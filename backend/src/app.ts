// HTTP API + WebSocket hub. createApp() wires services together; server.ts adds listen/timers.
import http from 'node:http';
import cors from 'cors';
import helmet from 'helmet';
import express, { NextFunction, Request, Response } from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { z } from 'zod';
import { Config } from './config.ts';
import { Db, openDb } from './db/index.ts';
import {
  can,
  canSeeRegion,
  deviceTokenMatches,
  Permission,
  permissionsFor,
  RateLimiter,
  signSession,
  verifySession,
} from './auth/security.ts';
import {
  AssignSchema,
  DecisionSchema,
  DispatchSchema,
  FieldUpdateSchema,
  LoginSchema,
  NoteSchema,
  ProvisionSchema,
  RegisterImportSchema,
  RelocationSchema,
  ResolveSchema,
  TelemetryPayloadSchema,
  UserCreateSchema,
  UserUpdateSchema,
} from './schema.ts';
import { FleetService, HubEvent } from './services/fleet.ts';
import { IncidentService } from './services/incidents.ts';
import { Notifier } from './services/notifier.ts';
import { assetHistory, fleetSummary, getIncident, listAssets, listIncidents } from './services/readModel.ts';
import { importRegister, parseRegisterCsv, REGISTER_COLUMNS } from './services/register.ts';
import { RelocationService } from './services/relocations.ts';
import { UserService } from './services/users.ts';
import { audit } from './services/audit.ts';
import { BreachSimulator, VirtualFleet } from './simulator.ts';
import { AuthUser, FleetSummary, ServerEvent } from './types.ts';
import { HttpError, log, toCsv } from './util.ts';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const SESSION_COOKIE = 'dag_session';
export const API_VERSION = '2.0.0';

type Handler = (req: Request, res: Response) => Promise<unknown> | unknown;
const h = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res)).catch(next);

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body ?? {});
  if (!r.success) throw new HttpError(400, 'Invalid request', r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  return r.data;
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export interface AppOptions {
  cfg: Config;
  db?: Db;
  now?: () => Date;
  fetchImpl?: typeof fetch;
}

export async function createApp(opts: AppOptions) {
  const { cfg } = opts;
  const now = opts.now ?? (() => new Date());
  const db = opts.db ?? (await openDb({ databaseUrl: cfg.databaseUrl, dataDir: cfg.dataDir }));

  const notifier = new Notifier(db, cfg, opts.fetchImpl);
  const fleet = new FleetService(db, cfg, notifier, now);
  const incidents = new IncidentService(db, fleet, notifier, now);
  const relocations = new RelocationService(db, now);
  const users = new UserService(db);
  const simulator = new BreachSimulator(fleet);
  const virtualFleet = new VirtualFleet(db, fleet);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: cfg.corsOrigins.length ? cfg.corsOrigins : false, credentials: true }));
  app.use(express.json({ limit: '6mb' }));
  app.use((req, res, next) => {
    const t = Date.now();
    res.on('finish', () => {
      if (req.path !== '/health' && !(req.path === '/api/v1/telemetry' && res.statusCode < 400)) {
        log.info('http', { method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - t });
      }
    });
    next();
  });

  // ---- authentication ----------------------------------------------------------------------
  async function authenticate(token: string | undefined): Promise<AuthUser | null> {
    if (!token) return null;
    const claims = await verifySession(token, cfg.jwtSecret);
    if (!claims) return null;
    const u = await users.byId(claims.sub);
    if (!u || !u.active || u.token_version !== claims.ver) return null;
    return { id: u.id, email: u.email, name: u.name, role: u.role, region: u.region, phone: u.phone };
  }

  const tokenFrom = (req: http.IncomingMessage) => {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) return auth.slice(7);
    return readCookie(req.headers.cookie, SESSION_COOKIE);
  };

  const requireUser =
    (perm?: Permission) =>
    async (req: Request, _res: Response, next: NextFunction) => {
      try {
        const user = await authenticate(tokenFrom(req));
        if (!user) throw new HttpError(401, 'Sign in required');
        if (perm && !can(user, perm)) throw new HttpError(403, 'Your role does not allow this action');
        req.user = user;
        next();
      } catch (err) {
        next(err);
      }
    };

  const loginLimiter = new RateLimiter(10, 15 * 60_000);
  const deviceLimiter = new RateLimiter(5, 1000);
  const actor = (req: Request) => ({ id: req.user!.id, name: req.user!.name });
  const ro = () => ({ ...fleet.readOpts() });
  const regionOf = (req: Request) => req.user?.region ?? null;

  async function visibleAsset(req: Request, id: string) {
    const a = await fleet.asset(id);
    if (!a || !canSeeRegion(req.user!, a.region)) throw new HttpError(404, 'Asset not found');
    return a;
  }

  // ---- public ----------------------------------------------------------------------------------
  app.get('/health', h(async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ ok: true, version: API_VERSION, db: db.kind, time: now().toISOString() });
  }));

  app.get('/api/v1/meta', (_req, res) => {
    res.json({ version: API_VERSION, demo_mode: cfg.demoMode, offline_after_min: cfg.offlineAfterMin, register_columns: REGISTER_COLUMNS });
  });

  app.post('/api/v1/auth/login', h(async (req, res) => {
    const body = parse(LoginSchema, req.body);
    const key = `${req.ip}:${body.email.toLowerCase()}`;
    if (!loginLimiter.take(key)) throw new HttpError(429, 'Too many sign-in attempts. Try again in 15 minutes.');
    const u = await users.authenticate(body.email, body.password, req.ip);
    if (!u) throw new HttpError(401, 'Email or password is incorrect');
    loginLimiter.reset(key);
    const token = await signSession(u, cfg.jwtSecret, cfg.sessionHours);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: cfg.env === 'production',
      maxAge: cfg.sessionHours * 3_600_000,
      path: '/',
    });
    const user: AuthUser = { id: u.id, email: u.email, name: u.name, role: u.role, region: u.region, phone: u.phone };
    res.json({ user, permissions: permissionsFor(u.role), token, expires_in: cfg.sessionHours * 3600 });
  }));

  app.post('/api/v1/auth/logout', h(async (req, res) => {
    const u = await authenticate(tokenFrom(req));
    if (u) await audit(db, { id: u.id, name: u.name }, 'auth.logout', null, undefined, req.ip);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  }));

  app.get('/api/v1/auth/me', requireUser(), (req, res) => {
    res.json({ user: req.user, permissions: permissionsFor(req.user!.role) });
  });

  // ---- device ingest ------------------------------------------------------------------------------
  app.post('/api/v1/telemetry', h(async (req, res) => {
    const auth = req.headers.authorization;
    const token = auth?.startsWith('Device ') ? auth.slice(7) : (req.headers['x-device-token'] as string | undefined);
    const payload = parse(TelemetryPayloadSchema, req.body);
    if (!token) throw new HttpError(401, 'Device token required');
    const row = await db.one<{ device_token_hash: string | null }>(`SELECT device_token_hash FROM assets WHERE id = $1 AND status = 'active'`, [
      payload.device_id,
    ]);
    if (!row || !deviceTokenMatches(token, row.device_token_hash)) throw new HttpError(401, 'Invalid device credentials');
    if (!deviceLimiter.take(payload.device_id)) throw new HttpError(429, 'Too many payloads');
    if (simulator.isRunning(payload.device_id)) {
      return res.status(202).json({ accepted: false, reason: 'simulation_active' });
    }
    const { asset, risk } = await fleet.ingest(payload);
    res.status(202).json({
      accepted: true,
      asset_id: asset.id,
      risk_score_pct: risk.score,
      theft_prediction_confidence_pct: risk.confidence,
      severity: risk.severity,
      geofence_breached: risk.geofenceBreached,
      displacement_distance_m: Math.round(asset.distance_m),
      reasons: risk.reasons,
      incident_id: asset.incident_id,
      location_name: asset.location_name,
    });
  }));

  // ---- fleet ------------------------------------------------------------------------------------------
  app.get('/api/v1/summary', requireUser('fleet:read'), h(async (req, res) => {
    res.json(await fleetSummary(db, { ...ro(), region: regionOf(req) }));
  }));

  app.get('/api/v1/assets', requireUser('fleet:read'), h(async (req, res) => {
    const region = regionOf(req);
    const [summary, assets, incs] = await Promise.all([
      fleetSummary(db, { ...ro(), region }),
      listAssets(db, { ...ro(), region }),
      listIncidents(db, { status: 'all', region, limit: 100 }),
    ]);
    res.json({ summary, assets, incidents: incs });
  }));

  app.get('/api/v1/assets/:id', requireUser('fleet:read'), h(async (req, res) => {
    const asset = await visibleAsset(req, req.params.id);
    const [history, incs] = await Promise.all([
      assetHistory(db, asset.id, Math.min(Number(req.query.limit ?? 2000), 5000)),
      listIncidents(db, { status: 'all', assetId: asset.id, limit: 20 }),
    ]);
    res.json({ asset, history, incident: incs.find((i) => i.id === asset.incident_id) ?? null, incidents: incs });
  }));

  app.post('/api/v1/assets/:id/provision', requireUser('asset:provision'), h(async (req, res) => {
    const body = parse(ProvisionSchema, req.body);
    const existing = await fleet.asset(req.params.id);
    if (existing && !canSeeRegion(req.user!, existing.region)) throw new HttpError(404, 'Asset not found');
    if (!/^[A-Za-z0-9_-]{3,64}$/.test(req.params.id)) throw new HttpError(400, 'Invalid device id');
    const result = await fleet.provision(req.params.id, body, actor(req), req.ip);
    res.json(result);
  }));

  app.get('/api/v1/retailers', requireUser('fleet:read'), h(async (req, res) => {
    res.json(
      await db.query(
        `SELECT r.*, (SELECT count(*)::int FROM assets a WHERE a.retailer_id = r.id AND a.status = 'active') AS coolers
           FROM retailers r WHERE ($1::text IS NULL OR lower(r.region) = lower($1)) ORDER BY r.region, r.name`,
        [regionOf(req)]
      )
    );
  }));

  // ---- demo controls ----------------------------------------------------------------------------------
  const requireDemo = (_req: Request, _res: Response, next: NextFunction) =>
    cfg.demoMode ? next() : next(new HttpError(404, 'Demo controls are disabled'));

  app.post('/api/v1/assets/:id/simulate-breach', requireDemo, requireUser('demo:control'), h(async (req, res) => {
    const asset = await visibleAsset(req, req.params.id);
    simulator.start({ id: asset.id, anchor: asset.anchor, battery_pct: asset.battery_pct });
    await audit(db, actor(req), 'demo.simulate_breach', asset.id, undefined, req.ip);
    res.status(202).json({ started: true });
  }));

  app.post('/api/v1/assets/:id/demo-reset', requireDemo, requireUser('demo:control'), h(async (req, res) => {
    const asset = await visibleAsset(req, req.params.id);
    simulator.stop(asset.id);
    for (const i of asset.open_incidents.filter((x) => x.kind === 'displacement')) {
      await incidents.resolve(i.id, 'reset', 'Demo reset: cooler returned to store.', req.user!, req.ip);
    }
    await fleet.ingest({
      device_id: asset.id,
      speed_kmh: 0,
      gps: { latitude: asset.anchor.lat, longitude: asset.anchor.lng },
      power: { mains_connected: true, voltage_ac: 230, battery_level_pct: asset.battery_pct ?? 92 },
      cold_chain: { internal_temp_c: 3.8 },
    });
    res.json({ ok: true });
  }));

  // ---- incidents ----------------------------------------------------------------------------------------
  app.get('/api/v1/incidents', requireUser('fleet:read'), h(async (req, res) => {
    const status = (['open', 'resolved', 'all'].includes(String(req.query.status)) ? req.query.status : 'all') as 'open' | 'resolved' | 'all';
    res.json(
      await listIncidents(db, {
        status,
        kind: req.query.kind ? String(req.query.kind) : undefined,
        region: regionOf(req),
        limit: Number(req.query.limit ?? 100),
      })
    );
  }));

  app.get('/api/v1/incidents/export.csv', requireUser('fleet:read'), h(async (req, res) => {
    const days = Math.min(Number(req.query.days ?? 30), 366);
    const since = new Date(now().getTime() - days * 86_400_000).toISOString();
    const rows = await listIncidents(db, { status: 'all', region: regionOf(req), limit: 1000, since });
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="delta-incidents-${days}d.csv"`);
    res.send(
      toCsv(
        ['incident', 'asset', 'kind', 'severity', 'status', 'region', 'retailer', 'opened_at', 'acknowledged_at', 'acknowledged_by', 'resolved_at', 'resolution', 'resolved_by', 'peak_score'],
        rows.map((i) => [i.id, i.asset_id, i.kind, i.severity, i.status, i.region, i.retailer_name, i.opened_at, i.acknowledged_at, i.acknowledged_by, i.resolved_at, i.resolution, i.resolved_by, i.peak_score])
      )
    );
  }));

  app.get('/api/v1/incidents/:id', requireUser('fleet:read'), h(async (req, res) => {
    const inc = await getIncident(db, req.params.id, true);
    if (!inc || !canSeeRegion(req.user!, inc.region)) throw new HttpError(404, 'Incident not found');
    res.json(inc);
  }));

  app.post('/api/v1/incidents/:id/acknowledge', requireUser('incident:act'), h(async (req, res) => {
    res.json(await incidents.acknowledge(req.params.id, req.user!, req.ip));
  }));
  app.post('/api/v1/incidents/:id/assign', requireUser('incident:act'), h(async (req, res) => {
    res.json(await incidents.assign(req.params.id, parse(AssignSchema, req.body).user_id, req.user!, req.ip));
  }));
  app.post('/api/v1/incidents/:id/notes', requireUser('incident:field'), h(async (req, res) => {
    res.json(await incidents.note(req.params.id, parse(NoteSchema, req.body).message, req.user!, req.ip));
  }));
  app.post('/api/v1/incidents/:id/dispatch', requireUser('incident:act'), h(async (req, res) => {
    res.json(await incidents.dispatch(req.params.id, parse(DispatchSchema, req.body).note ?? null, req.user!, req.ip));
  }));
  app.post('/api/v1/incidents/:id/field-update', requireUser('incident:field'), h(async (req, res) => {
    res.json(await incidents.fieldUpdate(req.params.id, parse(FieldUpdateSchema, req.body), req.user!, req.ip));
  }));
  app.post('/api/v1/incidents/:id/resolve', requireUser('incident:act'), h(async (req, res) => {
    const body = parse(ResolveSchema, req.body);
    if (body.resolution === 'reset' && !cfg.demoMode) throw new HttpError(400, 'Reset is a demo-only resolution');
    res.json(await incidents.resolve(req.params.id, body.resolution, body.note ?? null, req.user!, req.ip));
  }));

  // ---- relocations ------------------------------------------------------------------------------------------
  app.get('/api/v1/relocations', requireUser('fleet:read'), h(async (req, res) => {
    res.json(await relocations.list(req.user!, req.query.status ? String(req.query.status) : undefined));
  }));
  app.post('/api/v1/relocations', requireUser('relocation:request'), h(async (req, res) => {
    res.status(201).json(await relocations.request(parse(RelocationSchema, req.body), req.user!, req.ip));
  }));
  app.post('/api/v1/relocations/:id/decision', requireUser('relocation:decide'), h(async (req, res) => {
    res.json(await relocations.decide(req.params.id, parse(DecisionSchema, req.body).approve, req.user!, req.ip));
  }));

  // ---- cooler register ----------------------------------------------------------------------------------------
  app.get('/api/v1/register/template.csv', requireUser('fleet:read'), (_req, res) => {
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', 'attachment; filename="delta-cooler-register-template.csv"');
    res.send(
      toCsv([...REGISTER_COLUMNS], [
        ['DLTA-BCN-0001', 'DLT-C-000123', 'Double-door display cooler', 'RET-HRE-0001', 'Example Bottle Store', 'Harare North', '12 Example Rd, Avondale', 'Owner name', '+263 77 000 0000', -17.7942, 31.0378, 50, 7, 22],
      ])
    );
  });

  app.post('/api/v1/register/import', requireUser('register:import'), h(async (req, res) => {
    const body = parse(RegisterImportSchema, req.body);
    let rows = body.rows ?? [];
    if (body.csv) {
      const parsed = parseRegisterCsv(body.csv);
      if (parsed.missing.length) throw new HttpError(400, `Missing required columns: ${parsed.missing.join(', ')}`);
      rows = parsed.rows;
    }
    if (rows.length === 0) throw new HttpError(400, 'No rows to import');
    const result = await importRegister(db, rows, actor(req), { dryRun: body.dry_run, ip: req.ip });
    if (!body.dry_run) hub.broadcastSnapshot();
    res.json(result);
  }));

  // ---- users -------------------------------------------------------------------------------------------------
  app.get('/api/v1/users', requireUser('user:manage'), h(async (_req, res) => res.json(await users.list())));
  app.get('/api/v1/users/assignable', requireUser('incident:act'), h(async (req, res) => {
    res.json(
      await db.query(
        `SELECT id, name, role, region FROM users WHERE active AND role IN ('asset_protection','ops_lead','area_manager','technician')
           AND ($1::text IS NULL OR region IS NULL OR lower(region) = lower($1)) ORDER BY name`,
        [regionOf(req)]
      )
    );
  }));
  app.post('/api/v1/users', requireUser('user:manage'), h(async (req, res) => {
    res.status(201).json(await users.create(parse(UserCreateSchema, req.body), actor(req), req.ip));
  }));
  app.patch('/api/v1/users/:id', requireUser('user:manage'), h(async (req, res) => {
    res.json(await users.update(req.params.id, parse(UserUpdateSchema, req.body), actor(req), req.ip));
  }));

  // ---- oversight ---------------------------------------------------------------------------------------------
  app.get('/api/v1/audit', requireUser('audit:read'), h(async (req, res) => {
    res.json(await db.query(`SELECT * FROM audit_log ORDER BY at DESC, id DESC LIMIT $1`, [Math.min(Number(req.query.limit ?? 200), 1000)]));
  }));
  app.get('/api/v1/notifications', requireUser('audit:read'), h(async (req, res) => {
    res.json(await db.query(`SELECT * FROM notifications ORDER BY at DESC, id DESC LIMIT $1`, [Math.min(Number(req.query.limit ?? 100), 500)]));
  }));

  app.get('/api/v1/reports/summary', requireUser('fleet:read'), h(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days ?? 30), 1), 366);
    const since = new Date(now().getTime() - days * 86_400_000).toISOString();
    const region = regionOf(req);
    const byRegion = await db.query(
      `WITH fleet AS (
         SELECT COALESCE(r.region, 'Unassigned') AS region, count(*)::int AS coolers
           FROM assets a LEFT JOIN retailers r ON r.id = a.retailer_id
          WHERE a.status = 'active' AND ($2::text IS NULL OR lower(r.region) = lower($2)) GROUP BY 1),
       inc AS (
         SELECT COALESCE(r.region, 'Unassigned') AS region,
                count(*)::int AS incidents,
                count(*) FILTER (WHERE i.kind = 'displacement')::int AS displacement,
                count(*) FILTER (WHERE i.kind = 'power')::int AS power,
                count(*) FILTER (WHERE i.kind = 'signal_lost')::int AS signal_lost,
                count(*) FILTER (WHERE i.resolution = 'recovered')::int AS recovered,
                count(*) FILTER (WHERE i.status <> 'resolved')::int AS still_open,
                round(avg(extract(epoch FROM i.acknowledged_at - i.opened_at)) / 60)::int AS mtta_min,
                round(avg(extract(epoch FROM i.resolved_at - i.opened_at)) / 60)::int AS mttr_min
           FROM incidents i JOIN assets a ON a.id = i.asset_id LEFT JOIN retailers r ON r.id = a.retailer_id
          WHERE i.opened_at >= $1 AND ($2::text IS NULL OR lower(r.region) = lower($2)) GROUP BY 1)
       SELECT f.region, f.coolers, COALESCE(inc.incidents,0) AS incidents, COALESCE(inc.displacement,0) AS displacement,
              COALESCE(inc.power,0) AS power, COALESCE(inc.signal_lost,0) AS signal_lost, COALESCE(inc.recovered,0) AS recovered,
              COALESCE(inc.still_open,0) AS still_open, inc.mtta_min, inc.mttr_min
         FROM fleet f LEFT JOIN inc ON inc.region = f.region ORDER BY f.region`,
      [since, region]
    );
    res.json({ days, since, regions: byRegion });
  }));

  // ---- errors --------------------------------------------------------------------------------------------------
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((err: Error & { status?: number; type?: string; details?: unknown }, req: Request, res: Response, _next: NextFunction) => {
    const status = err instanceof HttpError ? err.status : err.status ?? 500;
    if (status >= 500) log.error('unhandled error', { path: req.path, error: err.message, stack: err.stack });
    res.status(status).json({ error: status >= 500 ? 'Internal error' : err.message, details: (err as HttpError).details });
  });

  // ---- WebSocket hub (authenticated, region-scoped) ----------------------------------------------------------------
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Map<WebSocket, { user: AuthUser; alive: boolean }>();

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/ws/telemetry') return socket.destroy();
    const token = url.searchParams.get('token') ?? tokenFrom(req);
    authenticate(token ?? undefined)
      .then((user) => {
        if (!user) {
          socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
          return socket.destroy();
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
          clients.set(ws, { user, alive: true });
          ws.on('pong', () => {
            const c = clients.get(ws);
            if (c) c.alive = true;
          });
          ws.on('close', () => clients.delete(ws));
          ws.on('error', () => ws.terminate());
          void sendSnapshot(ws, user);
        });
      })
      .catch(() => socket.destroy());
  });

  async function sendSnapshot(ws: WebSocket, user: AuthUser) {
    const region = user.region;
    const [summary, assets, incs] = await Promise.all([
      fleetSummary(db, { ...ro(), region }),
      listAssets(db, { ...ro(), region }),
      listIncidents(db, { status: 'all', region, limit: 100 }),
    ]);
    const msg: ServerEvent = { type: 'snapshot', summary, assets, incidents: incs };
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  const hub = {
    async broadcast(e: HubEvent) {
      const region = 'asset' in e ? e.asset.region : e.incident.region;
      const summaries = new Map<string, FleetSummary>();
      for (const [ws, c] of clients) {
        if (ws.readyState !== WebSocket.OPEN || !canSeeRegion(c.user, region)) continue;
        const key = c.user.region ?? '*';
        if (!summaries.has(key)) summaries.set(key, await fleetSummary(db, { ...ro(), region: c.user.region }));
        ws.send(JSON.stringify({ ...e, summary: summaries.get(key) }));
      }
    },
    broadcastSnapshot() {
      for (const [ws, c] of clients) void sendSnapshot(ws, c.user);
    },
  };
  fleet.on((e) => void hub.broadcast(e).catch((err) => log.error('broadcast failed', { error: (err as Error).message })));

  // ---- lifecycle ----------------------------------------------------------------------------------------------------
  const timers: ReturnType<typeof setInterval>[] = [];
  function startBackground() {
    timers.push(
      setInterval(() => {
        for (const [ws, c] of clients) {
          if (!c.alive) {
            ws.terminate();
            clients.delete(ws);
            continue;
          }
          c.alive = false;
          ws.ping();
        }
      }, 20_000)
    );
    timers.push(setInterval(() => void fleet.sweep().catch((err) => log.error('sweep failed', { error: err.message })), 60_000));
    timers.push(
      setInterval(
        () => void fleet.pruneTelemetry().then((n) => n && log.info('telemetry pruned', { rows: n })).catch(() => undefined),
        6 * 3_600_000
      )
    );
    if (cfg.demoMode) virtualFleet.start(30_000);
  }

  async function close() {
    timers.forEach(clearInterval);
    simulator.stopAll();
    virtualFleet.stop();
    for (const ws of clients.keys()) ws.terminate();
    wss.close();
    await new Promise<void>((r) => server.close(() => r()));
    await db.close();
  }

  return { app, server, db, fleet, incidents, users, relocations, simulator, virtualFleet, startBackground, close };
}
