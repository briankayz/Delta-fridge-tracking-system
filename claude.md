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