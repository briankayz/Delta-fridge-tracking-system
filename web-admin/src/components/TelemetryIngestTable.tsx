import React, { useState } from 'react';
import { CoolerAsset } from '../types';

interface TelemetryIngestTableProps {
  fleet: CoolerAsset[];
  onSelectCooler: (cooler: CoolerAsset) => void;
  flashingRowId?: string | null;
  onIntercept?: (assetId: string) => void;
}

export const TelemetryIngestTable: React.FC<TelemetryIngestTableProps> = ({
  fleet,
  onSelectCooler,
  flashingRowId,
  onIntercept,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'critical' | 'warning' | 'nominal'>('all');

  const filteredFleet = fleet.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      item.id.toLowerCase().includes(q) ||
      item.retailer.toLowerCase().includes(q) ||
      item.locationName.toLowerCase().includes(q)
    );
  });

  return (
    <section className="bg-white rounded-xl shadow-sm border border-[#eaedff] overflow-hidden flex flex-col">
      {/* Section Header */}
      <div className="p-4 bg-white border-b border-[#eaedff] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[#154363] text-[20px]">reorder</span>
          <h2 className="text-[16px] font-bold text-[#131b2e]">
            Live Fleet Telemetry Stream (Recent Ingests)
          </h2>
          <span className="px-2 py-0.5 rounded bg-[#eaedff] text-[11px] font-semibold text-[#42474d]">
            Buffer: 50/sec
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Status filter buttons */}
          <div className="flex items-center gap-1 bg-[#f2f3ff] p-0.5 rounded-lg border border-[#eaedff]">
            {(['all', 'critical', 'warning', 'nominal'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase transition-all ${
                  statusFilter === s
                    ? 'bg-white shadow-sm text-[#131b2e]'
                    : 'text-[#42474d] hover:text-[#131b2e]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Filter table..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-40 h-7 pl-2 pr-2 rounded text-[11px] bg-[#f2f3ff] border border-[#eaedff] focus:outline-none focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* Telemetry Matrix Table */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left text-[12px] text-[#131b2e]">
          <thead className="bg-[#f2f3ff] text-[#42474d] text-[11px] uppercase tracking-wider border-b border-[#eaedff]">
            <tr>
              <th className="px-4 py-3 font-semibold">Asset ID & Type</th>
              <th className="px-4 py-3 font-semibold">Retail Merchant / Deployment</th>
              <th className="px-4 py-3 font-semibold">Telemetry Status</th>
              <th className="px-4 py-3 font-semibold">Internal Temp</th>
              <th className="px-4 py-3 font-semibold">Power Source</th>
              <th className="px-4 py-3 font-semibold">Beacon Batt</th>
              <th className="px-4 py-3 font-semibold">Last Ping</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eaedff]">
            {filteredFleet.map((cooler) => {
              const isFlashing = flashingRowId === cooler.id;
              const isCritical = cooler.status === 'critical';
              const isWarning = cooler.status === 'warning';

              return (
                <tr
                  key={cooler.id}
                  onClick={() => onSelectCooler(cooler)}
                  className={`cursor-pointer transition-colors ${
                    isFlashing
                      ? 'bg-[#ffdad6] animate-pulse'
                      : isCritical
                      ? 'hover:bg-[#ffdad6]/40 bg-[#ffdad6]/10'
                      : 'hover:bg-[#f2f3ff]/60'
                  }`}
                >
                  {/* Asset ID & Type */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isCritical
                            ? 'bg-[#ba1a1a] animate-ping'
                            : isWarning
                            ? 'bg-[#735c00]'
                            : 'bg-[#0062a1]'
                        }`}
                      ></span>
                      <span className="font-bold text-[#131b2e]">{cooler.id}</span>
                    </div>
                    <span className="text-[10px] text-[#42474d] block mt-0.5">
                      {cooler.coolerModel}
                    </span>
                  </td>

                  {/* Retail Merchant / Deployment */}
                  <td className="px-4 py-3">
                    <span className="font-semibold text-[#131b2e] block">{cooler.retailer}</span>
                    <span
                      className={`text-[10px] block mt-0.5 ${
                        isCritical ? 'text-[#ba1a1a] font-bold' : 'text-[#42474d]'
                      }`}
                    >
                      {cooler.locationName}
                    </span>
                  </td>

                  {/* Telemetry Status */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
                        isCritical
                          ? 'bg-[#ffdad6] text-[#ba1a1a]'
                          : isWarning
                          ? 'bg-[#ffe088] text-[#735c00]'
                          : 'bg-[#eaf3ea] text-[#10B981]'
                      }`}
                    >
                      {isCritical ? (
                        <span className="material-symbols-outlined text-[12px]">fmd_bad</span>
                      ) : isWarning ? (
                        <span className="material-symbols-outlined text-[12px]">power_off</span>
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
                      )}
                      {cooler.statusLabel}
                    </span>
                  </td>

                  {/* Internal Temp */}
                  <td className="px-4 py-3 font-semibold">
                    <span
                      className={
                        cooler.internalTemp > 6.0
                          ? 'text-[#ba1a1a]'
                          : cooler.internalTemp > 4.0
                          ? 'text-[#735c00]'
                          : 'text-[#154363]'
                      }
                    >
                      {cooler.internalTemp}°C {cooler.internalTemp > 6.0 ? '↑' : ''}
                    </span>
                  </td>

                  {/* Power Source */}
                  <td className="px-4 py-3">
                    <span
                      className={`font-medium ${
                        cooler.isPowerCut ? 'text-[#ba1a1a]' : 'text-[#42474d]'
                      }`}
                    >
                      {cooler.powerSource}
                    </span>
                  </td>

                  {/* Beacon Batt */}
                  <td className="px-4 py-3 font-bold text-[#131b2e]">
                    {cooler.batteryPct}%
                  </td>

                  {/* Last Ping */}
                  <td className="px-4 py-3 text-[#42474d] text-[11px] font-mono">
                    {cooler.lastPing}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {isCritical ? (
                      <button
                        onClick={() => onIntercept?.(cooler.id)}
                        className="px-2.5 py-1 rounded bg-[#ba1a1a] hover:bg-[#93000a] text-white text-[11px] font-bold shadow-sm transition-colors"
                      >
                        Intercept
                      </button>
                    ) : (
                      <button
                        onClick={() => onSelectCooler(cooler)}
                        className="px-2.5 py-1 rounded bg-[#f2f3ff] hover:bg-[#eaedff] text-[#131b2e] text-[11px] font-semibold border border-[#eaedff] transition-colors"
                      >
                        Details
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

