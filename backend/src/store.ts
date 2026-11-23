// In-memory fleet store + incident state machine.
// ingest() is the single path every payload (real beacon or server simulation) goes through.

import { haversineM, nearestPlace } from './geo.ts';
import { harareHour, scoreRisk } from './riskEngine.ts';
import { TelemetryPayload } from './schema.ts';
import { AssetConfig, AssetState, FleetSummary, Incident, ServerEvent, TrailPoint } from './types.ts';

/** Consecutive calm payloads (inside fence, ~stationary) needed to auto-resolve an incident. */
export const RESOLVE_AFTER_CALM = 3;
const MAX_TRAIL = 300;
const MAX_HISTORY = 200;
const MAX_CLOSED_INCIDENTS = 50;

export interface FleetBaseline {
  // Fleet-wide numbers including untracked-in-prototype assets (the "1,420 coolers" story).
  total: number;
  compliant: number;
  outages: number;
  anomalies: number;
}

export interface StoreOptions {
  baseline: FleetBaseline;
  forceCurfew?: () => boolean;
  now?: () => Date;
}

export class FleetStore {
  private assets = new Map<string, AssetState>();
  private history = new Map<string, TrailPoint[]>();
  private calmCount = new Map<string, number>();
  private incidents: Incident[] = [];
  private incidentSeq = 0;
  private others: FleetBaseline = { total: 0, compliant: 0, outages: 0, anomalies: 0 };
  private readonly now: () => Date;

  constructor(private readonly opts: StoreOptions) {
    this.now = opts.now ?? (() => new Date());
  }

  /** Register an asset with its provisioning config. Position starts at the anchor. */
  register(cfg: AssetConfig): AssetState {
    const asset: AssetState = {
      ...cfg,
      location_name: `${cfg.retailer_name} (in store)`,
      lat: cfg.anchor.lat,
      lng: cfg.anchor.lng,
      speed_kmh: 0,
      bearing_deg: 0,
      distance_m: 0,
      internal_temp_c: null,
      mains_connected: true,
      mains_off_since: null,
      voltage_ac: null,
      battery_pct: null,
      device_status: null,
      last_seen: null,
      risk: { score: 0, severity: 'nominal', confidence: 0, geofenceBreached: false, reasons: [] },
      incident_id: null,
      trail: [],
      simulation_active: false,
    };
    this.assets.set(cfg.id, asset);
    return asset;
  }

  /**
   * Freeze the "untracked remainder" of the fleet so KPI totals equal the baseline right now
   * and move only with live state changes of tracked assets afterwards.
   */
  lockBaseline(): void {
    const tracked = this.trackedCounts();
    const b = this.opts.baseline;
    this.others = {
      total: b.total - tracked.total,
      compliant: b.compliant - tracked.compliant,
      outages: b.outages - tracked.outages,
      anomalies: b.anomalies - tracked.anomalies,
    };
  }

  private trackedCounts(): FleetBaseline {
    let compliant = 0, outages = 0, anomalies = 0;
    for (const a of this.assets.values()) {
      if (a.risk.severity === 'critical') anomalies++;
      if (!a.mains_connected) outages++;
      if (a.risk.severity === 'nominal' && a.mains_connected) compliant++;
    }
    return { total: this.assets.size, compliant, outages, anomalies };
  }

  summary(): FleetSummary {
    const t = this.trackedCounts();
    return {
      total: this.others.total + t.total,
      compliant: this.others.compliant + t.compliant,
      outages: this.others.outages + t.outages,
      anomalies: this.others.anomalies + t.anomalies,
    };
  }

  get(id: string): AssetState | undefined {
    return this.assets.get(id);
  }

  list(): AssetState[] {
    return [...this.assets.values()];
  }

  getHistory(id: string): TrailPoint[] {
    return this.history.get(id) ?? [];
  }

  listIncidents(): Incident[] {
    return [...this.incidents].reverse();
  }

  getIncident(id: string | null): Incident | undefined {
    return id ? this.incidents.find((i) => i.id === id) : undefined;
  }

  snapshot(): ServerEvent {
    return { type: 'snapshot', summary: this.summary(), assets: this.list(), incidents: this.listIncidents() };
  }

  setSimulation(id: string, active: boolean): void {
    const a = this.assets.get(id);
    if (a) a.simulation_active = active;
  }

  /** Update anchor / radius / shift for an asset (creating it if unknown). */
  provision(id: string, patch: {
    retailer_id?: string; retailer_name?: string; anchor_lat: number; anchor_lng: number;
    geofence_radius_m?: number; open_hour?: number; close_hour?: number;
  }): AssetState {
    const existing = this.assets.get(id);
    const base: AssetConfig = existing ?? defaultConfig(id, patch.anchor_lat, patch.anchor_lng);
    const cfg: AssetConfig = {
      ...base,
      retailer_id: patch.retailer_id ?? base.retailer_id,
      retailer_name: patch.retailer_name ?? base.retailer_name,
      anchor: { lat: patch.anchor_lat, lng: patch.anchor_lng },
      geofence_radius_m: patch.geofence_radius_m ?? base.geofence_radius_m,
      shift: {
        open_hour: patch.open_hour ?? base.shift.open_hour,
        close_hour: patch.close_hour ?? base.shift.close_hour,
      },
    };
    if (existing) {
      Object.assign(existing, cfg);
      return existing;
    }
    return this.register(cfg);
  }

  /** Validate-already-done payload → state update → zero or more events to broadcast. */
  ingest(p: TelemetryPayload): { asset: AssetState; events: ServerEvent[] } {
    const now = this.now();
    const nowIso = now.toISOString();
    let asset = this.assets.get(p.device_id);
    if (!asset) {
      // Unknown device: auto-register, anchoring at its first reported fix.
      asset = this.register({
        ...defaultConfig(p.device_id, p.gps.latitude, p.gps.longitude),
        cooler_id: p.cooler_id ?? p.device_id,
        imei: p.imei ?? '',
        retailer_id: p.retailer_id ?? 'UNASSIGNED',
        retailer_name: p.retailer_name ?? 'Unassigned retailer',
        geofence_radius_m: p.geofence_radius_m ?? 50,
      });
    }

    // Identity / metadata the beacon may update
    if (p.retailer_name) asset.retailer_name = p.retailer_name;
    if (p.retailer_id) asset.retailer_id = p.retailer_id;
    if (p.geofence_radius_m) asset.geofence_radius_m = p.geofence_radius_m;
    if (p.imei) asset.imei = p.imei;

    // Telemetry
    asset.lat = p.gps.latitude;
    asset.lng = p.gps.longitude;
    asset.speed_kmh = p.speed_kmh;
    asset.bearing_deg = p.bearing_deg ?? asset.bearing_deg;
    asset.internal_temp_c = p.cold_chain?.internal_temp_c ?? asset.internal_temp_c;
    asset.voltage_ac = p.power.voltage_ac ?? null;
    asset.battery_pct = p.power.battery_level_pct ?? asset.battery_pct;
    asset.device_status = p.status ?? null;
    asset.last_seen = nowIso;

    if (p.power.mains_connected) {
      asset.mains_off_since = null;
    } else {
      asset.mains_off_since ??= nowIso; // keep the original cut time across payloads
    }
    asset.mains_connected = p.power.mains_connected;

    asset.distance_m = haversineM(asset.anchor.lat, asset.anchor.lng, asset.lat, asset.lng);
    const offMin = asset.mains_off_since ? (now.getTime() - Date.parse(asset.mains_off_since)) / 60_000 : 0;

    asset.risk = scoreRisk({
      distance_m: asset.distance_m,
      geofence_radius_m: asset.geofence_radius_m,
      speed_kmh: asset.speed_kmh,
      mains_connected: asset.mains_connected,
      mains_off_minutes: offMin,
      vibration_status: p.accelerometer?.vibration_status,
      tilt_deg: p.accelerometer?.tilt_deg,
      internal_temp_c: asset.internal_temp_c,
      target_max_temp_c: p.cold_chain?.target_max_temp_c,
      local_hour: harareHour(now),
      shift: asset.shift,
      force_curfew: this.opts.forceCurfew?.() ?? false,
    });

    asset.location_name = asset.risk.geofenceBreached
      ? `Near ${nearestPlace(asset.lat, asset.lng)} (+${(asset.distance_m / 1000).toFixed(1)} km)`
      : `${asset.retailer_name} (in store)`;

    const point: TrailPoint = { t: nowIso, lat: asset.lat, lng: asset.lng, speed_kmh: asset.speed_kmh, score: asset.risk.score };
    const hist = this.history.get(asset.id) ?? [];
    hist.push(point);
    if (hist.length > MAX_HISTORY) hist.shift();
    this.history.set(asset.id, hist);

    const events: ServerEvent[] = [];
    const open = this.getIncident(asset.incident_id);

    if (open && open.status === 'open') {
      open.peak_score = Math.max(open.peak_score, asset.risk.score);
      if (asset.risk.score >= open.peak_score) open.reasons = asset.risk.reasons;
      asset.trail.push(point);
      if (asset.trail.length > MAX_TRAIL) asset.trail.shift();

      const calm = !asset.risk.geofenceBreached && asset.speed_kmh < 2;
      const c = calm ? (this.calmCount.get(asset.id) ?? 0) + 1 : 0;
      this.calmCount.set(asset.id, c);
      if (c >= RESOLVE_AFTER_CALM) {
        const resolved = this.closeIncident(asset, 'returned');
        events.push({ type: 'incident.resolved', summary: this.summary(), asset, incident: resolved });
        return { asset, events };
      }
    } else if (asset.risk.severity === 'critical') {
      const incident = this.openIncident(asset, nowIso);
      events.push({ type: 'incident.opened', summary: this.summary(), asset, incident });
      return { asset, events };
    }

    events.push({ type: 'asset.updated', summary: this.summary(), asset });
    return { asset, events };
  }

  /** Operator / simulator resolution. Returns undefined if no incident was open. */
  resolve(id: string, resolution: Incident['resolution']): { asset: AssetState; incident?: Incident } | undefined {
    const asset = this.assets.get(id);
    if (!asset) return undefined;
    const open = this.getIncident(asset.incident_id);
    if (!open || open.status !== 'open') return { asset };
    return { asset, incident: this.closeIncident(asset, resolution) };
  }

  private openIncident(asset: AssetState, nowIso: string): Incident {
    this.incidentSeq += 1;
    const incident: Incident = {
      id: `INC-${asset.id.split('-').pop()}-${String(this.incidentSeq).padStart(3, '0')}`,
      asset_id: asset.id,
      status: 'open',
      opened_at: nowIso,
      resolved_at: null,
      resolution: null,
      peak_score: asset.risk.score,
      reasons: asset.risk.reasons,
      origin: { ...asset.anchor, name: asset.retailer_name },
    };
    this.incidents.push(incident);
    asset.incident_id = incident.id;
    asset.trail = [
      { t: nowIso, lat: asset.anchor.lat, lng: asset.anchor.lng, speed_kmh: 0, score: 0 },
      { t: nowIso, lat: asset.lat, lng: asset.lng, speed_kmh: asset.speed_kmh, score: asset.risk.score },
    ];
    this.calmCount.set(asset.id, 0);
    return incident;
  }

  private closeIncident(asset: AssetState, resolution: Incident['resolution']): Incident {
    const incident = this.getIncident(asset.incident_id)!;
    incident.status = 'resolved';
    incident.resolved_at = this.now().toISOString();
    incident.resolution = resolution;
    asset.incident_id = null;
    asset.trail = [];
    this.calmCount.set(asset.id, 0);
    // Keep the incident log bounded
    const closed = this.incidents.filter((i) => i.status === 'resolved');
    if (closed.length > MAX_CLOSED_INCIDENTS) {
      const drop = closed[0];
      this.incidents = this.incidents.filter((i) => i !== drop);
    }
    return incident;
  }
}

function defaultConfig(id: string, lat: number, lng: number): AssetConfig {
  return {
    id,
    cooler_id: id,
    model: 'Commercial Display Cooler',
    asset_type: 'Display Cooler',
    imei: '',
    retailer_id: 'UNASSIGNED',
    retailer_name: 'Unassigned retailer',
    anchor: { lat, lng },
    geofence_radius_m: 50,
    shift: { open_hour: 7, close_hour: 22 },
  };
}
