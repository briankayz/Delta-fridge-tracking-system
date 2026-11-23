import React, { useEffect, useState } from 'react';
import { Bell, History, KeyRound, Plus, UsersRound } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button, Card, Segmented, cx } from '../components/ui';
import { api, AuditRow, NotificationRow, UserRecord } from '../services/api';
import { ROLE_LABEL, useAuth } from '../services/auth';
import { formatDateTime, timeAgo } from '../services/useTelemetryFeed';
import { Role } from '../types';
import { PageProps } from './shared';

type Tab = 'users' | 'audit' | 'notifications';
const ROLES = Object.keys(ROLE_LABEL) as Role[];
const input = 'h-9 w-full rounded-md bg-white px-2 text-sm ring-1 ring-inset ring-slate-300 focus:outline-none focus:ring-2 focus:ring-delta-500';

const Users: React.FC<PageProps> = ({ feed }) => {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [form, setForm] = useState({ email: '', name: '', role: 'viewer', region: '', phone: '', password: '' });
  const [adding, setAdding] = useState(false);
  const load = () => api.users().then(setUsers).catch(() => undefined);
  useEffect(() => void load(), []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await feed.run(
      'Create user',
      () => api.createUser({ ...form, region: form.region || null, phone: form.phone || null }),
      `${form.name} can now sign in.`
    );
    if (ok) {
      setAdding(false);
      setForm({ email: '', name: '', role: 'viewer', region: '', phone: '', password: '' });
      void load();
    }
  };

  const update = async (id: string, patch: Parameters<typeof api.updateUser>[1], label: string) => {
    if (await feed.run(label, () => api.updateUser(id, patch), 'Saved.')) void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" icon={Plus} onClick={() => setAdding((v) => !v)}>
          Add user
        </Button>
      </div>
      {adding && (
        <Card>
          <form onSubmit={create} className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="text-sm">
              <span className="font-medium text-slate-700">Full name</span>
              <input required minLength={2} className={cx(input, 'mt-1')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">Work email</span>
              <input required type="email" className={cx(input, 'mt-1')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">Role</span>
              <select className={cx(input, 'mt-1')} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">Region (blank = all)</span>
              <input className={cx(input, 'mt-1')} placeholder="e.g. Harare North" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">Mobile (for SMS alerts)</span>
              <input className={cx(input, 'mt-1')} placeholder="+263 77 123 4567" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">Temporary password</span>
              <input required minLength={10} type="password" autoComplete="new-password" className={cx(input, 'mt-1')} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <span className="text-xs text-slate-500">10+ characters with letters and numbers</span>
            </label>
            <div className="md:col-span-3 flex gap-2">
              <Button type="submit" variant="primary">
                Create user
              </Button>
              <Button variant="ghost" onClick={() => setAdding(false)}>
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
                <th className="px-4 py-2.5 font-medium">Person</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Region</th>
                <th className="px-4 py-2.5 font-medium">Last sign-in</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((u) => (
                <tr key={u.id} className={cx(!u.active && 'opacity-60')}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{u.name}</div>
                    <div className="text-xs text-slate-500">
                      {u.email}
                      {u.phone && ` · ${u.phone}`}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Role for ${u.name}`}
                      disabled={u.id === me?.id}
                      className="h-8 rounded-md bg-white px-2 text-sm ring-1 ring-inset ring-slate-300 disabled:opacity-60"
                      value={u.role}
                      onChange={(e) => void update(u.id, { role: e.target.value }, 'Change role')}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{u.region ?? 'All regions'}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{u.last_login_at ? formatDateTime(u.last_login_at) : 'Never'}</td>
                  <td className="px-4 py-3">
                    <span className={cx('rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset', u.active ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-slate-100 text-slate-600 ring-slate-400/30')}>
                      {u.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {u.id !== me?.id && (
                      <div className="inline-flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={KeyRound}
                          onClick={() => {
                            const pw = window.prompt(`New temporary password for ${u.name} (10+ characters, letters and numbers):`);
                            if (pw) void update(u.id, { password: pw }, 'Reset password');
                          }}
                        >
                          Reset password
                        </Button>
                        <Button size="sm" onClick={() => void update(u.id, { active: !u.active }, u.active ? 'Disable' : 'Enable')}>
                          {u.active ? 'Disable' : 'Enable'}
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

const Audit: React.FC = () => {
  const [rows, setRows] = useState<AuditRow[]>([]);
  useEffect(() => void api.audit(300).then(setRows).catch(() => undefined), []);
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500 border-b border-line">
            <tr>
              <th className="px-4 py-2.5 font-medium">When</th>
              <th className="px-4 py-2.5 font-medium">Who</th>
              <th className="px-4 py-2.5 font-medium">Action</th>
              <th className="px-4 py-2.5 font-medium">Target</th>
              <th className="px-4 py-2.5 font-medium">From</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">{formatDateTime(r.at)}</td>
                <td className="px-4 py-2.5 text-slate-900">{r.actor_name}</td>
                <td className="px-4 py-2.5">
                  <span className={cx('font-mono text-xs', r.action.includes('failed') ? 'text-red-700' : 'text-slate-700')}>{r.action}</span>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{r.target ?? '—'}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{r.ip ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

const Notifications: React.FC<{ now: number }> = ({ now }) => {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  useEffect(() => void api.notifications(200).then(setRows).catch(() => undefined), []);
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-line">
        {rows.length === 0 && <li className="p-8 text-center text-sm text-slate-500">No notifications sent yet.</li>}
        {rows.map((n) => (
          <li key={n.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium uppercase text-slate-700">{n.channel}</span>
              <span className="text-slate-600">{n.recipient}</span>
              <span
                className={cx(
                  'rounded px-1.5 py-0.5 font-medium',
                  n.status === 'failed' ? 'bg-red-50 text-red-700' : n.status === 'sent' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-600'
                )}
              >
                {n.status}
              </span>
              <span className="ml-auto text-slate-400">{timeAgo(n.at, now)}</span>
            </div>
            <div className="mt-1 text-sm text-slate-900">{n.body}</div>
            {n.error && <div className="text-xs text-red-700">{n.error}</div>}
          </li>
        ))}
      </ul>
    </Card>
  );
};

export const AdminPage: React.FC<PageProps> = (props) => {
  const { can } = useAuth();
  const [tab, setTab] = useState<Tab>(can('user:manage') ? 'users' : 'audit');
  const tabs = [
    ...(can('user:manage') ? [{ value: 'users' as Tab, label: 'Users' }] : []),
    { value: 'audit' as Tab, label: 'Audit log' },
    { value: 'notifications' as Tab, label: 'Notifications' },
  ];
  const Icon = tab === 'users' ? UsersRound : tab === 'audit' ? History : Bell;
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Governance"
        title="Users & audit"
        description="Who can access Asset Guard, what they did, and every alert the system sent."
        actions={<Segmented<Tab> label="Section" value={tab} onChange={setTab} options={tabs} />}
      />
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <Icon className="h-4 w-4 text-delta-700" aria-hidden="true" />
        {tabs.find((t) => t.value === tab)?.label}
      </div>
      {tab === 'users' && <Users {...props} />}
      {tab === 'audit' && <Audit />}
      {tab === 'notifications' && <Notifications now={props.feed.now} />}
    </div>
  );
};
