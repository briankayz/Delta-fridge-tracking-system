// ---- UI view models -------------------------------------------------------------------

export interface CoolerAsset {
  id: string;
  coolerModel: string;
  retailer: string;
  locationName: string;
  lat: number;
  lng: number;
  status: 'nominal' | 'warning' | 'critical';
  statusLabel: string;
  internalTemp: number;
  powerSource: string;
  batteryPct: number;
  lastPing: string;
  lastSeen: string | null;
  speedKmh: number;
  riskScore: number;
  confidencePct: number;
  riskReasons: RiskReason[];
  geofenceRadiusM: number;
  displacementM: number;
  routeOrigin?: {
    name: string;
    lat: number;
    lng: number;
  };
  trail: [number, number][];
  incidentId: string | null;
  incidentOpenedAt: string | null;
  isBreached: boolean;
  isPowerCut: boolean;
  mainsOffSince: string | null;
  simulationActive: boolean;
  imei?: string;
  assetType?: string;
}

export interface RiskAlertItem {
  id: string;
  assetId: string;
  title: string;
  severity: 'critical' | 'warning' | 'resolved';
  timeAgo: string;
  description: string;
  originStore: string;
  currentLocation: string;
  speedKmh: number;
  tempC: number;
  powerStatus: string;
  riskPct: number;
  timestamp: string;
}

// ---- Backend contract (mirrors backend/src/types.ts) ---------------------------------

export type Severity = 'nominal' | 'warning' | 'critical';

export interface RiskReason {
  code: string;
  label: string;
  detail: string;
  points: number;
}

export interface RiskResult {
  score: number;
  severity: Severity;
  confidence: number;
  geofenceBreached: boolean;
  reasons: RiskReason[];
}

export interface TrailPoint {
  t: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  score: number;
  battery_pct: number | null;
}

export interface AssetState {
  id: string;
  cooler_id: string;
  model: string;
  asset_type: string;
  imei: string;
  retailer_id: string;
  retailer_name: string;
  anchor: { lat: number; lng: number };
  geofence_radius_m: number;
  shift: { open_hour: number; close_hour: number };
  location_name: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  bearing_deg: number;
  distance_m: number;
  internal_temp_c: number | null;
  mains_connected: boolean;
  mains_off_since: string | null;
  voltage_ac: number | null;
  battery_pct: number | null;
  device_status: string | null;
  last_seen: string | null;
  risk: RiskResult;
  incident_id: string | null;
  trail: TrailPoint[];
  simulation_active: boolean;
}

export interface Incident {
  id: string;
  asset_id: string;
  status: 'open' | 'resolved';
  opened_at: string;
  resolved_at: string | null;
  resolution: 'returned' | 'authorized' | 'reset' | null;
  peak_score: number;
  reasons: RiskReason[];
  origin: { lat: number; lng: number; name: string };
}

export interface FleetSummary {
  total: number;
  compliant: number;
  outages: number;
  anomalies: number;
}

export type ServerEvent =
  | { type: 'snapshot'; summary: FleetSummary; assets: AssetState[]; incidents: Incident[] }
  | { type: 'asset.updated'; summary: FleetSummary; asset: AssetState }
  | { type: 'incident.opened'; summary: FleetSummary; asset: AssetState; incident: Incident }
  | { type: 'incident.resolved'; summary: FleetSummary; asset: AssetState; incident: Incident };

export type ConnectionState = 'connecting' | 'live' | 'offline';
