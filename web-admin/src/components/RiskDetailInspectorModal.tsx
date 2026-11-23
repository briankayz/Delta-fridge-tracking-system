import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import {
  CircleCheck,
  Clock,
  Flag,
  LucideIcon,
  MapPinOff,
  Moon,
  Navigation,
  Phone,
  Route,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Truck,
  Unplug,
  Vibrate,
  X,
  Zap,
} from 'lucide-react';
import { CoolerAsset, RiskReason, TrailPoint } from '../types';
import { api } from '../services/api';
import { formatCat, formatDuration } from '../services/useTelemetryFeed';
import { IncidentRouteMap } from './IncidentRouteMap';
import { Button, Card, CardHeader, Segmented, StatusBadge, STATUS_STYLE, cx } from './ui';

interface RiskDetailInspectorModalProps {
  cooler: CoolerAsset | null;
  now: number;
  onClose: () => void;
  onActionFeedback: (msg: string) => void;
  onAuthorizeMove: (assetId: string) => void;
  onDispatch: (assetId: string) => void;
  onCallRetailer: (assetId: string) => void;
}

const REASON_ICON: Record<string, LucideIcon> = {
  GEOFENCE_BREACH: MapPinOff,
  GEOFENCE_DRIFT: Navigation,
  MAINS_CUT_IN_TRANSIT: Unplug,
  MAINS_OUTAGE_PROLONGED: Unplug,
  MAINS_OUTAGE: Unplug,
  CURFEW_MOTION: Moon,
  MOTION: Zap,
  SHOCK_TILT: Vibrate,
  COLD_CHAIN: Thermometer,
};

const RANGES = { all: Infinity, '15m': 15 * 60_000, '5m': 5 * 60_000 } as const;
type Range = keyof typeof RANGES;

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Africa/Harare', hour: '2-digit', minute: '2-digit', second: '2-digit' });

function headline(c: CoolerAsset): { title: string; body: string } {
  const codes = new Set(c.riskReasons.map((r) => r.code));
  if (c.status === 'critical') {
    const parts = [
      codes.has('GEOFENCE_BREACH') && 'left its store geofence',
      codes.has('MAINS_CUT_IN_TRANSIT') && 'was unplugged while moving',
      (codes.has('MOTION') || codes.has('CURFEW_MOTION')) && `is travelling at ${c.speedKmh.toFixed(0)} km/h`,
      codes.has('CURFEW_MOTION') && 'outside trading hours',
    ].filter(Boolean);
    return { title: 'Likely theft or unauthorised move', body: `This cooler ${parts.join(', ')}.` };
  }
  if (c.status === 'warning') {
    return { title: 'Operational risk', body: `${c.riskReasons.map((r) => r.label).join(', ')}. The cooler has not moved.` };
  }
  return { title: 'No risk detected', body: 'Inside its geofence, on mains power and within cold-chain limits.' };
}

const Fact: React.FC<{ label: string; children: React.ReactNode; tone?: string }> = ({ label, children, tone }) => (
  <div className="rounded-lg border border-line bg-white px-4 py-3">
    <div className="text-xs text-slate-500">{label}</div>
    <div className={cx('mt-0.5 text-lg font-semibold tabular', tone ?? 'text-slate-900')}>{children}</div>
  </div>
);

const ReasonRow: React.FC<{ reason: RiskReason; critical: boolean }> = ({ reason, critical }) => {
  const Icon = REASON_ICON[reason.code] ?? Sparkles;
  return (
    <li className="flex items-start gap-3 py-3">
      <span
        className={cx(
          'w-8 h-8 rounded-md flex items-center justify-center shrink-0',
          critical ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-slate-900">{reason.label}</span>
          <span className="text-xs font-medium text-slate-500 tabular">+{reason.points}</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">{reason.detail}</p>
      </div>
    </li>
  );
};

/** One measure per chart (no dual axes); both share the same time axis. */
const MiniChart: React.FC<{
  data: { time: string; value: number | null }[];
  title: string;
  unit: string;
  domain: [number, number];
  color: string;
  marker?: string;
}> = ({ data, title, unit, domain, color, marker }) => (
  <div>
    <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
      <span className="w-3 h-0.5 rounded-full" style={{ background: color }} />
      {title} <span className="font-normal text-slate-500">({unit.trim()})</span>
    </div>
    <div className="h-36 mt-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#EEF2F6" vertical={false} />
          <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} minTickGap={48} />
          <YAxis domain={domain} stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} width={40} />
          <Tooltip
            formatter={(v: number) => [`${v}${unit}`, title]}
            contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12, boxShadow: '0 8px 24px -8px rgba(15,23,42,.2)' }}
            labelStyle={{ color: '#64748B' }}
          />
          {marker && <ReferenceLine x={marker} stroke="#DC2626" strokeDasharray="4 4" />}
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export const RiskDetailInspectorModal: React.FC<RiskDetailInspectorModalProps> = ({
  cooler,
  now,
  onClose,
  onActionFeedback,
  onAuthorizeMove,
  onDispatch,
  onCallRetailer,
}) => {
  const [range, setRange] = useState<Range>('15m');
  const [history, setHistory] = useState<TrailPoint[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const coolerId = cooler?.id;
  const lastSeen = cooler?.lastSeen;

  // Refresh history whenever a new payload for this cooler lands.
  useEffect(() => {
    if (!coolerId) return;
    let cancelled = false;
    api
      .getAsset(coolerId)
      .then((res) => {
        if (!cancelled) {
          setHistory(res.history);
          setHistoryError(null);
        }
      })
      .catch((err: Error) => !cancelled && setHistoryError(err.message));
    return () => {
      cancelled = true;
    };
  }, [coolerId, lastSeen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const points = useMemo(() => {
    const cutoff = now - RANGES[range];
    return history.filter((p) => Date.parse(p.t) >= cutoff);
  }, [history, range, now]);

  if (!cooler) return null;

  const s = STATUS_STYLE[cooler.status];
  const summary = headline(cooler);
  const incidentStart = cooler.incidentOpenedAt;
  const breachLabel = incidentStart ? points.map((p) => timeLabel(p.t)).find((t) => t >= timeLabel(incidentStart)) : undefined;
  const speedData = points.map((p) => ({ time: timeLabel(p.t), value: p.speed_kmh }));
  const batteryData = points.map((p) => ({ time: timeLabel(p.t), value: p.battery_pct }));
  const distance =
    cooler.displacementM >= 1000 ? `${(cooler.displacementM / 1000).toFixed(2)} km` : `${Math.round(cooler.displacementM)} m`;
  const ringOffset = 2 * Math.PI * 26 * (1 - Math.min(100, cooler.riskScore) / 100);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="inspector-title">
      <button type="button" aria-label="Close inspector" onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" />

      <div className="relative h-full w-full max-w-5xl bg-canvas shadow-2xl flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-line px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge severity={cooler.status} label={cooler.statusLabel} size="md" />
                {cooler.incidentId && (
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 font-mono">
                    {cooler.incidentId}
                  </span>
                )}
                {cooler.simulationActive && (
                  <span className="rounded-md bg-gold-50 px-2 py-1 text-xs font-medium text-gold-700 ring-1 ring-inset ring-gold-300">
                    Demo simulation
                  </span>
                )}
              </div>
              <h2 id="inspector-title" className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                {cooler.id}
              </h2>
              <p className="text-sm text-slate-500">
                {cooler.coolerModel} · {cooler.retailer} · IMEI <span className="font-mono">{cooler.imei || '—'}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 [&>*]:shrink-0">
          {/* Verdict + key facts */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-3">
            <div className={cx('rounded-lg border px-4 py-3 flex items-center gap-4', s.soft, 'border-line')}>
              <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90 shrink-0" aria-hidden="true">
                <circle cx="32" cy="32" r="26" fill="none" stroke="#E2E8F0" strokeWidth="7" />
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke={s.hex}
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 26}
                  strokeDashoffset={ringOffset}
                  style={{ transition: 'stroke-dashoffset 600ms ease' }}
                />
              </svg>
              <div className="min-w-0">
                <div className="text-xs text-slate-500">AI risk score</div>
                <div className="text-2xl font-semibold text-slate-900 tabular">{cooler.riskScore}%</div>
                <div className={cx('text-xs font-medium', s.text)}>{summary.title}</div>
              </div>
            </div>
            <Fact label="Confidence">{cooler.confidencePct}%</Fact>
            <Fact label="Distance from store" tone={cooler.isBreached ? 'text-red-700' : undefined}>
              {distance}
            </Fact>
            <Fact label={incidentStart ? 'Incident open for' : 'Last report'}>
              {incidentStart ? formatDuration(incidentStart, now) : cooler.lastPing}
            </Fact>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            {/* Explanation */}
            <Card className="xl:col-span-2">
              <CardHeader title="Why the AI flagged this" icon={Sparkles} />
              <div className="px-4">
                <p className="pt-3 text-sm text-slate-700">{summary.body}</p>
                {cooler.riskReasons.length === 0 ? (
                  <div className="flex items-center gap-2 py-6 text-sm text-slate-600">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                    All sensor checks are within normal limits.
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {cooler.riskReasons.map((r) => (
                      <ReasonRow key={r.code} reason={r} critical={cooler.status === 'critical'} />
                    ))}
                  </ul>
                )}
              </div>
              <div className="px-4 py-3 border-t border-line text-xs text-slate-500">
                Points add up to the risk score (max 100). 75+ is critical, 40+ is a warning.
              </div>
            </Card>

            {/* Route */}
            <Card className="xl:col-span-3 overflow-hidden">
              <CardHeader
                title="Location since breach"
                icon={Route}
                subtitle={`${cooler.locationName} · geofence ${cooler.geofenceRadiusM} m`}
              />
              <div className="relative isolate h-80">
                <IncidentRouteMap cooler={cooler} />
              </div>
              <dl className="grid grid-cols-3 divide-x divide-line border-t border-line text-xs">
                <div className="px-4 py-2.5">
                  <dt className="text-slate-500">Coordinates</dt>
                  <dd className="font-mono text-slate-900">
                    {cooler.lat.toFixed(5)}, {cooler.lng.toFixed(5)}
                  </dd>
                </div>
                <div className="px-4 py-2.5">
                  <dt className="text-slate-500">Speed</dt>
                  <dd className="font-medium text-slate-900 tabular">{cooler.speedKmh.toFixed(1)} km/h</dd>
                </div>
                <div className="px-4 py-2.5">
                  <dt className="text-slate-500">{incidentStart ? 'Breach detected' : 'Power'}</dt>
                  <dd className="font-medium text-slate-900">
                    {incidentStart ? formatCat(incidentStart) : cooler.isPowerCut ? `Battery ${cooler.batteryPct}%` : 'Mains'}
                  </dd>
                </div>
              </dl>
            </Card>
          </div>

          {/* Telemetry history: small multiples sharing the time axis */}
          <Card>
            <CardHeader
              title="Telemetry history"
              icon={Clock}
              subtitle="Movement and backup battery from the same readings"
              actions={
                <Segmented<Range>
                  label="Time range"
                  value={range}
                  onChange={setRange}
                  options={[
                    { value: '5m', label: '5 min' },
                    { value: '15m', label: '15 min' },
                    { value: 'all', label: 'Session' },
                  ]}
                />
              }
            />
            <div className="p-4">
              {points.length < 2 ? (
                <div className="h-40 rounded-md bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center text-sm text-slate-500">
                  {historyError ? `History unavailable: ${historyError}` : 'Collecting readings. The charts fill in as telemetry arrives.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <MiniChart data={speedData} title="Speed" unit=" km/h" domain={[0, 60]} color="#DC2626" marker={breachLabel} />
                  <MiniChart data={batteryData} title="Backup battery" unit="%" domain={[0, 100]} color="#123965" marker={breachLabel} />
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Actions */}
        <footer className="bg-white border-t border-line px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {cooler.incidentId ? (
              <>
                Incident <span className="font-mono text-slate-700">{cooler.incidentId}</span> opened {formatCat(incidentStart)}
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <CircleCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                No open incident
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onAuthorizeMove(cooler.id)} disabled={!cooler.incidentId}>
              Mark as authorised move
            </Button>
            <Button icon={Phone} onClick={() => onCallRetailer(cooler.id)}>
              Call retailer
            </Button>
            <Button
              variant="danger"
              icon={cooler.incidentId ? Truck : Flag}
              onClick={() => {
                onDispatch(cooler.id);
                onActionFeedback(`Recovery team flagged for ${cooler.id} near ${cooler.locationName}.`);
              }}
            >
              Dispatch recovery team
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
};
