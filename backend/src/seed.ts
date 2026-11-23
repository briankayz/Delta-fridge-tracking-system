// Demo fleet: the five coolers the dashboard previously hardcoded, plus Phone A's beacon.
// Seeded through the real ingest path so their risk scores are computed, not invented.

import { FleetStore } from './store.ts';
import { AssetConfig } from './types.ts';
import { TelemetryPayload } from './schema.ts';

export const DEMO_BEACON_ID = 'DLTA-BCN-9042';

export const FLEET_BASELINE = { total: 1420, compliant: 1385, outages: 23, anomalies: 12 };

const SHIFT = { open_hour: 7, close_hour: 22 };

const CONFIGS: AssetConfig[] = [
  {
    id: DEMO_BEACON_ID,
    cooler_id: 'DLT-COOLER-8821',
    model: 'Industrial Refrig-V4',
    asset_type: 'Double G-Door',
    imei: '864920041289123',
    retailer_id: 'RET-HRE-0419',
    retailer_name: 'OK Supermarket - Avondale',
    anchor: { lat: -17.79421, lng: 31.03784 },
    geofence_radius_m: 50,
    shift: SHIFT,
  },
  {
    id: 'DLTA-BCN-8821',
    cooler_id: 'DLT-COOLER-7710',
    model: 'Commercial Double Door',
    asset_type: 'Double G-Door',
    imei: '358920110482910',
    retailer_id: 'RET-HRE-0233',
    retailer_name: 'OK Supermarket - Avondale West',
    anchor: { lat: -17.7942, lng: 31.0378 },
    geofence_radius_m: 50,
    shift: SHIFT,
  },
  {
    id: 'DLTA-BCN-4012',
    cooler_id: 'DLT-COOLER-4012',
    model: 'Single Door Chiller',
    asset_type: 'Single Chiller',
    imei: '358920110484012',
    retailer_id: 'RET-HRE-0577',
    retailer_name: 'Chitepo Bottle Store',
    anchor: { lat: -17.8182, lng: 31.0489 },
    geofence_radius_m: 100,
    shift: SHIFT,
  },
  {
    id: 'DLTA-BCN-9402',
    cooler_id: 'DLT-COOLER-9402',
    model: 'Mega Visual Merchandiser',
    asset_type: 'Mega Merchandiser',
    imei: '358920110489402',
    retailer_id: 'RET-HRE-0010',
    retailer_name: 'TM Pick n Pay (Jason Moyo)',
    anchor: { lat: -17.8285, lng: 31.0522 },
    geofence_radius_m: 50,
    shift: SHIFT,
  },
  {
    id: 'DLTA-BCN-3109',
    cooler_id: 'DLT-COOLER-3109',
    model: 'Standard Beverage Cooler',
    asset_type: 'Standard Cooler',
    imei: '358920110483109',
    retailer_id: 'RET-HRE-0102',
    retailer_name: 'Spar (Borrowdale Village)',
    anchor: { lat: -17.7538, lng: 31.0852 },
    geofence_radius_m: 100,
    shift: SHIFT,
  },
  {
    id: 'DLTA-BCN-1194',
    cooler_id: 'DLT-COOLER-1194',
    model: 'Compact Countertop Cooler',
    asset_type: 'Countertop Cooler',
    imei: '358920110481194',
    retailer_id: 'RET-HRE-0891',
    retailer_name: 'TotalEnergies Samora Machel (Eastlea)',
    anchor: { lat: -17.8229, lng: 31.0768 },
    geofence_radius_m: 50,
    shift: SHIFT,
  },
];

const nominal = (id: string, lat: number, lng: number, temp: number): TelemetryPayload => ({
  device_id: id,
  speed_kmh: 0,
  gps: { latitude: lat, longitude: lng },
  power: { mains_connected: true, voltage_ac: 234, battery_level_pct: 98 },
  accelerometer: { tilt_deg: 0.4, vibration_status: 'Nominal' },
  cold_chain: { internal_temp_c: temp, target_max_temp_c: 6 },
});

export function seedFleet(store: FleetStore, now = new Date()): void {
  for (const cfg of CONFIGS) store.register(cfg);

  // Phone A's beacon: nominal at its store until the real device reports.
  store.ingest(nominal(DEMO_BEACON_ID, -17.79421, 31.03784, 3.8));
  store.ingest(nominal('DLTA-BCN-9402', -17.82852, 31.05221, 3.1));
  store.ingest(nominal('DLTA-BCN-3109', -17.75381, 31.08522, 3.4));
  store.ingest(nominal('DLTA-BCN-1194', -17.82291, 31.07681, 2.9));

  // Chitepo: mains off for 8h15m, stationary, warming up -> warning.
  const chitepo = store.get('DLTA-BCN-4012')!;
  chitepo.mains_connected = false;
  chitepo.mains_off_since = new Date(now.getTime() - (8 * 60 + 15) * 60_000).toISOString();
  store.ingest({
    ...nominal('DLTA-BCN-4012', -17.81821, 31.04891, 8.2),
    power: { mains_connected: false, voltage_ac: 0, battery_level_pct: 61 },
  });

  // 8821: an already-open theft incident — unplugged and moving towards Highfield.
  store.ingest({
    device_id: 'DLTA-BCN-8821',
    speed_kmh: 24.1,
    bearing_deg: 225,
    gps: { latitude: -17.8641, longitude: 31.0024 },
    power: { mains_connected: false, voltage_ac: 0, battery_level_pct: 84 },
    accelerometer: { tilt_deg: 12.5, vibration_status: 'Elevated' },
    cold_chain: { internal_temp_c: 4.8, target_max_temp_c: 6 },
  });

  store.lockBaseline();
}
