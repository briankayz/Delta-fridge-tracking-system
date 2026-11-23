import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { HubEvent, RESOLVE_AFTER_CALM } from '../src/services/fleet.ts';
import { breach, nominal, seedBasics, startTestApp } from './helpers.ts';

// Controllable clock: 14:00 Harare (trading hours) unless a test moves it.
let clock = new Date('2026-11-23T12:00:00Z');
const advance = (min: number) => (clock = new Date(clock.getTime() + min * 60_000));

let t: Awaited<ReturnType<typeof startTestApp>>;
const events: HubEvent[] = [];
const sys = { id: null, name: 'test' };

before(async () => {
  t = await startTestApp({ offlineAfterMin: 15 }, () => clock);
  await seedBasics(t.svc);
  t.svc.fleet.on((e) => events.push(e));
  for (const id of ['BCN-1', 'BCN-2', 'BCN-3', 'BCN-4', 'BCN-5']) {
    await t.svc.fleet.provision(id, { retailer_id: 'RET-A', anchor_lat: -17.79421, anchor_lng: 31.03784, geofence_radius_m: 50 }, sys);
  }
});
after(() => t.svc.close());

const count = (type: HubEvent['type']) => events.filter((e) => e.type === type).length;

test('unknown device is rejected', async () => {
  await assert.rejects(() => t.svc.fleet.ingest(nominal('NOPE-1')), /Unknown or decommissioned/);
});

test('nominal payload stays nominal and is stored', async () => {
  const { asset, risk } = await t.svc.fleet.ingest(nominal('BCN-1'));
  assert.equal(risk.severity, 'nominal');
  assert.equal(asset.online, true);
  assert.equal(asset.location_name, 'OK Avondale (in store)');
  const rows = await t.svc.db.query('SELECT * FROM telemetry WHERE asset_id = $1', ['BCN-1']);
  assert.equal(rows.length, 1);
});

test('a breach stream opens exactly one displacement incident', async () => {
  events.length = 0;
  advance(1);
  for (let i = 0; i < 6; i++) {
    await t.svc.fleet.ingest(breach('BCN-1', i));
    advance(1 / 60);
  }
  assert.equal(count('incident.opened'), 1);
  const asset = (await t.svc.fleet.asset('BCN-1'))!;
  assert.equal(asset.risk.score, 90);
  assert.equal(asset.open_incidents.length, 1);
  assert.equal(asset.open_incidents[0].kind, 'displacement');
  assert.match(asset.incident_id!, /^INC-\d{4}$/);
  assert.equal(asset.trail.length, 7); // anchor + 6 fixes
  await new Promise((r) => setTimeout(r, 100)); // notifications are sent after commit
  const notes = await t.svc.db.query<{ channel: string }>(`SELECT channel FROM notifications WHERE incident_id = $1`, [asset.incident_id]);
  assert.ok(notes.some((n) => n.channel === 'console'));
});

test(`displacement auto-resolves after ${RESOLVE_AFTER_CALM} calm payloads at home`, async () => {
  events.length = 0;
  const id = (await t.svc.fleet.asset('BCN-1'))!.incident_id!;
  for (let i = 0; i < RESOLVE_AFTER_CALM; i++) await t.svc.fleet.ingest(nominal('BCN-1'));
  assert.equal(count('incident.resolved'), 1);
  const row = await t.svc.db.one<{ status: string; resolution: string }>('SELECT status, resolution FROM incidents WHERE id = $1', [id]);
  assert.deepEqual(row, { status: 'resolved', resolution: 'returned' });
});

test('concurrent breach payloads still open a single incident (row lock)', async () => {
  await Promise.all([0, 1, 2, 3, 4].map((i) => t.svc.fleet.ingest(breach('BCN-2', i))));
  const open = await t.svc.db.query(`SELECT id FROM incidents WHERE asset_id = 'BCN-2' AND status <> 'resolved'`);
  assert.equal(open.length, 1);
});

test('a prolonged outage opens a power incident that closes when mains return', async () => {
  const off = { ...nominal('BCN-3'), power: { mains_connected: false, voltage_ac: 0, battery_level_pct: 80 } };
  await t.svc.fleet.ingest(off);
  advance(130);
  const { asset } = await t.svc.fleet.ingest(off);
  assert.equal(asset.risk.severity, 'warning');
  assert.equal(asset.open_incidents[0]?.kind, 'power');
  const after = await t.svc.fleet.ingest(nominal('BCN-3'));
  assert.equal(after.asset.open_incidents.length, 0);
});

test('a beacon that goes silent raises signal-lost; reporting again resolves it', async () => {
  await t.svc.fleet.ingest(nominal('BCN-4'));
  advance(16);
  // keep the others fresh so only BCN-4 is silent
  for (const id of ['BCN-1', 'BCN-2', 'BCN-3', 'BCN-5']) await t.svc.fleet.ingest(nominal(id));
  advance(1);
  await t.svc.fleet.ingest(nominal('BCN-5'));
  await t.svc.fleet.sweep();
  const silent = await t.svc.db.query<{ asset_id: string }>(`SELECT asset_id FROM incidents WHERE kind = 'signal_lost' AND status <> 'resolved'`);
  assert.ok(silent.some((s) => s.asset_id === 'BCN-4'));
  assert.ok(!silent.some((s) => s.asset_id === 'BCN-5'));
  const { asset } = await t.svc.fleet.ingest(nominal('BCN-4'));
  assert.ok(!asset.open_incidents.some((i) => i.kind === 'signal_lost'));
});

test('an approved relocation moves without a theft alert and re-anchors on arrival', async () => {
  const user = { id: 'x', email: 'x', name: 'Ops', role: 'ops_lead' as const, region: null };
  const rel = await t.svc.relocations.request({ asset_id: 'BCN-5', reason: 'Store refit', to_retailer_id: 'RET-B', hours: 4 }, user);
  await t.svc.relocations.decide(rel.id, true, user);
  const moving = await t.svc.fleet.ingest({ ...breach('BCN-5'), gps: { latitude: -17.82, longitude: 31.04 } });
  assert.equal(moving.risk.severity, 'warning');
  assert.ok(moving.risk.reasons.some((r) => r.code === 'AUTHORIZED_RELOCATION'));
  assert.ok(!moving.asset.open_incidents.some((i) => i.kind === 'displacement'));
  await t.svc.fleet.ingest(nominal('BCN-5', -17.858, 31.04));
  const a = (await t.svc.fleet.asset('BCN-5'))!;
  assert.deepEqual(a.anchor, { lat: -17.858, lng: 31.04 });
  assert.equal(a.retailer_id, 'RET-B');
  const done = await t.svc.db.one<{ status: string }>('SELECT status FROM relocations WHERE id = $1', [rel.id]);
  assert.equal(done!.status, 'completed');
});

test('summary counts only real registered assets', async () => {
  const { fleetSummary } = await import('../src/services/readModel.ts');
  const s = await fleetSummary(t.svc.db, { now: clock, offlineAfterMin: 15 });
  assert.equal(s.total, 5);
  assert.ok(s.anomalies >= 1);
});
