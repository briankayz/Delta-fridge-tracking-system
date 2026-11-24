// FridgeTelemetryPayload: the exact JSON the ESP32 firmware POSTs to /api/v1/telemetry.
// Source of truth for validation is backend/src/schema.ts (TelemetryPayloadSchema); keep in sync.
// Units are engineering units (degrees, g, volts, dBm), except accel_raw (MPU6050 int16 counts).

export type FirmwareState = 'IDLE_PROVISIONING' | 'ARMED_NOMINAL' | 'ALARM_BREACH_ACTIVE';

export interface GpsBlock {
  latitude: number; // decimal degrees, WGS84
  longitude: number;
  altitude_m: number; // MSL
  accuracy_m: number; // ~ HDOP x UERE
  hdop: number;
  satellites: number; // used in fix
  fix: 'none' | '2d' | '3d';
}

export interface AccelerometerBlock {
  accel_x: number; // g
  accel_y: number;
  accel_z: number;
  accel_raw: [number, number, number]; // ACCEL_XOUT/YOUT/ZOUT, int16, 16384 LSB/g (±2g)
  tilt_deg: number; // angle between gravity and the board Z axis
  vibration_rms: number; // g, RMS of (|a| - 1g) over the sample window
  vibration_status: 'Nominal' | 'Warning' | 'Elevated';
}

export interface PowerBlock {
  mains_connected: boolean;
  voltage_ac: number; // V RMS, 0 when lost
  frequency_hz: number; // 0 when lost
  battery_level_pct: number; // backup Li-ion
  battery_charging: boolean;
}

export interface ColdChainBlock {
  internal_temp_c: number; // DS18B20 cabinet probe
  target_max_temp_c: number;
}

export interface CellularBlock {
  rssi_dbm: number; // -113 + 2 * csq
  csq: number; // AT+CSQ 0..31, 99 unknown
  network: 'LTE-M' | 'NB-IoT' | 'GSM' | 'WIFI' | 'UNKNOWN';
  registered: boolean;
}

export interface FirmwareBlock {
  version: string;
  state: FirmwareState;
  seq: number; // monotonic since boot
  uptime_s: number;
  heartbeat_s: number;
  buffered: number; // readings waiting in the offline buffer
}

export interface FridgeTelemetryPayload {
  device_id: string;
  timestamp: string; // ISO-8601 UTC (GNSS/RTC)
  firmware_version: string;
  status: 'PROVISIONING' | 'SECURE_TRANSMITTING' | 'BREACH_ALERT';
  speed_kmh: number;
  bearing_deg: number;
  gps: GpsBlock;
  accelerometer: AccelerometerBlock;
  power: PowerBlock;
  cold_chain: ColdChainBlock;
  cellular: CellularBlock;
  firmware: FirmwareBlock;
  /** Dotted paths of values that were simulated rather than measured. */
  simulated: string[];
}

/** Risk verdict the server returns (202) for each accepted payload. */
export interface ServerAssessment {
  risk_score_pct: number;
  theft_prediction_confidence_pct: number;
  severity: 'nominal' | 'warning' | 'critical';
  geofence_breached: boolean;
  displacement_distance_m: number;
  reasons: { code: string; label: string; detail: string; points: number }[];
  incident_id: string | null;
}

const STATUS: Record<FirmwareState, FridgeTelemetryPayload['status']> = {
  IDLE_PROVISIONING: 'PROVISIONING',
  ARMED_NOMINAL: 'SECURE_TRANSMITTING',
  ALARM_BREACH_ACTIVE: 'BREACH_ALERT',
};

export function buildPayload(p: {
  deviceId: string;
  firmware: FirmwareBlock;
  utc: string;
  speedKmh: number;
  courseDeg: number;
  gps: GpsBlock;
  accelerometer: AccelerometerBlock;
  power: PowerBlock;
  coldChain: ColdChainBlock;
  cellular: CellularBlock;
  simulated: string[];
}): FridgeTelemetryPayload {
  return {
    device_id: p.deviceId,
    timestamp: p.utc,
    firmware_version: p.firmware.version,
    status: STATUS[p.firmware.state],
    speed_kmh: round(p.speedKmh, 1),
    bearing_deg: round(p.courseDeg, 1),
    gps: p.gps,
    accelerometer: p.accelerometer,
    power: p.power,
    cold_chain: p.coldChain,
    cellular: p.cellular,
    firmware: p.firmware,
    simulated: [...new Set(p.simulated)].sort(),
  };
}

export function toAssessment(body: Record<string, unknown>): ServerAssessment | null {
  if (!body || body.accepted !== true) return null;
  return {
    risk_score_pct: Number(body.risk_score_pct ?? 0),
    theft_prediction_confidence_pct: Number(body.theft_prediction_confidence_pct ?? 0),
    severity: (body.severity as ServerAssessment['severity']) ?? 'nominal',
    geofence_breached: !!body.geofence_breached,
    displacement_distance_m: Number(body.displacement_distance_m ?? 0),
    reasons: (body.reasons as ServerAssessment['reasons']) ?? [],
    incident_id: (body.incident_id as string | null) ?? null,
  };
}

export const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;
