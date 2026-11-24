# In-fridge beacon: hardware specification

Audience: hardware partner / Delta engineering. The phone "demo beacon" proves the software; production
needs a sealed unit inside each cooler that measures what a phone cannot.

## What the unit must sense

| Signal | Why | Typical part (example) |
|---|---|---|
| Position | geofence and theft route | GNSS (the SIM7000G's integrated GNSS, or a u-blox M10 class module) |
| Movement / shock / tilt | lifting, loading, transit | 3-axis accelerometer with motion interrupt (MPU6050, or a lower-power LIS3DH-class part) |
| Mains present / voltage | unplugging, outages | opto-isolated AC presence detection on the cooler's supply, optionally voltage sense |
| Cabinet temperature | cold-chain compliance | waterproof digital probe (DS18B20) inside the cabinet |
| Tamper | someone opening or removing the unit | magnetic reed switch on the mounting bracket |
| Backup power | keeps reporting during theft | Li-ion cell (≥ 24 h of breach-mode reporting) + charger from mains |
| Connectivity | report from anywhere | LTE-M / NB-IoT modem with 2G fallback where available, roaming SIM on a private APN |

## Reference build and firmware twin

Reference parts: **ESP32** (MCU) + **SIM7000G** (LTE-M/NB-IoT modem with integrated GNSS) + **MPU6050**
(accelerometer) + **DS18B20** (cabinet probe) + opto-isolated AC sense + Li-ion backup.

The field app contains a working TypeScript twin of this firmware in
[`mobile-beacon/src/hardware/`](../mobile-beacon/src/hardware/README.md): one module per component,
the same `setup()`/`loop()` structure, the same state machine, the same serial log format and the exact
payload. Port it module by module; the backend and dashboard need no changes.

## Reporting behaviour

| Firmware state | Interval | Notes |
|---|---|---|
| `IDLE_PROVISIONING` | no transmission | no device credential yet |
| `ARMED_NOMINAL` | every 5 min (heartbeat) | in store, on mains, still |
| `ALARM_BREACH_ACTIVE` | every 1 s | entered on motion plus a mains/geofence event, or a `critical` verdict from the server; left on operator clear or 3 consecutive `nominal` verdicts |
| No network | buffer readings (≥ 200 or 24 h) | send oldest first, at most 3 per loop (the server accepts 5 payloads/s per device) |

Set the server's `OFFLINE_AFTER_MIN` above the heartbeat (e.g. 15 min for a 5-minute heartbeat).
A unit that goes silent mid-breach raises a critical *beacon offline* incident.

## Message contract

HTTPS `POST /api/v1/telemetry` with header `Authorization: Device <device token>`. The JSON shape is
defined in `mobile-beacon/src/hardware/telemetryPayload.ts` and validated by `backend/src/schema.ts`
(the source of truth). Units are engineering units; only `accel_raw` carries raw MPU6050 counts.

```json
{
  "device_id": "DLTA-BCN-9042",
  "timestamp": "2026-11-24T07:36:32.636Z",
  "firmware_version": "dag-fw-1.0.0",
  "status": "SECURE_TRANSMITTING",
  "speed_kmh": 0,
  "bearing_deg": 0,
  "gps": { "latitude": -17.794295, "longitude": 31.037894, "altitude_m": 1492, "accuracy_m": 3, "hdop": 0.6, "satellites": 14, "fix": "3d" },
  "accelerometer": { "accel_x": 0.002, "accel_y": -0.001, "accel_z": 0.998, "accel_raw": [30, -15, 16349], "tilt_deg": 0.1, "vibration_rms": 0.0022, "vibration_status": "Nominal" },
  "power": { "mains_connected": true, "voltage_ac": 231.2, "frequency_hz": 49.98, "battery_level_pct": 100, "battery_charging": true },
  "cold_chain": { "internal_temp_c": 3.8, "target_max_temp_c": 6 },
  "cellular": { "rssi_dbm": -73, "csq": 20, "network": "LTE-M", "registered": true },
  "firmware": { "version": "dag-fw-1.0.0", "state": "ARMED_NOMINAL", "seq": 42, "uptime_s": 3600, "heartbeat_s": 300, "buffered": 0 },
  "simulated": []
}
```

| Field | Unit / source |
|---|---|
| `gps.*`, `speed_kmh`, `bearing_deg` | SIM7000G `+CGNSINF`: decimal degrees, metres, km/h, degrees true, HDOP, satellites used, fix |
| `accelerometer.accel_raw` | MPU6050 ACCEL_X/Y/ZOUT, int16 at ±2 g (16384 LSB/g); `accel_x/y/z` = raw / 16384, in g |
| `accelerometer.vibration_rms` | RMS of (\|a\| − 1 g) over a 2 s, 20 Hz window, in g. Status: < 0.02 Nominal, < 0.08 Warning, else Elevated |
| `power.*` | AC presence (opto), RMS volts, Hz from zero crossings, backup %, charger STAT pin |
| `cellular.rssi_dbm` | −113 + 2 × CSQ from `AT+CSQ` |
| `firmware.seq` | monotonic counter since boot (lets the server detect gaps and replays) |
| `simulated` | empty or omitted on real hardware; the phone twin lists what it could not measure |

Required: `device_id`, `speed_kmh`, `gps.latitude`, `gps.longitude`, `power.mains_connected`. Every other
field is optional and additive. The server computes all risk; anything the device sends about risk is
ignored. The `202` response returns the server's verdict (`severity`, `risk_score_pct`, `incident_id`),
which drives `ALARM_BREACH_ACTIVE` and can drive an on-device LED or buzzer.

HTTPS on the SIM7000G uses the `AT+SH*` command set (TLS 1.2). For very low-power NB-IoT units an MQTT or
CoAP gateway can translate to this HTTPS contract without changing the payload.

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
