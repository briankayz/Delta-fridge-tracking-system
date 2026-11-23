# Delta Asset Guard AI

IoT telemetry and AI risk-scoring prototype for Delta Beverages (Zimbabwe) commercial display coolers.

| Folder | What it is |
|---|---|
| `backend/` | Node + TypeScript telemetry ingest, rule-based risk engine, incident tracking, WebSocket hub |
| `web-admin/` | Fleet Telemetry & Risk Command Center (React + Vite + Leaflet) — "Phone B / Laptop" |
| `mobile-beacon/` | Beacon node simulator (Expo / React Native) — "Phone A", mounted in the fridge |
| `stitch_delta_app designs/` | Original UI design references |

API contract and risk-scoring rules are documented in [`CLAUDE.md`](claude.md).

## Run it

Requires Node 20+.

```bash
# 1. Backend (port 8787)
cd backend
npm install
npm run dev          # prints the LAN URL, e.g. http://192.168.1.20:8787

# 2. Dashboard (port 5173)
cd web-admin
npm install
npm run dev          # open http://localhost:5173, or http://<laptop-ip>:5173 from Phone B

# 3. Beacon (Phone A, Expo Go)
cd mobile-beacon
npm install
npx expo start       # scan the QR code with Expo Go
```

The dashboard and beacon find the backend automatically (same host / Expo dev host, port 8787).
Override with `VITE_API_URL=http://<ip>:8787` (dashboard) or `EXPO_PUBLIC_API_URL=http://<ip>:8787` (beacon).

### Two-device demo checklist
1. Laptop, Phone A and Phone B on the **same Wi-Fi**.
2. Allow inbound TCP **8787** and **5173** in Windows Defender Firewall (Private network). In an admin PowerShell:
   ```powershell
   New-NetFirewallRule -DisplayName "Delta Asset Guard" -Direction Inbound -Protocol TCP -LocalPort 8787,5173 -Action Allow -Profile Private
   ```
3. On Phone A, the provisioning screen shows `Backend connected • http://<ip>:8787`. Tap **Lock & Start Sentinel Tracker**.
4. Tap **Simulate Displacement Event** on Phone A. Within ~1 s the dashboard shows the red breach pin and trail,
   KPIs move by one, the alert appears in the AI Risk Radar, and the Risk Inspector opens with the AI reasoning.
5. Enter a supervisor PIN on Phone A (any 4+ digits) — or click **Mark as Authorized Move** on the dashboard — to close the incident.

No phone handy? The dashboard's **Simulate Beacon Ingest** button runs the same breach server-side.

### Useful environment variables (backend)
| Variable | Default | Effect |
|---|---|---|
| `PORT` | `8787` | Listen port |
| `INGEST_TOKEN` | unset | If set, `POST /api/v1/telemetry` requires header `x-device-token` (set `EXPO_PUBLIC_DEVICE_TOKEN` on the beacon) |
| `DEMO_FORCE_CURFEW` | unset | `1` = treat all hours as after-hours (shows the night-time velocity rule during a daytime demo) |

## Tests
```bash
cd backend && npm test       # risk engine, incident state machine, HTTP + WebSocket API
```

## Prototype limits
- State is in memory; restarting the backend reseeds the demo fleet.
- No operator authentication; intended for a trusted LAN demo.
- The 1,420-cooler KPI baseline is seeded; only the six demo beacons are tracked live and move those numbers.
