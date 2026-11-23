import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harareHour, isCurfew, RiskInput, scoreRisk } from '../src/riskEngine.ts';

const SHIFT = { open_hour: 7, close_hour: 22 };
const base: RiskInput = {
  distance_m: 3,
  geofence_radius_m: 50,
  speed_kmh: 0,
  mains_connected: true,
  mains_off_minutes: 0,
  vibration_status: 'Nominal',
  tilt_deg: 0.4,
  internal_temp_c: 3.8,
  target_max_temp_c: 6,
  local_hour: 14,
  shift: SHIFT,
};

test('stationary in-store cooler is nominal with zero risk', () => {
  const r = scoreRisk(base);
  assert.equal(r.score, 0);
  assert.equal(r.severity, 'nominal');
  assert.equal(r.confidence, 0);
  assert.equal(r.geofenceBreached, false);
});

test('daytime demo breach (2.4 km, unplugged, 38.5 km/h, shock) scores 90 critical', () => {
  const r = scoreRisk({ ...base, distance_m: 2420, speed_kmh: 38.5, mains_connected: false, vibration_status: 'Elevated', tilt_deg: 14.8, internal_temp_c: 5.6 });
  // geofence 40 + min(10, 10*(2420-100)/1000)=10 -> 50, transit cut 25, motion 10, shock 5
  assert.equal(r.score, 90);
  assert.equal(r.severity, 'critical');
  assert.equal(r.confidence, 99);
  assert.deepEqual(r.reasons.map((x) => x.code), ['GEOFENCE_BREACH', 'MAINS_CUT_IN_TRANSIT', 'MOTION', 'SHOCK_TILT']);
});

test('same breach after hours uses the night-time velocity weight and caps at 100', () => {
  const r = scoreRisk({ ...base, distance_m: 2420, speed_kmh: 38.5, mains_connected: false, vibration_status: 'Elevated', local_hour: 23 });
  assert.equal(r.score, 100);
  assert.ok(r.reasons.some((x) => x.code === 'CURFEW_MOTION'));
});

test('force_curfew applies the night weight during the day', () => {
  const r = scoreRisk({ ...base, speed_kmh: 10, force_curfew: true });
  assert.equal(r.reasons[0].code, 'CURFEW_MOTION');
  assert.equal(r.score, 20);
});

test('short outage in store is a low-risk observation', () => {
  const r = scoreRisk({ ...base, mains_connected: false, mains_off_minutes: 30 });
  assert.equal(r.score, 10);
  assert.equal(r.severity, 'nominal');
});

test('prolonged (8h) outage with warm cabinet is a warning, not a theft', () => {
  const r = scoreRisk({ ...base, mains_connected: false, mains_off_minutes: 495, internal_temp_c: 8.2 });
  assert.equal(r.score, 45);
  assert.equal(r.severity, 'warning');
});

test('GPS drift just outside the fence is flagged but stays nominal', () => {
  const r = scoreRisk({ ...base, distance_m: 70 });
  assert.equal(r.score, 20);
  assert.equal(r.severity, 'nominal');
  assert.equal(r.geofenceBreached, true);
});

test('unplugging while being moved inside the store still counts as transit', () => {
  const r = scoreRisk({ ...base, distance_m: 20, speed_kmh: 6, mains_connected: false });
  assert.ok(r.reasons.some((x) => x.code === 'MAINS_CUT_IN_TRANSIT'));
  assert.equal(r.score, 35);
});

test('curfew window wraps midnight', () => {
  assert.equal(isCurfew(23, SHIFT), true);
  assert.equal(isCurfew(3, SHIFT), true);
  assert.equal(isCurfew(7, SHIFT), false);
  assert.equal(isCurfew(21, SHIFT), false);
  assert.equal(isCurfew(22, SHIFT), true);
});

test('harareHour is UTC+2', () => {
  assert.equal(harareHour(new Date('2026-11-23T21:30:00Z')), 23);
  assert.equal(harareHour(new Date('2026-11-23T23:10:00Z')), 1);
});
