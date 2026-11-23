import React from 'react';
import { Activity } from 'lucide-react';
import { CoolerAsset } from '../types';
import { Card, CardHeader, cx } from './ui';

const ON_TIME_MS = 60_000; // a beacon that has not reported for 60 s is considered late

const Row: React.FC<{ label: string; value: number; total: number; suffix?: string; tone: string }> = ({
  label,
  value,
  total,
  suffix,
  tone,
}) => {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-900 tabular">
          {suffix ? `${Math.round(value)}${suffix}` : `${value}/${total}`}
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={cx('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

/** Device-health summary computed from live beacon state (no static figures). */
export const FleetHealthPanel: React.FC<{ fleet: CoolerAsset[]; now: number }> = ({ fleet, now }) => {
  const total = fleet.length;
  const onTime = fleet.filter((c) => c.lastSeen && now - Date.parse(c.lastSeen) < ON_TIME_MS).length;
  const onMains = fleet.filter((c) => !c.isPowerCut).length;
  const inRange = fleet.filter((c) => c.internalTemp <= 6).length;
  const avgBattery = total > 0 ? fleet.reduce((s, c) => s + c.batteryPct, 0) / total : 0;

  return (
    <Card>
      <CardHeader title="Beacon health" icon={Activity} subtitle="Live beacons on this console" />
      <div className="p-4 space-y-3">
        <Row label="Reporting on time (< 60 s)" value={onTime} total={total} tone="bg-delta-600" />
        <Row label="On mains power" value={onMains} total={total} tone="bg-delta-600" />
        <Row label="Cabinet ≤ 6 °C" value={inRange} total={total} tone="bg-delta-600" />
        <Row label="Average backup battery" value={avgBattery} total={100} suffix="%" tone="bg-delta-600" />
      </div>
    </Card>
  );
};
