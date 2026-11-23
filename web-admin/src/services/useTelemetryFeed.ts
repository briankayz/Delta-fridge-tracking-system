import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AssetState, ConnectionState, CoolerAsset, FleetSummary, Incident, ServerEvent } from '../types';
import { api, WS_URL } from './api';

export const DEMO_BEACON_ID = 'DLTA-BCN-9042';

const EMPTY_SUMMARY: FleetSummary = { total: 0, reporting: 0, offline: 0, compliant: 0, outages: 0, anomalies: 0, open_incidents: 0 };

export type Toast = { id: number; title: string; description: string; type: 'critical' | 'success' | 'info' };

// ---- formatting helpers ---------------------------------------------------------------------

export function timeAgo(iso: string | null, now: number): string {
  if (!iso) return 'Never';
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 5) return 'Just now';
  if (s < 60) return `${s} sec ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m ago`;
  return `${Math.floor(h / 24)} days ago`;
}

export function formatCat(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Africa/Harare', hour: '2-digit', minute: '2-digit' }) + ' CAT';
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Africa/Harare',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(fromIso: string | null, now: number, toIso?: string | null): string {
  if (!fromIso) return '—';
  const end = toIso ? Date.parse(toIso) : now;
  const s = Math.max(0, Math.round((end - Date.parse(fromIso)) / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s % 60).padStart(2, '0')}s`;
}

export const KIND_LABEL: Record<Incident['kind'], string> = {
  displacement: 'Theft / displacement',
  power: 'Power outage',
  signal_lost: 'Beacon offline',
};

export const RESOLUTION_LABEL: Record<string, string> = {
  returned: 'Returned to store',
  authorized: 'Authorised move',
  recovered: 'Recovered',
  false_alarm: 'False alarm',
  not_found: 'Not found (closed)',
  power_restored: 'Power restored',
  signal_restored: 'Signal restored',
  reset: 'Demo reset',
};

/** Server AssetState -> dashboard view model. */
export function toCoolerAsset(a: AssetState, now: number): CoolerAsset {
  const offHours = a.mains_off_since ? (now - Date.parse(a.mains_off_since)) / 3_600_000 : 0;
  const kinds = new Set(a.open_incidents.map((i) => i.kind));
  const statusLabel = !a.last_seen
    ? 'Not reporting'
    : a.risk.severity === 'critical'
    ? a.risk.geofenceBreached
      ? 'Geofence breach'
      : 'High risk'
    : kinds.has('signal_lost') || !a.online
    ? 'Offline'
    : a.relocation
    ? 'Approved move'
    : a.risk.severity === 'warning'
    ? !a.mains_connected
      ? `Unplugged ${Math.floor(offHours)}h`
      : 'Warning'
    : !a.mains_connected
    ? 'Unplugged'
    : 'Secure';
  const status = a.risk.severity === 'nominal' && (!a.online || kinds.has('signal_lost')) && a.last_seen ? 'warning' : a.risk.severity;
  const displacement = a.open_incidents.find((i) => i.kind === 'displacement');

  return {
    id: a.id,
    coolerModel: a.model,
    coolerSerial: a.cooler_serial,
    retailer: a.retailer_name,
    retailerId: a.retailer_id,
    region: a.region,
    retailerContact: a.retailer_contact,
    locationName: a.location_name,
    lat: a.lat,
    lng: a.lng,
    status,
    statusLabel,
    internalTemp: a.internal_temp_c,
    powerSource: a.mains_connected ? `${Math.round(a.voltage_ac ?? 230)}V mains` : 'Mains off',
    batteryPct: a.battery_pct,
    lastPing: timeAgo(a.last_seen, now),
    lastSeen: a.last_seen,
    online: a.online,
    isVirtual: a.is_virtual,
    provisioned: a.provisioned,
    speedKmh: a.speed_kmh,
    riskScore: a.risk.score,
    confidencePct: a.risk.confidence,
    riskReasons: a.risk.reasons,
    geofenceRadiusM: a.geofence_radius_m,
    displacementM: a.distance_m,
    routeOrigin: { name: `${a.retailer_name} (store)`, lat: a.anchor.lat, lng: a.anchor.lng },
    trail: a.trail.map((p) => [p.lat, p.lng] as [number, number]),
    incidentId: a.incident_id,
    incidentOpenedAt: displacement ? a.trail[0]?.t ?? null : null,
    openIncidents: a.open_incidents,
    relocation: a.relocation,
    isBreached: a.risk.geofenceBreached,
    isPowerCut: !a.mains_connected,
    mainsOffSince: a.mains_off_since,
    simulationActive: a.simulation_active,
    imei: a.imei,
    assetType: a.asset_type,
  };
}

const SEVERITY_RANK = { critical: 0, warning: 1, nominal: 2 } as const;

// ---- hook -------------------------------------------------------------------------------------

export function useTelemetryFeed(enabled: boolean) {
  const [assets, setAssets] = useState<Record<string, AssetState>>({});
  const [incidents, setIncidents] = useState<Record<string, Incident>>({});
  const [summary, setSummary] = useState<FleetSummary>(EMPTY_SUMMARY);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [flashingRowId, setFlashingRowId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<Toast | null>(null);
  const [inspectRequest, setInspectRequest] = useState<{ id: string; nonce: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const flashTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const triggerToast = useCallback((title: string, description: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToastMessage({ id, title, description, type });
    setTimeout(() => setToastMessage((prev) => (prev?.id === id ? null : prev)), 6000);
  }, []);
  const dismissToast = useCallback(() => setToastMessage(null), []);

  const upsertIncident = useCallback((i: Incident) => setIncidents((prev) => ({ ...prev, [i.id]: { ...prev[i.id], ...i } })), []);

  const handleEvent = useCallback(
    (ev: ServerEvent) => {
      setSummary(ev.summary);
      switch (ev.type) {
        case 'snapshot':
          setAssets(Object.fromEntries(ev.assets.map((a) => [a.id, a])));
          setIncidents(Object.fromEntries(ev.incidents.map((i) => [i.id, i])));
          return;
        case 'asset.updated':
          setAssets((prev) => ({ ...prev, [ev.asset.id]: ev.asset }));
          return;
        case 'incident.updated':
          upsertIncident(ev.incident);
          return;
        case 'incident.opened':
          setAssets((prev) => ({ ...prev, [ev.asset.id]: ev.asset }));
          upsertIncident(ev.incident);
          clearTimeout(flashTimer.current);
          setFlashingRowId(ev.asset.id);
          flashTimer.current = setTimeout(() => setFlashingRowId(null), 3200);
          if (ev.incident.kind === 'displacement') setInspectRequest({ id: ev.asset.id, nonce: Date.now() });
          triggerToast(
            `${KIND_LABEL[ev.incident.kind]} · ${ev.asset.id}`,
            `${ev.incident.reasons.map((r) => r.label).join(' · ') || 'New incident'}. ${ev.incident.id} opened.`,
            ev.incident.kind === 'displacement' ? 'critical' : 'info'
          );
          return;
        case 'incident.resolved':
          setAssets((prev) => ({ ...prev, [ev.asset.id]: ev.asset }));
          upsertIncident(ev.incident);
          triggerToast(
            `${ev.incident.id} resolved`,
            `${ev.asset.id}: ${RESOLUTION_LABEL[ev.incident.resolution ?? ''] ?? 'closed'}${ev.incident.resolved_by ? ` by ${ev.incident.resolved_by}` : ''}.`,
            'success'
          );
      }
    },
    [triggerToast, upsertIncident]
  );

  // Authenticated WebSocket (session cookie) with exponential back-off.
  useEffect(() => {
    if (!enabled) return;
    let ws: WebSocket | null = null;
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const connect = () => {
      if (disposed) return;
      setConnection('connecting');
      ws = new WebSocket(WS_URL);
      ws.onopen = () => {
        attempt = 0;
        setConnection('live');
      };
      ws.onmessage = (msg) => {
        try {
          handleEvent(JSON.parse(msg.data) as ServerEvent);
        } catch (err) {
          console.error('Bad telemetry event', err);
        }
      };
      ws.onclose = () => {
        if (disposed) return;
        setConnection('offline');
        api.me().catch(() => undefined); // a 401 here returns the app to the sign-in screen
        retry = setTimeout(connect, Math.min(15_000, 1000 * 2 ** attempt++));
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      disposed = true;
      clearTimeout(retry);
      ws?.close();
    };
  }, [enabled, handleEvent]);

  const fleet = useMemo(
    () =>
      Object.values(assets)
        .map((a) => toCoolerAsset(a, now))
        .sort((a, b) => SEVERITY_RANK[a.status] - SEVERITY_RANK[b.status] || b.riskScore - a.riskScore || a.id.localeCompare(b.id)),
    [assets, now]
  );

  const incidentList = useMemo(
    () =>
      Object.values(incidents).sort(
        (a, b) => Number(a.status === 'resolved') - Number(b.status === 'resolved') || Date.parse(b.opened_at) - Date.parse(a.opened_at)
      ),
    [incidents]
  );

  const run = useCallback(
    async (label: string, fn: () => Promise<unknown>, success?: string) => {
      try {
        await fn();
        if (success) triggerToast(label, success, 'success');
        return true;
      } catch (err) {
        triggerToast(`${label} failed`, (err as Error).message, 'critical');
        return false;
      }
    },
    [triggerToast]
  );

  return {
    fleet,
    incidents: incidentList,
    upsertIncident,
    summary,
    flashingRowId,
    connection,
    toastMessage,
    triggerToast,
    dismissToast,
    inspectRequest,
    run,
    now,
  };
}

export type Feed = ReturnType<typeof useTelemetryFeed>;
