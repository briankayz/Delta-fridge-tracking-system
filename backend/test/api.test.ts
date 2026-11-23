import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { breach, nominal, seedBasics, startTestApp, PASSWORD } from './helpers.ts';

let t: Awaited<ReturnType<typeof startTestApp>>;
const tok: Record<string, string> = {};
let deviceToken = '';

before(async () => {
  t = await startTestApp();
  await seedBasics(t.svc);
  for (const r of ['admin', 'ops_lead', 'area_manager', 'asset_protection', 'technician', 'viewer']) tok[r] = await t.login(`${r}@test.local`);
});
after(() => t.svc.close());

test('public endpoints and auth wall', async () => {
  assert.equal((await t.call('GET', '/health')).status, 200);
  assert.equal((await t.call('GET', '/api/v1/meta')).body.demo_mode, true);
  assert.equal((await t.call('GET', '/api/v1/assets')).status, 401);
  assert.equal((await t.call('POST', '/api/v1/auth/login', { email: 'viewer@test.local', password: 'wrong-password-1' })).status, 401);
  const me = await t.call('GET', '/api/v1/auth/me', undefined, tok.viewer);
  assert.equal(me.body.user.role, 'viewer');
  assert.ok(!me.body.permissions.includes('incident:act'));
});

test('login is rate limited', async () => {
  let last = 0;
  for (let i = 0; i < 11; i++) last = (await t.call('POST', '/api/v1/auth/login', { email: 'nobody@test.local', password: 'x' })).status;
  assert.equal(last, 429);
});

test('provisioning issues a device credential that telemetry requires', async () => {
  const body = { retailer_id: 'RET-A', anchor_lat: -17.79421, anchor_lng: 31.03784, geofence_radius_m: 50 };
  assert.equal((await t.call('POST', '/api/v1/assets/BCN-9042/provision', body, tok.viewer)).status, 403);
  const p = await t.call('POST', '/api/v1/assets/BCN-9042/provision', body, tok.technician);
  assert.equal(p.status, 200);
  deviceToken = p.body.device_token;
  assert.match(deviceToken, /^dag_dev_/);

  assert.equal((await t.call('POST', '/api/v1/telemetry', nominal('BCN-9042'))).status, 401);
  assert.equal((await t.call('POST', '/api/v1/telemetry', nominal('BCN-9042'), undefined, { authorization: 'Device dag_dev_wrong' })).status, 401);
  const ok = await t.call('POST', '/api/v1/telemetry', nominal('BCN-9042'), undefined, { authorization: `Device ${deviceToken}` });
  assert.equal(ok.status, 202);
  assert.equal(ok.body.severity, 'nominal');
  const bad = await t.call('POST', '/api/v1/telemetry', { device_id: 'BCN-9042' }, undefined, { authorization: `Device ${deviceToken}` });
  assert.equal(bad.status, 400);
});

test('WebSocket requires a session and streams one incident.opened per breach', async () => {
  const wsUrl = t.base.replace('http', 'ws') + '/ws/telemetry';
  const denied = new WebSocket(wsUrl);
  const code = await new Promise((r) => denied.on('unexpected-response', (_req, res) => r(res.statusCode)).on('error', () => r('error')));
  assert.equal(code, 401);

  const ws = new WebSocket(`${wsUrl}?token=${tok.ops_lead}`);
  const msgs: any[] = [];
  ws.on('message', (d) => msgs.push(JSON.parse(String(d))));
  await new Promise((r) => ws.once('open', r));
  for (let i = 0; i < 4; i++) {
    const r = await t.call('POST', '/api/v1/telemetry', breach('BCN-9042', i), undefined, { authorization: `Device ${deviceToken}` });
    assert.equal(r.status, 202);
    await new Promise((res) => setTimeout(res, 220)); // stay under the per-device rate limit
  }
  await new Promise((r) => setTimeout(r, 200));
  ws.close();
  assert.equal(msgs[0].type, 'snapshot');
  assert.equal(msgs.filter((m) => m.type === 'incident.opened').length, 1);
  assert.equal(msgs.at(-1).summary.anomalies, 1);
});

test('incident workflow: acknowledge, assign, note, dispatch, field update, resolve', async () => {
  const list = await t.call('GET', '/api/v1/incidents?status=open', undefined, tok.ops_lead);
  const inc = list.body.find((i: any) => i.asset_id === 'BCN-9042');
  assert.ok(inc);
  const id = inc.id;

  assert.equal((await t.call('POST', `/api/v1/incidents/${id}/acknowledge`, {}, tok.viewer)).status, 403);
  const ack = await t.call('POST', `/api/v1/incidents/${id}/acknowledge`, {}, tok.asset_protection);
  assert.equal(ack.body.status, 'acknowledged');

  const people = await t.call('GET', '/api/v1/users/assignable', undefined, tok.ops_lead);
  const ap = people.body.find((u: any) => u.role === 'asset_protection');
  assert.equal((await t.call('POST', `/api/v1/incidents/${id}/assign`, { user_id: ap.id }, tok.ops_lead)).body.assigned_name, 'asset_protection user');
  await t.call('POST', `/api/v1/incidents/${id}/notes`, { message: 'Called the store manager' }, tok.ops_lead);
  await t.call('POST', `/api/v1/incidents/${id}/dispatch`, { note: 'Unit 4' }, tok.ops_lead);
  const field = await t.call('POST', `/api/v1/incidents/${id}/field-update`, { outcome: 'not_found', note: 'Truck gone' }, tok.technician);
  assert.equal(field.status, 200);

  const done = await t.call('POST', `/api/v1/incidents/${id}/field-update`, { outcome: 'recovered', note: 'Found in Mt Pleasant' }, tok.asset_protection);
  assert.equal(done.body.status, 'resolved');
  assert.equal(done.body.resolution, 'recovered');
  const types = done.body.events.map((e: any) => e.type);
  for (const tpe of ['opened', 'acknowledged', 'assigned', 'note', 'dispatched', 'field_update', 'resolved']) assert.ok(types.includes(tpe), tpe);
  assert.equal((await t.call('POST', `/api/v1/incidents/${id}/resolve`, { resolution: 'false_alarm' }, tok.ops_lead)).status, 409);

  const notes = await t.call('GET', '/api/v1/notifications', undefined, tok.ops_lead);
  assert.ok(notes.body.some((n: any) => n.incident_id === id && n.channel === 'console'));
  assert.equal((await t.call('GET', '/api/v1/notifications', undefined, tok.technician)).status, 403);
});

test('regional managers only see their region', async () => {
  await t.svc.fleet.provision('BCN-SOUTH', { retailer_id: 'RET-B', anchor_lat: -17.858, anchor_lng: 31.04 }, { id: null, name: 't' });
  const north = await t.call('GET', '/api/v1/assets', undefined, tok.area_manager);
  assert.ok(north.body.assets.every((a: any) => a.region === 'Harare North'));
  assert.equal((await t.call('GET', '/api/v1/assets/BCN-SOUTH', undefined, tok.area_manager)).status, 404);
  assert.equal((await t.call('GET', '/api/v1/assets/BCN-SOUTH', undefined, tok.ops_lead)).status, 200);
});

test('cooler register import validates rows and upserts', async () => {
  const csv = [
    'device_id,retailer_name,region,lat,lng,contact_phone,geofence_radius_m',
    'REG-001,Borrowdale Spar,Harare North,-17.754,31.085,+263 77 111 2222,75',
    'REG-002,"Eastlea Bottle Store, Main St",Harare East,-17.823,31.075,,',
    'BAD ID,Nowhere,Harare,999,31,,',
    'REG-001,Duplicate,Harare,-17.7,31.0,,',
  ].join('\n');
  assert.equal((await t.call('POST', '/api/v1/register/import', { csv }, tok.technician)).status, 403);
  const dry = await t.call('POST', '/api/v1/register/import', { csv, dry_run: true }, tok.ops_lead);
  assert.equal(dry.body.assets_created, 0);
  assert.equal(dry.body.errors.length, 2);
  const real = await t.call('POST', '/api/v1/register/import', { csv }, tok.ops_lead);
  assert.equal(real.body.assets_created, 2);
  const again = await t.call('POST', '/api/v1/register/import', { csv }, tok.ops_lead);
  assert.equal(again.body.assets_updated, 2);
  const missing = await t.call('POST', '/api/v1/register/import', { csv: 'device_id,lat\nX,1' }, tok.ops_lead);
  assert.equal(missing.status, 400);
  const tpl = await t.call('GET', '/api/v1/register/template.csv', undefined, tok.viewer);
  assert.match(String(tpl.body), /^device_id,cooler_serial/);
});

test('user management and session revocation', async () => {
  assert.equal((await t.call('GET', '/api/v1/users', undefined, tok.ops_lead)).status, 403);
  const weak = await t.call('POST', '/api/v1/users', { email: 'new@test.local', name: 'New Person', role: 'viewer', password: 'short' }, tok.admin);
  assert.equal(weak.status, 400);
  const created = await t.call('POST', '/api/v1/users', { email: 'new@test.local', name: 'New Person', role: 'viewer', password: PASSWORD }, tok.admin);
  assert.equal(created.status, 201);
  const newTok = await t.login('new@test.local');
  assert.equal((await t.call('GET', '/api/v1/auth/me', undefined, newTok)).status, 200);
  await t.call('PATCH', `/api/v1/users/${created.body.id}`, { active: false }, tok.admin);
  assert.equal((await t.call('GET', '/api/v1/auth/me', undefined, newTok)).status, 401);
  const self = await t.call('GET', '/api/v1/auth/me', undefined, tok.admin);
  assert.equal((await t.call('PATCH', `/api/v1/users/${self.body.user.id}`, { role: 'viewer' }, tok.admin)).status, 400);
});

test('audit trail, CSV export, reports and demo controls', async () => {
  const audit = await t.call('GET', '/api/v1/audit', undefined, tok.admin);
  const actions = new Set(audit.body.map((a: any) => a.action));
  for (const a of ['auth.login', 'auth.login_failed', 'asset.provisioned', 'incident.resolved', 'register.imported', 'user.created']) assert.ok(actions.has(a), a);

  const csv = await t.call('GET', '/api/v1/incidents/export.csv', undefined, tok.viewer);
  assert.match(String(csv.body), /^incident,asset,kind/);

  const report = await t.call('GET', '/api/v1/reports/summary?days=30', undefined, tok.viewer);
  assert.ok(report.body.regions.some((r: any) => r.region === 'Harare North' && r.recovered >= 1));

  assert.equal((await t.call('POST', '/api/v1/assets/BCN-9042/simulate-breach', {}, tok.technician)).status, 403);
  assert.equal((await t.call('POST', '/api/v1/assets/BCN-9042/simulate-breach', {}, tok.ops_lead)).status, 202);
  await new Promise((r) => setTimeout(r, 300));
  const during = await t.call('GET', '/api/v1/assets/BCN-9042', undefined, tok.ops_lead);
  assert.equal(during.body.asset.risk.severity, 'critical');
  assert.equal(during.body.asset.simulation_active, true);
  const blocked = await t.call('POST', '/api/v1/telemetry', nominal('BCN-9042'), undefined, { authorization: `Device ${deviceToken}` });
  assert.equal(blocked.body.accepted, false);
  assert.equal((await t.call('POST', '/api/v1/assets/BCN-9042/demo-reset', {}, tok.ops_lead)).status, 200);
  const after = await t.call('GET', '/api/v1/assets/BCN-9042', undefined, tok.ops_lead);
  assert.equal(after.body.asset.risk.severity, 'nominal');
  assert.equal(after.body.asset.open_incidents.filter((i: any) => i.kind === 'displacement').length, 0);
});

test('self-service password change signs out other sessions', async () => {
  const email = 'viewer@test.local';
  const other = await t.login(email);
  const mine = await t.login(email);
  assert.equal((await t.call('POST', '/api/v1/auth/change-password', { current_password: 'wrong', new_password: 'Another-Pass-456' }, mine)).status, 400);
  assert.equal((await t.call('POST', '/api/v1/auth/change-password', { current_password: PASSWORD, new_password: 'short' }, mine)).status, 400);
  const ok = await t.call('POST', '/api/v1/auth/change-password', { current_password: PASSWORD, new_password: 'Another-Pass-456' }, mine);
  assert.equal(ok.status, 200);
  assert.equal((await t.call('GET', '/api/v1/auth/me', undefined, other)).status, 401);
  assert.equal((await t.call('GET', '/api/v1/auth/me', undefined, ok.body.token)).status, 200);
  assert.equal((await t.call('POST', '/api/v1/auth/login', { email, password: 'Another-Pass-456' })).status, 200);
});

test('serves the built dashboard with a strict CSP when present', async () => {
  const res = await fetch(`${t.base}/incidents/INC-1`);
  if (!t.cfg.webDist || res.status === 404) return; // web app not built in this checkout
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<div id="root">/);
  assert.match(res.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
  assert.equal((await fetch(`${t.base}/api/v1/nope`)).status, 404);
});
