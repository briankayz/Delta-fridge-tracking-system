import Constants from 'expo-constants';
import { FridgeTelemetryPayload, LinkStatus, RetailerProfile, ServerAssessment } from '../types/telemetry';
import { sensorEngine, DEFAULT_RETAILER, DEVICE_METADATA } from './sensorEngine';

type TelemetryListener = (payload: FridgeTelemetryPayload) => void;
type StatusListener = (status: LinkStatus) => void;
type AssessmentListener = (assessment: ServerAssessment | null) => void;

const BACKEND_PORT = 8787;
const REQUEST_TIMEOUT_MS = 4000;

/**
 * Where the Delta backend lives:
 *   1. EXPO_PUBLIC_API_URL (e.g. http://192.168.1.20:8787) if set
 *   2. the laptop running Metro/Expo (Expo Go knows its LAN IP via hostUri)
 *   3. the host serving the page (Expo web)
 *   4. localhost
 */
function resolveApiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const hostUri: string | undefined =
    Constants.expoConfig?.hostUri ?? (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost;
  const devHost = hostUri?.split(':')[0];
  if (devHost) return `http://${devHost}:${BACKEND_PORT}`;
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:${BACKEND_PORT}`;
  }
  return `http://127.0.0.1:${BACKEND_PORT}`;
}

async function postJson<T>(url: string, body: unknown): Promise<{ status: number; data: T }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = process.env.EXPO_PUBLIC_DEVICE_TOKEN;
    if (token) headers['x-device-token'] = token;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
    const data = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

class TelemetryStreamService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private cadenceSeconds = 5;
  private isDisplaced = false;
  private displacedSince = 0;
  private useRealGps = false;
  private currentRetailer: RetailerProfile = DEFAULT_RETAILER;
  private currentGeofenceRadius = 50;
  private anchor = { latitude: DEFAULT_RETAILER.anchor_lat, longitude: DEFAULT_RETAILER.anchor_lon };

  private telemetryListeners = new Set<TelemetryListener>();
  private statusListeners = new Set<StatusListener>();
  private assessmentListeners = new Set<AssessmentListener>();
  private lastPayload: FridgeTelemetryPayload | null = null;
  private lastAssessment: ServerAssessment | null = null;
  private payloadCount = 0;
  private isConnected = false;
  private lastError: string | null = null;
  private lastSyncTime: Date | null = null;
  private apiBase = resolveApiBase();

  constructor() {
    this.startStreaming();
  }

  public getApiBase(): string {
    return this.apiBase;
  }

  public setApiBase(url: string) {
    this.apiBase = url.replace(/\/$/, '');
    this.notifyStatus();
  }

  public startStreaming(cadenceSec = 5) {
    this.stopStreaming();
    this.cadenceSeconds = cadenceSec;
    this.timer = setInterval(() => this.broadcastCurrentState(), this.cadenceSeconds * 1000);
    this.broadcastCurrentState();
  }

  public stopStreaming() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public setRetailer(retailer: RetailerProfile) {
    this.currentRetailer = retailer;
    if (!this.useRealGps) this.anchor = { latitude: retailer.anchor_lat, longitude: retailer.anchor_lon };
  }

  public setGeofenceRadius(radius: number) {
    this.currentGeofenceRadius = radius;
  }

  public setUseRealGps(enabled: boolean) {
    this.useRealGps = enabled;
    if (!enabled) this.anchor = { latitude: this.currentRetailer.anchor_lat, longitude: this.currentRetailer.anchor_lon };
  }

  public getUseRealGps(): boolean {
    return this.useRealGps;
  }

  private buildPayload(): FridgeTelemetryPayload {
    return sensorEngine.getPayload(
      this.isDisplaced,
      this.currentGeofenceRadius,
      this.currentRetailer,
      {
        useRealGps: this.useRealGps,
        displacedSeconds: this.isDisplaced ? (Date.now() - this.displacedSince) / 1000 : 0,
      },
      this.anchor
    );
  }

  public broadcastCurrentState(): FridgeTelemetryPayload {
    const payload = this.buildPayload();
    void this.sendPayload(payload);
    return payload;
  }

  /**
   * Register this beacon's store anchor, radius and trading hours with the backend.
   * With live GPS enabled the anchor is the phone's current fix (provision on-site);
   * otherwise it is the selected retailer's surveyed coordinates.
   */
  public async provision(): Promise<{ ok: boolean; error?: string }> {
    const fix = this.useRealGps ? sensorEngine.getRealFix() : null;
    if (this.useRealGps && !fix) {
      return { ok: false, error: 'No GPS fix yet. Wait for a location lock or switch to the store anchor.' };
    }
    this.anchor = fix ?? { latitude: this.currentRetailer.anchor_lat, longitude: this.currentRetailer.anchor_lon };
    try {
      const { status, data } = await postJson<{ error?: string }>(
        `${this.apiBase}/api/v1/assets/${DEVICE_METADATA.deviceId}/provision`,
        {
          retailer_id: this.currentRetailer.id,
          retailer_name: this.currentRetailer.name,
          anchor_lat: this.anchor.latitude,
          anchor_lng: this.anchor.longitude,
          geofence_radius_m: this.currentGeofenceRadius,
          open_hour: 7,
          close_hour: 22,
        }
      );
      if (status >= 400) return { ok: false, error: data.error ?? `HTTP ${status}` };
      this.broadcastCurrentState();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: `Backend unreachable at ${this.apiBase} (${(err as Error).message})` };
    }
  }

  public simulateDisplacementEvent(): FridgeTelemetryPayload {
    this.isDisplaced = true;
    this.displacedSince = Date.now();
    // Emergency 1 s cadence during the breach burst; the backend decides it is a breach.
    this.startStreaming(1);
    return this.lastPayload!;
  }

  public resetDisplacementEvent(): FridgeTelemetryPayload {
    this.isDisplaced = false;
    this.displacedSince = 0;
    // Supervisor PIN verified on-device: close the incident as an authorized move.
    void postJson(`${this.apiBase}/api/v1/assets/${DEVICE_METADATA.deviceId}/reset`, { resolution: 'authorized' }).catch(
      () => undefined
    );
    this.startStreaming(5);
    return this.lastPayload!;
  }

  private async sendPayload(payload: FridgeTelemetryPayload) {
    this.lastPayload = payload;
    this.payloadCount += 1;
    this.emitTelemetry(payload);

    try {
      const { status, data } = await postJson<{
        accepted?: boolean;
        error?: string;
        risk_score_pct?: number;
        theft_prediction_confidence_pct?: number;
        severity?: ServerAssessment['severity'];
        geofence_breached?: boolean;
        displacement_distance_m?: number;
        reasons?: ServerAssessment['reasons'];
        incident_id?: string | null;
      }>(`${this.apiBase}/api/v1/telemetry`, payload);

      if (status >= 400) {
        this.isConnected = false;
        this.lastError = data.error ?? `HTTP ${status}`;
      } else {
        this.isConnected = true;
        this.lastError = null;
        this.lastSyncTime = new Date();
        if (data.accepted && data.risk_score_pct != null && data.severity) {
          this.lastAssessment = {
            risk_score_pct: data.risk_score_pct,
            theft_prediction_confidence_pct: data.theft_prediction_confidence_pct ?? 0,
            severity: data.severity,
            geofence_breached: !!data.geofence_breached,
            displacement_distance_m: data.displacement_distance_m ?? payload.displacement_distance_m,
            reasons: data.reasons ?? [],
            incident_id: data.incident_id ?? null,
            received_at: new Date().toISOString(),
          };
          this.assessmentListeners.forEach((l) => l(this.lastAssessment));
        }
      }
    } catch (err) {
      this.isConnected = false;
      this.lastError = `Backend unreachable at ${this.apiBase}`;
      // Stale verdicts must not be shown as live.
      if (this.lastAssessment) {
        this.lastAssessment = null;
        this.assessmentListeners.forEach((l) => l(null));
      }
    }
    this.notifyStatus();
  }

  private emitTelemetry(payload: FridgeTelemetryPayload) {
    this.telemetryListeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.error('Telemetry subscriber error:', err);
      }
    });
  }

  private status(): LinkStatus {
    return {
      connected: this.isConnected,
      apiBase: this.apiBase,
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastError,
      payloadCount: this.payloadCount,
      cadenceSeconds: this.cadenceSeconds,
    };
  }

  private notifyStatus() {
    const s = this.status();
    this.statusListeners.forEach((listener) => {
      try {
        listener(s);
      } catch (err) {
        console.error('Status subscriber error:', err);
      }
    });
  }

  public subscribeTelemetry(listener: TelemetryListener): () => void {
    this.telemetryListeners.add(listener);
    if (this.lastPayload) listener(this.lastPayload);
    return () => {
      this.telemetryListeners.delete(listener);
    };
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status());
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public subscribeAssessment(listener: AssessmentListener): () => void {
    this.assessmentListeners.add(listener);
    listener(this.lastAssessment);
    return () => {
      this.assessmentListeners.delete(listener);
    };
  }

  public getLastPayload(): FridgeTelemetryPayload | null {
    return this.lastPayload;
  }

  public getIsDisplaced(): boolean {
    return this.isDisplaced;
  }
}

export const telemetryStream = new TelemetryStreamService();
