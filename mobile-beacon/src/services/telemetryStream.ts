// Demo-only: turns this phone into a cooler's beacon. Sends FridgeTelemetryPayload to
// POST /api/v1/telemetry with the device credential issued when the beacon was installed.
// Real deployments use dedicated in-fridge hardware speaking the same contract.
import { session } from '../api/client';
import { FridgeTelemetryPayload, RetailerProfile, ServerAssessment } from '../types/telemetry';
import { sensorEngine } from './sensorEngine';

export interface BeaconConfig {
  deviceId: string;
  token: string;
  anchor: { lat: number; lng: number };
  radius: number;
  retailerName: string;
  useRealGps: boolean;
}

export interface BeaconStatus {
  connected: boolean;
  lastError: string | null;
  payloads: number;
  cadence: number;
  displaced: boolean;
  assessment: ServerAssessment | null;
  last: FridgeTelemetryPayload | null;
}

export class BeaconRunner {
  private timer: ReturnType<typeof setInterval> | null = null;
  private displacedSince = 0;
  private status: BeaconStatus = { connected: false, lastError: null, payloads: 0, cadence: 5, displaced: false, assessment: null, last: null };
  private listener: ((s: BeaconStatus) => void) | null = null;

  constructor(private readonly cfg: BeaconConfig) {}

  private get retailer(): RetailerProfile {
    return {
      id: this.cfg.deviceId,
      name: this.cfg.retailerName,
      site_code: '',
      cluster: '',
      zone: '',
      anchor_lat: this.cfg.anchor.lat,
      anchor_lon: this.cfg.anchor.lng,
    };
  }

  subscribe(fn: (s: BeaconStatus) => void) {
    this.listener = fn;
    fn(this.status);
  }

  private update(patch: Partial<BeaconStatus>) {
    this.status = { ...this.status, ...patch };
    this.listener?.(this.status);
  }

  start(cadence = 5) {
    sensorEngine.start();
    this.stop();
    this.update({ cadence });
    this.timer = setInterval(() => void this.tick(), cadence * 1000);
    void this.tick();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  dispose() {
    this.stop();
    this.listener = null;
    sensorEngine.cleanup();
  }

  /** Simulates the cooler being unplugged and driven away; streams every second. */
  simulateTheft() {
    this.displacedSince = Date.now();
    this.update({ displaced: true });
    this.start(1);
  }

  /** Back to normal in-store telemetry (the incident itself is closed from the dashboard or Respond). */
  endSimulation() {
    this.displacedSince = 0;
    this.update({ displaced: false });
    this.start(5);
  }

  private async tick() {
    const displaced = this.displacedSince > 0;
    const payload = sensorEngine.getPayload(
      displaced,
      this.cfg.radius,
      this.retailer,
      { useRealGps: this.cfg.useRealGps, displacedSeconds: displaced ? (Date.now() - this.displacedSince) / 1000 : 0 },
      { latitude: this.cfg.anchor.lat, longitude: this.cfg.anchor.lng }
    );
    payload.device_id = this.cfg.deviceId;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(`${session.server}/api/v1/telemetry`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Device ${this.cfg.token}` },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        this.update({ connected: false, lastError: body.error ?? `HTTP ${res.status}`, last: payload, payloads: this.status.payloads + 1 });
        return;
      }
      this.update({
        connected: true,
        lastError: null,
        last: payload,
        payloads: this.status.payloads + 1,
        assessment: body.accepted
          ? {
              risk_score_pct: body.risk_score_pct,
              theft_prediction_confidence_pct: body.theft_prediction_confidence_pct,
              severity: body.severity,
              geofence_breached: body.geofence_breached,
              displacement_distance_m: body.displacement_distance_m,
              reasons: body.reasons ?? [],
              incident_id: body.incident_id ?? null,
              received_at: new Date().toISOString(),
            }
          : this.status.assessment,
      });
    } catch {
      this.update({ connected: false, lastError: 'No connection to the server', last: payload, payloads: this.status.payloads + 1 });
    } finally {
      clearTimeout(timeout);
    }
  }
}
