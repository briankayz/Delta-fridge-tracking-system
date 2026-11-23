// Demo-only traffic generators. Both push payloads through the normal FleetService.ingest path,
// so everything downstream (risk, incidents, notifications, audit) behaves exactly as in production.
//   - BreachSimulator: 1 Hz theft run for one asset (dashboard "Demo: simulate breach").
//   - VirtualFleet:    heartbeats for assets flagged is_virtual (seeded demo coolers).
import { Db } from './db/index.ts';
import { destinationPoint } from './geo.ts';
import { TelemetryPayload } from './schema.ts';
import { FleetService } from './services/fleet.ts';
import { log } from './util.ts';

export const SIM_BEARING_DEG = 42;
export const SIM_START_OFFSET_M = 2400;
export const SIM_SPEED_KMH = 38.5;
const SIM_MAX_TICKS = 180;

interface Anchor {
  id: string;
  anchor: { lat: number; lng: number };
  battery_pct: number | null;
}

export function simulatedBreachPayload(asset: Anchor, tick: number): TelemetryPayload {
  const metresPerSecond = (SIM_SPEED_KMH * 1000) / 3600;
  const pos = destinationPoint(asset.anchor.lat, asset.anchor.lng, SIM_BEARING_DEG, SIM_START_OFFSET_M + tick * metresPerSecond);
  const jitter = () => Math.random() * 1.6 - 0.8;
  return {
    device_id: asset.id,
    status: 'BREACH_ALERT',
    speed_kmh: Number((SIM_SPEED_KMH + jitter()).toFixed(1)),
    bearing_deg: SIM_BEARING_DEG,
    gps: { latitude: Number(pos.lat.toFixed(6)), longitude: Number(pos.lng.toFixed(6)), accuracy_m: 2.8 },
    power: { mains_connected: false, voltage_ac: 0, battery_level_pct: Math.max(0, Math.round((asset.battery_pct ?? 92) - tick / 60)) },
    accelerometer: { tilt_deg: 14.8, vibration_status: 'Elevated' },
    cold_chain: { internal_temp_c: Number((5.6 + tick * 0.01).toFixed(1)), target_max_temp_c: 6 },
  };
}

export class BreachSimulator {
  private runs = new Map<string, ReturnType<typeof setInterval>>();

  constructor(private readonly fleet: FleetService) {}

  isRunning(id: string) {
    return this.runs.has(id);
  }

  start(asset: Anchor) {
    this.stop(asset.id);
    let tick = 0;
    const step = () => {
      const t = tick++;
      if (t >= SIM_MAX_TICKS) return this.stop(asset.id);
      this.fleet.ingest(simulatedBreachPayload(asset, t)).catch((err) => log.error('breach sim ingest failed', { error: (err as Error).message }));
    };
    this.fleet.simulating.add(asset.id);
    this.runs.set(asset.id, setInterval(step, 1000));
    step();
  }

  stop(id: string) {
    const t = this.runs.get(id);
    if (t) clearInterval(t);
    this.runs.delete(id);
    this.fleet.simulating.delete(id);
  }

  stopAll() {
    for (const id of [...this.runs.keys()]) this.stop(id);
  }
}

/**
 * demo_scenario values:
 *   null / 'nominal'          in store, on mains
 *   'outage'                  in store, mains off (becomes a prolonged outage)
 *   'stolen:<lat>,<lng>'      parked away from the store, unplugged
 */
export function virtualPayload(a: { id: string; anchor_lat: number; anchor_lng: number; demo_scenario: string | null }): TelemetryPayload {
  const j = () => (Math.random() - 0.5) * 0.00003;
  const scenario = a.demo_scenario ?? 'nominal';
  if (scenario.startsWith('stolen:')) {
    const [lat, lng] = scenario.slice(7).split(',').map(Number);
    return {
      device_id: a.id,
      speed_kmh: 0,
      gps: { latitude: lat + j(), longitude: lng + j() },
      power: { mains_connected: false, voltage_ac: 0, battery_level_pct: 78 },
      accelerometer: { tilt_deg: 1.2, vibration_status: 'Nominal' },
      cold_chain: { internal_temp_c: 9.4, target_max_temp_c: 6 },
    };
  }
  const outage = scenario === 'outage';
  return {
    device_id: a.id,
    speed_kmh: 0,
    gps: { latitude: a.anchor_lat + j(), longitude: a.anchor_lng + j() },
    power: outage ? { mains_connected: false, voltage_ac: 0, battery_level_pct: 61 } : { mains_connected: true, voltage_ac: 230 + Math.round(Math.random() * 8), battery_level_pct: 98 },
    accelerometer: { tilt_deg: 0.4, vibration_status: 'Nominal' },
    cold_chain: { internal_temp_c: outage ? 8.2 : Number((3 + Math.random()).toFixed(1)), target_max_temp_c: 6 },
  };
}

export class VirtualFleet {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly db: Db, private readonly fleet: FleetService) {}

  async tick() {
    const assets = await this.db.query<{ id: string; anchor_lat: number; anchor_lng: number; demo_scenario: string | null }>(
      `SELECT id, anchor_lat, anchor_lng, demo_scenario FROM assets WHERE is_virtual AND status = 'active'`
    );
    for (const a of assets) {
      if (this.fleet.simulating.has(a.id)) continue;
      await this.fleet.ingest(virtualPayload(a)).catch((err) => log.error('virtual fleet ingest failed', { id: a.id, error: (err as Error).message }));
    }
  }

  start(everyMs = 30_000) {
    this.stop();
    this.timer = setInterval(() => void this.tick(), everyMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
