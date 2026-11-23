import React, { useState } from 'react';
import { RiskAlertItem } from '../types';

interface AiRiskRadarPanelProps {
  alerts: RiskAlertItem[];
  onSelectCoolerId: (assetId: string) => void;
  onDispatchResponse?: (assetId: string) => void;
  onLockout?: (assetId: string) => void;
  onCallMerchant?: (assetId: string) => void;
}

export const AiRiskRadarPanel: React.FC<AiRiskRadarPanelProps> = ({
  alerts,
  onSelectCoolerId,
  onDispatchResponse,
  onLockout,
  onCallMerchant,
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'critical' | 'warning'>('all');

  const filteredAlerts = alerts.filter((alert) => {
    if (filterTab === 'critical') return alert.severity === 'critical';
    if (filterTab === 'warning') return alert.severity === 'warning';
    return true;
  });

  return (
    <section className="flex flex-col gap-4">
      {/* Risk Radar Container */}
      <div className="bg-white rounded-xl shadow-sm border border-[#eaedff] overflow-hidden flex flex-col">
        {/* Radar Header */}
        <div className="p-4 bg-white border-b border-[#eaedff] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ba1a1a] text-[22px]">radar</span>
            <div>
              <h2 className="text-[16px] font-bold text-[#131b2e]">AI Risk Radar</h2>
              <span className="text-[12px] text-[#ba1a1a] font-semibold">
                {alerts.filter((a) => a.severity === 'critical').length} Critical Action(s) Required
              </span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-[#ffdad6] text-[#ba1a1a] text-[11px] font-bold animate-pulse">
            LIVE
          </span>
        </div>

        {/* Alert Queue Filter Tabs */}
        <div className="px-4 pt-2.5 pb-2 bg-[#f2f3ff]/60 border-b border-[#eaedff] flex items-center gap-2">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
              filterTab === 'all'
                ? 'bg-white shadow-sm text-[#131b2e]'
                : 'text-[#42474d] hover:bg-white'
            }`}
          >
            All ({alerts.length})
          </button>
          <button
            onClick={() => setFilterTab('critical')}
            className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1 ${
              filterTab === 'critical'
                ? 'bg-white shadow-sm text-[#ba1a1a]'
                : 'text-[#ba1a1a] hover:bg-white'
            }`}
          >
            Critical ({alerts.filter((a) => a.severity === 'critical').length})
          </button>
          <button
            onClick={() => setFilterTab('warning')}
            className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
              filterTab === 'warning'
                ? 'bg-white shadow-sm text-[#735c00]'
                : 'text-[#735c00] hover:bg-white'
            }`}
          >
            Warning ({alerts.filter((a) => a.severity === 'warning').length})
          </button>
        </div>

        {/* Alert Cards Scroll Area */}
        <div className="p-4 flex flex-col gap-3.5 max-h-[580px] overflow-y-auto">
          {filteredAlerts.map((alert) => {
            const isCritical = alert.severity === 'critical';

            if (alert.severity === 'resolved') {
              return (
                <article
                  key={alert.id}
                  className="bg-[#f2f3ff]/70 rounded-xl p-3 border border-[#eaedff] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-full bg-[#154363]/10 text-[#154363] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    </span>
                    <div>
                      <span className="text-[12px] font-bold text-[#131b2e] block">
                        {alert.title}
                      </span>
                      <span className="text-[11px] text-[#42474d]">{alert.description}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[#10B981] px-2 py-0.5 rounded bg-white border border-[#10B981]/30">
                    Resolved
                  </span>
                </article>
              );
            }

            return (
              <article
                key={alert.id}
                className={`bg-white rounded-xl p-4 shadow-sm border border-[#eaedff] transition-all hover:shadow-md border-l-4 ${
                  isCritical ? 'border-l-[#ba1a1a]' : 'border-l-[#735c00]'
                }`}
              >
                {/* Header Badges */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                      isCritical
                        ? 'bg-[#ffdad6] text-[#ba1a1a]'
                        : 'bg-[#ffe088] text-[#735c00]'
                    }`}
                  >
                    {isCritical ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a] animate-ping"></span>
                        CRITICAL DISPLACEMENT
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[13px]">power_off</span>
                        PROLONGED POWER OUTAGE
                      </>
                    )}
                  </span>
                  <span className="text-[11px] text-[#42474d] font-medium">{alert.timeAgo}</span>
                </div>

                {/* Title & IDs */}
                <h3 className="text-[15px] font-bold text-[#131b2e] leading-snug">{alert.title}</h3>
                <div className="flex items-center gap-2 text-[#42474d] text-[11px] mt-0.5">
                  <span>
                    Asset ID: <strong className="text-[#131b2e] font-semibold">{alert.assetId}</strong>
                  </span>
                </div>

                {/* Anomaly Details */}
                <div className="mt-2.5 p-2 rounded-lg bg-[#f2f3ff] text-[#131b2e] text-[12px] flex flex-col gap-1 border border-[#eaedff]">
                  <div
                    className={`flex items-start gap-1.5 font-medium ${
                      isCritical ? 'text-[#ba1a1a]' : 'text-[#735c00]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px] shrink-0 mt-0.5">
                      {isCritical ? 'wrong_location' : 'thermostat'}
                    </span>
                    <span>{alert.description}</span>
                  </div>
                  <div className="text-[#42474d] text-[11px] pt-1">
                    <strong>Origin Store:</strong> {alert.originStore}
                    <br />
                    <strong>Current GPS:</strong> {alert.currentLocation}
                  </div>
                </div>

                {/* Real-time Telemetry Mini Grid */}
                <div className="grid grid-cols-3 gap-2 my-3">
                  <div className="p-2 rounded bg-[#f2f3ff] text-center border border-[#eaedff]">
                    <span className="block text-[9px] text-[#42474d] uppercase font-semibold">
                      {isCritical ? 'Speed' : 'Temp'}
                    </span>
                    <span
                      className={`text-[12px] font-bold ${
                        isCritical ? 'text-[#ba1a1a]' : 'text-[#735c00]'
                      }`}
                    >
                      {isCritical ? `${alert.speedKmh} km/h` : '8.2°C'}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-[#f2f3ff] text-center border border-[#eaedff]">
                    <span className="block text-[9px] text-[#42474d] uppercase font-semibold">Power</span>
                    <span className="text-[12px] font-bold text-[#735c00]">{alert.powerStatus}</span>
                  </div>
                  <div className="p-2 rounded bg-[#f2f3ff] text-center border border-[#eaedff]">
                    <span className="block text-[9px] text-[#42474d] uppercase font-semibold">Risk AI</span>
                    <span
                      className={`text-[12px] font-bold ${
                        isCritical ? 'text-[#ba1a1a]' : 'text-[#735c00]'
                      }`}
                    >
                      {alert.riskPct}% Risk
                    </span>
                  </div>
                </div>

                {/* Action CTAs */}
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  {isCritical ? (
                    <>
                      <button
                        onClick={() => onDispatchResponse?.(alert.assetId)}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-[#0062a1] hover:bg-[#00497b] text-white text-[12px] font-semibold text-center transition-all shadow-sm flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[15px]">local_police</span>
                        <span>Dispatch Response</span>
                      </button>
                      <button
                        onClick={() => onLockout?.(alert.assetId)}
                        className="py-1.5 px-3 rounded-lg bg-[#ffdad6] hover:bg-[#ba1a1a] hover:text-white text-[#93000a] text-[12px] font-semibold transition-all flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[15px]">lock_reset</span>
                        <span>Lockout</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => onCallMerchant?.(alert.assetId)}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-[#f2f3ff] hover:bg-[#eaedff] text-[#131b2e] text-[12px] font-semibold text-center transition-all flex items-center justify-center gap-1.5 border border-[#eaedff]"
                      >
                        <span className="material-symbols-outlined text-[15px]">call</span>
                        <span>Call Merchant</span>
                      </button>
                      <button
                        onClick={() => onSelectCoolerId(alert.assetId)}
                        className="py-1.5 px-3 rounded-lg bg-white hover:bg-[#f2f3ff] text-[#42474d] text-[12px] font-medium transition-all shadow-sm border border-[#eaedff]"
                      >
                        Details
                      </button>
                    </>
                  )}
                </div>

                {/* Full Inspector Trigger */}
                <button
                  onClick={() => onSelectCoolerId(alert.assetId)}
                  className="w-full mt-2 py-1 text-[11px] font-bold text-[#0062a1] hover:underline flex items-center justify-center gap-1"
                >
                  <span>Open Full AI Risk Inspector</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </article>
            );
          })}
        </div>
      </div>

      {/* Sensor Health Matrix */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-[#eaedff] flex flex-col gap-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold text-[#42474d] uppercase tracking-wider">
            Sensor Health Matrix
          </span>
          <span className="text-[11px] text-[#0062a1] font-semibold">Harare Cluster</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[#131b2e] text-[12px]">
          <div className="flex items-center justify-between p-2 rounded bg-[#f2f3ff] border border-[#eaedff]">
            <span className="text-[#42474d]">GPS Triangulation</span>
            <span className="font-semibold text-[#154363]">Optimal</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-[#f2f3ff] border border-[#eaedff]">
            <span className="text-[#42474d]">Cellular Signal</span>
            <span className="font-semibold text-[#154363]">-74 dBm (LTE)</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-[#f2f3ff] border border-[#eaedff]">
            <span className="text-[#42474d]">Vibration Gyro</span>
            <span className="font-semibold text-[#735c00]">Active Tilt</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-[#f2f3ff] border border-[#eaedff]">
            <span className="text-[#42474d]">Beacon Battery Avg</span>
            <span className="font-semibold text-[#154363]">92% Capacity</span>
          </div>
        </div>
      </div>
    </section>
  );
};
