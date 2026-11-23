// Shared domain types for the Delta Asset Guard backend.
// The inbound contract mirrors mobile-beacon/src/types/telemetry.ts (FridgeTelemetryPayload);
// its runtime validation lives in schema.ts.

export type Severity = 'nominal' | 'warning' | 'critical';

export interface RiskReason {
  code: 'GEOFENCE_DRIFT' | 'GEOFENCE_BREACH' | 'MAINS_OUTAGE' | 'MAINS_OUTAGE_PROLONGED' | 'MAINS_CUT_IN_TRANSIT'
    | 'MOTION' | 'CURFEW_MOTION' | 'SHOCK_TILT' | 'COLD_CHAIN';
  label: string;
  detail: string;
  points: number;
}

export interface RiskResult {
  score: number;            // 0..100
  severity: Severity;
  confidence: number;       // theft_prediction_confidence_pct, 0..99
  geofenceBreached: boolean; // distance > radius
  reasons: RiskReason[];
}

export interface ShiftWindow {
  open_hour: number;   // local Harare hour store opens (e.g. 7)
  close_hour: number;  // local Harare hour store closes (e.g. 22)
}

export interface AssetConfig {
  id: string;               // device id, e.g. DLTA-BCN-9042
  cooler_id: string;
  model: string;
  asset_type: string;
  imei: string;
  retailer_id: string;
  retailer_name: string;
  anchor: { lat: number; lng: number };
  geofence_radius_m: number;
  shift: ShiftWindow;
}

export interface TrailPoint {
  t: string;   // ISO time received
  lat: number;
  lng: number;
  speed_kmh: number;
  score: number;
  battery_pct: number | null;
}

export interface AssetState extends AssetConfig {
  location_name: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  bearing_deg: number;
  distance_m: number;          // computed from anchor
  internal_temp_c: number | null;
  mains_connected: boolean;
  mains_off_since: string | null;
  voltage_ac: number | null;
  battery_pct: number | null;
  device_status: string | null;  // status as reported by the beacon
  last_seen: string | null;      // ISO, server receive time
  risk: RiskResult;
  incident_id: string | null;
  trail: TrailPoint[];           // positions since current incident opened
  simulation_active: boolean;    // server-side simulate-breach run in progress
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
