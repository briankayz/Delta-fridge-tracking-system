// Domain types shared by services, routes and the WebSocket hub.
// The inbound device contract mirrors mobile-beacon/src/types/telemetry.ts and is validated in schema.ts.

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

export interface RiskReason {
  code:
    | 'GEOFENCE_DRIFT'
    | 'GEOFENCE_BREACH'
    | 'MAINS_OUTAGE'
    | 'MAINS_OUTAGE_PROLONGED'
    | 'MAINS_CUT_IN_TRANSIT'
    | 'MOTION'
    | 'CURFEW_MOTION'
    | 'SHOCK_TILT'
    | 'COLD_CHAIN'
    | 'AUTHORIZED_RELOCATION';
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

export interface ShiftWindow {
  open_hour: number;
  close_hour: number;
}

export interface TrailPoint {
  t: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  score: number;
  battery_pct: number | null;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  region: string | null;
  phone?: string | null;
}

/** Actor recorded in audit/incident logs: a person, a device, or the system itself. */
export interface Actor {
  id: string | null;
  name: string;
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
  shift: ShiftWindow;
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
  /** Most important open incident (displacement > signal_lost > power). */
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
  /** Latest reported position of the cooler (for responders). */
  position: { lat: number; lng: number; at: string } | null;
  retailer_contact: { name: string | null; phone: string | null };
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
