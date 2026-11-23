// Demo data (DEMO_MODE=1 only). Everything created here is flagged is_virtual, except the
// Phone A beacon DLTA-BCN-9042, which a technician provisions from the mobile app.
import { Config } from './config.ts';
import { Db } from './db/index.ts';
import { FleetService } from './services/fleet.ts';
import { UserService } from './services/users.ts';
import { VirtualFleet } from './simulator.ts';
import { log } from './util.ts';
import { SYSTEM } from './services/audit.ts';

export const DEMO_BEACON_ID = 'DLTA-BCN-9042';

const AREAS: { suburb: string; region: string; lat: number; lng: number }[] = [
  { suburb: 'Avondale', region: 'Harare North', lat: -17.795, lng: 31.038 },
  { suburb: 'Borrowdale', region: 'Harare North', lat: -17.754, lng: 31.085 },
  { suburb: 'Mount Pleasant', region: 'Harare North', lat: -17.77, lng: 31.045 },
  { suburb: 'Marlborough', region: 'Harare North', lat: -17.755, lng: 31.02 },
  { suburb: 'CBD', region: 'Harare Central', lat: -17.8292, lng: 31.0522 },
  { suburb: 'Milton Park', region: 'Harare Central', lat: -17.816, lng: 31.03 },
  { suburb: 'Belvedere', region: 'Harare Central', lat: -17.827, lng: 31.015 },
  { suburb: 'Eastlea', region: 'Harare East', lat: -17.823, lng: 31.075 },
  { suburb: 'Greendale', region: 'Harare East', lat: -17.813, lng: 31.1 },
  { suburb: 'Tafara', region: 'Harare East', lat: -17.81, lng: 31.15 },
  { suburb: 'Mbare', region: 'Harare South', lat: -17.858, lng: 31.04 },
  { suburb: 'Highfield', region: 'Harare South', lat: -17.878, lng: 30.997 },
];
const OUTLETS = ['Bottle Store', 'Supermarket', 'Tuckshop', 'Service Station', 'Bar & Grill'];
const MODELS = ['Double-door display cooler', 'Single-door chiller', 'Countertop cooler', 'Visual merchandiser'];

/** Deterministic PRNG so every demo database looks the same. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export async function seedDemo(db: Db, cfg: Config, fleet: FleetService, users: UserService): Promise<boolean> {
  const existing = await db.one<{ n: number }>('SELECT count(*)::int AS n FROM assets');
  if (existing!.n > 0) return false;
  const rand = rng(42);

  // ---- people (one per role) ----
  const people: [string, string, string, string | null][] = [
    ['admin@delta.demo', 'Demo Administrator', 'admin', null],
    ['ops@delta.demo', 'Fleet Operations Lead', 'ops_lead', null],
    ['north.manager@delta.demo', 'Area Manager · Harare North', 'area_manager', 'Harare North'],
    ['security@delta.demo', 'Asset Protection Officer', 'asset_protection', null],
    ['tech@delta.demo', 'Field Technician', 'technician', null],
    ['viewer@delta.demo', 'Read-only Viewer', 'viewer', null],
  ];
  for (const [email, name, role, region] of people) {
    await users.create({ email, name, role: role as any, region, password: cfg.demoPassword }, SYSTEM);
  }

  await db.tx(async (q) => {
    // ---- Phone A's store ----
    await q.query(
      `INSERT INTO retailers (id, name, region, address, contact_name, contact_phone, lat, lng)
       VALUES ('RET-HRE-0419','OK Supermarket - Avondale','Harare North','Avondale Shopping Centre, King George Rd','Store manager',NULL,-17.79421,31.03784)`
    );
    await q.query(
      `INSERT INTO assets (id, cooler_serial, model, asset_type, imei, retailer_id, anchor_lat, anchor_lng, geofence_radius_m)
       VALUES ($1,'DLT-COOLER-8821','Industrial Refrig-V4','Double-door display cooler','864920041289123','RET-HRE-0419',-17.79421,31.03784,50)`,
      [DEMO_BEACON_ID]
    );

    // ---- virtual demo fleet ----
    let n = 0;
    for (const area of AREAS) {
      const outlets = 3;
      for (let k = 0; k < outlets; k++) {
        n++;
        const lat = area.lat + (rand() - 0.5) * 0.02;
        const lng = area.lng + (rand() - 0.5) * 0.02;
        const retailerId = `RET-DEMO-${String(n).padStart(3, '0')}`;
        await q.query(
          `INSERT INTO retailers (id, name, region, contact_name, lat, lng) VALUES ($1,$2,$3,$4,$5,$6)`,
          [retailerId, `${area.suburb} ${OUTLETS[(n + k) % OUTLETS.length]}`, area.region, 'Outlet owner', lat, lng]
        );
        const scenario = n === 7 ? 'outage' : n === 14 ? 'stolen:-17.8641,31.0024' : null;
        await q.query(
          `INSERT INTO assets (id, cooler_serial, model, asset_type, retailer_id, anchor_lat, anchor_lng, geofence_radius_m, is_virtual, demo_scenario)
           VALUES ($1,$2,$3,$3,$4,$5,$6,$7,true,$8)`,
          [`DEMO-BCN-${String(n).padStart(3, '0')}`, `DLT-C-${10_000 + n}`, MODELS[n % MODELS.length], retailerId, lat, lng, n % 3 === 0 ? 100 : 50, scenario]
        );
      }
    }
  });

  // First heartbeat, then back-date the outage so it reads as "8 h unplugged" and opens a power incident.
  const vf = new VirtualFleet(db, fleet);
  await vf.tick();
  await db.query(
    `UPDATE asset_state SET mains_off_since = now() - interval '8 hours 15 minutes'
      WHERE asset_id IN (SELECT id FROM assets WHERE demo_scenario = 'outage')`
  );
  await vf.tick();

  log.info('Demo data created', {
    beacons: (await db.one<{ n: number }>('SELECT count(*)::int AS n FROM assets'))!.n,
    logins: people.map((p) => p[0]),
    password: cfg.demoPassword,
  });
  return true;
}
