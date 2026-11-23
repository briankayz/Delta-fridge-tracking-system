import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import { WebSocket } from 'ws';
import { createApp } from '../src/app.ts';
import { ServerEvent } from '../src/types.ts';

let base = '';
let wsUrl = '';
let close: () => Promise<void>;

before(async () => {
  const app = createApp({ ingestToken: 'secret' });
  close = app.close;
  await new Promise<void>((r) => app.server.listen(0, '127.0.0.1', r));
  const { port } = app.server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
  wsUrl = `ws://127.0.0.1:${port}/ws/telemetry`;
});
after(() => close());

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

const breach = (i: number) => ({
  device_id: 'DLTA-BCN-9042',
  speed_kmh: 38.5,
  gps: { latitude: -17.778 + i * 0.0001, longitude: 31.053 },
  power: { mains_connected: false, voltage_ac: 0, battery_level_pct: 92 },
  accelerometer: { tilt_deg: 14.8, vibration_status: 'Elevated' },
  // client-side fields that must be ignored:
  risk_score_pct: 1,
  geofence_breached: false,
});

test('GET /health and /api/v1/assets', async () => {
  assert.equal((await fetch(base + '/health')).status, 200);
  const body = await (await fetch(base + '/api/v1/assets')).json();
  assert.equal(body.summary.total, 1420);
  assert.equal(body.assets.length, 6);
});

test('POST /telemetry rejects bad token and invalid payloads', async () => {
  assert.equal((await post('/api/v1/telemetry', breach(0))).status, 401);
  const bad = await post('/api/v1/telemetry', { device_id: 'x' }, { 'x-device-token': 'secret' });
  assert.equal(bad.status, 400);
  assert.ok((await bad.json()).issues.length > 0);
});

test('breach stream over HTTP yields one incident.opened over WebSocket', async () => {
  const ws = new WebSocket(wsUrl);
  const events: ServerEvent[] = [];
  ws.on('message', (d) => events.push(JSON.parse(String(d))));
  await new Promise((r) => ws.once('open', r));

  let last: any;
  for (let i = 0; i < 5; i++) {
    const res = await post('/api/v1/telemetry', breach(i), { 'x-device-token': 'secret' });
    assert.equal(res.status, 202);
    last = await res.json();
  }
  await new Promise((r) => setTimeout(r, 100));
  ws.close();

  assert.equal(events[0].type, 'snapshot');
  assert.equal(events.filter((e) => e.type === 'incident.opened').length, 1);
  assert.equal(last.severity, 'critical');
  assert.ok(last.risk_score_pct >= 75, 'server recomputes risk, ignoring client value');
  assert.ok(last.incident_id);

  // reset resolves it and restores the anchor
  const reset = await (await post('/api/v1/assets/DLTA-BCN-9042/reset', { resolution: 'authorized' })).json();
  assert.equal(reset.incident.resolution, 'authorized');
  assert.equal(reset.asset.risk.severity, 'nominal');
});

test('simulate-breach drives the asset server-side and blocks device payloads', async () => {
  const res = await post('/api/v1/assets/DLTA-BCN-9402/simulate-breach', {});
  assert.equal(res.status, 202);
  const detail = await (await fetch(base + '/api/v1/assets/DLTA-BCN-9402')).json();
  assert.equal(detail.asset.risk.severity, 'critical');
  assert.ok(detail.incident);

  const dev = await (await post('/api/v1/telemetry', { ...breach(0), device_id: 'DLTA-BCN-9402' }, { 'x-device-token': 'secret' })).json();
  assert.equal(dev.accepted, false);

  await post('/api/v1/assets/DLTA-BCN-9402/reset', {});
  assert.equal((await post('/api/v1/assets/NOPE/simulate-breach', {})).status, 404);
});
