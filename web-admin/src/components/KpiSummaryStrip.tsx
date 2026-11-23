import React from 'react';
import { LucideIcon, Radio, Refrigerator, ShieldAlert, ShieldCheck, Unplug } from 'lucide-react';
import { FleetSummary } from '../types';
import { cx } from './ui';

const Tile: React.FC<{
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
  footer: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}> = ({ label, value, icon: Icon, tone, footer, children, className }) => (
  <div className={cx('bg-white rounded-lg border border-line shadow-card p-3 sm:p-4 flex flex-col min-w-0', className)}>
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs sm:text-[13px] font-medium text-slate-500 leading-snug">{label}</span>
      <span className={cx('w-7 h-7 sm:w-8 sm:h-8 rounded-md flex items-center justify-center shrink-0', tone)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
    </div>
    <div className="mt-1 text-2xl sm:text-[28px] leading-8 sm:leading-9 font-semibold tracking-tight text-slate-900 tabular">{value.toLocaleString()}</div>
    {children}
    <div className="mt-auto pt-2 text-[11px] sm:text-xs text-slate-500 leading-snug">{footer}</div>
  </div>
);

/** All figures come from the cooler register and live beacon state (region-scoped). */
export const KpiSummaryStrip: React.FC<{ summary: FleetSummary }> = ({ summary: s }) => {
  const compliantPct = s.total > 0 ? (s.compliant / s.total) * 100 : 0;
  return (
    <section aria-label="Fleet summary" className="grid grid-cols-2 sm:grid-cols-6 xl:grid-cols-5 gap-3 sm:gap-4">
      <Tile
        className="sm:col-span-3 xl:col-span-1"
        label="Registered coolers"
        value={s.total}
        icon={Refrigerator}
        tone="bg-delta-50 text-delta-700"
        footer={
          <>
            <span className="tabular font-medium text-slate-700">{s.reporting}</span> reporting now
          </>
        }
      />
      <Tile className="sm:col-span-3 xl:col-span-1" label="Secure & compliant" value={s.compliant} icon={ShieldCheck} tone="bg-emerald-50 text-emerald-700" footer="In geofence, on mains, reporting">
        <div className="mt-2 flex items-center gap-2">
          <div
            className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(compliantPct)}
            aria-label="Share of fleet compliant"
          >
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${compliantPct}%` }} />
          </div>
          <span className="text-xs font-medium text-slate-700 tabular">{compliantPct.toFixed(1)}%</span>
        </div>
      </Tile>
      <Tile className="sm:col-span-2 xl:col-span-1" label="Unplugged" value={s.outages} icon={Unplug} tone="bg-amber-50 text-amber-700" footer="Mains off · running on battery" />
      <Tile className="sm:col-span-2 xl:col-span-1" label="Beacons offline" value={s.offline} icon={Radio} tone="bg-slate-100 text-slate-700" footer="Not reporting or never installed" />
      <Tile
        className="col-span-2 sm:col-span-2 xl:col-span-1"
        label="Theft alerts"
        value={s.anomalies}
        icon={ShieldAlert}
        tone="bg-red-50 text-red-700"
        footer={
          s.open_incidents > 0 ? (
            <span className="font-medium text-red-700">{s.open_incidents} open incident{s.open_incidents === 1 ? '' : 's'} in total</span>
          ) : (
            'No open incidents'
          )
        }
      />
    </section>
  );
};
