// ---- Backend contract (mirrors backend/src/types.ts) ---------------------------------------

export type Severity = 'nominal' | 'warning' | 'critical';
export type Role = 'admin' | 'ops_lead' | 'area_manager' | 'asset_protection' | 'technician' | 'viewer';
export type IncidentKind = 'displacement' | 'power' | 'signal_lost';
export type IncidentStatus = 'open' | 'acknowledged' | 'resolved';
export type Resolution =
  | 'returned'
  | 'authorized'
  | 'recovered'
  | 'false_alarm'
  | 'not_found'
  | 'power_restored'
  | 'signal_restored'
  | 'reset';

export type Permission =
  | 'fleet:read'
  | 'incident:act'
  | 'incident:field'
  | 'asset:provision'
  | 'register:import'
  | 'relocation:request'
  | 'relocation:decide'
  | 'user:manage'
  | 'audit:read'
  | 'demo:control';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  region: string | null;
  phone?: string | null;
}

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
  cooler_serial: string | null;
  model: string;
  asset_type: string;
  imei: string;
  is_virtual: boolean;
  provisioned: boolean;
  retailer_id: string | null;
  retailer_name: string;
  region: string;
  retailer_contact: { name: string | null; phone: string | null };
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
  online: boolean;
  risk: RiskResult;
  incident_id: string | null;
  open_incidents: { id: string; kind: IncidentKind; status: IncidentStatus }[];
  relocation: { id: string; window_end: string; to: { lat: number; lng: number } } | null;
  trail: TrailPoint[];
  simulation_active: boolean;
}

export interface IncidentEvent {
  id: number;
  at: string;
  actor_name: string;
  type: string;
  message: string | null;
  data: unknown;
}

export interface Incident {
  id: string;
  asset_id: string;
  kind: IncidentKind;
  severity: Severity;
  status: IncidentStatus;
  opened_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution: Resolution | null;
  peak_score: number;
  reasons: RiskReason[];
  origin: { lat: number; lng: number; name: string };
  retailer_name: string | null;
  region: string | null;
  events?: IncidentEvent[];
}

export interface FleetSummary {
  total: number;
  reporting: number;
  offline: number;
  compliant: number;
  outages: number;
  anomalies: number;
  open_incidents: number;
}

export type ServerEvent =
  | { type: 'snapshot'; summary: FleetSummary; assets: AssetState[]; incidents: Incident[] }
  | { type: 'asset.updated'; summary: FleetSummary; asset: AssetState }
  | { type: 'incident.opened'; summary: FleetSummary; asset: AssetState; incident: Incident }
  | { type: 'incident.updated'; summary: FleetSummary; incident: Incident }
  | { type: 'incident.resolved'; summary: FleetSummary; asset: AssetState; incident: Incident };

export type ConnectionState = 'connecting' | 'live' | 'offline';

// ---- UI view models ---------------------------------------------------------------------------

export interface CoolerAsset {
  id: string;
  coolerModel: string;
  coolerSerial: string | null;
  retailer: string;
  retailerId: string | null;
  region: string;
  retailerContact: { name: string | null; phone: string | null };
  locationName: string;
  lat: number;
  lng: number;
  status: Severity;
  statusLabel: string;
  internalTemp: number | null;
  powerSource: string;
  batteryPct: number | null;
  lastPing: string;
  lastSeen: string | null;
  online: boolean;
  isVirtual: boolean;
  provisioned: boolean;
  speedKmh: number;
  riskScore: number;
  confidencePct: number;
  riskReasons: RiskReason[];
  geofenceRadiusM: number;
  displacementM: number;
  routeOrigin?: { name: string; lat: number; lng: number };
  trail: [number, number][];
  incidentId: string | null;
  incidentOpenedAt: string | null;
  openIncidents: AssetState['open_incidents'];
  relocation: AssetState['relocation'];
  isBreached: boolean;
  isPowerCut: boolean;
  mainsOffSince: string | null;
  simulationActive: boolean;
  imei?: string;
  assetType?: string;
}
