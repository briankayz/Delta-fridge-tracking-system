# CLAUDE.md - Project Context & Prototyping Guidelines

## Project Overview
**Delta Asset Guard AI** is an IoT-enabled telemetry and AI risk-scoring prototype designed for Delta Beverages (Zimbabwe). 
The system tracks commercial display fridges to prevent unauthorized relocation, theft, and improper usage (such as turning off AC power overnight).

The system consists of two distinct components:
1. **Phone A (Beacon Node / IoT Simulator):** Mobile web/React Native interface acting as an onboard hardware telemetry unit inside the fridge.
2. **Phone B / Laptop (Admin Ops Dashboard):** Enterprise web dashboard for Delta logistics managers featuring live map tracking and AI risk analysis.

---

## Technical Stack & Framework Specs

### 1. Mobile Beacon App (Phone A)
- **Framework:** React Native (Expo) or Tailwind Mobile Web UI.
- **Sensors & APIs:** HTML5 Geolocation / React Native Location API, Accelerometer (DeviceMotion / MPU6050 payload contract), Battery status (AC Mains simulation).
- **Primary Screen 1:** Beacon Setup & Provisioning (`DLTA-BCN-9042`, OK Supermarket Avondale, 50m geofence).
- **Primary Screen 2:** Active Telemetry Node (`STATUS: SECURE & TRANSMITTING`, live accelerometer graph, AC 234V feed, "Simulate Displacement Event" trigger button).

### 2. Admin Command Dashboard (Phone B / Desktop Web)
- **Framework:** React (Vite / Next.js) + Tailwind CSS.
- **Icons & Mapping:** `lucide-react`, Leaflet.js / React-Leaflet (or Mapbox GL JS) with custom SVG markers.
- **Charts:** `recharts` (24-hour battery vs speed correlation graph).
- **Primary Screen 1:** Fleet Telemetry & Risk Command Center (`1,420 Tracked Assets`, live Harare map with Avondale, Borrowdale, Highfield, Mbare, Eastlea, Tafara clusters).
- **Primary Screen 2:** Risk Assessment Inspector (`Cooler ID: DLT-COOLER-8821`, 94% Risk Rating radial gauge, AI Reasoning logs, Repossession action panel).

### 3. Backend & Real-Time Sync
- **Database & WebSockets:** Supabase / Firebase Realtime or Lightweight Django REST Framework + Channels.
- **API Endpoint:** `POST /api/v1/telemetry`

---

## Brand & Visual System Constraints

Strictly adhere to the following styling tokens across all generated UI components:

```json
{
  "colors": {
    "primaryNavy": "#315B7C",
    "darkNavy": "#003366",
    "accentGold": "#D4AF37",
    "accentCyan": "#0087DC",
    "bgDark": "#0F172A",
    "bgDarkCard": "#1E293B",
    "bgLight": "#F8FAFC",
    "bgLightCard": "#FFFFFF",
    "statusSafe": "#10B981",
    "statusWarning": "#F59E0B",
    "statusCritical": "#EF4444"
  },
  "typography": "Inter, system-ui, sans-serif",
  "borderColors": "Dark: #334155 | Light: #E2E8F0",
  "borderRadius": "8px (rounded-lg)"
}
```

---

## Backend & Integration Contract (implemented)

### Topology & ports
- `backend/` — Node 22 + TypeScript (Express, `ws`, `zod`). Default port **8787** (8080 is taken by Apache on the dev laptop). One port serves HTTP and the WebSocket.
- `web-admin/` — Vite on 5173. Talks to `http://<same host>:8787` unless `VITE_API_URL` is set.
- `mobile-beacon/` — Expo. Talks to `http://<Metro host IP>:8787` (from Expo `hostUri`) unless `EXPO_PUBLIC_API_URL` is set.

### API
| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/telemetry` | `FridgeTelemetryPayload` (see `mobile-beacon/src/types/telemetry.ts`, validated by `backend/src/schema.ts`). Returns 202 with `risk_score_pct`, `theft_prediction_confidence_pct`, `severity`, `reasons[]`, `incident_id`. Optional `x-device-token` when `INGEST_TOKEN` is set. |
| GET | `/api/v1/assets` | `{ summary, assets: AssetState[], incidents }` |
| GET | `/api/v1/assets/:id` | `{ asset, history, incident }` |
| POST | `/api/v1/assets/:id/simulate-breach` | Server-side 1 Hz breach stream (works without Phone A). Device payloads for that asset are ignored while it runs. |
| POST | `/api/v1/assets/:id/provision` | `{ anchor_lat, anchor_lng, geofence_radius_m?, retailer_id?, retailer_name?, open_hour?, close_hour? }` |
| POST | `/api/v1/assets/:id/reset` | `{ resolution?: 'authorized' \| 'reset' }` — closes the incident, snaps to anchor. |
| WS | `/ws/telemetry` | Server → client events: `snapshot`, `asset.updated`, `incident.opened` (once per incident), `incident.resolved`. Every event carries `summary`. |

### Rules
- **The server owns risk.** Client-sent `risk_score_pct`, `geofence_breached`, `displacement_distance_m` are ignored and recomputed.
- KPI counters, toasts, row flashes and the auto-opening Risk Inspector react to `incident.opened` only — never to individual payloads.
- Map tiles must be keyless: OpenStreetMap standard, Esri World Imagery, Esri Light Gray Canvas. **Do not use CARTO basemaps** — they now return an "API KEY REQUIRED" watermark tile.

### AI risk scoring heuristic (`backend/src/riskEngine.ts`)
| Signal | Condition | Points |
|---|---|---|
| Geofence | `r < d ≤ 2r` (drift) | 20 |
| | `d > 2r` | 40 + up to 10 (full at 1 km beyond 2r) |
| AC power | cut, stationary, in fence, < 2 h | 10 |
| | cut, stationary, in fence, ≥ 2 h | 40 |
| | cut while moving (≥ 5 km/h) or `d > 2r` | 25 |
| Velocity | ≥ 5 km/h in trading hours | 10 |
| | ≥ 5 km/h in curfew (default 22:00–07:00 CAT) | 20 |
| Shock/tilt | MPU-6050 `Elevated` or tilt > 10° | 5 |
| Cold chain | internal temp > target max | 5 |

Capped at 100. Severity: ≥ 75 critical (opens incident), ≥ 40 warning, else nominal. Confidence = 0 below 40, else min(99, 50 + 12.5 × firing families [geofence, power, velocity, shock]). An incident auto-resolves after 3 consecutive payloads inside the fence at < 2 km/h. `DEMO_FORCE_CURFEW=1` treats all hours as curfew.
