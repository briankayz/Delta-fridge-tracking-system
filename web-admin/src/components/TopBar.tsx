import React from 'react';
import { Bell, FlaskConical, Search, UserRound } from 'lucide-react';
import { ConnectionState } from '../types';
import { cx, DeltaMark } from './ui';

interface TopBarProps {
  onSearchChange: (query: string) => void;
  onSimulateBreach: () => void;
  connection: ConnectionState;
  alertCount: number;
}

export const TopBar: React.FC<TopBarProps> = ({ onSearchChange, onSimulateBreach, connection, alertCount }) => (
  <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur border-b border-line">
    <div className="h-full flex items-center gap-3 px-4 sm:px-6">
      {/* Compact brand on small screens (sidebar hidden) */}
      <div className="flex lg:hidden items-center gap-2 shrink-0">
        <span className="w-8 h-8 rounded-md bg-delta-900 flex items-center justify-center">
          <DeltaMark size={20} />
        </span>
        <span className="font-brand font-semibold text-delta-700">Delta</span>
      </div>

      {/* Global search */}
      <label className="relative flex-1 max-w-md">
        <span className="sr-only">Search assets</span>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          placeholder="Search cooler ID, IMEI or retailer"
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-9 pl-9 pr-3 rounded-md bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 ring-1 ring-inset ring-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-delta-500"
        />
      </label>

      <div className="ml-auto flex items-center gap-2">
        {/* Demo control, visually separated from production actions */}
        <button
          type="button"
          onClick={onSimulateBreach}
          disabled={connection !== 'live'}
          title="Runs a server-side breach for DLTA-BCN-9042 (no phone needed)"
          className="hidden md:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium text-gold-700 bg-gold-50 ring-1 ring-inset ring-gold-300 hover:bg-gold-100 disabled:opacity-50"
        >
          <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
          Demo: simulate breach
        </button>

        <a
          href="#incidents"
          className="relative inline-flex items-center justify-center w-9 h-9 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label={`${alertCount} open alerts`}
        >
          <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
          {alertCount > 0 && (
            <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center tabular">
              {alertCount}
            </span>
          )}
        </a>

        <div className="h-6 w-px bg-line mx-1" />

        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-delta-100 text-delta-700 flex items-center justify-center">
            <UserRound className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="hidden md:block leading-tight">
            <div className="text-sm font-medium text-slate-900">Operations</div>
            <div className={cx('text-[11px]', connection === 'live' ? 'text-emerald-700' : 'text-amber-700')}>
              {connection === 'live' ? 'Signed in · live' : 'Not connected'}
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
);
