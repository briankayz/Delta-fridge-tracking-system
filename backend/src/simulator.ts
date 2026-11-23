// Server-side breach simulation for POST /api/v1/assets/:id/simulate-breach.
// Produces a realistic 1 Hz stream (unplugged, moving away from the anchor on bearing 42°)
// and pushes it through the normal ingest pipeline, so the dashboard demo works without Phone A.

import { destinationPoint } from './geo.ts';
import { TelemetryPayload } from './schema.ts';
import { AssetState } from './types.ts';

export const SIM_BEARING_DEG = 42;
export const SIM_START_OFFSET_M = 2400;
export const SIM_SPEED_KMH = 38.5;
const SIM_MAX_TICKS = 180; // stop after 3 minutes

export function simulatedBreachPayload(asset: AssetState, tick: number): TelemetryPayload {
  const metresPerSecond = (SIM_SPEED_KMH * 1000) / 3600;
  const pos = destinationPoint(asset.anchor.lat, asset.anchor.lng, SIM_BEARING_DEG, SIM_START_OFFSET_M + tick * metresPerSecond);
  const jitter = () => Math.random() * 1.6 - 0.8;
  return {
    device_id: asset.id,
    status: 'BREACH_ALERT',
    speed_kmh: Number((SIM_SPEED_KMH + jitter()).toFixed(1)),
    bearing_deg: SIM_BEARING_DEG,
    gps: { latitude: Number(pos.lat.toFixed(6)), longitude: Number(pos.lng.toFixed(6)), accuracy_m: 2.8 },
    power: { mains_connected: false, voltage_ac: 0, battery_level_pct: Math.max(0, (asset.battery_pct ?? 92) - (tick % 60 === 59 ? 1 : 0)) },
    accelerometer: { tilt_deg: 14.8, vibration_status: 'Elevated' },
    cold_chain: { internal_temp_c: Number((5.6 + tick * 0.01).toFixed(1)), target_max_temp_c: 6 },
  };
}

export class BreachSimulator {
  private runs = new Map<string, { timer: NodeJS.Timeout; tick: number }>();

  constructor(private readonly emit: (payload: TelemetryPayload) => void, private readonly onStop: (id: string) => void) {}

  isRunning(id: string): boolean {
    return this.runs.has(id);
  }

  start(asset: AssetState): void {
    this.stop(asset.id);
    const run = { tick: 0, timer: undefined as unknown as NodeJS.Timeout };
    const step = () => {
      this.emit(simulatedBreachPayload(asset, run.tick));
      run.tick += 1;
      if (run.tick >= SIM_MAX_TICKS) this.stop(asset.id);
    };
    run.timer = setInterval(step, 1000);
    this.runs.set(asset.id, run);
    step();
  }

  stop(id: string): void {
    const run = this.runs.get(id);
    if (!run) return;
    clearInterval(run.timer);
    this.runs.delete(id);
    this.onStop(id);
  }

  stopAll(): void {
    for (const id of [...this.runs.keys()]) this.stop(id);
  }
}
