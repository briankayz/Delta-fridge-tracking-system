import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { CoolerAsset, RiskReason, TrailPoint } from '../types';
import { api } from '../services/api';
import { formatCat, formatDuration } from '../services/useTelemetryFeed';
import { IncidentRouteMap } from './IncidentRouteMap';

interface RiskDetailInspectorModalProps {
  cooler: CoolerAsset | null;
  now: number;
  onClose: () => void;
  onActionFeedback: (msg: string) => void;
  onAuthorizeMove: (assetId: string) => void;
  onDispatch: (assetId: string) => void;
  onCallRetailer: (assetId: string) => void;
}

const TONE = {
  critical: { text: 'text-[#ba1a1a]', bg: 'bg-[#ba1a1a]', soft: 'bg-[#ffdad6]', hex: '#ba1a1a' },
  warning: { text: 'text-[#735c00]', bg: 'bg-[#735c00]', soft: 'bg-[#ffe088]', hex: '#735c00' },
  nominal: { text: 'text-[#10B981]', bg: 'bg-[#10B981]', soft: 'bg-[#eaf3ea]', hex: '#10B981' },
} as const;

const HEADLINE = {
  critical: 'UNAUTHORIZED RELOCATION DETECTED',
  warning: 'POWER / COLD-CHAIN WARNING',
  nominal: 'SECURE & TRANSMITTING',
} as const;

const REASON_UI: Record<string, { icon: string; critical: boolean }> = {
  GEOFENCE_BREACH: { icon: 'crisis_alert', critical: true },
  GEOFENCE_DRIFT: { icon: 'wrong_location', critical: false },
  MAINS_CUT_IN_TRANSIT: { icon: 'power_off', critical: true },
  MAINS_OUTAGE_PROLONGED: { icon: 'power_off', critical: false },
  MAINS_OUTAGE: { icon: 'power_off', critical: false },
  CURFEW_MOTION: { icon: 'nightlight', critical: true },
  MOTION: { icon: 'local_shipping', critical: false },
  SHOCK_TILT: { icon: 'vibration', critical: false },
  COLD_CHAIN: { icon: 'thermostat', critical: false },
};

const RANGES = { all: Infinity, '15m': 15 * 60_000, '5m': 5 * 60_000 } as const;
type Range = keyof typeof RANGES;

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Africa/Harare', hour: '2-digit', minute: '2-digit', second: '2-digit' });

function summarise(cooler: CoolerAsset): { title: string; body: string } {
  const codes = new Set(cooler.riskReasons.map((r) => r.code));
  if (cooler.status === 'critical') {
    const parts = [
      codes.has('MAINS_CUT_IN_TRANSIT') && 'AC power loss',
      (codes.has('MOTION') || codes.has('CURFEW_MOTION')) && `a vehicular motion profile (${cooler.speedKmh.toFixed(1)} km/h)`,
      codes.has('GEOFENCE_BREACH') && 'a geofence exit',
      codes.has('CURFEW_MOTION') && 'outside trading hours',
    ].filter(Boolean);
    return {
      title: 'High-Confidence Theft / Unauthorized Move',
      body: `Multi-sensor fusion detected ${parts.join(', ')}. Theft-prediction confidence ${cooler.confidencePct}%.`,
    };
  }
  if (cooler.status === 'warning') {
    return { title: 'Operational Risk', body: cooler.riskReasons.map((r) => r.label).join(', ') + '. No displacement detected.' };
  }
  return { title: 'No Anomaly Detected', body: 'Cooler is inside its geofence, on mains power and within cold-chain limits.' };
}

const ReasonRow: React.FC<{ reason: RiskReason }> = ({ reason }) => {
  const ui = REASON_UI[reason.code] ?? { icon: 'info', critical: false };
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-[#eaedff] shadow-sm">
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
          ui.critical ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#ffe088] text-[#735c00]'
        }`}
      >
        <span className="material-symbols-outlined text-[16px]">{ui.icon}</span>
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-bold text-[#131b2e]">{reason.label}</span>
          <span className="text-[10px] font-bold text-[#42474d] font-mono">+{reason.points} pts</span>
        </div>
        <span className="text-[11px] text-[#42474d]">{reason.detail}</span>
      </div>
    </div>
  );
};

export const RiskDetailInspectorModal: React.FC<RiskDetailInspectorModalProps> = ({
  cooler,
  now,
  onClose,
  onActionFeedback,
  onAuthorizeMove,
  onDispatch,
  onCallRetailer,
}) => {
  const [rangeTab, setRangeTab] = useState<Range>('all');
  const [history, setHistory] = useState<TrailPoint[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const coolerId = cooler?.id;
  const lastSeen = cooler?.lastSeen;

  // Refresh history whenever a new payload for this cooler lands (throttled by payload cadence).
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

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const chartData = useMemo(() => {
    const cutoff = now - RANGES[rangeTab];
    return history
      .filter((p) => Date.parse(p.t) >= cutoff)
      .map((p) => ({ time: timeLabel(p.t), battery: p.battery_pct, speed: p.speed_kmh, risk: p.score }));
  }, [history, rangeTab, now]);

  if (!cooler) return null;

  const tone = TONE[cooler.status];
  const summary = summarise(cooler);
  const gaugeOffset = 314.16 * (1 - Math.min(100, cooler.riskScore) / 100);
  const incidentStart = cooler.incidentOpenedAt;
  const breachLabel = incidentStart ? chartData.find((d) => d.time >= timeLabel(incidentStart))?.time : undefined;
  const displaced = cooler.displacementM > cooler.geofenceRadiusM;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-start justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#eaedff] w-full max-w-[1400px] overflow-hidden my-auto flex flex-col relative">
        {/* Top Breadcrumb & Telemetry Sync Bar */}
        <div className="px-6 py-3.5 bg-[#f2f3ff] border-b border-[#eaedff] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white shadow-sm text-[12px] font-semibold text-[#42474d] hover:text-[#154363] transition-colors border border-[#eaedff]"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Back to Dashboard</span>
            </button>
            <span className="text-[#42474d] text-[12px]">/</span>
            <span className="text-[12px] font-bold text-[#131b2e]">{cooler.id}</span>
            {cooler.incidentId && (
              <span className="px-2 py-0.5 rounded bg-[#eaedff] text-[#42474d] text-[10px] font-bold uppercase">
                {cooler.incidentId}
              </span>
            )}
            {cooler.simulationActive && (
              <span className="px-2 py-0.5 rounded bg-[#ffe088] text-[#735c00] text-[10px] font-bold uppercase">
                Simulation
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white shadow-sm border border-[#eaedff]">
              <span className={`w-2 h-2 rounded-full ${tone.bg} animate-pulse`}></span>
              <span className="text-[11px] text-[#42474d]">
                LAST PING: <strong className="text-[#131b2e] font-bold uppercase">{cooler.lastPing}</strong>
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white shadow-sm border border-[#eaedff]">
              <span className="material-symbols-outlined text-[#0062a1] text-[16px]">
                {cooler.isPowerCut ? 'battery_charging_20' : 'power'}
              </span>
              <span className="text-[11px] text-[#42474d]">
                {cooler.isPowerCut ? 'BACKUP BATT' : 'MAINS'}:{' '}
                <strong className={`${cooler.isPowerCut ? 'text-[#ba1a1a]' : 'text-[#131b2e]'} font-bold`}>
                  {cooler.isPowerCut ? `${cooler.batteryPct}%` : cooler.powerSource}
                </strong>
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close inspector"
              className="w-8 h-8 rounded-lg bg-white border border-[#eaedff] flex items-center justify-center text-[#42474d] hover:text-[#131b2e]"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        {/* [&>*]:shrink-0 stops cards being squashed by the max-height scroll container */}
        <div className="p-6 flex flex-col gap-6 max-h-[80vh] overflow-y-auto [&>*]:shrink-0">
          {/* 1. Header Asset Card */}
          <section className="w-full bg-white rounded-xl border border-[#eaedff] p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#315B7C]"></div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-5 pl-2">
              <div className="w-20 h-20 rounded-xl bg-[#f2f3ff] border border-[#eaedff] overflow-hidden shrink-0 shadow-sm flex items-center justify-center">
                <span className="material-symbols-outlined text-[36px] text-[#154363]">kitchen</span>
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#315B7C]">
                    ASSET TELEMETRY PROFILE
                  </span>
                  <span className="text-[#c2c7ce]">•</span>
                  <span className="text-[11px] text-[#42474d] font-mono">IMEI: {cooler.imei || '—'}</span>
                </div>
                <h1 className="text-[22px] font-bold text-[#131b2e] tracking-tight">Cooler ID: {cooler.id}</h1>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-1">
                  <div className="flex items-center gap-1.5 text-[#42474d] text-[13px]">
                    <span className="material-symbols-outlined text-[16px] text-[#315B7C]">inventory_2</span>
                    <span>
                      Model: <strong className="text-[#131b2e] font-semibold">{cooler.coolerModel}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#42474d] text-[13px]">
                    <span className="material-symbols-outlined text-[16px] text-[#315B7C]">storefront</span>
                    <span>
                      Retailer Assigned: <strong className="text-[#131b2e] font-semibold">{cooler.retailer}</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-2 shrink-0 pl-2 lg:pl-0">
              <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full ${tone.soft} ${tone.text} shadow-sm`}>
                <span className={`w-2.5 h-2.5 rounded-full ${tone.bg} ${cooler.status === 'critical' ? 'animate-ping' : ''}`}></span>
                <span className="text-[11px] uppercase tracking-wider font-bold">{HEADLINE[cooler.status]}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[12px] text-[#42474d]">
                {incidentStart && (
                  <>
                    <span>
                      Breach Detected: <strong className="text-[#131b2e]">{formatCat(incidentStart)}</strong>
                    </span>
                    <span>•</span>
                  </>
                )}
                <span>
                  Location: <strong className="text-[#131b2e]">{cooler.locationName}</strong>
                </span>
              </div>
            </div>
          </section>

          {/* 2 & 3. Bento Grid: AI Anomaly Analysis + Displacement Map */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* 2. AI Anomaly Analysis Breakdown (5 cols) */}
            <section className="xl:col-span-5 bg-gradient-to-br from-[#d0e4ff]/40 via-white to-white rounded-xl shadow-sm border border-[#eaedff] p-5 flex flex-col justify-between gap-5 relative">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#0062a1] text-[18px]">auto_awesome</span>
                    <span className="text-[11px] uppercase tracking-wider text-[#0062a1] font-bold">
                      SENTINEL AI ANOMALY ENGINE
                    </span>
                  </div>
                  <h2 className="text-[18px] font-bold text-[#131b2e] mt-1">Risk Assessment Breakdown</h2>
                </div>
                <span className={`px-2.5 py-1 rounded ${tone.bg} text-white text-[11px] font-bold uppercase tracking-wider`}>
                  {cooler.status}
                </span>
              </div>

              {/* Radial Risk Score Gauge */}
              <div className="flex flex-col sm:flex-row items-center gap-5 bg-white rounded-xl p-4 shadow-sm border border-[#eaedff]">
                <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                    <circle className="text-[#e2e7ff]" cx="60" cy="60" fill="none" r="50" stroke="currentColor" strokeWidth="10"></circle>
                    <circle
                      cx="60"
                      cy="60"
                      fill="none"
                      r="50"
                      stroke={tone.hex}
                      strokeDasharray="314.16"
                      strokeDashoffset={gaugeOffset}
                      strokeLinecap="round"
                      strokeWidth="10"
                      style={{ transition: 'stroke-dashoffset 600ms ease' }}
                    ></circle>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className={`text-[26px] font-bold ${tone.text} leading-none`}>{cooler.riskScore}%</span>
                    <span className="text-[10px] text-[#42474d] uppercase font-semibold mt-1">Risk Rating</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[14px] font-bold text-[#131b2e]">{summary.title}</span>
                  <p className="text-[12px] text-[#42474d] leading-relaxed">{summary.body}</p>
                </div>
              </div>

              {/* AI Reasoning Logs */}
              <div className="flex flex-col gap-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#42474d]">AI REASONING LOGS</span>
                {cooler.riskReasons.length === 0 ? (
                  <div className="p-3 rounded-lg bg-white border border-[#eaedff] text-[11px] text-[#42474d]">
                    No risk signals firing. All sensor channels within expected bounds.
                  </div>
                ) : (
                  cooler.riskReasons.map((r) => <ReasonRow key={r.code} reason={r} />)
                )}
              </div>
            </section>

            {/* 3. Interactive Location History Map (7 cols) */}
            <section className="xl:col-span-7 bg-white rounded-xl shadow-sm border border-[#eaedff] p-5 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#42474d]">GPS TELEMETRY TRAIL</span>
                  <h2 className="text-[18px] font-bold text-[#131b2e]">Location History & Displacement</h2>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                    displaced ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#eaf3ea] text-[#10B981]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">distance</span>
                  <span>
                    {cooler.displacementM >= 1000
                      ? `${(cooler.displacementM / 1000).toFixed(2)} km`
                      : `${Math.round(cooler.displacementM)} m`}{' '}
                    from anchor
                  </span>
                </span>
              </div>

              <div className="relative isolate w-full h-80 rounded-xl overflow-hidden border border-[#eaedff] shadow-inner">
                <IncidentRouteMap cooler={cooler} />
              </div>

              {/* Map Footer Telemetry */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="p-3 rounded-lg bg-[#f2f3ff] flex flex-col border border-[#eaedff]">
                  <span className="text-[10px] font-bold uppercase text-[#42474d]">ORIGIN GEOFENCE</span>
                  <span className="text-[13px] font-semibold text-[#131b2e] mt-0.5">{cooler.geofenceRadiusM} m radius</span>
                </div>
                <div className="p-3 rounded-lg bg-[#f2f3ff] flex flex-col border border-[#eaedff]">
                  <span className="text-[10px] font-bold uppercase text-[#42474d]">CURRENT COORDINATES</span>
                  <span className="text-[13px] font-mono font-semibold text-[#131b2e] mt-0.5">
                    {Math.abs(cooler.lat).toFixed(5)}° {cooler.lat < 0 ? 'S' : 'N'}, {Math.abs(cooler.lng).toFixed(5)}°{' '}
                    {cooler.lng < 0 ? 'W' : 'E'}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-[#f2f3ff] flex flex-col border border-[#eaedff]">
                  <span className="text-[10px] font-bold uppercase text-[#42474d]">
                    {incidentStart ? 'INCIDENT DURATION' : 'SPEED'}
                  </span>
                  <span className={`text-[13px] font-semibold mt-0.5 ${incidentStart ? 'text-[#ba1a1a]' : 'text-[#131b2e]'}`}>
                    {incidentStart
                      ? `${formatDuration(incidentStart, now)} (since ${formatCat(incidentStart)})`
                      : `${cooler.speedKmh.toFixed(1)} km/h`}
                  </span>
                </div>
              </div>
            </section>
          </div>

          {/* 4. Sensor Correlation Chart (live history from backend) */}
          <section className="w-full bg-white rounded-xl shadow-sm border border-[#eaedff] p-5 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#42474d]">LIVE SENSOR CORRELATION</span>
                <h2 className="text-[18px] font-bold text-[#131b2e]">Battery Level (%) vs. Movement Speed (km/h)</h2>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-1 rounded-full bg-[#0062a1]"></span>
                    <span className="text-[11px] text-[#42474d]">Battery (%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-1 rounded-full bg-[#ba1a1a]"></span>
                    <span className="text-[11px] text-[#42474d]">Speed (km/h)</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 p-1 rounded-lg bg-[#f2f3ff] border border-[#eaedff]">
                  {(Object.keys(RANGES) as Range[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRangeTab(r)}
                      className={`px-3 py-1 rounded text-[11px] font-semibold transition-all ${
                        rangeTab === r ? 'bg-white shadow-sm text-[#131b2e]' : 'text-[#42474d] hover:text-[#131b2e]'
                      }`}
                    >
                      {r.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="w-full h-64 mt-2">
              {chartData.length < 2 ? (
                <div className="w-full h-full rounded-lg bg-[#f2f3ff] border border-dashed border-[#c2c7ce] flex items-center justify-center text-[12px] text-[#42474d]">
                  {historyError ? `History unavailable: ${historyError}` : 'Collecting telemetry… the chart fills in as payloads arrive.'}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 16, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e7ff" vertical={false} />
                    <XAxis dataKey="time" stroke="#72787e" fontSize={11} minTickGap={40} />
                    <YAxis yAxisId="left" domain={[0, 100]} stroke="#0062a1" fontSize={11} unit="%" />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 60]} stroke="#ba1a1a" fontSize={11} unit="km/h" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#131b2e', borderRadius: 8, color: '#ffffff', fontSize: 12, border: 'none' }}
                    />
                    {breachLabel && (
                      <ReferenceLine
                        x={breachLabel}
                        yAxisId="right"
                        stroke="#ba1a1a"
                        strokeDasharray="4 4"
                        label={{ value: 'Breach', position: 'top', fill: '#ba1a1a', fontSize: 10, fontWeight: 'bold' }}
                      />
                    )}
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="battery"
                      stroke="#0062a1"
                      strokeWidth={2.5}
                      dot={false}
                      isAnimationActive={false}
                      name="Battery Level (%)"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="speed"
                      stroke="#ba1a1a"
                      strokeWidth={2.5}
                      dot={false}
                      isAnimationActive={false}
                      name="Velocity (km/h)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
        </div>

        {/* 5. Fixed Bottom Action Bar */}
        <div className="bg-[#f2f3ff] border-t border-[#eaedff] px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[#42474d] text-[12px]">
            <span className={`material-symbols-outlined ${tone.text} text-[18px]`}>gavel</span>
            {cooler.incidentId ? (
              <span>
                Incident <strong className="text-[#131b2e]">{cooler.incidentId}</strong> • Open for{' '}
                <strong className="text-[#ba1a1a]">{formatDuration(incidentStart, now)}</strong>
              </span>
            ) : (
              <span>No open incident for this asset</span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => onAuthorizeMove(cooler.id)}
              disabled={!cooler.incidentId}
              className="px-4 py-2 rounded-lg bg-white border border-[#eaedff] hover:bg-[#eaedff] text-[#131b2e] text-[12px] font-semibold transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Mark as Authorized Move
            </button>
            <button
              onClick={() => onCallRetailer(cooler.id)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0062a1] text-white hover:bg-[#00497b] text-[12px] font-semibold shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">call</span>
              <span>Call Retailer</span>
            </button>
            <button
              onClick={() => {
                onDispatch(cooler.id);
                onActionFeedback(`Repossession team flagged for ${cooler.id} near ${cooler.locationName}.`);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#ba1a1a] text-white hover:bg-[#93000a] text-[12px] font-bold shadow-md transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">flag</span>
              <span>Flag for Repossession Team</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
