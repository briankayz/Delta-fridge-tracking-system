import React from 'react';
import { ArrowLeftRight, BarChart3, LayoutDashboard, LucideIcon, Refrigerator, ShieldAlert, UsersRound, Wifi, WifiOff } from 'lucide-react';
import { ConnectionState, Permission } from '../types';
import { Link } from '../services/router';
import { useAuth } from '../services/auth';
import { API_HOST_LABEL } from '../services/api';
import { cx, DeltaMark } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  perm: Permission;
  badge?: 'incidents';
}

export const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Operations',
    items: [
      { to: '/', label: 'Command centre', icon: LayoutDashboard, perm: 'fleet:read' },
      { to: '/incidents', label: 'Incidents', icon: ShieldAlert, perm: 'fleet:read', badge: 'incidents' },
      { to: '/register', label: 'Cooler register', icon: Refrigerator, perm: 'fleet:read' },
      { to: '/relocations', label: 'Relocations', icon: ArrowLeftRight, perm: 'fleet:read' },
    ],
  },
  {
    section: 'Management',
    items: [
      { to: '/reports', label: 'Reports', icon: BarChart3, perm: 'fleet:read' },
      { to: '/admin', label: 'Users & audit', icon: UsersRound, perm: 'audit:read' },
    ],
  },
];

export const isActive = (path: string, to: string) => (to === '/' ? path === '/' : path === to || path.startsWith(`${to}/`));

export const Sidebar: React.FC<{ path: string; incidentCount: number; connection: ConnectionState }> = ({ path, incidentCount, connection }) => {
  const { can } = useAuth();
  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-60 flex-col bg-delta-900 text-delta-100">
      <div className="h-16 flex items-center gap-3 px-5 border-b border-white/10">
        <DeltaMark size={30} />
        <div className="leading-tight">
          <div className="font-brand text-[17px] font-semibold text-white tracking-tight">Delta</div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-gold-300">Asset Guard</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto" aria-label="Primary">
        {NAV.map((group) => {
          const items = group.items.filter((i) => can(i.perm));
          if (items.length === 0) return null;
          return (
            <div key={group.section}>
              <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-delta-300">{group.section}</div>
              <ul className="space-y-0.5">
                {items.map(({ to, label, icon: Icon, badge }) => {
                  const active = isActive(path, to);
                  return (
                    <li key={to}>
                      <Link
                        to={to}
                        aria-current={active ? 'page' : undefined}
                        className={cx(
                          'relative flex items-center gap-3 h-9 px-3 rounded-md text-sm transition-colors',
                          active ? 'bg-white/10 text-white font-medium' : 'text-delta-100/80 hover:bg-white/5 hover:text-white'
                        )}
                      >
                        {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-gold-400" />}
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        <span className="flex-1">{label}</span>
                        {badge === 'incidents' && incidentCount > 0 && (
                          <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white text-[11px] font-semibold flex items-center justify-center tabular">
                            {incidentCount}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="m-3 rounded-md bg-white/5 px-3 py-2.5">
        <div className="flex items-center gap-2 text-xs font-medium text-white">
          {connection === 'live' ? (
            <Wifi className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
          )}
          {connection === 'live' ? 'Telemetry live' : connection === 'connecting' ? 'Connecting…' : 'Telemetry offline'}
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-delta-300 truncate" title={API_HOST_LABEL}>
          {API_HOST_LABEL}
        </div>
      </div>
      <div className="px-5 pb-4 text-[11px] text-delta-300">Delta Beverages · Asset Protection</div>
    </aside>
  );
};
