# Delta Asset Guard · Web dashboard

React + TypeScript + Vite + Tailwind, Leaflet maps, Recharts, lucide icons. Delta brand: navy
`#123965` / `#082563`, gold `#C8B967` (accent only).

## Pages

| Page | Who | What |
|---|---|---|
| Sign in | everyone | Account sign-in (session cookie) |
| Command centre | everyone | KPIs from the cooler register, live map, live incidents, beacon health |
| Incidents | everyone (actions by role) | Case files: acknowledge, assign, dispatch, notes, resolve with outcome, full timeline, CSV export |
| Cooler register | everyone (import: ops lead/admin) | All coolers with live state; CSV import with validation preview; template download |
| Relocations | request: managers/technicians · approve: ops lead/admin | Planned moves that won't raise theft alerts |
| Reports | everyone | Incidents, recoveries, MTTA/MTTR by region; CSV export |
| Users & audit | admin (users), ops lead/admin (audit) | Accounts and roles, audit log, notification outbox |

The **Risk Inspector** slide-over opens from any map pin, table row or incident, and pops up automatically
for new theft alerts.

## Run

```bash
npm install
npm run dev        # http://localhost:5173, proxies /api and /ws to the backend on :8787
npm run build      # production build in dist/ (served by the backend in production)
```

`API_PROXY_TARGET` changes the dev proxy target; `VITE_API_URL` points a build at another API origin
(that origin must then be listed in the backend's `CORS_ORIGINS`).

## Conventions

- Status is always icon + label, never colour alone (`components/ui.tsx` → `StatusBadge`).
- One y-axis per chart; the Inspector shows speed and battery as two aligned charts.
- No hard-coded figures: everything shown comes from the API or live WebSocket events.
- Basemaps must be keyless (OSM, Esri). CARTO shows an "API KEY REQUIRED" watermark without a key.
