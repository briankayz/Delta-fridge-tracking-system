import React from 'react';
import { LayoutDashboard, Map, Refrigerator, ShieldAlert, Wifi, WifiOff } from 'lucide-react';
import { ConnectionState } from '../types';
import { cx, DeltaMark } from './ui';

export const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'live-map', label: 'Live map', icon: Map },
  { id: 'incidents', label: 'Incidents', icon: ShieldAlert },
  { id: 'assets', label: 'Asset register', icon: Refrigerator },
] as const;

export type NavId = (typeof NAV_ITEMS)[number]['id'];

interface SidebarProps {
  active: NavId;
  incidentCount: number;
  connection: ConnectionState;
  apiHost: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ active, incidentCount, connection, apiHost }) => (
  <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-60 flex-col bg-delta-900 text-delta-100">
    {/* Brand */}
    <div className="h-16 flex items-center gap-3 px-5 border-b border-white/10">
      <DeltaMark size={30} />
      <div className="leading-tight">
        <div className="font-brand text-[17px] font-semibold text-white tracking-tight">Delta</div>
        <div className="text-[11px] uppercase tracking-[0.14em] text-gold-300">Asset Guard</div>
      </div>
    </div>

    {/* Navigation (sections of the command centre) */}
    <nav className="flex-1 px-3 py-4" aria-label="Primary">
      <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-delta-300">Operations</div>
      <ul className="space-y-0.5">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-current={isActive ? 'location' : undefined}
                className={cx(
                  'relative flex items-center gap-3 h-9 px-3 rounded-md text-sm transition-colors',
                  isActive ? 'bg-white/10 text-white font-medium' : 'text-delta-100/80 hover:bg-white/5 hover:text-white'
                )}
              >
                {isActive && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-gold-400" />}
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="flex-1">{label}</span>
                {id === 'incidents' && incidentCount > 0 && (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white text-[11px] font-semibold flex items-center justify-center tabular">
                    {incidentCount}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>

    {/* Telemetry link status */}
    <div className="m-3 rounded-md bg-white/5 px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs font-medium text-white">
        {connection === 'live' ? (
          <Wifi className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
        ) : (
          <WifiOff className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
        )}
        {connection === 'live' ? 'Telemetry live' : connection === 'connecting' ? 'Connecting…' : 'Telemetry offline'}
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-delta-300 truncate" title={apiHost}>
        {apiHost.replace(/^https?:\/\//, '')}
      </div>
    </div>
    <div className="px-5 pb-4 text-[11px] text-delta-300">Delta Beverages · Harare Operations</div>
  </aside>
);
