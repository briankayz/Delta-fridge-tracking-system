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

Strictly adhere to the following styling tokens across all generated UI components. Navy and gold are sampled from delta.co.zw and the Delta Corporation logo (navy serif wordmark, gold nested-triangle mark). Gold is an accent only (rules, active markers, logo) and is never used for body text on white. Icons: `lucide-react` only. Status is always icon + label, never colour alone. Charts: one y-axis per chart (no dual axes).

```json
{
  "colors": {
    "primaryNavy": "#123965",
    "darkNavy": "#082563",
    "accentGold": "#C8B967",
    "accentBlue": "#2B5A90",
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

## Platform architecture (current)

```
In-fridge beacon (hardware, or the field app in Demo mode)
        │  POST /api/v1/telemetry   Authorization: Device <token>
        ▼
backend/  Node 22 + TypeScript · Express · ws · zod · PostgreSQL (DATABASE_URL) or embedded PGlite
        │  risk engine → incidents → notifications → audit log
        ├── WS /ws/telemetry (session-authenticated, region-scoped)  ──►  web-admin/ (React + Vite + Leaflet)
        └── REST /api/v1 (Bearer token)                              ──►  mobile-beacon/ (Expo field app)
```

Production is one deployable: the backend serves the built dashboard (`WEB_DIST`). See `Dockerfile`, `docker-compose.yml`, `docs/OPERATIONS.md`.

## Rules for changes

- **The server owns risk.** Device-sent `risk_score_pct`, `geofence_breached`, `displacement_distance_m` are ignored and recomputed.
- **No invented numbers in the UI.** Every figure comes from the cooler register or live telemetry. Demo data is flagged `is_virtual` and labelled "Demo".
- **Every write is audited** (`audit_log`) and every incident action is on its timeline (`incident_events`).
- **Permissions are enforced server-side** (`backend/src/auth/security.ts`); the UI only hides what the role can't do. Users with a region only see that region.
- Schema changes: append a new entry to `backend/src/db/migrations.ts`; never edit an applied one.
- Map tiles must be keyless (OSM standard, Esri imagery / light-grey canvas). **Never CARTO** (watermarks without a key).
- Field app: plain words, one status per screen, 52dp+ touch targets, strings in `mobile-beacon/src/i18n.ts`.

## Roles

| Role | Can |
|---|---|
| admin | everything, incl. users |
| ops_lead | all incidents, register import, approve relocations, audit, demo controls |
| area_manager | incidents and relocation requests in their region |
| asset_protection | acknowledge, assign, dispatch, resolve, field reports |
| technician | install beacons, field reports, relocation requests |
| viewer | read-only |

## API (v2)

Auth: `POST /api/v1/auth/login` → `{ user, permissions, token }` + httpOnly `dag_session` cookie. Web uses the cookie (same origin); mobile sends `Authorization: Bearer <token>`. `GET /auth/me`, `POST /auth/logout`, `POST /auth/change-password`.

| Method | Path | Permission |
|---|---|---|
| POST | `/api/v1/telemetry` | device token (`Authorization: Device …`) |
| GET | `/api/v1/summary`, `/assets`, `/assets/:id`, `/retailers`, `/incidents`, `/incidents/:id`, `/incidents/export.csv`, `/relocations`, `/reports/summary`, `/register/template.csv` | fleet:read |
| POST | `/api/v1/assets/:id/provision` → `{ asset, device_token }` | asset:provision |
| POST | `/api/v1/incidents/:id/acknowledge` · `/assign` · `/dispatch` · `/resolve` | incident:act |
| POST | `/api/v1/incidents/:id/notes` · `/field-update` (`found` / `not_found` / `recovered` / `authorized`) | incident:field |
| POST | `/api/v1/relocations` | relocation:request |
| POST | `/api/v1/relocations/:id/decision` | relocation:decide |
| POST | `/api/v1/register/import` (`{ csv, dry_run }`) | register:import |
| GET/POST/PATCH | `/api/v1/users`, `/users/:id` | user:manage |
| GET | `/api/v1/users/assignable` | incident:act |
| GET | `/api/v1/audit`, `/notifications` | audit:read |
| POST | `/api/v1/assets/:id/simulate-breach`, `/demo-reset` | demo:control + `DEMO_MODE=1` |
| WS | `/ws/telemetry` (cookie or `?token=`) | any signed-in user; events: `snapshot`, `asset.updated`, `incident.opened`, `incident.updated`, `incident.resolved` (each with region-scoped `summary`) |

## Incidents

Kinds: `displacement` (opens at risk ≥ 75, auto-resolves after 3 calm payloads at home), `power` (prolonged outage ≥ 2 h, resolves when mains return), `signal_lost` (no report for `OFFLINE_AFTER_MIN`, critical if it went silent mid-breach; resolves when reporting resumes). Status: `open` → `acknowledged` → `resolved` with a resolution. Resolving a displacement as `authorized` re-anchors the geofence at the cooler's current position. Approved relocations cap risk below critical during their window and re-anchor on arrival.

## AI risk scoring heuristic (`backend/src/riskEngine.ts`)

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
| Approved relocation | active window | caps score at 74 (shown as negative points) |

Capped at 100. Severity: ≥ 75 critical, ≥ 40 warning, else nominal. Confidence = 0 below 40, else min(99, round(50 + 12.5 × firing families [geofence, power, velocity, shock])).
