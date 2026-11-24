# Hardware twin (firmware reference)

Audience: the firmware developer porting the beacon to ESP32 + SIM7000G + MPU6050 + DS18B20.

This folder is a TypeScript twin of the beacon firmware. The phone runs it in **More → Demo mode →
Use this phone as the beacon**. Port it module by module; the payload, endpoint, states and log
format must stay identical, so the backend and dashboard need no changes when real hardware arrives.

| Twin file | Firmware counterpart | What must match |
|---|---|---|
| `firmwareLoop.ts` | `setup()` / `loop()` in the sketch | boot order, sensor init timeouts (3 s), FSM, heartbeat, offline buffer (200 readings, oldest first, ≤3 per loop), `seq` counter |
| `telemetryPayload.ts` | JSON builder (ArduinoJson) | every key, type and unit; validated server-side by `backend/src/schema.ts` |
| `sensors/gpsModule.ts` | SIM7000G GNSS: `AT+CGNSPWR=1`, `AT+CGNSINF` | decimal degrees, km/h, course, HDOP, satellites used, fix |
| `sensors/accelerometerModule.ts` | MPU6050 over I2C (0x68), ±2 g, DLPF, 20 Hz ring buffer | `accel_raw` int16 counts, g = raw / 16384, tilt, RMS of (\|a\| − 1 g) over 2 s, thresholds 0.02 g / 0.08 g |
| `sensors/powerMonitorModule.ts` | opto-isolated AC sense (GPIO interrupt), Li-ion ADC, charger STAT pin | `mains_connected`, `voltage_ac`, `frequency_hz`, `battery_level_pct`, `battery_charging` |
| `sensors/tempProbeModule.ts` | DS18B20 on 1-Wire | °C, target max 6 °C |
| `sensors/cellularModule.ts` | SIM7000G: `AT+CNMP=38`, `AT+CMNB=1`, APN, `AT+CSQ`, HTTPS via `AT+SH*` | `rssi_dbm = −113 + 2·CSQ`, `Authorization: Device <token>` header |
| `serial.ts` | `Serial.printf` at 115200 | line format `[   12.345] [TAG] message`, tags BOOT/FSM/GPS/ACCEL/PWR/TEMP/MODEM/HTTP/BUF |

## State machine

| State | Heartbeat | Entered when | Left when |
|---|---|---|---|
| `IDLE_PROVISIONING` | 5 s (no transmit) | no device credential | credential stored → `ARMED_NOMINAL` |
| `ARMED_NOMINAL` | 300 s in production (5 s in the demo) | credential present, alarm cleared | displacement detected or server verdict `critical` |
| `ALARM_BREACH_ACTIVE` | 1 s | motion + geofence/mains event (twin: "Simulate theft"), or server verdict `critical` | operator clear, or 3 consecutive server verdicts `nominal` |

The device never computes risk. It sends measurements; the server returns the verdict in the `202`
response (`severity`, `risk_score_pct`, `incident_id`) and the device only reacts to it.

## Simulated values

A phone cannot measure mains voltage/frequency, cabinet temperature or LTE signal, and has no
MPU6050 registers. The twin fills these with realistic values, prints `[SIM]` on those log lines,
and lists them in the payload's `simulated` array (e.g. `["cellular","cold_chain","power.voltage_ac"]`).
Real firmware sends `simulated: []` or omits it.
