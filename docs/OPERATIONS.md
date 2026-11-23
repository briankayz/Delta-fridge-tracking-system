# Operations & security

Audience: IT and operations staff running Delta Asset Guard.

## Deployment model

One container (`Dockerfile`) serves the REST API, the WebSocket hub and the web dashboard on port 8787.
State lives in PostgreSQL (16 recommended). `docker-compose.yml` runs both.

```
Internet ──TLS──► reverse proxy / load balancer ──► app:8787 ──► PostgreSQL
                                 ▲
       beacons (HTTPS POST) ─────┘   field app (HTTPS + Bearer token)
```

- Terminate TLS in front of the app (nginx, Caddy, cloud load balancer). Session cookies are marked
  `Secure` when `NODE_ENV=production`, so the dashboard must be served over HTTPS.
- Forward WebSocket upgrades for `/ws/telemetry`.
- The app trusts `X-Forwarded-For` only from loopback and private networks (`trust proxy`).

## Configuration

All settings are environment variables; see `backend/.env.example` and `deploy.env.example`.

| Variable | Required in production | Notes |
|---|---|---|
| `DATABASE_URL` | yes | `postgres://user:pass@host:5432/db`. Without it an embedded database is used (development only). |
| `JWT_SECRET` | yes | 32+ random characters. Rotating it signs everyone out. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | first start | Creates the first administrator when no users exist. Change the password after signing in. |
| `DEMO_MODE` | no (keep `0`) | `1` seeds demo users and virtual coolers and enables simulation controls. A warning is logged if enabled in production. |
| `CORS_ORIGINS` | no | Only needed if a browser app on another origin calls the API. The dashboard is same-origin. |
| `OFFLINE_AFTER_MIN` | no | Minutes of silence before a beacon is "offline" (default 15). Set above the hardware heartbeat interval. |
| `TELEMETRY_RETENTION_DAYS` | no | Raw telemetry is pruned after this (default 90). Incidents and audit are kept. |
| `DB_POOL_MAX` | no | PostgreSQL connections per app instance (default 10). |
| `NOTIFY_WEBHOOK_URL` | no | JSON POST for each alert (Teams workflow, Slack, integration bus). |
| `TWILIO_*` | no | SMS / WhatsApp to users with a phone number, by role and region. |

## First-time setup

1. Deploy, sign in as the admin, change the admin password (account menu → Change password).
2. **Users & audit → Add user** for each person. Give area managers a region so they only see their area.
   Add mobile numbers for anyone who should get SMS/WhatsApp alerts.
3. **Cooler register → CSV template**, fill it from Delta's asset system, then import. The import is
   validated first (dry run) and never creates duplicates; re-importing updates existing coolers.
4. Technicians install beacons from the field app (**Install** tab). Each installation issues a unique
   device credential.

## Security model

| Area | Control |
|---|---|
| Staff sign-in | scrypt password hashes, 10+ character policy, 10 attempts / 15 min per IP+email, uniform timing for unknown emails |
| Sessions | signed JWT (12 h default) in an httpOnly SameSite cookie (web) or Bearer token (mobile, stored in Keychain/Keystore). Changing role, region, password or disabling a user revokes their sessions within 30 s. |
| Authorisation | role permissions enforced on every endpoint; region-scoped users cannot read or act on other regions (404) |
| Devices | per-beacon random credential (only a SHA-256 hash is stored); re-installing rotates it; 5 payloads/s limit per device |
| Input | every request body validated (zod); 6 MB body limit; CSV export guards against spreadsheet formula injection |
| Browser | Helmet headers with a strict Content-Security-Policy (only map tiles, Google Fonts and the Leaflet stylesheet are allowed off-site), no framing |
| Audit | sign-ins (including failures), user changes, provisioning, imports, every incident action and demo control, with actor and IP |

Known gaps before handling Delta production data: single sign-on with Delta's identity provider,
MFA for administrators, a penetration test, and a data-protection review of stored phone numbers and
locations.

## Backups and retention

- Back up PostgreSQL daily (`pg_dump` or the cloud provider's snapshots) and test a restore.
- Raw telemetry is pruned after `TELEMETRY_RETENTION_DAYS`; incidents, timelines, notifications and
  the audit log are kept (archive them per Delta's retention policy).

## Monitoring

- `GET /health` returns `200 {ok:true}` when the app and database respond (used by the Docker healthcheck).
- Logs are JSON lines on stdout (request method, path, status, duration; errors with stack traces).
- Watch: rising `signal_lost` incidents (network or tamper), failed notifications (**Users & audit → Notifications**),
  and repeated `auth.login_failed` in the audit log.

## Scaling notes

- A single instance comfortably handles thousands of beacons on a 5-minute heartbeat.
- For multiple instances, place a shared pub/sub (e.g. Redis or PostgreSQL `LISTEN/NOTIFY`) behind
  the WebSocket hub and move the login rate limiter to shared storage.
- For tens of thousands of coolers, partition `telemetry` by time (TimescaleDB) and add map clustering.
