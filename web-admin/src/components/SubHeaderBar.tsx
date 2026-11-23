import React from 'react';

interface SubHeaderBarProps {
  onExportCsv?: () => void;
  onProvisionClick?: () => void;
}

export const SubHeaderBar: React.FC<SubHeaderBarProps> = ({
  onExportCsv,
  onProvisionClick,
}) => {
  return (
    <header className="w-full bg-white px-6 py-4 shadow-sm border-b border-[#eaedff]">
      <div className="max-w-[1600px] mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* Title & Subtitle */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-bold text-[#131b2e] tracking-tight">
              Fleet Telemetry & Risk Command Center
            </h1>
            <span className="px-2 py-0.5 rounded bg-[#e2e7ff] text-[#154363] text-[11px] font-bold uppercase tracking-wider">
              Harare Ops
            </span>
          </div>
          <p className="text-[13px] text-[#42474d] mt-0.5">
            Real-time monitoring across 1,420 provisioned IoT beacons (Harare Metropolitan & Chitungwiza Cluster)
          </p>
        </div>

        {/* Action & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Live Cadence Stream Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#f2f3ff] text-[#131b2e] text-[12px] font-medium border border-[#eaedff]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0062a1] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0062a1]"></span>
            </span>
            <span>
              Live Stream: <strong className="text-[#131b2e] font-semibold">5s Cadence</strong>
            </span>
          </div>

          {/* Region Selector */}
          <div className="relative">
            <select className="appearance-none bg-white border border-[#c2c7ce]/50 pl-3 pr-8 py-1.5 rounded-lg text-[12px] font-medium text-[#131b2e] shadow-sm focus:outline-none cursor-pointer">
              <option>Harare Central & Suburbs</option>
              <option>Chitungwiza Industrial</option>
              <option>Ruwa & Eastlea Sector</option>
              <option>Norton Logistics Corridor</option>
            </select>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[18px] text-[#42474d] pointer-events-none">
              expand_more
            </span>
          </div>

          {/* Export CSV Button */}
          <button
            onClick={onExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f2f3ff] hover:bg-[#eaedff] text-[#131b2e] text-[12px] font-medium transition-colors shadow-sm border border-[#eaedff]"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span>Export CSV</span>
          </button>

          {/* Provision Beacon Button */}
          <button
            onClick={onProvisionClick}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#315B7C] hover:bg-[#154363] text-white text-[12px] font-semibold transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>+ Provision Beacon</span>
          </button>
        </div>
      </div>
    </header>
  );
};

