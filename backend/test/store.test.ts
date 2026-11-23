import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FleetStore, RESOLVE_AFTER_CALM } from '../src/store.ts';
import { FLEET_BASELINE, seedFleet, DEMO_BEACON_ID } from '../src/seed.ts';
import { simulatedBreachPayload } from '../src/simulator.ts';
import { TelemetryPayload } from '../src/schema.ts';

// Fixed daytime clock (14:00 Harare) so curfew rules are deterministic.
const fixedNow = () => new Date('2026-11-23T12:00:00Z');

function makeStore() {
  const store = new FleetStore({ baseline: FLEET_BASELINE, now: fixedNow });
  seedFleet(store, fixedNow());
  return store;
}

const home = (id: string, lat: number, lng: number): TelemetryPayload => ({
  device_id: id,
  speed_kmh: 0,
  gps: { latitude: lat, longitude: lng },
  power: { mains_connected: true },
});

test('seeded summary equals the fleet baseline', () => {
  assert.deepEqual(makeStore().summary(), FLEET_BASELINE);
});

test('seeded risk states are computed, not hardcoded', () => {
  const s = makeStore();
  assert.equal(s.get('DLTA-BCN-8821')!.risk.severity, 'critical');
  assert.ok(s.get('DLTA-BCN-8821')!.incident_id);
  assert.equal(s.get('DLTA-BCN-4012')!.risk.severity, 'warning');
  assert.equal(s.get(DEMO_BEACON_ID)!.risk.score, 0);
});

test('10 breach payloads open exactly one incident and move KPIs once', () => {
  const s = makeStore();
  const asset = s.get(DEMO_BEACON_ID)!;
  const types: string[] = [];
  for (let i = 0; i < 10; i++) {
    types.push(...s.ingest(simulatedBreachPayload(asset, i)).events.map((e) => e.type));
  }
  assert.equal(types.filter((t) => t === 'incident.opened').length, 1);
  assert.equal(types[0], 'incident.opened');
  assert.equal(types.filter((t) => t === 'asset.updated').length, 9);

  const sum = s.summary();
  assert.equal(sum.anomalies, FLEET_BASELINE.anomalies + 1);
  assert.equal(sum.outages, FLEET_BASELINE.outages + 1);
  assert.equal(sum.compliant, FLEET_BASELINE.compliant - 1);
  assert.equal(sum.total, FLEET_BASELINE.total);

  const a = s.get(DEMO_BEACON_ID)!;
  assert.equal(a.risk.score, 90);
  assert.ok(a.distance_m > 2400 && a.distance_m < 2600, `distance ${a.distance_m}`);
  assert.equal(a.trail.length, 11); // anchor + 10 fixes
  assert.match(a.location_name, /^Near .+ \(\+2\.\d km\)$/);
});

test(`incident auto-resolves after ${RESOLVE_AFTER_CALM} calm payloads back home`, () => {
  const s = makeStore();
  const asset = s.get(DEMO_BEACON_ID)!;
  s.ingest(simulatedBreachPayload(asset, 0));
  const id = asset.incident_id!;
  const back = home(DEMO_BEACON_ID, asset.anchor.lat, asset.anchor.lng);
  assert.equal(s.ingest(back).events[0].type, 'asset.updated');
  assert.equal(s.ingest(back).events[0].type, 'asset.updated');
  const ev = s.ingest(back).events[0];
  assert.equal(ev.type, 'incident.resolved');
  assert.equal(s.getIncident(id)!.resolution, 'returned');
  assert.equal(s.get(DEMO_BEACON_ID)!.incident_id, null);
  assert.deepEqual(s.summary(), FLEET_BASELINE);
});

test('mains_off_since persists across consecutive outage payloads', () => {
  const s = makeStore();
  const since = s.get('DLTA-BCN-4012')!.mains_off_since;
  s.ingest({ ...home('DLTA-BCN-4012', -17.8182, 31.0489), power: { mains_connected: false } });
  assert.equal(s.get('DLTA-BCN-4012')!.mains_off_since, since);
  s.ingest(home('DLTA-BCN-4012', -17.8182, 31.0489));
  assert.equal(s.get('DLTA-BCN-4012')!.mains_off_since, null);
});

test('unknown device auto-registers anchored at its first fix', () => {
  const s = makeStore();
  const { asset } = s.ingest(home('DLTA-BCN-7777', -17.8, 31.0));
  assert.deepEqual(asset.anchor, { lat: -17.8, lng: 31.0 });
  assert.equal(asset.risk.score, 0);
  assert.equal(s.summary().total, FLEET_BASELINE.total + 1);
});

test('provision moves the anchor so a phone anywhere can start nominal', () => {
  const s = makeStore();
  s.provision(DEMO_BEACON_ID, { anchor_lat: 51.5, anchor_lng: -0.12, geofence_radius_m: 75 });
  const { asset } = s.ingest(home(DEMO_BEACON_ID, 51.5001, -0.1201));
  assert.equal(asset.risk.severity, 'nominal');
  assert.equal(asset.geofence_radius_m, 75);
});
