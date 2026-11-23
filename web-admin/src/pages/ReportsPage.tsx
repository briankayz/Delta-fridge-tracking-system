import React, { useEffect, useState } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button, Card, CardHeader, Segmented } from '../components/ui';
import { api, RegionReport } from '../services/api';
import { PageProps } from './shared';

type Days = '7' | '30' | '90';

const mins = (m: number | null) => (m == null ? '—' : m < 60 ? `${m} min` : `${(m / 60).toFixed(1)} h`);

export const ReportsPage: React.FC<PageProps> = ({ feed }) => {
  const [days, setDays] = useState<Days>('30');
  const [rows, setRows] = useState<RegionReport[] | null>(null);

  useEffect(() => {
    setRows(null);
    api.report(Number(days)).then((r) => setRows(r.regions)).catch(() => setRows([]));
  }, [days, feed.summary.open_incidents]);

  const total = (k: keyof RegionReport) => (rows ?? []).reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const theft = total('displacement');
  const recovered = total('recovered');
  const maxIncidents = Math.max(1, ...(rows ?? []).map((r) => r.incidents));

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Management"
        title="Reports"
        description="Incident volume, recoveries and response times by region."
        actions={
          <>
            <Segmented<Days>
              label="Period"
              value={days}
              onChange={setDays}
              options={[
                { value: '7', label: '7 days' },
                { value: '30', label: '30 days' },
                { value: '90', label: '90 days' },
              ]}
            />
            <a href={api.incidentsCsvUrl(Number(days))}>
              <Button icon={Download}>Incidents CSV</Button>
            </a>
          </>
        }
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Period totals">
        {[
          ['Coolers registered', total('coolers')],
          ['Incidents', total('incidents')],
          ['Theft alerts', theft],
          ['Recovered', recovered],
        ].map(([label, v]) => (
          <div key={label as string} className="bg-white rounded-lg border border-line shadow-card p-4">
            <div className="text-[13px] font-medium text-slate-500">{label}</div>
            <div className="mt-1 text-[28px] leading-9 font-semibold text-slate-900 tabular">{Number(v).toLocaleString()}</div>
          </div>
        ))}
      </section>

      <Card className="overflow-hidden">
        <CardHeader title="By region" icon={BarChart3} subtitle="MTTA = average time to acknowledge · MTTR = average time to resolve" />
        {/* Phones: one card per region */}
        <ul className="md:hidden divide-y divide-line">
          {rows === null && <li className="px-4 py-10 text-center text-sm text-slate-500">Loading…</li>}
          {rows?.map((r) => (
            <li key={r.region} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-slate-900">{r.region}</span>
                <span className="text-xs text-slate-500 tabular">{r.coolers} coolers</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-delta-600" style={{ width: `${(r.incidents / maxIncidents) * 100}%` }} />
                </div>
                <span className="text-xs font-medium text-slate-700 tabular">{r.incidents} incidents</span>
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs tabular">
                {(
                  [
                    ['Theft', r.displacement],
                    ['Power', r.power],
                    ['Offline', r.signal_lost],
                    ['Recovered', r.recovered],
                    ['Still open', r.still_open],
                    ['MTTA / MTTR', `${mins(r.mtta_min)} / ${mins(r.mttr_min)}`],
                  ] as [string, string | number][]
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="font-medium text-slate-900">{v}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500 border-b border-line">
              <tr>
                <th className="px-4 py-2.5 font-medium">Region</th>
                <th className="px-4 py-2.5 font-medium text-right">Coolers</th>
                <th className="px-4 py-2.5 font-medium">Incidents</th>
                <th className="px-4 py-2.5 font-medium text-right">Theft</th>
                <th className="px-4 py-2.5 font-medium text-right">Power</th>
                <th className="px-4 py-2.5 font-medium text-right">Offline</th>
                <th className="px-4 py-2.5 font-medium text-right">Recovered</th>
                <th className="px-4 py-2.5 font-medium text-right">Still open</th>
                <th className="px-4 py-2.5 font-medium text-right">MTTA</th>
                <th className="px-4 py-2.5 font-medium text-right">MTTR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular">
              {rows === null && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              )}
              {rows?.map((r) => (
                <tr key={r.region}>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.region}</td>
                  <td className="px-4 py-3 text-right">{r.coolers}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-36">
                      <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-delta-600" style={{ width: `${(r.incidents / maxIncidents) * 100}%` }} />
                      </div>
                      <span className="w-8 text-right">{r.incidents}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">{r.displacement}</td>
                  <td className="px-4 py-3 text-right">{r.power}</td>
                  <td className="px-4 py-3 text-right">{r.signal_lost}</td>
                  <td className="px-4 py-3 text-right">{r.recovered}</td>
                  <td className="px-4 py-3 text-right">{r.still_open}</td>
                  <td className="px-4 py-3 text-right">{mins(r.mtta_min)}</td>
                  <td className="px-4 py-3 text-right">{mins(r.mttr_min)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
