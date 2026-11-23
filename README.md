# Delta Asset Guard

Trade-cooler protection platform for Delta Beverages: every cooler's location, power and theft risk,
with a clear, audited response workflow from the control room to the field.

| Part | For | What it is |
|---|---|---|
| [`backend/`](backend) | everyone | Node 22 + TypeScript API, PostgreSQL, risk engine, incidents, notifications, audit, WebSocket hub |
| [`web-admin/`](web-admin) | control room, managers, admins | Command centre, incidents, cooler register, relocations, reports, users & audit |
| [`mobile-beacon/`](mobile-beacon) | field staff | Expo app: Respond to alerts, Install beacons, Check a cooler (plus a demo beacon mode) |
| [`docs/`](docs) | IT & operations | [Operations & security](docs/OPERATIONS.md), [beacon hardware spec](docs/HARDWARE.md) |

Rules for contributors, the API contract and the risk model are in [`CLAUDE.md`](claude.md).

## Quick start (development, demo data)

Requires Node 22.12+.

```bash
cd backend && cp .env.example .env && npm install && npm run dev     # API on :8787, demo data seeded
cd web-admin && npm install && npm run dev                           # dashboard on http://localhost:5173
cd mobile-beacon && npm install && npx expo start                    # field app (Expo Go, same Wi-Fi)
```

The embedded PostgreSQL stores data in `backend/data/` (delete it to start over). Demo sign-ins
(password = `DEMO_PASSWORD` in `backend/.env`):

| Email | Role |
|---|---|
| ops@delta.demo | Operations lead |
| security@delta.demo | Asset Protection |
| north.manager@delta.demo | Area manager (Harare North only) |
| tech@delta.demo | Field technician |
| admin@delta.demo | Administrator |

### Five-minute demo

1. Dashboard: sign in as `ops@delta.demo`. The command centre shows 37 coolers (36 virtual demo coolers marked *Demo* + Phone A's), one stolen cooler and one long power outage.
2. Phone A: sign in as `tech@delta.demo` → **Install** → type `DLTA-BCN-9042` → *OK Supermarket - Avondale* → *Small · 50 m* → "This cooler is now protected".
3. Phone A: **More → Use this phone as the beacon → DLTA-BCN-9042 → Simulate theft**.
4. Dashboard: a theft alert opens within seconds; the Risk Inspector pops up with the AI's reasons and the route. Click **Acknowledge** and **Dispatch team**.
5. Phone B: sign in as `security@delta.demo` → **Respond** → the alert is at the top (nearest) → **Directions** → **Cooler recovered**.
6. Dashboard: the incident closes with the full timeline; **Reports** and **Users & audit** show the record.

No phone? Use the dashboard's **Demo: simulate theft** button.

## Deploy

```bash
cp deploy.env.example deploy.env        # set POSTGRES_PASSWORD, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
docker compose --env-file deploy.env up -d --build
```

One container serves the API, WebSocket and dashboard on port 8787, backed by PostgreSQL 16. Put TLS in
front of it. Details, backups, security model and production checklist: [docs/OPERATIONS.md](docs/OPERATIONS.md).

Then: sign in as the admin → **Users & audit** → create staff accounts → **Cooler register** → import
Delta's cooler list (CSV template provided) → technicians install beacons from the field app.

## Tests

```bash
cd backend && npm test          # 31 tests: risk engine, incident state machine, API, auth, roles, regions
cd backend && npm run test:pg   # same suite through the node-postgres driver (wire protocol)
```

CI (`.github/workflows/ci.yml`) also runs the suite against a real PostgreSQL 16 server, builds the
dashboard, type-checks the field app and builds the Docker image.

## What is still a prototype

- **Beacon hardware.** The phone demo cannot measure mains voltage or cabinet temperature; production needs the in-fridge unit in [docs/HARDWARE.md](docs/HARDWARE.md).
- **Single sign-on.** Accounts are local (scrypt, revocable sessions). Microsoft Entra ID / SAML would replace the login screen for Delta staff.
- **Push notifications** on phones need production app builds with FCM/APNs credentials; SMS/WhatsApp work today via Twilio settings.
- **ERP integration.** The cooler register is imported by CSV; a scheduled sync from Delta's asset system (e.g. SAP) is the next step.
- **Scale.** Tested with dozens of live beacons; for 10,000+ coolers add map clustering, time-series partitioning (TimescaleDB) and a second app instance with a shared WebSocket bus.
