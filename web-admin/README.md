# Delta Asset Guard AI - Admin Web Dashboard (Phone B / Command Center)

A high-performance React + Tailwind CSS web dashboard (Vite + TypeScript) designed for **Delta Beverages (Zimbabwe)** logistics fleet managers and asset protection directors.

The system tracks commercial beverage coolers across the Harare Metropolitan cluster, monitoring GNSS geofences, AC power continuity, cold-chain temperature compliance, and AI theft risk scores in real time.

---

## Key Features & UI Specifications

### 1. Header Bar (`src/components/HeaderBar.tsx`)
- **Delta Navy Theme:** Dark Navy (`#315B7C`) background styling matching enterprise brand tokens.
- **Branding & Telemetry Pill:** Minimalist Delta logo, `DELTA BEVERAGES` title, `Sentinel AI` badge, and pulsing `System Online` indicator.
- **Top Navigation:** `Live Fleet Map`, `Alert Queue (2)`, `Asset Directory`, `Analytics`, and `Firmware & Telemetry`.
- **Search & Operator Profile:** Real-time asset search, latency monitor (`42ms`), notification bell with unread count (`2`), and operator card (`Takudzwa M. - Fleet Ops Lead`).
- **Interactive Beacon Ingest:** Integrated `Simulate Beacon Ingest` button to test live payload ingestion from Phone A.

### 2. Main Command Dashboard View
- **Sub-Header Bar (`src/components/SubHeaderBar.tsx`):**
  - Title: `Fleet Telemetry & Risk Command Center` with `Harare Ops` badge.
  - Controls: Live stream indicator (`5s Cadence`), cluster dropdown (`Harare Central & Suburbs`), `Export CSV`, and `+ Provision Beacon` action.
- **KPI Stat Strip (`src/components/KpiSummaryStrip.tsx`):**
  - **Total Tracked Assets:** `1,420 Coolers` (1,418 Online • 99.8%, +12 this week).
  - **Active & Compliant:** `1,385 (97.5%)` with `SAFE` badge (Within ≤50m geofence, nominal 3.4°C).
  - **Power Outage Warnings:** `23 Coolers` with `MAINS 0V` badge (AC disconnected > 2 hrs).
  - **AI Anomaly Alerts:** `12 High Risk` with pulsing red dot (Theft & nighttime motion).
- **Interactive Fleet Map (`src/components/FleetMap.tsx`):**
  - Built with **Leaflet.js** and **React-Leaflet**, centered on Harare (`[-17.82485, 31.05303]`).
  - Layer switcher: **Fleet Vector**, **Satellite**, and **Heatmap**.
  - Geofence visualization with dashed safe circles around Avondale, Borrowdale, and CBD.
  - Interactive status pins:
    - Primary Navy/Blue circular clusters for compliant stores (**Avondale** 18 units, **CBD** 42 units, **Borrowdale** 12 units).
    - Amber pulsing warning marker for **Chitepo Bottle Store** (`power_off`, AC offline 8h, batt 61%).
    - Pulsing red breach marker (`fmd_bad`) for unauthorized displacement in **Highfield West Res. / Sector 4**.
    - Red dashed vector displacement polyline connecting origin anchor to relocation breach position.
    - Quick search bar, center Harare button, and clickable marker popups.
- **AI Risk Radar Panel (`src/components/AiRiskRadarPanel.tsx`):**
  - Filter tabs: `All (12)`, `Critical (4)`, `Warning (8)`.
  - **Critical Displacement Card:** `DLTA-BCN-8821` / `DLTA-BCN-9042`, 3.4 km outside geofence, speed 24.1 km/h / 38.5 km/h, 94% Risk score, `Dispatch Response` and `Lockout` actions.
  - **Power Outage Card:** `DLTA-BCN-4012`, 8.2°C temperature breach, battery backup 61%, `Call Merchant` and `Acknowledge` actions.
  - **Resolved History:** Geofence re-entry confirmation logs.
  - **Sensor Health Matrix:** Live status for GPS triangulation, LTE cellular link (-74 dBm), vibration gyro, and average beacon battery capacity (92%).
- **Telemetry Ingest Table (`src/components/TelemetryIngestTable.tsx`):**
  - Real-time tabular stream (buffer 50/sec) with status filters (`All`, `Critical`, `Warning`, `Nominal`).
  - Columns: Asset ID & Type, Retail Merchant / Deployment, Telemetry Status, Internal Temp, Power Source, Beacon Batt, Last Ping, Actions (`Intercept`, `Details`).
  - Supports live row flashing when emergency events arrive.

### 3. Risk Detail Inspector View / Modal (`src/components/RiskDetailInspectorModal.tsx`)
- Triggered by clicking any critical card, table row, or map breach pin.
- **Alert Header:** Cooler photo, Asset Profile, `DLT-COOLER-8821`, `Double Glass Door Beverage Display`, `Tafara Local Bar`, and `UNAUTHORIZED RELOCATION DETECTED` banner.
- **Bento Left - Sentinel AI Engine:**
  - **94% Risk Rating** radial gauge with animated SVG progress track.
  - **AI Reasoning Logs:**
    1. Geofence Breached (Moved 3.4 km outside radius at 23:45).
    2. Transit Vibration Pattern (Logged sustained 45 km/h motion profile).
    3. Power Interrupted (Main AC 234V feed disconnected in transit).
- **Bento Right - Location History Map:**
  - Route visual tracing Tafara Local Bar origin (150m geofence) along dashed red route to Residential Compound, Sector 4.
  - Telemetry footer: Origin Geofence, Current Coordinates, Transit Duration (14 mins).
- **24-Hour Correlation Line Chart (Recharts):**
  - Dual-axis graph correlating **Battery Level (%)** (blue) vs **Movement Speed (km/h)** (red).
  - Highlights breach anomaly window at 23:45 with interactive tooltips and 24H / 12H / 1H range tabs.
- **Containment Action Dock:**
  - `Mark as Authorized Move`
  - `Call Retailer`
  - `Flag for Repossession Team`

---

## Real-Time Telemetry Listener (`src/services/useTelemetryFeed.ts`)

- Listens on WebSocket (`ws://127.0.0.1:8080/ws/telemetry`) and BroadcastChannel (`delta-telemetry-bus`).
- When an emergency breach event is received from the Mobile Beacon (`Phone A`):
  1. Dynamically plots a red pulsing marker and displacement route on the Harare map.
  2. Increments the **AI Anomaly Alerts** count in the KPI summary strip.
  3. Pushes a critical alert card to the top of the **AI Risk Radar**.
  4. Flashes the table row in red with live velocity and coordinates.
  5. Displays an executive toast alert with actionable details.

---

## Development & Build

### Install Dependencies
Dependencies are already installed:
```bash
cd web-admin
npm install
```

### Run Local Development Server
```bash
npm run dev
```
The app will be available at `http://localhost:5173`.

### Production Build
```bash
npm run build
```
Creates an optimized, production-ready static bundle in `dist/`.

