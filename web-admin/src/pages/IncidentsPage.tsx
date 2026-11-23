import React, { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, FileText, ShieldAlert } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { IncidentActions, IncidentTimeline } from '../components/IncidentActions';
import { Button, Card, CardHeader, Segmented, cx } from '../components/ui';
import { api } from '../services/api';
import { Link, navigate } from '../services/router';
import { formatDateTime, formatDuration, KIND_LABEL, RESOLUTION_LABEL } from '../services/useTelemetryFeed';
import { Incident } from '../types';
import { PageProps } from './shared';

type StatusFilter = 'open' | 'resolved' | 'all';
type KindFilter = 'all' | Incident['kind'];

const STATUS_CHIP: Record<Incident['status'], string> = {
  open: 'bg-red-50 text-red-700 ring-red-600/20',
  acknowledged: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
};
const STATUS_TEXT: Record<Incident['status'], string> = { open: 'Unacknowledged', acknowledged: 'In progress', resolved: 'Resolved' };

export const IncidentsPage: React.FC<PageProps & { incidentId?: string }> = ({ feed, search, inspect, incidentId }) => {
  const [status, setStatus] = useState<StatusFilter>('open');
  const [kind, setKind] = useState<KindFilter>('all');
  const [history, setHistory] = useState<Incident[] | null>(null);
  const [detail, setDetail] = useState<Incident | null>(null);
  const { now, run, upsertIncident } = feed;

  // The live feed carries recent incidents; older ones come from the API.
  useEffect(() => {
    if (status !== 'open') api.incidents(status, 500).then(setHistory).catch(() => setHistory([]));
  }, [status]);

  const source = status === 'open' ? feed.incidents : history ?? [];
  const list = useMemo(
    () =>
      source
        .filter((i) => (status === 'open' ? i.status !== 'resolved' : status === 'resolved' ? i.status === 'resolved' : true))
        .filter((i) => kind === 'all' || i.kind === kind)
        .filter((i) => !search || [i.id, i.asset_id, i.retailer_name ?? '', i.region ?? ''].some((v) => v.toLowerCase().includes(search.toLowerCase()))),
    [source, status, kind, search]
  );

  const selectedId = incidentId ?? list[0]?.id;
  const live = feed.incidents.find((i) => i.id === selectedId);
  const liveKey = live ? `${live.status}|${live.assigned_to}|${live.resolved_at}|${live.acknowledged_at}` : '';

  useEffect(() => {
    if (!selectedId) return setDetail(null);
    let cancelled = false;
    api
      .incident(selectedId)
      .then((i) => !cancelled && setDetail(i))
      .catch(() => !cancelled && setDetail(null));
    return () => {
      cancelled = true;
    };
  }, [selectedId, liveKey]);

  const onChanged = (i: Incident) => {
    setDetail(i);
    upsertIncident(i);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Response"
        title="Incidents"
        description="Every theft, power and offline alert with who handled it and how it ended."
        actions={
          <a href={api.incidentsCsvUrl(30)}>
            <Button icon={Download}>Export last 30 days</Button>
          </a>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
        {/* List */}
        <Card className="xl:col-span-2 overflow-hidden">
          <div className="p-3 border-b border-line flex flex-wrap gap-2">
            <Segmented<StatusFilter>
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'open', label: 'Open' },
                { value: 'resolved', label: 'Resolved' },
                { value: 'all', label: 'All' },
              ]}
            />
            <Segmented<KindFilter>
              label="Type"
              value={kind}
              onChange={setKind}
              options={[
                { value: 'all', label: 'All types' },
                { value: 'displacement', label: 'Theft' },
                { value: 'power', label: 'Power' },
                { value: 'signal_lost', label: 'Offline' },
              ]}
            />
          </div>
          <ul className="divide-y divide-line max-h-[70vh] overflow-y-auto">
            {list.length === 0 && <li className="p-8 text-center text-sm text-slate-500">No incidents match.</li>}
            {list.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/incidents/${i.id}`)}
                  aria-current={i.id === selectedId ? 'true' : undefined}
                  className={cx('w-full text-left px-4 py-3 hover:bg-slate-50', i.id === selectedId && 'bg-delta-50/60')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-medium text-slate-700">{i.id}</span>
                    <span className={cx('rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset', STATUS_CHIP[i.status])}>{STATUS_TEXT[i.status]}</span>
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-900">
                    {KIND_LABEL[i.kind]} · {i.asset_id}
                  </div>
                  <div className="text-xs text-slate-500">
                    {i.retailer_name} · {i.region} · {formatDateTime(i.opened_at)}
                    {i.assigned_name ? ` · ${i.assigned_name}` : ''}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {/* Detail */}
        <div className="xl:col-span-3 space-y-6">
          {!detail ? (
            <Card className="p-10 text-center text-sm text-slate-500">
              <FileText className="mx-auto mb-2 h-8 w-8 text-slate-300" aria-hidden="true" />
              Select an incident to see its case file.
            </Card>
          ) : (
            <>
              <Card>
                <div className="p-5 border-b border-line">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cx('rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset', STATUS_CHIP[detail.status])}>{STATUS_TEXT[detail.status]}</span>
                    <span className="font-mono text-xs text-slate-500">{detail.id}</span>
                  </div>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    {KIND_LABEL[detail.kind]} · {detail.asset_id}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {detail.retailer_name} · {detail.region}
                  </p>
                  <button
                    type="button"
                    onClick={() => inspect(detail.asset_id)}
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-delta-700 hover:underline"
                  >
                    Open cooler in risk inspector <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
                <dl className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-line text-sm">
                  <div className="p-4">
                    <dt className="text-xs text-slate-500">Opened</dt>
                    <dd className="font-medium text-slate-900">{formatDateTime(detail.opened_at)}</dd>
                  </div>
                  <div className="p-4">
                    <dt className="text-xs text-slate-500">{detail.status === 'resolved' ? 'Time to resolve' : 'Open for'}</dt>
                    <dd className="font-medium text-slate-900 tabular">{formatDuration(detail.opened_at, now, detail.resolved_at)}</dd>
                  </div>
                  <div className="p-4">
                    <dt className="text-xs text-slate-500">Peak risk</dt>
                    <dd className="font-medium text-slate-900 tabular">{detail.peak_score}%</dd>
                  </div>
                  <div className="p-4">
                    <dt className="text-xs text-slate-500">{detail.status === 'resolved' ? 'Outcome' : 'Owner'}</dt>
                    <dd className="font-medium text-slate-900">
                      {detail.status === 'resolved' ? RESOLUTION_LABEL[detail.resolution ?? ''] : detail.assigned_name ?? detail.acknowledged_by ?? 'Unassigned'}
                    </dd>
                  </div>
                </dl>
                <div className="p-5 border-t border-line">
                  <IncidentActions incident={detail} onChanged={onChanged} run={run} />
                </div>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader title="Why it was raised" icon={ShieldAlert} />
                  <ul className="divide-y divide-line px-4">
                    {detail.reasons.length === 0 && <li className="py-4 text-sm text-slate-500">No sensor reasons recorded.</li>}
                    {detail.reasons.map((r) => (
                      <li key={r.code} className="py-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium text-slate-900">{r.label}</span>
                          <span className="text-xs text-slate-500 tabular">{r.points > 0 ? `+${r.points}` : r.points}</span>
                        </div>
                        <p className="text-xs text-slate-600">{r.detail}</p>
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card>
                  <CardHeader title="Timeline" icon={FileText} subtitle="Every action is recorded" />
                  <div className="p-4">
                    <IncidentTimeline events={detail.events} />
                  </div>
                </Card>
              </div>
              <p className="text-xs text-slate-500">
                Cooler details: <Link to="/register" className="text-delta-700 hover:underline">cooler register</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
