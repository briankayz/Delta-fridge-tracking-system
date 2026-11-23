export interface Mpu6050Reading {
  accel_x: number;
  accel_y: number;
  accel_z: number;
  tilt_deg: number;
  vibration_rms: number;
  vibration_status: 'Nominal' | 'Warning' | 'Elevated';
}

export interface GpsLocation {
  latitude: number;
  longitude: number;
  altitude_m: number;
  accuracy_m: number;
  satellites: number;
  hdop: number;
  elevation_asl: number;
}

export interface PowerState {
  mains_connected: boolean;
  voltage_ac: number;
  current_amps: number;
  frequency_hz: number;
  battery_level_pct: number;
  battery_charging: boolean;
  backup_duration_hours: number;
}

export interface ColdChainState {
  internal_temp_c: number;
  target_min_temp_c: number;
  target_max_temp_c: number;
  compressor_active: boolean;
  status: 'Optimal' | 'Warning' | 'Critical';
}

export interface RetailerProfile {
  id: string;
  name: string;
  site_code: string;
  cluster: string;
  zone: string;
  anchor_lat: number;
  anchor_lon: number;
}

export interface FridgeTelemetryPayload {
  device_id: string;
  cooler_id: string;
  timestamp: string;
  retailer_id: string;
  retailer_name: string;
  firmware_version: string;
  imei: string;
  status: 'PROVISIONING' | 'SECURE_TRANSMITTING' | 'BREACH_ALERT' | 'DEACTIVATED';
  geofence_breached: boolean;
  geofence_radius_m: number;
  displacement_distance_m: number;
  speed_kmh: number;
  bearing_deg: number;
  bearing_text: string;
  risk_score_pct: number;
  theft_prediction_confidence_pct: number;
  gps: GpsLocation;
  accelerometer: Mpu6050Reading;
  power: PowerState;
  cold_chain: ColdChainState;
  tamper_seal_armed: boolean;
  curfew_anomaly: boolean;
  mains_power_cut: boolean;
}

