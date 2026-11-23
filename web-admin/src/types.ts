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
  speedKmh: number;
  riskScore: number;
  geofenceRadiusM: number;
  displacementM: number;
  routeOrigin?: {
    name: string;
    lat: number;
    lng: number;
  };
  isBreached: boolean;
  isPowerCut: boolean;
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
  powerStatus: string;
  riskPct: number;
  timestamp: string;
}

export interface LiveBeaconTelemetryPayload {
  device_id: string;
  cooler_id?: string;
  timestamp: string;
  retailer_id?: string;
  retailer_name?: string;
  firmware_version?: string;
  imei?: string;
  status?: string;
  geofence_breached: boolean;
  geofence_radius_m?: number;
  displacement_distance_m?: number;
  speed_kmh: number;
  bearing_deg?: number;
  bearing_text?: string;
  risk_score_pct: number;
  theft_prediction_confidence_pct?: number;
  gps?: {
    latitude: number;
    longitude: number;
    altitude_m?: number;
    accuracy_m?: number;
    satellites?: number;
  };
  power?: {
    mains_connected: boolean;
    voltage_ac: number;
    current_amps: number;
    battery_level_pct: number;
  };
  cold_chain?: {
    internal_temp_c: number;
    status?: string;
  };
}

