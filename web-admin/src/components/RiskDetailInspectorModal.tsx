import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import { CoolerAsset } from '../types';

interface RiskDetailInspectorModalProps {
  cooler: CoolerAsset | null;
  onClose: () => void;
  onActionFeedback: (msg: string) => void;
}

// 24-Hour Telemetry Correlation Data
const CORRELATION_DATA = [
  { time: '04:00', battery: 100, speed: 0, event: 'Idle' },
  { time: '06:00', battery: 100, speed: 0, event: 'Idle' },
  { time: '08:00', battery: 100, speed: 0, event: 'Store Open' },
  { time: '10:00', battery: 100, speed: 0, event: 'Normal' },
  { time: '12:00', battery: 100, speed: 0, event: 'Normal' },
  { time: '14:00', battery: 100, speed: 0, event: 'Normal' },
  { time: '16:00', battery: 100, speed: 0, event: 'Normal' },
  { time: '18:00', battery: 100, speed: 0, event: 'Normal' },
  { time: '20:00', battery: 100, speed: 0, event: 'Normal' },
  { time: '22:00', battery: 100, speed: 0, event: 'Store Close' },
  { time: '23:30', battery: 98, speed: 0, event: 'Mains Cut' },
  { time: '23:45', battery: 95, speed: 45, event: 'Breach Detected' },
  { time: '00:00', battery: 91, speed: 38, event: 'Transit' },
  { time: '00:15', battery: 88, speed: 28, event: 'Transit' },
  { time: '00:30', battery: 84, speed: 0, event: 'Stationary (Sector 4)' },
  { time: '01:00', battery: 78, speed: 0, event: 'Power Cut' },
  { time: '02:00', battery: 68, speed: 0, event: 'Battery Backup' },
];

export const RiskDetailInspectorModal: React.FC<RiskDetailInspectorModalProps> = ({
  cooler,
  onClose,
  onActionFeedback,
}) => {
  const [rangeTab, setRangeTab] = useState<'24h' | '12h' | '1h'>('24h');

  if (!cooler) return null;

  const chartData =
    rangeTab === '1h'
      ? CORRELATION_DATA.slice(-6)
      : rangeTab === '12h'
      ? CORRELATION_DATA.slice(-10)
      : CORRELATION_DATA;

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
            <span className="px-2 py-0.5 rounded bg-[#eaedff] text-[#42474d] text-[10px] font-bold uppercase">
              INC-8821-RL
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white shadow-sm border border-[#eaedff]">
              <span className="w-2 h-2 rounded-full bg-[#ba1a1a] animate-pulse"></span>
              <span className="text-[11px] text-[#42474d]">
                LAST PING: <strong className="text-[#131b2e] font-bold">2 MINS AGO</strong>
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white shadow-sm border border-[#eaedff]">
              <span className="material-symbols-outlined text-[#0062a1] text-[16px]">
                battery_charging_20
              </span>
              <span className="text-[11px] text-[#42474d]">
                BACKUP BATT: <strong className="text-[#ba1a1a] font-bold">{cooler.batteryPct}%</strong>
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white border border-[#eaedff] flex items-center justify-center text-[#42474d] hover:text-[#131b2e]"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 flex flex-col gap-6 max-h-[80vh] overflow-y-auto">
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
                  <span className="text-[11px] text-[#42474d] font-mono">
                    IMEI: {cooler.imei ?? '358920110482910'}
                  </span>
                </div>
                <h1 className="text-[22px] font-bold text-[#131b2e] tracking-tight">
                  Cooler ID: {cooler.id}
                </h1>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-1">
                  <div className="flex items-center gap-1.5 text-[#42474d] text-[13px]">
                    <span className="material-symbols-outlined text-[16px] text-[#315B7C]">
                      inventory_2
                    </span>
                    <span>
                      Model: <strong className="text-[#131b2e] font-semibold">{cooler.coolerModel}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#42474d] text-[13px]">
                    <span className="material-symbols-outlined text-[16px] text-[#315B7C]">
                      storefront
                    </span>
                    <span>
                      Retailer Assigned: <strong className="text-[#131b2e] font-semibold">{cooler.retailer}</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-2 shrink-0 pl-2 lg:pl-0">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ffdad6] text-[#ba1a1a] shadow-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ba1a1a] animate-ping"></span>
                <span className="text-[11px] uppercase tracking-wider font-bold">
                  UNAUTHORIZED RELOCATION DETECTED
                </span>
              </div>
              <div className="flex items-center gap-3 text-[12px] text-[#42474d]">
                <span>
                  Breach Detected: <strong className="text-[#131b2e]">23:45 CAT</strong>
                </span>
                <span>•</span>
                <span>
                  Territory: <strong className="text-[#131b2e]">Harare East / Sector 4</strong>
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
                    <span className="material-symbols-outlined text-[#0062a1] text-[18px]">
                      auto_awesome
                    </span>
                    <span className="text-[11px] uppercase tracking-wider text-[#0062a1] font-bold">
                      SENTINEL AI ANOMALY ENGINE
                    </span>
                  </div>
                  <h2 className="text-[18px] font-bold text-[#131b2e] mt-1">
                    Risk Assessment Breakdown
                  </h2>
                </div>
                <span className="px-2.5 py-1 rounded bg-[#ba1a1a] text-white text-[11px] font-bold uppercase tracking-wider">
                  CRITICAL
                </span>
              </div>

              {/* Radial Risk Score Gauge */}
              <div className="flex flex-col sm:flex-row items-center gap-5 bg-white rounded-xl p-4 shadow-sm border border-[#eaedff]">
                <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                    <circle
                      className="text-[#e2e7ff]"
                      cx="60"
                      cy="60"
                      fill="none"
                      r="50"
                      stroke="currentColor"
                      strokeWidth="10"
                    ></circle>
                    <circle
                      className="text-[#ba1a1a]"
                      cx="60"
                      cy="60"
                      fill="none"
                      r="50"
                      stroke="currentColor"
                      strokeDasharray="314.16"
                      strokeDashoffset="18.85"
                      strokeLinecap="round"
                      strokeWidth="10"
                    ></circle>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[26px] font-bold text-[#ba1a1a] leading-none">
                      {cooler.riskScore}%
                    </span>
                    <span className="text-[10px] text-[#42474d] uppercase font-semibold mt-1">
                      Risk Rating
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[14px] font-bold text-[#131b2e]">
                    High-Confidence Theft / Unauthorized Move
                  </span>
                  <p className="text-[12px] text-[#42474d] leading-relaxed">
                    Multi-sensor fusion detected simultaneous AC power loss, vehicular acceleration
                    profile ({cooler.speedKmh} km/h), and geofence exit outside operational hours.
                  </p>
                </div>
              </div>

              {/* AI Reasoning Logs */}
              <div className="flex flex-col gap-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#42474d]">
                  AI REASONING LOGS
                </span>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-[#eaedff] shadow-sm">
                  <div className="w-7 h-7 rounded-lg bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[16px]">crisis_alert</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[12px] font-bold text-[#131b2e]">Geofence Breached</span>
                    <span className="text-[11px] text-[#42474d]">
                      Device moved <strong className="text-[#ba1a1a]">{(cooler.displacementM / 1000).toFixed(1)} km</strong> outside designated radius at <strong className="text-[#131b2e]">23:45</strong>.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-[#eaedff] shadow-sm">
                  <div className="w-7 h-7 rounded-lg bg-[#ffe088] text-[#735c00] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[16px]">local_shipping</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[12px] font-bold text-[#131b2e]">Transit Vibration Pattern</span>
                    <span className="text-[11px] text-[#42474d]">
                      MPU-6050 accelerometer logged sustained <strong className="text-[#131b2e]">{cooler.speedKmh} km/h</strong> motion profile.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-[#eaedff] shadow-sm">
                  <div className="w-7 h-7 rounded-lg bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[16px]">power_off</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[12px] font-bold text-[#131b2e]">Power Interrupted</span>
                    <span className="text-[11px] text-[#42474d]">
                      Main AC 234V line disconnected while device was in rapid vehicular transit.
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. Interactive Location History Map (7 cols) */}
            <section className="xl:col-span-7 bg-white rounded-xl shadow-sm border border-[#eaedff] p-5 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#42474d]">
                    GPS & CELL-TOWER TRIANGULATION
                  </span>
                  <h2 className="text-[18px] font-bold text-[#131b2e]">
                    Location History & Displacement
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ffdad6] text-[#ba1a1a] text-[11px] font-bold">
                    <span className="material-symbols-outlined text-[15px]">distance</span>
                    <span>{(cooler.displacementM / 1000).toFixed(1)} km Displacement</span>
                  </span>
                </div>
              </div>

              {/* Visual Route Canvas */}
              <div className="relative w-full h-80 rounded-xl overflow-hidden bg-[#f2f4f7] border border-[#eaedff] shadow-inner">
                {/* SVG Visual Cartographic Overlay */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 320" preserveAspectRatio="none">
                  {/* Origin Safe Geofence */}
                  <circle
                    cx="150"
                    cy="210"
                    r="56"
                    stroke="#0062a1"
                    strokeWidth="2"
                    strokeDasharray="4,4"
                    fill="#0062a1"
                    fillOpacity="0.12"
                  />
                  {/* Red Dashed Displacement Route Line */}
                  <path
                    d="M 150 210 Q 260 190, 320 140 T 455 95"
                    fill="none"
                    stroke="#ba1a1a"
                    strokeWidth="3.5"
                    strokeDasharray="8,6"
                    strokeLinecap="round"
                  />
                </svg>

                {/* Origin Pin */}
                <div className="absolute left-[25%] top-[65%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                  <div className="px-2.5 py-1 rounded-lg bg-white shadow-md flex items-center gap-1.5 mb-1 border border-[#eaedff]">
                    <span className="w-2 h-2 rounded-full bg-[#0062a1]"></span>
                    <span className="text-[11px] font-semibold text-[#131b2e] whitespace-nowrap">
                      {cooler.retailer} (Origin)
                    </span>
                  </div>
                  <div className="w-4 h-4 rounded-full bg-[#0062a1] border-2 border-white shadow"></div>
                </div>

                {/* Distance Badge */}
                <div className="absolute left-[52%] top-[45%] -translate-x-1/2 -translate-y-1/2 px-2.5 py-1 rounded-full bg-[#ba1a1a] text-white text-[11px] font-bold shadow-md">
                  +{(cooler.displacementM / 1000).toFixed(1)} km
                </div>

                {/* Relocation Breach Marker */}
                <div className="absolute left-[76%] top-[30%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                  <div className="px-2.5 py-1 rounded-lg bg-[#ba1a1a] text-white shadow-md flex items-center gap-1.5 mb-1">
                    <span className="material-symbols-outlined text-[14px]">location_on</span>
                    <span className="text-[11px] font-bold whitespace-nowrap">
                      {cooler.locationName}
                    </span>
                  </div>
                  <div className="relative flex items-center justify-center">
                    <span className="w-8 h-8 rounded-full bg-[#ba1a1a]/40 animate-ping absolute"></span>
                    <span className="w-4 h-4 rounded-full bg-[#ba1a1a] shadow relative"></span>
                  </div>
                </div>
              </div>

              {/* Map Footer Telemetry */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="p-3 rounded-lg bg-[#f2f3ff] flex flex-col border border-[#eaedff]">
                  <span className="text-[10px] font-bold uppercase text-[#42474d]">
                    ORIGIN GEOFENCE
                  </span>
                  <span className="text-[13px] font-semibold text-[#131b2e] mt-0.5">
                    {cooler.geofenceRadiusM}m Radius • Verified
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-[#f2f3ff] flex flex-col border border-[#eaedff]">
                  <span className="text-[10px] font-bold uppercase text-[#42474d]">
                    CURRENT COORDINATES
                  </span>
                  <span className="text-[13px] font-mono font-semibold text-[#131b2e] mt-0.5">
                    {cooler.lat.toFixed(4)}° S, {cooler.lng.toFixed(4)}° E
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-[#f2f3ff] flex flex-col border border-[#eaedff]">
                  <span className="text-[10px] font-bold uppercase text-[#42474d]">
                    TRANSIT DURATION
                  </span>
                  <span className="text-[13px] font-semibold text-[#ba1a1a] mt-0.5">
                    14 mins (23:45 – 23:59)
                  </span>
                </div>
              </div>
            </section>
          </div>

          {/* 4. Full-Width 24-Hour Sensor Correlation Chart */}
          <section className="w-full bg-white rounded-xl shadow-sm border border-[#eaedff] p-5 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#42474d]">
                  24-HOUR SENSOR CORRELATION
                </span>
                <h2 className="text-[18px] font-bold text-[#131b2e]">
                  Battery Level (%) vs. Movement Speed (km/h)
                </h2>
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
                  {(['24h', '12h', '1h'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRangeTab(r)}
                      className={`px-3 py-1 rounded text-[11px] font-semibold transition-all ${
                        rangeTab === r
                          ? 'bg-white shadow-sm text-[#131b2e]'
                          : 'text-[#42474d] hover:text-[#131b2e]'
                      }`}
                    >
                      {r.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Recharts Dual-Axis Line Graph */}
            <div className="w-full h-64 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e7ff" vertical={false} />
                  <XAxis dataKey="time" stroke="#72787e" fontSize={11} />
                  <YAxis
                    yAxisId="left"
                    domain={[0, 100]}
                    stroke="#0062a1"
                    fontSize={11}
                    unit="%"
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 60]}
                    stroke="#ba1a1a"
                    fontSize={11}
                    unit="km/h"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#131b2e',
                      borderRadius: 8,
                      color: '#ffffff',
                      fontSize: 12,
                      border: 'none',
                    }}
                  />
                  <ReferenceArea
                    x1="23:30"
                    x2="00:30"
                    yAxisId="left"
                    fill="#ba1a1a"
                    fillOpacity={0.08}
                  />
                  <ReferenceLine
                    x="23:45"
                    yAxisId="right"
                    stroke="#ba1a1a"
                    strokeDasharray="4 4"
                    label={{
                      value: 'Breach: 45 km/h',
                      position: 'top',
                      fill: '#ba1a1a',
                      fontSize: 10,
                      fontWeight: 'bold',
                    }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="battery"
                    stroke="#0062a1"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#0062a1' }}
                    name="Battery Level (%)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="speed"
                    stroke="#ba1a1a"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#ba1a1a' }}
                    name="Velocity (km/h)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        {/* 5. Fixed Bottom Action Bar */}
        <div className="bg-[#f2f3ff] border-t border-[#eaedff] px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[#42474d] text-[12px]">
            <span className="material-symbols-outlined text-[#ba1a1a] text-[18px]">gavel</span>
            <span>
              Incident <strong className="text-[#131b2e]">INC-8821-RL</strong> • Escalation SLA: <strong className="text-[#ba1a1a]">01:42:18</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => onActionFeedback(`Authorized Move logged for ${cooler.id}.`)}
              className="px-4 py-2 rounded-lg bg-white border border-[#eaedff] hover:bg-[#eaedff] text-[#131b2e] text-[12px] font-semibold transition-colors shadow-sm"
            >
              Mark as Authorized Move
            </button>
            <button
              onClick={() => onActionFeedback(`Initiating VoIP call to ${cooler.retailer}...`)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0062a1] text-white hover:bg-[#00497b] text-[12px] font-semibold shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">call</span>
              <span>Call Retailer</span>
            </button>
            <button
              onClick={() => onActionFeedback(`URGENT: Delta Repossession Team dispatched to Sector 4 for ${cooler.id}!`)}
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

