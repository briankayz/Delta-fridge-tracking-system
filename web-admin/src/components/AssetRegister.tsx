import React, { useState } from 'react';
import { BatteryMedium, BatteryWarning, ChevronRight, ListFilter, Plug, Refrigerator, Unplug } from 'lucide-react';
import { CoolerAsset, Severity } from '../types';
import { Card, CardHeader, Segmented, StatusBadge, STATUS_STYLE, cx } from './ui';

interface AssetRegisterProps {
  fleet: CoolerAsset[];
  onSelectCooler: (cooler: CoolerAsset) => void;
  flashingRowId?: string | null;
}

type Filter = 'all' | Severity;

export const AssetRegister: React.FC<AssetRegisterProps> = ({ fleet, onSelectCooler, flashingRowId }) => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Filter>('all');

  const count = (s: Severity) => fleet.filter((c) => c.status === s).length;
  const rows = fleet.filter((c) => {
    if (status !== 'all' && c.status !== status) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return c.id.toLowerCase().includes(q) || c.retailer.toLowerCase().includes(q) || c.locationName.toLowerCase().includes(q);
  });

  return (
    <Card id="assets" className="overflow-hidden">
      <CardHeader
        title="Asset register"
        icon={Refrigerator}
        subtitle="Latest telemetry per beacon · click a row for the risk inspector"
        actions={
          <>
            <Segmented<Filter>
              label="Filter by status"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: 'All', count: fleet.length },
                { value: 'critical', label: 'Critical', count: count('critical') },
                { value: 'warning', label: 'Warning', count: count('warning') },
                { value: 'nominal', label: 'Secure', count: count('nominal') },
              ]}
            />
            <label className="relative">
              <span className="sr-only">Filter assets</span>
              <ListFilter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter"
                className="h-7 w-36 pl-8 pr-2 rounded-md text-xs ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-delta-500"
              />
            </label>
          </>
        }
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500 border-b border-line">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Cooler</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Retailer / location</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Risk</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-right">Cabinet</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Power</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-right">Battery</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Last report</th>
              <th scope="col" className="px-2 py-2.5"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                  No coolers match this filter.
                </td>
              </tr>
            )}
            {rows.map((c) => {
              const s = STATUS_STYLE[c.status];
              const warm = c.internalTemp > 6;
              return (
                <tr
                  key={c.id}
                  onClick={() => onSelectCooler(c)}
                  className={cx(
                    'cursor-pointer hover:bg-slate-50 focus-within:bg-slate-50',
                    flashingRowId === c.id && 'dag-flash'
                  )}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-medium text-slate-900">{c.id}</div>
                    <div className="text-xs text-slate-500">{c.coolerModel}</div>
                  </td>
                  <td className="px-4 py-3 min-w-[220px]">
                    <div className="text-slate-900">{c.retailer}</div>
                    <div className={cx('text-xs', c.isBreached ? 'text-red-700 font-medium' : 'text-slate-500')}>
                      {c.locationName}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge severity={c.status} label={c.statusLabel} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 w-28">
                      <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                        <div className={cx('h-full rounded-full', s.dot)} style={{ width: `${c.riskScore}%` }} />
                      </div>
                      <span className="w-9 text-right text-xs font-medium text-slate-700 tabular">{c.riskScore}%</span>
                    </div>
                  </td>
                  <td className={cx('px-4 py-3 text-right tabular whitespace-nowrap', warm ? 'text-red-700 font-medium' : 'text-slate-700')}>
                    {c.internalTemp.toFixed(1)}°C
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={cx('inline-flex items-center gap-1.5 text-xs', c.isPowerCut ? 'text-amber-800 font-medium' : 'text-slate-600')}>
                      {c.isPowerCut ? <Unplug className="h-3.5 w-3.5" aria-hidden="true" /> : <Plug className="h-3.5 w-3.5" aria-hidden="true" />}
                      {c.isPowerCut ? 'Mains off' : c.powerSource}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <span className={cx('inline-flex items-center gap-1 text-xs tabular', c.batteryPct < 30 ? 'text-red-700' : 'text-slate-700')}>
                      {c.batteryPct < 30 ? (
                        <BatteryWarning className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <BatteryMedium className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                      )}
                      {c.batteryPct}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap tabular">{c.lastPing}</td>
                  <td className="px-2 py-3 text-slate-400">
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
