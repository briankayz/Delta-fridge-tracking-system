import React from 'react';
import { LucideIcon, Refrigerator, ShieldAlert, ShieldCheck, Unplug } from 'lucide-react';
import { cx } from './ui';

interface KpiSummaryStripProps {
  totalTracked: number;
  activeCompliant: number;
  powerOutages: number;
  anomalyAlerts: number;
  liveReporting: number;
  liveTotal: number;
  openIncidents: number;
}

const Tile: React.FC<{
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
  footer: React.ReactNode;
  children?: React.ReactNode;
}> = ({ label, value, icon: Icon, tone, footer, children }) => (
  <div className="bg-white rounded-lg border border-line shadow-card p-4 flex flex-col">
    <div className="flex items-start justify-between gap-3">
      <span className="text-[13px] font-medium text-slate-500">{label}</span>
      <span className={cx('w-8 h-8 rounded-md flex items-center justify-center shrink-0', tone)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
    </div>
    <div className="mt-1 text-[28px] leading-9 font-semibold tracking-tight text-slate-900 tabular">
      {value.toLocaleString()}
    </div>
    {children}
    <div className="mt-auto pt-2 text-xs text-slate-500">{footer}</div>
  </div>
);

export const KpiSummaryStrip: React.FC<KpiSummaryStripProps> = ({
  totalTracked,
  activeCompliant,
  powerOutages,
  anomalyAlerts,
  liveReporting,
  liveTotal,
  openIncidents,
}) => {
  const compliantPct = totalTracked > 0 ? (activeCompliant / totalTracked) * 100 : 0;

  return (
    <section aria-label="Fleet summary" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <Tile
        label="Coolers under management"
        value={totalTracked}
        icon={Refrigerator}
        tone="bg-delta-50 text-delta-700"
        footer={
          <>
            <span className="tabular font-medium text-slate-700">
              {liveReporting}/{liveTotal}
            </span>{' '}
            live beacons reporting
          </>
        }
      />
      <Tile
        label="Secure & compliant"
        value={activeCompliant}
        icon={ShieldCheck}
        tone="bg-emerald-50 text-emerald-700"
        footer="Inside geofence and on mains power"
      >
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
      <Tile
        label="Power outages"
        value={powerOutages}
        icon={Unplug}
        tone="bg-amber-50 text-amber-700"
        footer="Mains disconnected · running on battery"
      />
      <Tile
        label="Theft & displacement alerts"
        value={anomalyAlerts}
        icon={ShieldAlert}
        tone="bg-red-50 text-red-700"
        footer={
          openIncidents > 0 ? (
            <span className="font-medium text-red-700">
              {openIncidents} live incident{openIncidents === 1 ? ' needs' : 's need'} action
            </span>
          ) : (
            'No live incidents'
          )
        }
      />
    </section>
  );
};
