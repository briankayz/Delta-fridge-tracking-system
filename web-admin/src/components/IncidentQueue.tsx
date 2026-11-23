import React, { useState } from 'react';
import { ChevronRight, CircleCheck, Clock, Gauge, Phone, ShieldAlert, Thermometer, Truck, Unplug, Zap } from 'lucide-react';
import { RiskAlertItem } from '../types';
import { Button, Card, CardHeader, Segmented, STATUS_STYLE, cx } from './ui';

interface IncidentQueueProps {
  alerts: RiskAlertItem[];
  onOpen: (assetId: string) => void;
  onDispatch: (assetId: string) => void;
  onCallRetailer: (assetId: string) => void;
}

type Filter = 'all' | 'critical' | 'warning';

const Meta: React.FC<{ icon: React.ElementType; children: React.ReactNode; tone?: string }> = ({ icon: Icon, children, tone }) => (
  <span className={cx('inline-flex items-center gap-1 tabular', tone ?? 'text-slate-600')}>
    <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
    {children}
  </span>
);

export const IncidentQueue: React.FC<IncidentQueueProps> = ({ alerts, onOpen, onDispatch, onCallRetailer }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const open = alerts.filter((a) => a.severity !== 'resolved');
  const resolved = alerts.filter((a) => a.severity === 'resolved');
  const shown = open.filter((a) => filter === 'all' || a.severity === filter);
  const nCritical = open.filter((a) => a.severity === 'critical').length;

  return (
    <Card id="incidents" className="flex flex-col">
      <CardHeader
        title="Incidents"
        icon={ShieldAlert}
        subtitle={nCritical > 0 ? `${nCritical} critical ${nCritical === 1 ? 'needs' : 'need'} action` : 'No critical incidents'}
      />
      <div className="px-4 pt-3">
        <Segmented<Filter>
          label="Filter incidents"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Open', count: open.length },
            { value: 'critical', label: 'Critical', count: nCritical },
            { value: 'warning', label: 'Warning', count: open.length - nCritical },
          ]}
        />
      </div>

      <ul className="p-4 space-y-3 max-h-[560px] overflow-y-auto">
        {shown.length === 0 && (
          <li className="flex flex-col items-center text-center py-10 text-sm text-slate-500">
            <CircleCheck className="h-8 w-8 text-emerald-500 mb-2" aria-hidden="true" />
            No open incidents in this view.
          </li>
        )}

        {shown.map((a) => {
          const critical = a.severity === 'critical';
          const s = STATUS_STYLE[critical ? 'critical' : 'warning'];
          const Icon = s.icon;
          return (
            <li key={a.id} className={cx('rounded-lg border p-3', critical ? 'border-red-200 bg-red-50/40' : 'border-line')}>
              <div className="flex items-start gap-3">
                <span className={cx('mt-0.5 w-8 h-8 rounded-md flex items-center justify-center shrink-0', s.soft, s.text)}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cx('text-[11px] font-semibold uppercase tracking-wide', s.text)}>
                      {critical ? 'Theft / displacement' : 'Power outage'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 tabular">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {a.timeAgo}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpen(a.assetId)}
                    className="mt-0.5 text-left text-sm font-semibold text-slate-900 hover:text-delta-700"
                  >
                    {a.assetId} <span className="font-normal text-slate-500">· {a.originStore}</span>
                  </button>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">{a.description}</p>

                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    <Meta icon={Gauge} tone={cx('font-semibold', s.text)}>
                      Risk {a.riskPct}%
                    </Meta>
                    {critical ? (
                      <Meta icon={Zap}>{a.speedKmh.toFixed(1)} km/h</Meta>
                    ) : (
                      <Meta icon={Thermometer}>{a.tempC.toFixed(1)}°C</Meta>
                    )}
                    <Meta icon={Unplug}>{a.powerStatus}</Meta>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {critical ? (
                      <>
                        <Button size="sm" variant="danger" icon={Truck} onClick={() => onDispatch(a.assetId)}>
                          Dispatch team
                        </Button>
                        <Button size="sm" onClick={() => onOpen(a.assetId)}>
                          Inspect
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" icon={Phone} onClick={() => onCallRetailer(a.assetId)}>
                          Call retailer
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onOpen(a.assetId)}>
                          Details
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </>
                    )}
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
                  <span className="truncate">{r.title}</span>
                  <span className="ml-auto text-slate-400 whitespace-nowrap">{r.timeAgo}</span>
                </li>
              ))}
            </ul>
          </li>
        )}
      </ul>
    </Card>
  );
};
