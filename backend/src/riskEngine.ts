// Rule-based "AI" risk engine. Pure and deterministic so it can be unit-tested and explained
// line-by-line to operators: every point in the score comes with a human-readable reason.
//
//   Signal       Condition                                                   Points
//   Geofence     radius < d <= 2*radius  (drift / in-store reposition)          20
//                d > 2*radius                                40 + up to 10 by distance (full at +1 km)
//   AC power     mains cut, stationary, inside fence, < 2 h                     10
//                mains cut, stationary, inside fence, >= 2 h                    40
//                mains cut while moving (speed >= 5 km/h or d > 2*radius)        25
//   Velocity     speed >= 5 km/h inside trading hours                           10
//                speed >= 5 km/h during curfew (store closed)                   20
//   Shock/tilt   MPU-6050 vibration "Elevated" or tilt > 10 deg                  5
//   Cold chain   internal temperature above target max                           5
//
//   Score is capped at 100. Severity: >= 75 critical, >= 40 warning, else nominal.
//   Confidence: 0 below 40, otherwise min(99, 50 + 12.5 per independent signal family firing)
//   (families: geofence, power, velocity, shock).

import { RiskReason, RiskResult, Severity, ShiftWindow } from './types.ts';

export const MOVING_KMH = 5;
export const PROLONGED_OUTAGE_MIN = 120;
export const CRITICAL_THRESHOLD = 75;
export const WARNING_THRESHOLD = 40;

export interface RiskInput {
  distance_m: number;
  geofence_radius_m: number;
  speed_kmh: number;
  mains_connected: boolean;
  mains_off_minutes: number;   // 0 when connected
  vibration_status?: string | null;
  tilt_deg?: number | null;
  internal_temp_c?: number | null;
  target_max_temp_c?: number | null;
  local_hour: number;          // 0..23, Africa/Harare
  shift: ShiftWindow;
  force_curfew?: boolean;
}

export function isCurfew(hour: number, shift: ShiftWindow): boolean {
  const { open_hour, close_hour } = shift;
  // Window that wraps midnight, e.g. closed 22:00 -> 07:00
  return open_hour < close_hour ? hour < open_hour || hour >= close_hour : hour >= close_hour && hour < open_hour;
}

/** Hour in Africa/Harare (CAT, UTC+2, no daylight saving). */
export function harareHour(date: Date): number {
  return (date.getUTCHours() + 2) % 24;
}

const fmtKm = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

export function scoreRisk(input: RiskInput): RiskResult {
  const reasons: RiskReason[] = [];
  const r = Math.max(1, input.geofence_radius_m);
  const d = Math.max(0, input.distance_m);
  const moving = input.speed_kmh >= MOVING_KMH;
  const farOut = d > 2 * r;
  const curfew = input.force_curfew || isCurfew(input.local_hour, input.shift);

  // 1. Geofence
  if (farOut) {
    const extra = Math.min(10, (10 * (d - 2 * r)) / 1000);
    reasons.push({
      code: 'GEOFENCE_BREACH',
      label: 'Geofence breach',
      detail: `Cooler is ${fmtKm(d)} from its store anchor, outside the ${r} m geofence.`,
      points: Math.round(40 + extra),
    });
  } else if (d > r) {
    reasons.push({
      code: 'GEOFENCE_DRIFT',
      label: 'Geofence drift',
      detail: `Cooler is ${fmtKm(d)} from anchor, just outside the ${r} m radius (possible GPS drift or in-store move).`,
      points: 20,
    });
  }

  // 2. AC mains power
  if (!input.mains_connected) {
    if (moving || farOut) {
      reasons.push({
        code: 'MAINS_CUT_IN_TRANSIT',
        label: 'AC power cut during transit',
        detail: 'Mains supply disconnected while the cooler is moving or displaced, consistent with unplugging for removal.',
        points: 25,
      });
    } else if (input.mains_off_minutes >= PROLONGED_OUTAGE_MIN) {
      const h = (input.mains_off_minutes / 60).toFixed(1);
      reasons.push({
        code: 'MAINS_OUTAGE_PROLONGED',
        label: 'Prolonged AC outage',
        detail: `Mains supply off for ${h} h while stationary in store; cooler running on battery backup.`,
        points: 40,
      });
    } else {
      reasons.push({
        code: 'MAINS_OUTAGE',
        label: 'AC outage',
        detail: 'Mains supply disconnected while stationary in store.',
        points: 10,
      });
    }
  }

  // 3. Velocity, weighted by time of day
  if (moving) {
    reasons.push(
      curfew
        ? {
            code: 'CURFEW_MOTION',
            label: 'Night-time velocity spike',
            detail: `Moving at ${input.speed_kmh.toFixed(1)} km/h outside trading hours (store closed ${pad(input.shift.close_hour)}:00–${pad(input.shift.open_hour)}:00).`,
            points: 20,
          }
        : {
            code: 'MOTION',
            label: 'Sustained motion',
            detail: `Moving at ${input.speed_kmh.toFixed(1)} km/h; display coolers should be stationary.`,
            points: 10,
          },
    );
  }

  // 4. Shock / tilt (MPU-6050)
  if (input.vibration_status === 'Elevated' || (input.tilt_deg ?? 0) > 10) {
    reasons.push({
      code: 'SHOCK_TILT',
      label: 'Handling shock / tilt',
      detail: `Accelerometer reports ${input.vibration_status ?? 'motion'}${input.tilt_deg != null ? `, tilt ${input.tilt_deg.toFixed(1)}°` : ''}, consistent with lifting or loading.`,
      points: 5,
    });
  }

  // 5. Cold chain
  const maxT = input.target_max_temp_c ?? 6;
  if (input.internal_temp_c != null && input.internal_temp_c > maxT) {
    reasons.push({
      code: 'COLD_CHAIN',
      label: 'Cold-chain excursion',
      detail: `Internal temperature ${input.internal_temp_c.toFixed(1)}°C exceeds the ${maxT.toFixed(1)}°C target.`,
      points: 5,
    });
  }

  const score = Math.min(100, reasons.reduce((s, x) => s + x.points, 0));
  const severity: Severity = score >= CRITICAL_THRESHOLD ? 'critical' : score >= WARNING_THRESHOLD ? 'warning' : 'nominal';

  const families = [
    d > r,
    !input.mains_connected,
    moving,
    reasons.some((x) => x.code === 'SHOCK_TILT'),
  ].filter(Boolean).length;
  const confidence = score < WARNING_THRESHOLD ? 0 : Math.min(99, 50 + 12.5 * families);

  return { score, severity, confidence, geofenceBreached: d > r, reasons };
}

const pad = (n: number) => String(n).padStart(2, '0');
