// Incident workflow: acknowledge -> assign/dispatch -> field updates -> resolve.
// Every action is written to the incident timeline and the audit log.
import { Db, Queryable } from '../db/index.ts';
import { Actor, AuthUser, Incident, Resolution } from '../types.ts';
import { HttpError } from '../util.ts';
import { canSeeRegion } from '../auth/security.ts';
import { audit } from './audit.ts';
import { FleetService } from './fleet.ts';
import { Notifier } from './notifier.ts';
import { getIncident } from './readModel.ts';

export type FieldOutcome = 'found' | 'not_found' | 'recovered' | 'authorized';

const RESOLUTIONS: Resolution[] = ['returned', 'authorized', 'recovered', 'false_alarm', 'not_found', 'power_restored', 'signal_restored', 'reset'];

export class IncidentService {
  constructor(
    private readonly db: Db,
    private readonly fleet: FleetService,
    private readonly notifier: Notifier,
    private readonly now: () => Date = () => new Date()
  ) {}

  private actor(u: AuthUser): Actor {
    return { id: u.id, name: u.name };
  }

  /** Loads an incident the user may act on; 404 hides other regions' incidents. */
  async load(id: string, user: AuthUser, q: Queryable = this.db): Promise<Incident> {
    const inc = await getIncident(q, id);
    if (!inc || !canSeeRegion(user, inc.region)) throw new HttpError(404, 'Incident not found');
    return inc;
  }

  private async event(q: Queryable, id: string, actor: Actor, type: string, message: string | null, data?: unknown) {
    await q.query(
      `INSERT INTO incident_events (incident_id, at, actor_id, actor_name, type, message, data) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [id, this.now().toISOString(), actor.id, actor.name, type, message, data ?? null]
    );
  }

  private async changed(id: string) {
    const incident = (await getIncident(this.db, id, true))!;
    this.fleet.emit({ type: 'incident.updated', incident });
    return incident;
  }

  private assertOpen(inc: Incident) {
    if (inc.status === 'resolved') throw new HttpError(409, `Incident ${inc.id} is already resolved`);
  }

  async acknowledge(id: string, user: AuthUser, ip?: string) {
    await this.db.tx(async (q) => {
      const inc = await this.load(id, user, q);
      this.assertOpen(inc);
      if (inc.status === 'acknowledged') return;
      await q.query(`UPDATE incidents SET status = 'acknowledged', acknowledged_at = $2, acknowledged_by = $3 WHERE id = $1`, [
        id,
        this.now().toISOString(),
        user.name,
      ]);
      await this.event(q, id, this.actor(user), 'acknowledged', `${user.name} is handling this incident.`);
      await audit(q, this.actor(user), 'incident.acknowledged', id, undefined, ip);
    });
    return this.changed(id);
  }

  async assign(id: string, assigneeId: string, user: AuthUser, ip?: string) {
    await this.db.tx(async (q) => {
      const inc = await this.load(id, user, q);
      this.assertOpen(inc);
      const assignee = await q.one<{ id: string; name: string }>(`SELECT id, name FROM users WHERE id = $1 AND active`, [assigneeId]);
      if (!assignee) throw new HttpError(400, 'Assignee not found or inactive');
      await q.query(
        `UPDATE incidents SET assigned_to = $2, status = CASE WHEN status = 'open' THEN 'acknowledged' ELSE status END,
                acknowledged_at = COALESCE(acknowledged_at, $3), acknowledged_by = COALESCE(acknowledged_by, $4) WHERE id = $1`,
        [id, assignee.id, this.now().toISOString(), user.name]
      );
      await this.event(q, id, this.actor(user), 'assigned', `Assigned to ${assignee.name}.`, { assignee_id: assignee.id });
      await audit(q, this.actor(user), 'incident.assigned', id, { assignee_id: assignee.id }, ip);
    });
    return this.changed(id);
  }

  async note(id: string, message: string, user: AuthUser, ip?: string) {
    await this.db.tx(async (q) => {
      await this.load(id, user, q);
      await this.event(q, id, this.actor(user), 'note', message);
      await audit(q, this.actor(user), 'incident.note', id, undefined, ip);
    });
    return this.changed(id);
  }

  async dispatch(id: string, note: string | null, user: AuthUser, ip?: string) {
    const inc = await this.db.tx(async (q) => {
      const inc = await this.load(id, user, q);
      this.assertOpen(inc);
      await q.query(
        `UPDATE incidents SET status = 'acknowledged', acknowledged_at = COALESCE(acknowledged_at, $2),
                acknowledged_by = COALESCE(acknowledged_by, $3) WHERE id = $1`,
        [id, this.now().toISOString(), user.name]
      );
      await this.event(q, id, this.actor(user), 'dispatched', note ? `Recovery team dispatched. ${note}` : 'Recovery team dispatched.');
      await audit(q, this.actor(user), 'incident.dispatched', id, { note }, ip);
      return inc;
    });
    const asset = await this.fleet.asset(inc.asset_id);
    if (asset) {
      const assignee = inc.assigned_to
        ? await this.db.one<{ name: string; phone: string | null }>(`SELECT name, phone FROM users WHERE id = $1`, [inc.assigned_to])
        : null;
      await this.notifier.dispatched(inc, asset, assignee ?? null, note);
    }
    return this.changed(id);
  }

  /** Report from a responder on site (mobile "Respond" flow). */
  async fieldUpdate(
    id: string,
    body: { outcome: FieldOutcome; note?: string; lat?: number; lng?: number },
    user: AuthUser,
    ip?: string
  ) {
    const labels: Record<FieldOutcome, string> = {
      found: 'Cooler found on site',
      not_found: 'Cooler NOT found at the reported location',
      recovered: 'Cooler recovered',
      authorized: 'Move confirmed as authorised',
    };
    const message = `${labels[body.outcome]}${body.note ? `: ${body.note}` : '.'}`;
    if (body.outcome === 'recovered' || body.outcome === 'authorized') {
      return this.resolve(id, body.outcome, message, user, ip, { lat: body.lat, lng: body.lng });
    }
    await this.db.tx(async (q) => {
      const inc = await this.load(id, user, q);
      this.assertOpen(inc);
      await q.query(
        `UPDATE incidents SET status = 'acknowledged', acknowledged_at = COALESCE(acknowledged_at, $2),
                acknowledged_by = COALESCE(acknowledged_by, $3) WHERE id = $1`,
        [id, this.now().toISOString(), user.name]
      );
      await this.event(q, id, this.actor(user), 'field_update', message, { outcome: body.outcome, lat: body.lat, lng: body.lng });
      await audit(q, this.actor(user), 'incident.field_update', id, { outcome: body.outcome }, ip);
    });
    return this.changed(id);
  }

  /**
   * Close an incident. An authorised displacement re-anchors the cooler at its current position
   * (it has a new legitimate home); the demo 'reset' snaps it back to the store.
   */
  async resolve(
    id: string,
    resolution: Resolution,
    note: string | null,
    user: AuthUser,
    ip?: string,
    at?: { lat?: number; lng?: number }
  ) {
    if (!RESOLUTIONS.includes(resolution)) throw new HttpError(400, 'Unknown resolution');
    const inc = await this.db.tx(async (q) => {
      const inc = await this.load(id, user, q);
      this.assertOpen(inc);
      await this.fleet.closeIncident(q, id, resolution, this.actor(user), note ?? null);
      if (inc.kind === 'displacement' && resolution === 'authorized') {
        const s = await q.one<{ lat: number; lng: number }>(`SELECT lat, lng FROM asset_state WHERE asset_id = $1`, [inc.asset_id]);
        const lat = at?.lat ?? s?.lat;
        const lng = at?.lng ?? s?.lng;
        if (lat != null && lng != null) {
          await q.query(`UPDATE assets SET anchor_lat = $2, anchor_lng = $3, updated_at = $4 WHERE id = $1`, [
            inc.asset_id,
            lat,
            lng,
            this.now().toISOString(),
          ]);
          await q.query(
            `UPDATE asset_state SET distance_m = 0, geofence_breached = false, risk_score = 0, severity = 'nominal',
                    confidence = 0, reasons = '[]'::jsonb WHERE asset_id = $1`,
            [inc.asset_id]
          );
          await this.event(q, id, this.actor(user), 'note', 'Geofence moved to the cooler’s current location.');
        }
      }
      await audit(q, this.actor(user), 'incident.resolved', id, { resolution, note }, ip);
      return inc;
    });
    const asset = (await this.fleet.asset(inc.asset_id))!;
    const incident = (await getIncident(this.db, id, true))!;
    this.fleet.emit({ type: 'incident.resolved', asset, incident });
    return incident;
  }
}
