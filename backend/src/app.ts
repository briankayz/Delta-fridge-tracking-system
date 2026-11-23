// HTTP API + WebSocket hub. Exported as a factory so tests can start it on a random port.

import http from 'node:http';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { ProvisionSchema, ResetSchema, TelemetryPayloadSchema } from './schema.ts';
import { FLEET_BASELINE, seedFleet } from './seed.ts';
import { BreachSimulator } from './simulator.ts';
import { FleetStore } from './store.ts';
import { ServerEvent } from './types.ts';

export interface AppOptions {
  ingestToken?: string;      // if set, POST /telemetry requires header x-device-token
  forceCurfew?: boolean;     // DEMO_FORCE_CURFEW: treat every hour as after-hours
  seed?: boolean;
}

export function createApp(opts: AppOptions = {}) {
  const store = new FleetStore({ baseline: FLEET_BASELINE, forceCurfew: () => !!opts.forceCurfew });
  if (opts.seed !== false) seedFleet(store);

  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws/telemetry' });

  const broadcast = (event: ServerEvent) => {
    const data = JSON.stringify(event);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(data);
    }
  };

  const simulator = new BreachSimulator(
    (payload) => store.ingest(payload).events.forEach(broadcast),
    (id) => store.setSimulation(id, false),
  );

  app.use(cors());
  app.use(express.json({ limit: '64kb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, assets: store.list().length, clients: wss.clients.size, time: new Date().toISOString() });
  });

  // ---- Telemetry ingest -------------------------------------------------------------
  app.post('/api/v1/telemetry', (req, res) => {
    if (opts.ingestToken && req.header('x-device-token') !== opts.ingestToken) {
      return res.status(401).json({ error: 'invalid device token' });
    }
    const parsed = TelemetryPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid telemetry payload', issues: parsed.error.issues });
    }
    // While a server-side simulation drives this asset, real device payloads would fight it.
    if (simulator.isRunning(parsed.data.device_id)) {
      return res.status(202).json({ accepted: false, reason: 'simulation_active' });
    }
    const { asset, events } = store.ingest(parsed.data);
    events.forEach(broadcast);
    res.status(202).json({
      accepted: true,
      asset_id: asset.id,
      risk_score_pct: asset.risk.score,
      theft_prediction_confidence_pct: asset.risk.confidence,
      severity: asset.risk.severity,
      geofence_breached: asset.risk.geofenceBreached,
      displacement_distance_m: Math.round(asset.distance_m),
      reasons: asset.risk.reasons,
      incident_id: asset.incident_id,
    });
  });

  // ---- Fleet state ------------------------------------------------------------------
  app.get('/api/v1/assets', (_req, res) => {
    res.json({ summary: store.summary(), assets: store.list(), incidents: store.listIncidents() });
  });

  app.get('/api/v1/assets/:id', (req, res) => {
    const asset = store.get(req.params.id);
    if (!asset) return res.status(404).json({ error: 'unknown asset' });
    res.json({ asset, history: store.getHistory(asset.id), incident: store.getIncident(asset.incident_id) ?? null });
  });

  app.post('/api/v1/assets/:id/provision', (req, res) => {
    const parsed = ProvisionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid provisioning request', issues: parsed.error.issues });
    const asset = store.provision(req.params.id, parsed.data);
    broadcast({ type: 'asset.updated', summary: store.summary(), asset });
    res.json({ asset });
  });

  app.post('/api/v1/assets/:id/simulate-breach', (req, res) => {
    const asset = store.get(req.params.id);
    if (!asset) return res.status(404).json({ error: 'unknown asset' });
    store.setSimulation(asset.id, true);
    simulator.start(asset);
    res.status(202).json({ started: true, asset: store.get(asset.id) });
  });

  app.post('/api/v1/assets/:id/reset', (req, res) => {
    const parsed = ResetSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid reset request', issues: parsed.error.issues });
    const asset = store.get(req.params.id);
    if (!asset) return res.status(404).json({ error: 'unknown asset' });
    simulator.stop(asset.id);

    const result = store.resolve(asset.id, parsed.data.resolution ?? 'reset')!;
    // Snap back to the anchor in a nominal state so the map and KPIs recover immediately.
    const { events } = store.ingest({
      device_id: asset.id,
      speed_kmh: 0,
      gps: { latitude: asset.anchor.lat, longitude: asset.anchor.lng },
      power: { mains_connected: true, voltage_ac: 234, battery_level_pct: asset.battery_pct ?? 92 },
      cold_chain: { internal_temp_c: asset.internal_temp_c ?? 3.8 },
    });
    if (result.incident) {
      broadcast({ type: 'incident.resolved', summary: store.summary(), asset: store.get(asset.id)!, incident: result.incident });
    }
    events.forEach(broadcast);
    res.json({ asset: store.get(asset.id), incident: result.incident ?? null });
  });

  // ---- Errors -----------------------------------------------------------------------
  app.use((_req, res) => res.status(404).json({ error: 'not found' }));
  app.use((err: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status ?? 500;
    res.status(status).json({ error: status === 500 ? 'internal error' : err.message });
    if (status === 500) console.error(err);
  });

  // ---- WebSocket --------------------------------------------------------------------
  const alive = new WeakMap<WebSocket, boolean>();
  wss.on('connection', (ws) => {
    alive.set(ws, true);
    ws.on('pong', () => alive.set(ws, true));
    ws.on('error', () => ws.terminate());
    ws.send(JSON.stringify(store.snapshot()));
  });
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.get(ws)) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, 20_000);

  const close = () =>
    new Promise<void>((resolve) => {
      clearInterval(heartbeat);
      simulator.stopAll();
      for (const ws of wss.clients) ws.terminate();
      wss.close();
      server.close(() => resolve());
    });

  return { app, server, store, close };
}
