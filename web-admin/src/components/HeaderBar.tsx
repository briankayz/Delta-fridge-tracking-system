import React from 'react';

interface HeaderBarProps {
  onSearchChange?: (query: string) => void;
  onSimulateBreach?: () => void;
  activeCoolersCount?: number;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  onSearchChange,
  onSimulateBreach,
  activeCoolersCount = 1420,
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 w-full z-50 bg-[#315B7C] shadow-[0_1px_8px_rgba(0,0,0,0.12)]">
      <div className="h-16 w-full px-6 flex items-center justify-between gap-4">
        {/* Left Branding */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#ffe088] text-[22px]">change_history</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[16px] text-white tracking-tight font-bold">DELTA BEVERAGES</span>
                <span className="px-1.5 py-0.5 rounded bg-[#ffe088] text-[#241a00] text-[11px] font-semibold uppercase tracking-wider">
                  Sentinel AI
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#47a8ff] animate-pulse"></span>
                <span className="text-[11px] text-[#a9d2f9] uppercase tracking-wider">
                  System Online • {activeCoolersCount.toLocaleString()} Assets
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center Nav Links */}
        <nav className="hidden xl:flex items-center gap-1 shrink-0">
          <a
            href="#"
            className="px-3 py-2 rounded-lg bg-white/20 text-white font-semibold text-[13px] transition-colors"
          >
            Live Fleet Map
          </a>
          <a
            href="#"
            className="px-3 py-2 rounded-lg text-[13px] text-[#a9d2f9] hover:bg-white/10 hover:text-white transition-colors"
          >
            Alert Queue (2)
          </a>
          <a
            href="#"
            className="px-3 py-2 rounded-lg text-[13px] text-[#a9d2f9] hover:bg-white/10 hover:text-white transition-colors"
          >
            Asset Directory
          </a>
          <a
            href="#"
            className="px-3 py-2 rounded-lg text-[13px] text-[#a9d2f9] hover:bg-white/10 hover:text-white transition-colors"
          >
            Analytics
          </a>
          <a
            href="#"
            className="px-3 py-2 rounded-lg text-[13px] text-[#a9d2f9] hover:bg-white/10 hover:text-white transition-colors"
          >
            Firmware & Telemetry
          </a>
        </nav>

        {/* Right Search & Profile */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="relative hidden lg:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#a9d2f9] text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search Asset ID, IMEI, or Merchant..."
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="w-64 h-9 pl-9 pr-3 rounded-lg bg-white/10 text-[13px] text-white placeholder:text-[#a9d2f9]/70 focus:outline-none focus:bg-white/20 transition-all"
            />
          </div>

          {/* Quick Simulation Trigger for Demo */}
          {onSimulateBreach && (
            <button
              onClick={onSimulateBreach}
              title="Inject live displacement payload from Phone A Beacon simulator"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ba1a1a] hover:bg-[#93000a] text-white text-[12px] font-bold shadow-sm transition-all"
            >
              <span className="material-symbols-outlined text-[16px] animate-pulse">crisis_alert</span>
              <span>Simulate Beacon Ingest</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-[11px] text-[#a9d2f9]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#47a8ff]"></span>
              <span>42ms</span>
            </div>

            <button className="relative p-2 rounded-lg text-[#a9d2f9] hover:bg-white/10 hover:text-white transition-colors">
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute top-1 right-1 px-1 min-w-[14px] h-3.5 rounded-full bg-[#ba1a1a] text-white text-[10px] leading-3 flex items-center justify-center font-bold">
                2
              </span>
            </button>

            <div className="h-6 w-px bg-white/20 mx-1"></div>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#154363] border border-white/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-[18px]">person</span>
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-[12px] text-white font-semibold leading-tight">Takudzwa M.</span>
                <span className="text-[10px] text-[#a9d2f9] leading-tight">Fleet Ops Lead</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
