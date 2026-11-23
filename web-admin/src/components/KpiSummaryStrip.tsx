import React from 'react';

interface KpiSummaryStripProps {
  totalTracked?: number;
  activeCompliant?: number;
  powerOutages?: number;
  anomalyAlerts?: number;
}

export const KpiSummaryStrip: React.FC<KpiSummaryStripProps> = ({
  totalTracked = 1420,
  activeCompliant = 1385,
  powerOutages = 23,
  anomalyAlerts = 12,
}) => {
  const compliantPct = ((activeCompliant / totalTracked) * 100).toFixed(1);

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Total Tracked Assets */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-[#eaedff] flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[#42474d] uppercase tracking-wider">
            Total Tracked Assets
          </span>
          <span className="w-7 h-7 rounded-lg bg-[#eaedff] flex items-center justify-center text-[#154363]">
            <span className="material-symbols-outlined text-[18px]">kitchen</span>
          </span>
        </div>
        <div className="my-2">
          <div className="text-[28px] font-bold text-[#131b2e] leading-tight">
            {totalTracked.toLocaleString()}{' '}
            <span className="text-[14px] font-normal text-[#42474d]">Coolers</span>
          </div>
        </div>
        <div className="flex items-center justify-between text-[#42474d] text-[11px] pt-2 bg-[#f2f3ff]/60 px-2 py-1 rounded">
          <div className="flex items-center gap-1 text-[#154363]">
            <span className="material-symbols-outlined text-[15px]">sensors</span>
            <span className="font-semibold">1,418 Online (99.8%)</span>
          </div>
          <span className="text-[#0062a1] font-semibold">+12 this week</span>
        </div>
      </div>

      {/* Card 2: Active & Compliant */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-[#eaedff] flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[#42474d] uppercase tracking-wider">
            Active & Compliant
          </span>
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#eaf3ea] text-[#10B981] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span> SAFE
          </span>
        </div>
        <div className="my-2">
          <div className="text-[28px] font-bold text-[#154363] leading-tight">
            {activeCompliant.toLocaleString()}{' '}
            <span className="text-[16px] text-[#154363] font-normal">({compliantPct}%)</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[#42474d] text-[11px] pt-2">
          <span className="material-symbols-outlined text-[16px] text-[#10B981]">verified_user</span>
          <span className="truncate">Within ≤50m geofence • Nominal 3.4°C</span>
        </div>
      </div>

      {/* Card 3: Power Outage Warnings */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-[#eaedff] flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[#42474d] uppercase tracking-wider">
            Power Outage Warnings
          </span>
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#ffe088] text-[#735c00] flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">bolt</span> MAINS 0V
          </span>
        </div>
        <div className="my-2">
          <div className="text-[28px] font-bold text-[#735c00] leading-tight">
            {powerOutages}{' '}
            <span className="text-[14px] font-normal text-[#42474d]">Coolers</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[#42474d] text-[11px] pt-2">
          <span className="material-symbols-outlined text-[16px] text-[#735c00]">battery_charging_full</span>
          <span className="truncate">AC Disconnected &gt; 2 hrs • Battery backup</span>
        </div>
      </div>

      {/* Card 4: AI Anomaly Alerts */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-[#eaedff] flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[#ba1a1a] uppercase tracking-wider">
            AI Anomaly Alerts
          </span>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ba1a1a] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ba1a1a]"></span>
          </span>
        </div>
        <div className="my-2">
          <div className="text-[28px] font-bold text-[#ba1a1a] leading-tight">
            {anomalyAlerts}{' '}
            <span className="text-[16px] text-[#ba1a1a] font-normal">High Risk</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[#42474d] text-[11px] pt-2">
          <span className="material-symbols-outlined text-[16px] text-[#ba1a1a]">warning</span>
          <span className="truncate text-[#ba1a1a] font-semibold">Theft & unauthorized nighttime motion</span>
        </div>
      </div>
    </section>
  );
};

