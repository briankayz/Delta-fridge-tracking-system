import React, { useEffect, useState } from 'react';
import { ArrowLeftRight, Check, Plus, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button, Card, CardHeader, cx } from '../components/ui';
import { api, Relocation, Retailer } from '../services/api';
import { useAuth } from '../services/auth';
import { formatDateTime } from '../services/useTelemetryFeed';
import { PageProps } from './shared';

const STATUS_STYLE: Record<Relocation['status'], string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  approved: 'bg-delta-50 text-delta-700 ring-delta-600/20',
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  rejected: 'bg-slate-100 text-slate-600 ring-slate-400/30',
  expired: 'bg-slate-100 text-slate-600 ring-slate-400/30',
};

const input = 'h-9 w-full rounded-md bg-white px-2 text-sm ring-1 ring-inset ring-slate-300 focus:outline-none focus:ring-2 focus:ring-delta-500';

export const RelocationsPage: React.FC<PageProps> = ({ feed }) => {
  const { can } = useAuth();
  const [items, setItems] = useState<Relocation[]>([]);
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [form, setForm] = useState({ asset_id: '', to_retailer_id: '', hours: 4, reason: '' });
  const [showForm, setShowForm] = useState(false);

  const load = () => api.relocations().then(setItems).catch(() => undefined);
  useEffect(() => {
    void load();
    api.retailers().then(setRetailers).catch(() => undefined);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await feed.run(
      'Relocation request',
      () => api.requestRelocation({ asset_id: form.asset_id, to_retailer_id: form.to_retailer_id, hours: Number(form.hours), reason: form.reason }),
      'Request sent for approval.'
    );
    if (ok) {
      setShowForm(false);
      setForm({ asset_id: '', to_retailer_id: '', hours: 4, reason: '' });
      void load();
    }
  };

  const decide = async (id: string, approve: boolean) => {
    if (await feed.run(approve ? 'Approve' : 'Reject', () => api.decideRelocation(id, approve), approve ? 'Move approved.' : 'Request rejected.')) void load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Planned moves"
        title="Relocations"
        description="Approve planned cooler moves in advance so they are not raised as theft. On arrival the geofence moves to the new store."
        actions={
          can('relocation:request') && (
            <Button variant="primary" icon={Plus} onClick={() => setShowForm((v) => !v)}>
              Request a move
            </Button>
          )
        }
      />

      {showForm && (
        <Card>
          <CardHeader title="New relocation request" icon={ArrowLeftRight} />
          <form onSubmit={submit} className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="font-medium text-slate-700">Cooler</span>
              <select required className={cx(input, 'mt-1')} value={form.asset_id} onChange={(e) => setForm({ ...form, asset_id: e.target.value })}>
                <option value="">Choose a cooler…</option>
                {feed.fleet.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} · {c.retailer}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">Destination store</span>
              <select required className={cx(input, 'mt-1')} value={form.to_retailer_id} onChange={(e) => setForm({ ...form, to_retailer_id: e.target.value })}>
                <option value="">Choose a store…</option>
                {retailers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {r.region}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">Move window (hours from now)</span>
              <input type="number" min={0.5} max={168} step={0.5} required className={cx(input, 'mt-1')} value={form.hours} onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })} />
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">Reason</span>
              <input required minLength={3} maxLength={300} className={cx(input, 'mt-1')} placeholder="e.g. Store refit, transfer to new outlet" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </label>
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" variant="primary">
                Submit for approval
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500 border-b border-line">
              <tr>
                <th className="px-4 py-2.5 font-medium">Cooler</th>
                <th className="px-4 py-2.5 font-medium">To</th>
                <th className="px-4 py-2.5 font-medium">Window</th>
                <th className="px-4 py-2.5 font-medium">Reason</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Requested / decided</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No relocation requests yet.
                  </td>
                </tr>
              )}
              {items.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{r.asset_id}</td>
                  <td className="px-4 py-3">{r.to_retailer_name ?? `${r.to_lat.toFixed(4)}, ${r.to_lng.toFixed(4)}`}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                    {formatDateTime(r.window_start)} → {formatDateTime(r.window_end)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{r.reason}</td>
                  <td className="px-4 py-3">
                    <span className={cx('rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset capitalize', STATUS_STYLE[r.status])}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {r.requested_by}
                    {r.decided_by && ` · ${r.decided_by}`}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {r.status === 'pending' && can('relocation:decide') && (
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="primary" icon={Check} onClick={() => void decide(r.id, true)}>
                          Approve
                        </Button>
                        <Button size="sm" icon={X} onClick={() => void decide(r.id, false)}>
                          Reject
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
