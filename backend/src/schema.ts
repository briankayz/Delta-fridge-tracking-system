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

export const ProvisionSchema = z.object({
  retailer_id: z.string().max(64).optional(),
  retailer_name: z.string().max(120).optional(),
  anchor_lat: finite.min(-90).max(90),
  anchor_lng: finite.min(-180).max(180),
  geofence_radius_m: finite.min(5).max(5000).optional(),
  open_hour: z.number().int().min(0).max(23).optional(),
  close_hour: z.number().int().min(0).max(23).optional(),
});

export const ResetSchema = z.object({
  resolution: z.enum(['returned', 'authorized', 'reset']).optional(),
});
