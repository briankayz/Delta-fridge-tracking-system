# Delta Asset Guard AI - Mobile Beacon Node (Phone A)

A production-ready React Native (Expo) mobile telemetry simulator and IoT hardware node interface built for **Delta Beverages (Zimbabwe)** cold-chain asset tracking.

This application acts as an onboard hardware telemetry unit (`DLTA-BCN-9042`) mounted inside commercial beverage display coolers. It monitors GNSS geofences, inertial motion (MPU-6050 3-axis accelerometer), and 234V AC grid power feeds to prevent unauthorized cooler relocations, theft, and improper overnight power shutdowns.

---

## Screen Gallery & Visual Fidelity

The application replicates the visual layouts, colors, typography, and micro-copy from the Stitch design specifications:

### 1. Setup & Provisioning Screen (`delta_cooler_sentinel_beacon_setup`)
- **Device Header:** Geometric Delta triangle branding, `COLD-CHAIN SENTINEL`, Sentinel Beacon `#9042`, and cyan pulse `PROVISIONING` status pill.
- **Hardware Metadata Pill:** `memory` v2.4.1 • `DLTA-BCN-9042` • IMEI: `864920041289123`.
- **Merchant & Operational Profile:** Assigned to **OK Supermarket - Avondale** (`RET-HRE-0419`, Harare North Commercial) with retailer selector modal.
- **Geofence Radius Control:** Range slider (25m boutique to 250m warehouse) set to default **Strict 50m** zone with displacement threshold alert footnote.
- **Operating Shift Windows:** 15h Active / 9h Lockdown timeline (Store open 07:00, Store close 22:00) with segmented day schedule ribbon.
- **Pre-Flight Diagnostics (2x2 Grid):**
  - **GNSS Accuracy:** `±3m` (12 Sats, Lat: -17.7942° S, Lon: 31.0378° E, HDOP 0.8).
  - **Vector G-Force (MPU-6050):** `0.01g` (Calibrated, Tilt: 0.4°, Motion Guard Armed).
  - **Supply Feed:** `234V` (Mains AC, 50.0 Hz Clean, Li-ion 98%).
  - **Cellular Link:** `4G LTE` (-72 dBm, APN: `iot.deltabev.co`, Encrypted TLS 1.3).
- **Physical Mounting Preview:** Showcase Bay 02 Bracket with magnetic tamper seal validation and camera shortcut.
- **Action Dock:** `LOCK & START SENTINEL TRACKER` button with crypto-key committing animation and transition to live telemetry.

### 2. Active Telemetry Transmission Screen (`delta_cooler_sentinel_active_node_status`)
- **Node Status Strip:** Node ID `DLTA-BCN-9042`, FW `v2.4.1`, battery indicator (98% charging), and store branch tag.
- **Surveillance Status & Radar Hub:** Animated concentric rings with rotating SVG radar sweep gradient, pulsing status badge (`STATUS: SECURE & TRANSMITTING`), live heartbeat (10s cadence), last payload timestamp, and next sync countdown timer.
- **Sentinel AI Risk Evaluation:** Displacement risk gauge at `0.0% (Nominal / Safe)`.
- **Live Data Feed Cards:**
  - **GPS Telemetry:** `GEOFENCE: INSIDE`, Lat `-17.79421° S`, Lon `31.03784° E`, 14 Sats, velocity `0.0 km/h STATIONARY`, anchor drift `3.4m / 50.0m` (7% rail).
  - **Inertial Sentinel (MPU-6050):** Real-time SVG waveforms for X-Axis (`+0.002g`), Y-Axis (`-0.001g`), and Z-Axis (`0.998g` 1G vector), with RMS vibration diagnostics (`0.004 mm/s`).
  - **Cold Chain & Grid:** AC Online monitor, internal chamber probe `3.8°C` (Optimal 2.0° - 6.0°), compressor load `1.42A`, `234.2V AC / 50.1Hz`, and magnetic chassis bracket tamper seal `ARMED & SEALED`.
- **Simulation Control:** Large action button **`SIMULATE DISPLACEMENT EVENT`** to immediately trigger an unauthorized relocation alert.

### 3. High-Alert Emergency Breach Screen (`delta_asset_guard_telemetry_node_9042_breach_alert`)
- **Breach Alert Bar & Header:** Flashing crimson warning bar, Priority 1 Intervention chip, elapsed stopwatch (`T+ 03m 14s`), and `UNAUTHORIZED DISPLACEMENT` banner.
- **Critical Velocity Panel:** Live displacement velocity at tabular **`38.5 km/h`**, sustained motion indicator, and `Bearing 42° NE (Rapid Transit)`.
- **Theft Prediction Confidence:** **`98.4% MATCH`** progress track with breakdown chips: Geofence (100% Breached), Curfew Time (96% Anomaly), Mains Power (99% Cut).
- **Diagnostics Grid:** Boundary violation `+2.42 km` from Avondale anchor point, telemetry power `DISCONNECTED` (Li-ion 92%, 14h rem.).
- **Industrial Tactical Map Vector:** Interactive SVG displacement radar displaying the 50m anchor circle, curved dashed trajectory line, current node ping marker at Sector 4 Transit, coordinates `-17.78120° S, 31.05431° E`, and 1s burst transmission rate.
- **Remote Containment Actions:**
  - `Lockout Compressor & Sound Siren`: Dispatches 110dB remote siren.
  - `Authorize Movement / PIN Override`: Prompts for 4-digit or 6-digit Supervisor PIN to acknowledge authorized relocation and clear emergency state.
- **Live Audit Stream:** Broadcast toast confirming AES-256 encrypted telemetry stream to Harare Central HQ (`ACK 9042`).

---

## Telemetry Engine & Broadcaster Architecture

### Physical & Mock Sensor Engine (`src/services/sensorEngine.ts`)
- **`expo-location`:** Requests foreground location permissions; reads actual device GPS coordinates, altitude, and speed.
- **`expo-sensors` (`Accelerometer`):** Listens to 3-axis acceleration; calculates tilt angle and RMS vibration.
- **`expo-battery`:** Monitors device battery level and AC charging state.
- **Seamless Fallback:** When run on an emulator or without physical sensors, natural realistic hardware micro-jitter is generated around baseline values (-17.7942° S, 31.0378° E, 234.2V AC, 3.8°C).

### State Broadcaster Service (`src/services/telemetryStream.ts`)
- Broadcasts sensor updates every **5 seconds** in nominal mode and **1 second** during breach burst mode.
- Connects to local WebSocket server (`ws://127.0.0.1:8080/ws/telemetry`) and syncs via HTTP `POST /api/v1/telemetry`.
- When "SIMULATE DISPLACEMENT EVENT" is triggered, it instantly emits a payload matching the `FridgeTelemetryPayload` schema:
  ```json
  {
    "device_id": "DLTA-BCN-9042",
    "cooler_id": "DLT-COOLER-8821",
    "status": "BREACH_ALERT",
    "geofence_breached": true,
    "geofence_radius_m": 50,
    "displacement_distance_m": 2420,
    "speed_kmh": 38.5,
    "bearing_deg": 42,
    "risk_score_pct": 94.0,
    "theft_prediction_confidence_pct": 98.4,
    "mains_power_cut": true,
    "gps": {
      "latitude": -17.78120,
      "longitude": 31.05431,
      "accuracy_m": 2.8
    }
  }
  ```

---

## Getting Started

### 1. Install Dependencies
Dependencies are already configured and installed in `mobile-beacon/`:
```bash
cd mobile-beacon
npm install
```

### 2. Start the App
Run Expo development server:
```bash
npm start
# or
npx expo start
```

### 3. Platform Targets
- **Android Device / Emulator:** Press `a` in terminal or run `npm run android`
- **iOS Simulator:** Press `i` in terminal or run `npm run ios`
- **Web Browser:** Press `w` in terminal or run `npm run web`
- **Physical Phone:** Scan the QR code using the Expo Go mobile app.

