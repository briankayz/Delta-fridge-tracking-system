// Subset of the backend contract used by the field app (see backend/src/types.ts).

export type Role = 'admin' | 'ops_lead' | 'area_manager' | 'asset_protection' | 'technician' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  region: string | null;
}

export interface Meta {
  version: string;
  demo_mode: boolean;
  offline_after_min: number;
}

export interface RiskReason {
  code: string;
  label: string;
  detail: string;
  points: number;
}

export interface Incident {
  id: string;
  asset_id: string;
  kind: 'displacement' | 'power' | 'signal_lost';
  severity: 'nominal' | 'warning' | 'critical';
  status: 'open' | 'acknowledged' | 'resolved';
  opened_at: string;
  assigned_name: string | null;
  peak_score: number;
  reasons: RiskReason[];
  origin: { lat: number; lng: number; name: string };
  retailer_name: string | null;
  region: string | null;
  position: { lat: number; lng: number; at: string } | null;
  retailer_contact: { name: string | null; phone: string | null };
}

export interface Asset {
  id: string;
  model: string;
  provisioned: boolean;
  retailer_name: string;
  region: string;
  anchor: { lat: number; lng: number };
  geofence_radius_m: number;
  location_name: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  distance_m: number;
  mains_connected: boolean;
  mains_off_since: string | null;
  battery_pct: number | null;
  last_seen: string | null;
  online: boolean;
  risk: { score: number; severity: 'nominal' | 'warning' | 'critical'; confidence: number; reasons: RiskReason[]; geofenceBreached: boolean };
  open_incidents: { id: string; kind: Incident['kind']; status: Incident['status'] }[];
  relocation: { id: string } | null;
  simulation_active: boolean;
}

export interface Retailer {
  id: string;
  name: string;
  region: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  coolers: number;
}
