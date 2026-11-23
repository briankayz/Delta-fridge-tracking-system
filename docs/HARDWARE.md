# In-fridge beacon: hardware specification

Audience: hardware partner / Delta engineering. The phone "demo beacon" proves the software; production
needs a sealed unit inside each cooler that measures what a phone cannot.

## What the unit must sense

| Signal | Why | Typical part (example) |
|---|---|---|
| Position | geofence and theft route | GNSS module with assisted GPS (e.g. u-blox M10 class) |
| Movement / shock / tilt | lifting, loading, transit | 3-axis accelerometer with motion interrupt (e.g. MPU-6050 or a lower-power LIS3DH-class part) |
| Mains present / voltage | unplugging, outages | opto-isolated AC presence detection on the cooler's supply, optionally voltage sense |
| Cabinet temperature | cold-chain compliance | waterproof digital probe (e.g. DS18B20) inside the cabinet |
| Tamper | someone opening or removing the unit | magnetic reed switch on the mounting bracket |
| Backup power | keeps reporting during theft | Li-ion cell (≥ 24 h of breach-mode reporting) + charger from mains |
| Connectivity | report from anywhere | LTE-M / NB-IoT modem with 2G fallback where available, roaming SIM on a private APN |

## Reporting behaviour

| State | Interval |
|---|---|
| Normal (in store, on mains, still) | every 5 min (heartbeat) |
| Mains lost or motion detected | every 30 s for 10 min |
| Moving outside the geofence | every 5–10 s until stationary for 5 min |
| No network | buffer readings (≥ 24 h) and send oldest-first when back |

Set the server's `OFFLINE_AFTER_MIN` above the heartbeat (e.g. 15 min for a 5-minute heartbeat).
A unit that goes silent mid-breach raises a critical *beacon offline* incident.

## Message contract

HTTPS `POST /api/v1/telemetry` with header `Authorization: Device <device token>` and a JSON body
(full shape in `mobile-beacon/src/types/telemetry.ts`; validation in `backend/src/schema.ts`):

```json
{
  "device_id": "DLTA-BCN-9042",
  "timestamp": "2026-11-23T12:00:00Z",
  "speed_kmh": 0,
  "bearing_deg": 0,
  "gps": { "latitude": -17.79421, "longitude": 31.03784, "accuracy_m": 3.0 },
  "power": { "mains_connected": true, "voltage_ac": 231, "battery_level_pct": 98 },
  "accelerometer": { "tilt_deg": 0.4, "vibration_status": "Nominal" },
  "cold_chain": { "internal_temp_c": 3.8, "target_max_temp_c": 6 }
}
```

Required: `device_id`, `speed_kmh`, `gps.latitude`, `gps.longitude`, `power.mains_connected`.
The server computes all risk; anything the device sends about risk is ignored. Response `202` returns
the server's verdict (useful for an on-device LED/buzzer).

For very low-power units an MQTT or CoAP gateway can translate to this HTTPS contract.

## Identity and provisioning

1. Each unit carries a QR sticker with its `device_id`.
2. The technician scans it in the field app and chooses the store; the server records the cooler's home
   position and issues a device credential.
3. **Prototype:** the credential is returned to the installer's phone (used by demo mode).
   **Production options:** (a) the app passes it to the unit over Bluetooth during installation, or
   (b) units are flashed at the factory with a unique key and the server registers that key when the
   technician installs it. Option (b) avoids secrets passing through phones and is recommended.
4. Re-installing a unit rotates its credential; old credentials stop working immediately.

## Enclosure and installation

- Mounted inside the cooler's base or behind the kick plate, out of customer reach, with the GNSS and
  cellular antennas clear of the metal cabinet (external low-profile antenna if needed).
- Powered from the cooler's mains input before the compressor switch, so "unplugged" is distinguished
  from "compressor off".
- Ingress protection suitable for condensation (IP65 or better).
