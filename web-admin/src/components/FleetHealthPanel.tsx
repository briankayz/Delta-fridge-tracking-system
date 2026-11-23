import React from 'react';
import { Activity } from 'lucide-react';
import { CoolerAsset } from '../types';
import { Card, CardHeader, cx } from './ui';

const Row: React.FC<{ label: string; value: number; total: number; suffix?: string; tone?: string }> = ({
  label,
  value,
  total,
  suffix,
  tone = 'bg-delta-600',
}) => {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-900 tabular">{suffix ? `${Math.round(value)}${suffix}` : `${value}/${total}`}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={cx('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

/** Device-health summary computed from live beacon state (no static figures). */
export const FleetHealthPanel: React.FC<{ fleet: CoolerAsset[]; offlineAfterMin: number }> = ({ fleet, offlineAfterMin }) => {
  const total = fleet.length;
  const onTime = fleet.filter((c) => c.online).length;
  const onMains = fleet.filter((c) => c.lastSeen && !c.isPowerCut).length;
  const temps = fleet.filter((c) => c.internalTemp != null);
  const inRange = temps.filter((c) => (c.internalTemp ?? 0) <= 6).length;
  const batteries = fleet.map((c) => c.batteryPct).filter((b): b is number => b != null);
  const avgBattery = batteries.length ? batteries.reduce((s, b) => s + b, 0) / batteries.length : 0;

  return (
    <Card>
      <CardHeader title="Beacon health" icon={Activity} subtitle={`${total} beacons visible to you`} />
      <div className="p-4 space-y-3">
        <Row label={`Reporting (last ${offlineAfterMin} min)`} value={onTime} total={total} />
        <Row label="On mains power" value={onMains} total={total} />
        <Row label="Cabinet ≤ 6 °C" value={inRange} total={temps.length} />
        <Row label="Average backup battery" value={avgBattery} total={100} suffix="%" />
      </div>
    </Card>
  );
};
