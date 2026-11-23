import { z } from 'zod';

// Runtime contract for POST /api/v1/telemetry (FridgeTelemetryPayload from the beacon).
// Only the fields the risk engine needs are required; client-computed fields such as
// risk_score_pct / geofence_breached / displacement_distance_m are accepted but ignored —
// the server is the authority on risk.

const finite = z.number().finite();

export const TelemetryPayloadSchema = z.object({
  device_id: z.string().min(3).max(64).regex(/^[A-Za-z0-9_-]+$/),
  cooler_id: z.string().max(64).optional(),
  timestamp: z.string().max(40).optional(),
  retailer_id: z.string().max(64).optional(),
  retailer_name: z.string().max(120).optional(),
  firmware_version: z.string().max(32).optional(),
  imei: z.string().max(20).optional(),
  status: z.string().max(32).optional(),
  geofence_radius_m: finite.min(5).max(5000).optional(),
  speed_kmh: finite.min(0).max(300),
  bearing_deg: finite.optional(),
  gps: z.object({
    latitude: finite.min(-90).max(90),
    longitude: finite.min(-180).max(180),
    accuracy_m: finite.optional(),
  }),
  accelerometer: z
    .object({
      tilt_deg: finite.optional(),
      vibration_status: z.string().max(16).optional(),
    })
    .optional(),
  power: z.object({
    mains_connected: z.boolean(),
    voltage_ac: finite.optional(),
    battery_level_pct: finite.min(0).max(100).optional(),
  }),
  cold_chain: z
    .object({
      internal_temp_c: finite.optional(),
      target_max_temp_c: finite.optional(),
    })
    .optional(),
});

export type TelemetryPayload = z.infer<typeof TelemetryPayloadSchema>;

// ---- Request bodies ----------------------------------------------------------------------

const role = z.enum(['admin', 'ops_lead', 'area_manager', 'asset_protection', 'technician', 'viewer']);
const phone = z.string().trim().regex(/^\+?[0-9 ]{7,20}$/, 'Use international format, e.g. +263 77 123 4567');

export const ProvisionSchema = z.object({
  retailer_id: z.string().min(1).max(64),
  anchor_lat: finite.min(-90).max(90),
  anchor_lng: finite.min(-180).max(180),
  geofence_radius_m: z.number().int().min(5).max(5000).optional(),
  open_hour: z.number().int().min(0).max(23).optional(),
  close_hour: z.number().int().min(0).max(23).optional(),
  cooler_serial: z.string().trim().max(64).optional(),
  model: z.string().trim().max(80).optional(),
  imei: z.string().trim().max(20).optional(),
});

export const LoginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
});

export const UserCreateSchema = z.object({
  email: z.string().trim().email().max(200),
  name: z.string().trim().min(2).max(80),
  role,
  region: z.string().trim().max(60).nullable().optional(),
  phone: phone.nullable().optional(),
  password: z.string().min(10).max(200),
});

export const UserUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  role: role.optional(),
  region: z.string().trim().max(60).nullable().optional(),
  phone: phone.nullable().optional(),
  active: z.boolean().optional(),
  password: z.string().min(10).max(200).optional(),
});

export const NoteSchema = z.object({ message: z.string().trim().min(1).max(2000) });
export const AssignSchema = z.object({ user_id: z.string().min(1).max(64) });
export const DispatchSchema = z.object({ note: z.string().trim().max(500).optional() });

export const FieldUpdateSchema = z.object({
  outcome: z.enum(['found', 'not_found', 'recovered', 'authorized']),
  note: z.string().trim().max(1000).optional(),
  lat: finite.min(-90).max(90).optional(),
  lng: finite.min(-180).max(180).optional(),
});

export const ResolveSchema = z.object({
  resolution: z.enum(['returned', 'authorized', 'recovered', 'false_alarm', 'not_found', 'power_restored', 'signal_restored', 'reset']),
  note: z.string().trim().max(1000).optional(),
});

export const RelocationSchema = z.object({
  asset_id: z.string().min(1).max(64),
  reason: z.string().trim().min(3).max(300),
  to_retailer_id: z.string().max(64).optional(),
  to_lat: finite.min(-90).max(90).optional(),
  to_lng: finite.min(-180).max(180).optional(),
  start: z.string().max(40).optional(),
  hours: z.number().min(0.5).max(168),
});

export const DecisionSchema = z.object({ approve: z.boolean() });

export const RegisterImportSchema = z.object({
  csv: z.string().max(5_000_000).optional(),
  rows: z.array(z.record(z.string(), z.unknown())).max(20_000).optional(),
  dry_run: z.boolean().optional(),
});
