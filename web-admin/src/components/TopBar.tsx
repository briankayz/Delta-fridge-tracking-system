import React, { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, FlaskConical, KeyRound, LogOut, Menu, Search, UserRound, X } from 'lucide-react';
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { ConnectionState } from '../types';
import { useAuth, ROLE_LABEL } from '../services/auth';
import { Link } from '../services/router';
import { NAV, isActive } from './Sidebar';
import { cx, DeltaMark } from './ui';

interface TopBarProps {
  path: string;
  onSearchChange: (query: string) => void;
  onSimulateBreach: () => void;
  connection: ConnectionState;
  alertCount: number;
}

export const TopBar: React.FC<TopBarProps> = ({ path, onSearchChange, onSimulateBreach, connection, alertCount }) => {
  const { user, logout, can, meta } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwDone, setPwDone] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => menuRef.current && !menuRef.current.contains(e.target as Node) && setMenuOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  useEffect(() => setNavOpen(false), [path]);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-line">
      <div className="h-16 flex items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          className="lg:hidden -ml-1 p-2 rounded-md text-slate-600 hover:bg-slate-100"
          aria-label={navOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((v) => !v)}
        >
          {navOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <div className="flex lg:hidden items-center gap-2 shrink-0">
          <span className="w-8 h-8 rounded-md bg-delta-900 flex items-center justify-center">
            <DeltaMark size={20} />
          </span>
        </div>

        <label className="relative flex-1 max-w-md">
          <span className="sr-only">Search coolers</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search cooler, retailer or region"
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-md bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 ring-1 ring-inset ring-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-delta-500"
          />
        </label>

        <div className="ml-auto flex items-center gap-2">
          {meta?.demo_mode && can('demo:control') && (
            <button
              type="button"
              onClick={onSimulateBreach}
              disabled={connection !== 'live'}
              title="Runs a server-side theft simulation for DLTA-BCN-9042"
              className="hidden md:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium text-gold-700 bg-gold-50 ring-1 ring-inset ring-gold-300 hover:bg-gold-100 disabled:opacity-50"
            >
              <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
              Demo: simulate theft
            </button>
          )}

          <Link
            to="/incidents"
            className="relative inline-flex items-center justify-center w-9 h-9 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label={`${alertCount} open incidents`}
          >
            <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
            {alertCount > 0 && (
              <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center tabular">
                {alertCount}
              </span>
            )}
          </Link>

          <div className="h-6 w-px bg-line mx-1" />

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2 rounded-md p-1 pr-2 hover:bg-slate-50"
            >
              <span className="w-8 h-8 rounded-full bg-delta-100 text-delta-700 flex items-center justify-center">
                <UserRound className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="hidden md:block text-left leading-tight">
                <span className="block text-sm font-medium text-slate-900">{user?.name}</span>
                <span className="block text-[11px] text-slate-500">
                  {user ? ROLE_LABEL[user.role] : ''}
                  {user?.region ? ` · ${user.region}` : ''}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 mt-2 w-64 rounded-lg bg-white shadow-pop ring-1 ring-line p-1">
                <div className="px-3 py-2 border-b border-line">
                  <div className="text-sm font-medium text-slate-900">{user?.name}</div>
                  <div className="text-xs text-slate-500 truncate">{user?.email}</div>
                  <div className={cx('mt-1 text-[11px]', connection === 'live' ? 'text-emerald-700' : 'text-amber-700')}>
                    {connection === 'live' ? 'Receiving live telemetry' : 'Live telemetry disconnected'}
                  </div>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setPwOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-slate-700 hover:bg-slate-50"
                >
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  {pwDone ? 'Password changed ✓' : 'Change password'}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void logout()}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-slate-700 hover:bg-slate-50"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {pwOpen && (
        <ChangePasswordDialog
          onClose={() => setPwOpen(false)}
          onDone={() => {
            setPwOpen(false);
            setPwDone(true);
          }}
        />
      )}

      {/* Mobile navigation */}
      {navOpen && (
        <nav className="lg:hidden border-t border-line bg-white px-3 py-2" aria-label="Primary">
          {NAV.flatMap((g) => g.items)
            .filter((i) => can(i.perm))
            .map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={cx(
                  'flex items-center gap-3 h-10 px-3 rounded-md text-sm',
                  isActive(path, to) ? 'bg-delta-50 text-delta-700 font-medium' : 'text-slate-700'
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Link>
            ))}
        </nav>
      )}
    </header>
  );
};
