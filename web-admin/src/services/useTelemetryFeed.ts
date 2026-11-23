import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AssetState,
  ConnectionState,
  CoolerAsset,
  FleetSummary,
  Incident,
  RiskAlertItem,
  ServerEvent,
} from '../types';
import { api, WS_URL } from './api';

export const DEMO_BEACON_ID = 'DLTA-BCN-9042';

// Shown until the first snapshot arrives from the backend.
const INITIAL_SUMMARY: FleetSummary = { total: 1420, compliant: 1385, outages: 23, anomalies: 12 };

type Toast = { id: number; title: string; description: string; type: 'critical' | 'success' | 'info' };

// ---- formatting helpers ---------------------------------------------------------------

export function timeAgo(iso: string | null, now: number): string {
  if (!iso) return 'No data';
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 5) return 'Just now';
  if (s < 60) return `${s} sec ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

export function formatCat(iso: string | null): string {
  if (!iso) return '—';
  return (
    new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Africa/Harare', hour: '2-digit', minute: '2-digit' }) + ' CAT'
  );
}

export function formatDuration(fromIso: string | null, now: number): string {
  if (!fromIso) return '—';
  const s = Math.max(0, Math.round((now - Date.parse(fromIso)) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(sec).padStart(2, '0')}s`;
}

const shortId = (id: string) => id.split('-').pop() ?? id;

/** Server AssetState -> dashboard view model. */
export function toCoolerAsset(a: AssetState, now: number): CoolerAsset {
  const offHours = a.mains_off_since ? (now - Date.parse(a.mains_off_since)) / 3_600_000 : 0;
  const statusLabel =
    a.risk.severity === 'critical'
      ? a.risk.geofenceBreached
        ? 'Geofence Breach'
        : 'High Risk'
      : a.risk.severity === 'warning'
      ? !a.mains_connected
        ? `Outage > ${Math.floor(offHours)}h`
        : 'Warning'
      : !a.mains_connected
      ? 'Mains Cut'
      : 'Nominal';

  return {
    id: a.id,
    coolerModel: a.model,
    retailer: a.retailer_name,
    locationName: a.location_name,
    lat: a.lat,
    lng: a.lng,
    status: a.risk.severity,
    statusLabel,
    internalTemp: a.internal_temp_c ?? 0,
    powerSource: a.mains_connected ? `${Math.round(a.voltage_ac ?? 230)}V AC Mains` : 'Mains Cut (0V)',
    batteryPct: a.battery_pct ?? 0,
    lastPing: timeAgo(a.last_seen, now),
    lastSeen: a.last_seen,
    speedKmh: a.speed_kmh,
    riskScore: a.risk.score,
    confidencePct: a.risk.confidence,
    riskReasons: a.risk.reasons,
    geofenceRadiusM: a.geofence_radius_m,
    displacementM: a.distance_m,
    routeOrigin: { name: `${a.retailer_name} (Origin)`, lat: a.anchor.lat, lng: a.anchor.lng },
    trail: a.trail.map((p) => [p.lat, p.lng] as [number, number]),
    incidentId: a.incident_id,
    incidentOpenedAt: a.trail[0]?.t ?? null,
    isBreached: a.risk.geofenceBreached,
    isPowerCut: !a.mains_connected,
    mainsOffSince: a.mains_off_since,
    simulationActive: a.simulation_active,
    imei: a.imei,
    assetType: a.asset_type,
  };
}

const SEVERITY_RANK = { critical: 0, warning: 1, nominal: 2 } as const;

function buildAlerts(fleet: CoolerAsset[], incidents: Incident[], now: number): RiskAlertItem[] {
  const active: RiskAlertItem[] = fleet
    .filter((c) => c.status !== 'nominal')
    .map((c) => {
      const critical = c.status === 'critical';
      const since = critical ? c.incidentOpenedAt : c.mainsOffSince ?? c.lastSeen;
      const lead = c.riskReasons[0];
      return {
        id: c.incidentId ?? `WARN-${c.id}`,
        assetId: c.id,
        title: `${c.coolerModel} #${shortId(c.id)}`,
        severity: critical ? 'critical' : 'warning',
        timeAgo: since ? `T+ ${formatDuration(since, now)}` : '',
        description: critical
          ? `${lead?.detail ?? 'High theft risk.'} Moving at ${c.speedKmh.toFixed(1)} km/h.`
          : c.riskReasons.map((r) => r.label).join(' • ') || 'Elevated risk',
        originStore: c.retailer,
        currentLocation: `${c.locationName} (${c.lat.toFixed(4)}, ${c.lng.toFixed(4)})`,
        speedKmh: c.speedKmh,
        tempC: c.internalTemp,
        powerStatus: c.isPowerCut ? `BAT ${c.batteryPct}%` : 'AC OK',
        riskPct: c.riskScore,
        timestamp: formatCat(since),
      };
    });
  active.sort((a, b) => (a.severity === b.severity ? b.riskPct - a.riskPct : a.severity === 'critical' ? -1 : 1));

  const resolved: RiskAlertItem[] = incidents
    .filter((i) => i.status === 'resolved')
    .slice(0, 3)
    .map((i) => ({
      id: i.id,
      assetId: i.asset_id,
      title: `#${shortId(i.asset_id)} • ${i.resolution === 'authorized' ? 'Authorized move' : i.resolution === 'returned' ? 'Geofence re-entry' : 'Incident closed'}`,
      severity: 'resolved',
      timeAgo: timeAgo(i.resolved_at, now),
      description: `${i.id} closed ${timeAgo(i.resolved_at, now)} • peak risk ${i.peak_score}%`,
      originStore: i.origin.name,
      currentLocation: '',
      speedKmh: 0,
      tempC: 0,
      powerStatus: '',
      riskPct: 0,
      timestamp: formatCat(i.resolved_at),
    }));

  return [...active, ...resolved];
}

// ---- hook -----------------------------------------------------------------------------

export function useTelemetryFeed() {
  const [assets, setAssets] = useState<Record<string, AssetState>>({});
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [summary, setSummary] = useState<FleetSummary>(INITIAL_SUMMARY);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [flashingRowId, setFlashingRowId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<Toast | null>(null);
  const [inspectRequest, setInspectRequest] = useState<{ id: string; nonce: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const flashTimer = useRef<ReturnType<typeof setTimeout>>();

  // Relative times ("12 sec ago", "T+ 3m 05s") tick once a second.
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

  const handleEvent = useCallback(
    (ev: ServerEvent) => {
      setSummary(ev.summary);
      if (ev.type === 'snapshot') {
        setAssets(Object.fromEntries(ev.assets.map((a) => [a.id, a])));
        setIncidents(ev.incidents);
        return;
      }
      setAssets((prev) => ({ ...prev, [ev.asset.id]: ev.asset }));

      if (ev.type === 'incident.opened') {
        setIncidents((prev) => [ev.incident, ...prev.filter((i) => i.id !== ev.incident.id)]);
        clearTimeout(flashTimer.current);
        setFlashingRowId(ev.asset.id);
        flashTimer.current = setTimeout(() => setFlashingRowId(null), 3000);
        setInspectRequest({ id: ev.asset.id, nonce: Date.now() });
        triggerToast(
          `CRITICAL BREACH: ${ev.asset.id}`,
          `${ev.incident.reasons.map((r) => r.label).join(' • ')}. AI risk ${ev.asset.risk.score}% (confidence ${ev.asset.risk.confidence}%).`,
          'critical',
        );
      } else if (ev.type === 'incident.resolved') {
        setIncidents((prev) => [ev.incident, ...prev.filter((i) => i.id !== ev.incident.id)]);
        triggerToast(
          `Incident ${ev.incident.id} resolved`,
          `${ev.asset.id} is ${ev.incident.resolution === 'authorized' ? 'marked as an authorized move' : 'back inside its geofence'}.`,
          'success',
        );
      }
    },
    [triggerToast],
  );

  // WebSocket with exponential back-off. `disposed` stops reconnects after unmount
  // (React StrictMode mounts effects twice in development).
  useEffect(() => {
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
        const delay = Math.min(10_000, 1000 * 2 ** attempt++);
        retry = setTimeout(connect, delay);
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      disposed = true;
      clearTimeout(retry);
      ws?.close();
    };
  }, [handleEvent]);

  const fleet = useMemo(
    () =>
      Object.values(assets)
        .map((a) => toCoolerAsset(a, now))
        .sort((a, b) => SEVERITY_RANK[a.status] - SEVERITY_RANK[b.status] || b.riskScore - a.riskScore || a.id.localeCompare(b.id)),
    [assets, now],
  );

  const alerts = useMemo(() => buildAlerts(fleet, incidents, now), [fleet, incidents, now]);

  const simulateBreach = useCallback(
    async (id: string = DEMO_BEACON_ID) => {
      try {
        await api.simulateBreach(id);
      } catch (err) {
        triggerToast('Simulation failed', `Backend unreachable or rejected the request: ${(err as Error).message}`, 'critical');
      }
    },
    [triggerToast],
  );

  const resetAsset = useCallback(
    async (id: string, resolution: 'authorized' | 'reset' = 'reset') => {
      try {
        const res = await api.reset(id, resolution);
        if (!res.incident) triggerToast('No open incident', `${id} had no open incident to close.`, 'info');
      } catch (err) {
        triggerToast('Action failed', (err as Error).message, 'critical');
      }
    },
    [triggerToast],
  );

  return {
    fleet,
    alerts,
    incidents,
    kpiCounts: {
      totalTracked: summary.total,
      activeCompliant: summary.compliant,
      powerOutages: summary.outages,
      anomalyAlerts: summary.anomalies,
    },
    flashingRowId,
    connection,
    isConnected: connection === 'live',
    toastMessage,
    triggerToast,
    dismissToast,
    inspectRequest,
    simulateBreach,
    resetAsset,
    now,
  };
}
