import React, { useEffect, useState } from 'react';
import {
  CircleCheck,
  CircleDot,
  Hand,
  MessageSquarePlus,
  Radio,
  ShieldAlert,
  Truck,
  UserPlus,
  Wrench,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../services/auth';
import { formatDateTime, RESOLUTION_LABEL } from '../services/useTelemetryFeed';
import { Incident, IncidentEvent, Resolution } from '../types';
import { Button, cx } from './ui';

const RESOLUTIONS: Record<Incident['kind'], Resolution[]> = {
  displacement: ['recovered', 'returned', 'authorized', 'false_alarm', 'not_found'],
  power: ['power_restored', 'false_alarm'],
  signal_lost: ['signal_restored', 'recovered', 'not_found', 'false_alarm'],
};

interface Props {
  incident: Incident;
  onChanged: (i: Incident) => void;
  run: (label: string, fn: () => Promise<unknown>, success?: string) => Promise<boolean>;
  compact?: boolean;
}

/** Workflow controls for one incident, filtered by the signed-in user's permissions. */
export const IncidentActions: React.FC<Props> = ({ incident, onChanged, run, compact }) => {
  const { can, meta } = useAuth();
  const [panel, setPanel] = useState<null | 'note' | 'assign' | 'resolve' | 'dispatch'>(null);
  const [text, setText] = useState('');
  const [assignee, setAssignee] = useState('');
  const [people, setPeople] = useState<{ id: string; name: string; role: string }[]>([]);
  const [resolution, setResolution] = useState<Resolution>(RESOLUTIONS[incident.kind][0]);
  const open = incident.status !== 'resolved';
  const act = can('incident:act');

  useEffect(() => {
    if (panel === 'assign' && people.length === 0) api.assignable().then(setPeople).catch(() => undefined);
  }, [panel, people.length]);

  useEffect(() => {
    setResolution(RESOLUTIONS[incident.kind][0]);
    setPanel(null);
  }, [incident.id, incident.kind]);

  const done = (i: Incident) => {
    onChanged(i);
    setPanel(null);
    setText('');
  };

  if (!open && !can('incident:field')) return null;
  const resolutions = [...RESOLUTIONS[incident.kind], ...(meta?.demo_mode && incident.kind === 'displacement' ? (['reset'] as Resolution[]) : [])];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {open && act && incident.status === 'open' && (
          <Button size={compact ? 'sm' : 'md'} variant="primary" icon={Hand} onClick={() => run('Acknowledge', async () => done(await api.acknowledge(incident.id)))}>
            Acknowledge
          </Button>
        )}
        {open && act && (
          <Button size={compact ? 'sm' : 'md'} icon={UserPlus} onClick={() => setPanel(panel === 'assign' ? null : 'assign')}>
            Assign
          </Button>
        )}
        {open && act && incident.kind === 'displacement' && (
          <Button size={compact ? 'sm' : 'md'} variant="danger" icon={Truck} onClick={() => setPanel(panel === 'dispatch' ? null : 'dispatch')}>
            Dispatch team
          </Button>
        )}
        {can('incident:field') && (
          <Button size={compact ? 'sm' : 'md'} icon={MessageSquarePlus} onClick={() => setPanel(panel === 'note' ? null : 'note')}>
            Add note
          </Button>
        )}
        {open && act && (
          <Button size={compact ? 'sm' : 'md'} icon={CircleCheck} onClick={() => setPanel(panel === 'resolve' ? null : 'resolve')}>
            Resolve
          </Button>
        )}
      </div>

      {panel === 'assign' && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 p-3 ring-1 ring-inset ring-line">
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="h-9 min-w-56 rounded-md bg-white px-2 text-sm ring-1 ring-inset ring-slate-300"
            aria-label="Assign to"
          >
            <option value="">Choose a person…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.role.replace('_', ' ')}
              </option>
            ))}
          </select>
          <Button variant="primary" disabled={!assignee} onClick={() => run('Assign', async () => done(await api.assign(incident.id, assignee)))}>
            Assign
          </Button>
        </div>
      )}

      {(panel === 'note' || panel === 'dispatch') && (
        <div className="space-y-2 rounded-md bg-slate-50 p-3 ring-1 ring-inset ring-line">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={panel === 'note' ? 2000 : 500}
            placeholder={panel === 'note' ? 'What happened or what was done?' : 'Instructions for the recovery team (optional)'}
            className="w-full rounded-md bg-white p-2 text-sm ring-1 ring-inset ring-slate-300 focus:outline-none focus:ring-2 focus:ring-delta-500"
          />
          {panel === 'note' ? (
            <Button variant="primary" disabled={!text.trim()} onClick={() => run('Note', async () => done(await api.note(incident.id, text.trim())))}>
              Save note
            </Button>
          ) : (
            <Button
              variant="danger"
              icon={Truck}
              onClick={() => run('Dispatch', async () => done(await api.dispatch(incident.id, text.trim() || undefined)), 'Recovery team notified.')}
            >
              Send dispatch
            </Button>
          )}
        </div>
      )}

      {panel === 'resolve' && (
        <div className="space-y-2 rounded-md bg-slate-50 p-3 ring-1 ring-inset ring-line">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Outcome">
            {resolutions.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={resolution === r}
                onClick={() => setResolution(r)}
                className={cx(
                  'h-8 px-3 rounded-md text-xs font-medium ring-1 ring-inset',
                  resolution === r ? 'bg-delta-700 text-white ring-delta-700' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
                )}
              >
                {RESOLUTION_LABEL[r]}
              </button>
            ))}
          </div>
          {resolution === 'authorized' && (
            <p className="text-xs text-slate-600">The cooler’s geofence will move to where it is now (its new home).</p>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Closing note (recommended)"
            className="w-full rounded-md bg-white p-2 text-sm ring-1 ring-inset ring-slate-300 focus:outline-none focus:ring-2 focus:ring-delta-500"
          />
          <Button
            variant="primary"
            icon={CircleCheck}
            onClick={() => run('Resolve', async () => done(await api.resolve(incident.id, resolution, text.trim() || undefined)), `${incident.id} closed.`)}
          >
            Close incident
          </Button>
        </div>
      )}
    </div>
  );
};

const EVENT_ICON: Record<string, React.ElementType> = {
  opened: ShieldAlert,
  acknowledged: Hand,
  assigned: UserPlus,
  note: MessageSquarePlus,
  dispatched: Truck,
  field_update: Wrench,
  resolved: CircleCheck,
};

export const IncidentTimeline: React.FC<{ events?: IncidentEvent[] }> = ({ events }) => {
  if (!events) return <div className="text-sm text-slate-500">Loading timeline…</div>;
  return (
    <ol className="relative space-y-4 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-px before:bg-line">
      {events.map((e) => {
        const Icon = EVENT_ICON[e.type] ?? (e.type === 'signal' ? Radio : CircleDot);
        return (
          <li key={e.id} className="relative flex gap-3">
            <span
              className={cx(
                'relative z-10 w-8 h-8 shrink-0 rounded-full flex items-center justify-center ring-4 ring-white',
                e.type === 'opened' ? 'bg-red-50 text-red-700' : e.type === 'resolved' ? 'bg-emerald-50 text-emerald-700' : 'bg-delta-50 text-delta-700'
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 pt-1">
              <div className="text-sm text-slate-900">
                <span className="font-medium">{e.actor_name}</span>{' '}
                <span className="text-slate-500">· {formatDateTime(e.at)}</span>
              </div>
              {e.message && <p className="text-sm text-slate-600 whitespace-pre-line">{e.message}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
};
