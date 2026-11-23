import React, { useState } from 'react';
import { ChevronRight, CircleCheck, Clock, Gauge, Radio, ShieldAlert, Unplug, UserRound } from 'lucide-react';
import { CoolerAsset, Incident } from '../types';
import { formatDuration, KIND_LABEL, RESOLUTION_LABEL, timeAgo } from '../services/useTelemetryFeed';
import { Link } from '../services/router';
import { Card, CardHeader, Segmented, cx } from './ui';

interface IncidentQueueProps {
  incidents: Incident[];
  fleetById: Record<string, CoolerAsset>;
  now: number;
  onInspect: (assetId: string) => void;
}

type Filter = 'all' | 'displacement' | 'other';

const KIND_ICON = { displacement: ShieldAlert, power: Unplug, signal_lost: Radio } as const;

export const IncidentQueue: React.FC<IncidentQueueProps> = ({ incidents, fleetById, now, onInspect }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const open = incidents.filter((i) => i.status !== 'resolved');
  const resolved = incidents.filter((i) => i.status === 'resolved').slice(0, 4);
  const shown = open.filter((i) => filter === 'all' || (filter === 'displacement' ? i.kind === 'displacement' : i.kind !== 'displacement'));
  const nTheft = open.filter((i) => i.kind === 'displacement').length;

  return (
    <Card id="incidents" className="flex flex-col">
      <CardHeader
        title="Live incidents"
        icon={ShieldAlert}
        subtitle={nTheft > 0 ? `${nTheft} theft alert${nTheft === 1 ? '' : 's'} need${nTheft === 1 ? 's' : ''} action` : 'No theft alerts'}
        actions={
          <Link to="/incidents" className="text-xs font-medium text-delta-700 hover:underline">
            All incidents
          </Link>
        }
      />
      <div className="px-4 pt-3">
        <Segmented<Filter>
          label="Filter incidents"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Open', count: open.length },
            { value: 'displacement', label: 'Theft', count: nTheft },
            { value: 'other', label: 'Power / offline', count: open.length - nTheft },
          ]}
        />
      </div>

      <ul className="p-4 space-y-3 max-h-[560px] overflow-y-auto">
        {shown.length === 0 && (
          <li className="flex flex-col items-center text-center py-10 text-sm text-slate-500">
            <CircleCheck className="h-8 w-8 text-emerald-500 mb-2" aria-hidden="true" />
            Nothing open in this view.
          </li>
        )}

        {shown.map((i) => {
          const theft = i.kind === 'displacement';
          const Icon = KIND_ICON[i.kind];
          const asset = fleetById[i.asset_id];
          return (
            <li key={i.id} className={cx('rounded-lg border p-3', theft ? 'border-red-200 bg-red-50/40' : 'border-line')}>
              <div className="flex items-start gap-3">
                <span
                  className={cx(
                    'mt-0.5 w-8 h-8 rounded-md flex items-center justify-center shrink-0',
                    theft ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cx('text-[11px] font-semibold uppercase tracking-wide', theft ? 'text-red-700' : 'text-amber-700')}>
                      {KIND_LABEL[i.kind]}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 tabular">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {formatDuration(i.opened_at, now)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onInspect(i.asset_id)}
                    className="mt-0.5 text-left text-sm font-semibold text-slate-900 hover:text-delta-700"
                  >
                    {i.asset_id} <span className="font-normal text-slate-500">· {i.retailer_name ?? 'Unknown store'}</span>
                  </button>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    {theft && asset ? `${(asset.displacementM / 1000).toFixed(1)} km from store · ${asset.locationName}` : i.reasons[0]?.detail}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className={cx('inline-flex items-center gap-1 font-semibold tabular', theft ? 'text-red-700' : 'text-amber-700')}>
                      <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
                      Risk {asset?.riskScore ?? i.peak_score}%
                    </span>
                    <span
                      className={cx(
                        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium',
                        i.status === 'open' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'
                      )}
                    >
                      {i.status === 'open' ? 'Unacknowledged' : 'Acknowledged'}
                    </span>
                    {i.assigned_name && (
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <UserRound className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        {i.assigned_name}
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <Link to={`/incidents/${i.id}`} className="inline-flex items-center gap-0.5 text-xs font-medium text-delta-700 hover:underline">
                      {i.id} · open case
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>
            </li>
          );
        })}

        {resolved.length > 0 && filter === 'all' && (
          <li className="pt-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Recently resolved</div>
            <ul className="space-y-1.5">
              {resolved.map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-xs text-slate-600">
                  <CircleCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                  <Link to={`/incidents/${r.id}`} className="truncate hover:text-delta-700">
                    {r.asset_id} · {RESOLUTION_LABEL[r.resolution ?? ''] ?? 'Closed'}
                  </Link>
                  <span className="ml-auto text-slate-400 whitespace-nowrap">{timeAgo(r.resolved_at, now)}</span>
                </li>
              ))}
            </ul>
          </li>
        )}
      </ul>
    </Card>
  );
};
