// Core write path: telemetry ingest -> risk -> state -> incidents. Everything is transactional and
// row-locked per asset, so concurrent payloads can never open duplicate incidents.
import { Config } from '../config.ts';
import { Db, Queryable } from '../db/index.ts';
import { haversineM } from '../geo.ts';
import { harareHour, scoreRisk } from '../riskEngine.ts';
import { TelemetryPayload } from '../schema.ts';
import { Actor, AssetState, Incident, IncidentKind, Resolution, RiskResult } from '../types.ts';
import { HttpError, log } from '../util.ts';
import { audit, SYSTEM } from './audit.ts';
import { Notifier } from './notifier.ts';
import { getAsset, getIncident, ReadOptions } from './readModel.ts';
import { hashDeviceToken, newDeviceToken } from '../auth/security.ts';

/** Events from the domain; the WebSocket hub adds the (region-scoped) summary. */
export type HubEvent =
  | { type: 'asset.updated'; asset: AssetState }
  | { type: 'incident.opened'; asset: AssetState; incident: Incident }
  | { type: 'incident.updated'; incident: Incident }
  | { type: 'incident.resolved'; asset: AssetState; incident: Incident };

/** Consecutive calm payloads (inside fence, ~stationary) that auto-resolve a displacement incident. */
export const RESOLVE_AFTER_CALM = 3;

interface Change {
  kind: 'opened' | 'resolved';
  incidentId: string;
}

export class FleetService {
  readonly simulating = new Set<string>();
  private listeners = new Set<(e: HubEvent) => void>();

  constructor(
    private readonly db: Db,
    private readonly cfg: Config,
    private readonly notifier: Notifier,
    private readonly now: () => Date = () => new Date()
  ) {}

  on(listener: (e: HubEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(e: HubEvent) {
    for (const l of this.listeners) {
      try {
        l(e);
      } catch (err) {
        log.error('hub listener failed', { error: (err as Error).message });
      }
    }
  }

  readOpts(): ReadOptions {
    return { now: this.now(), offlineAfterMin: this.cfg.offlineAfterMin, simulating: this.simulating };
  }

  async asset(id: string, q: Queryable = this.db) {
    return getAsset(q, id, this.readOpts());
  }

  // ---- Ingest ---------------------------------------------------------------------------

  async ingest(p: TelemetryPayload): Promise<{ asset: AssetState; risk: RiskResult }> {
    const now = this.now();
    const nowIso = now.toISOString();

    const { risk, changes } = await this.db.tx(async (q) => {
      const a = await q.one<Record<string, any>>(
        `SELECT a.*, r.name AS retailer_name FROM assets a LEFT JOIN retailers r ON r.id = a.retailer_id
          WHERE a.id = $1 AND a.status = 'active' FOR UPDATE OF a`,
        [p.device_id]
      );
      if (!a) throw new HttpError(404, 'Unknown or decommissioned device');
      const prev = await q.one<Record<string, any>>('SELECT * FROM asset_state WHERE asset_id = $1', [a.id]);

      const mainsOffSince = p.power.mains_connected ? null : (prev && !prev.mains_connected && prev.mains_off_since) || nowIso;
      const offMin = mainsOffSince ? (now.getTime() - Date.parse(mainsOffSince)) / 60_000 : 0;
      const distance = haversineM(a.anchor_lat, a.anchor_lng, p.gps.latitude, p.gps.longitude);
      const relocation = await q.one<Record<string, any>>(
        `SELECT * FROM relocations WHERE asset_id = $1 AND status = 'approved'
            AND $2::timestamptz BETWEEN window_start AND window_end ORDER BY window_end DESC LIMIT 1`,
        [a.id, nowIso]
      );

      const risk = scoreRisk({
        distance_m: distance,
        geofence_radius_m: a.geofence_radius_m,
        speed_kmh: p.speed_kmh,
        mains_connected: p.power.mains_connected,
        mains_off_minutes: offMin,
        vibration_status: p.accelerometer?.vibration_status,
        tilt_deg: p.accelerometer?.tilt_deg,
        internal_temp_c: p.cold_chain?.internal_temp_c ?? prev?.internal_temp_c ?? null,
        target_max_temp_c: p.cold_chain?.target_max_temp_c,
        local_hour: harareHour(now),
        shift: { open_hour: a.open_hour, close_hour: a.close_hour },
        force_curfew: this.cfg.forceCurfew,
        authorized_relocation: !!relocation,
      });

      // ---- incidents (state machine) ----
      const open = await q.query<Record<string, any>>(`SELECT * FROM incidents WHERE asset_id = $1 AND status <> 'resolved'`, [a.id]);
      const byKind = (k: IncidentKind) => open.find((i) => i.kind === k);
      const changes: Change[] = [];
      let calm = 0;

      const disp = byKind('displacement');
      if (disp) {
        if (risk.score > disp.peak_score) {
          await q.query(`UPDATE incidents SET peak_score = $2, reasons = $3::jsonb WHERE id = $1`, [disp.id, risk.score, JSON.stringify(risk.reasons)]);
        }
        calm = !risk.geofenceBreached && p.speed_kmh < 2 ? (prev?.calm_count ?? 0) + 1 : 0;
        if (calm >= RESOLVE_AFTER_CALM) {
          await this.closeIncident(q, disp.id, 'returned', SYSTEM, 'Cooler is back inside its geofence and stationary.', nowIso);
          changes.push({ kind: 'resolved', incidentId: disp.id });
          calm = 0;
        }
      } else if (risk.severity === 'critical') {
        changes.push({ kind: 'opened', incidentId: await this.openIncident(q, a, 'displacement', 'critical', risk, nowIso) });
      }

      const power = byKind('power');
      const prolonged = risk.reasons.some((r) => r.code === 'MAINS_OUTAGE_PROLONGED');
      if (power && p.power.mains_connected) {
        await this.closeIncident(q, power.id, 'power_restored', SYSTEM, 'Mains power restored.', nowIso);
        changes.push({ kind: 'resolved', incidentId: power.id });
      } else if (!power && prolonged) {
        changes.push({ kind: 'opened', incidentId: await this.openIncident(q, a, 'power', 'warning', risk, nowIso) });
      }

      const silent = byKind('signal_lost');
      if (silent) {
        await this.closeIncident(q, silent.id, 'signal_restored', SYSTEM, 'Beacon is reporting again.', nowIso);
        changes.push({ kind: 'resolved', incidentId: silent.id });
      }

      // ---- approved relocation reaching its destination ----
      if (relocation && p.speed_kmh < 2 && haversineM(relocation.to_lat, relocation.to_lng, p.gps.latitude, p.gps.longitude) <= a.geofence_radius_m) {
        await q.query(
          `UPDATE assets SET anchor_lat = $2, anchor_lng = $3, retailer_id = COALESCE($4, retailer_id), updated_at = $5 WHERE id = $1`,
          [a.id, relocation.to_lat, relocation.to_lng, relocation.to_retailer_id, nowIso]
        );
        await q.query(`UPDATE relocations SET status = 'completed', completed_at = $2 WHERE id = $1`, [relocation.id, nowIso]);
        await audit(q, SYSTEM, 'relocation.completed', a.id, { relocation_id: relocation.id });
      }

      // ---- state + history ----
      await q.query(
        `INSERT INTO asset_state (asset_id, lat, lng, speed_kmh, bearing_deg, distance_m, internal_temp_c, mains_connected,
                                  mains_off_since, voltage_ac, battery_pct, device_status, last_seen, risk_score, severity,
                                  confidence, geofence_breached, reasons, calm_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19)
         ON CONFLICT (asset_id) DO UPDATE SET
           lat=$2, lng=$3, speed_kmh=$4, bearing_deg=$5, distance_m=$6, internal_temp_c=$7, mains_connected=$8,
           mains_off_since=$9, voltage_ac=$10, battery_pct=$11, device_status=$12, last_seen=$13, risk_score=$14,
           severity=$15, confidence=$16, geofence_breached=$17, reasons=$18::jsonb, calm_count=$19`,
        [
          a.id, p.gps.latitude, p.gps.longitude, p.speed_kmh, p.bearing_deg ?? prev?.bearing_deg ?? 0, distance,
          p.cold_chain?.internal_temp_c ?? prev?.internal_temp_c ?? null, p.power.mains_connected, mainsOffSince,
          p.power.voltage_ac ?? null, p.power.battery_level_pct ?? prev?.battery_pct ?? null, p.status ?? null, nowIso,
          risk.score, risk.severity, risk.confidence, risk.geofenceBreached, JSON.stringify(risk.reasons), calm,
        ]
      );
      await q.query(
        `INSERT INTO telemetry (asset_id, received_at, lat, lng, speed_kmh, battery_pct, mains_connected, internal_temp_c, risk_score, severity, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
        [
          a.id, nowIso, p.gps.latitude, p.gps.longitude, p.speed_kmh, p.power.battery_level_pct ?? null,
          p.power.mains_connected, p.cold_chain?.internal_temp_c ?? null, risk.score, risk.severity, p,
        ]
      );
      return { risk, changes };
    });

    const asset = (await this.asset(p.device_id))!;
    await this.publish(asset, changes);
    return { asset, risk };
  }

  /** Emits hub events for committed changes and triggers notifications (never inside a tx). */
  private async publish(asset: AssetState, changes: Change[]) {
    if (changes.length === 0) {
      this.emit({ type: 'asset.updated', asset });
      return;
    }
    for (const c of changes) {
      const incident = (await getIncident(this.db, c.incidentId))!;
      if (c.kind === 'opened') {
        this.emit({ type: 'incident.opened', asset, incident });
        this.notifier.incidentOpened(incident, asset).catch((err) => log.error('notify failed', { error: (err as Error).message }));
      } else {
        this.emit({ type: 'incident.resolved', asset, incident });
      }
    }
  }

  async openIncident(q: Queryable, a: Record<string, any>, kind: IncidentKind, severity: string, risk: RiskResult, nowIso: string) {
    const seq = await q.one<{ n: number }>(`SELECT nextval('incident_seq')::int AS n`);
    const id = `INC-${seq!.n}`;
    await q.query(
      `INSERT INTO incidents (id, asset_id, kind, severity, opened_at, peak_score, reasons, origin_lat, origin_lng, origin_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)`,
      [id, a.id, kind, severity, nowIso, risk.score, JSON.stringify(risk.reasons), a.anchor_lat, a.anchor_lng, a.retailer_name ?? a.id]
    );
    const summary = risk.reasons.map((r) => r.label).join(' · ') || kind;
    await q.query(
      `INSERT INTO incident_events (incident_id, at, actor_name, type, message, data) VALUES ($1,$2,'System','opened',$3,$4::jsonb)`,
      [id, nowIso, summary, { score: risk.score }]
    );
    return id;
  }

  async closeIncident(q: Queryable, id: string, resolution: Resolution, actor: Actor, message: string | null, nowIso = this.now().toISOString()) {
    await q.query(`UPDATE incidents SET status = 'resolved', resolved_at = $2, resolved_by = $3, resolution = $4 WHERE id = $1`, [
      id,
      nowIso,
      actor.name,
      resolution,
    ]);
    await q.query(
      `INSERT INTO incident_events (incident_id, at, actor_id, actor_name, type, message, data) VALUES ($1,$2,$3,$4,'resolved',$5,$6::jsonb)`,
      [id, nowIso, actor.id, actor.name, message, { resolution }]
    );
    // Reset the calm counter so a future incident starts clean.
    await q.query(`UPDATE asset_state SET calm_count = 0 FROM incidents i WHERE i.id = $1 AND asset_state.asset_id = i.asset_id`, [id]);
  }

  // ---- Provisioning -----------------------------------------------------------------------

  /**
   * Registers (or re-registers) a beacon at a store and issues a fresh device credential.
   * The token is returned once; only its hash is stored.
   */
  async provision(
    id: string,
    input: {
      retailer_id: string;
      anchor_lat: number;
      anchor_lng: number;
      geofence_radius_m?: number;
      open_hour?: number;
      close_hour?: number;
      cooler_serial?: string;
      model?: string;
      imei?: string;
    },
    actor: Actor,
    ip?: string
  ): Promise<{ asset: AssetState; device_token: string }> {
    const token = newDeviceToken();
    const nowIso = this.now().toISOString();
    await this.db.tx(async (q) => {
      const retailer = await q.one('SELECT id FROM retailers WHERE id = $1', [input.retailer_id]);
      if (!retailer) throw new HttpError(400, `Retailer ${input.retailer_id} is not in the register`);
      await q.query(
        `INSERT INTO assets (id, retailer_id, anchor_lat, anchor_lng, geofence_radius_m, open_hour, close_hour, cooler_serial, model, asset_type, imei,
                             device_token_hash, provisioned_at, provisioned_by, updated_at)
         VALUES ($1,$2,$3,$4,COALESCE($5,50),COALESCE($6,7),COALESCE($7,22),$8,COALESCE($9,'Display cooler'),COALESCE($9,'Display cooler'),$10,$11,$12,$13,$12)
         ON CONFLICT (id) DO UPDATE SET retailer_id=$2, anchor_lat=$3, anchor_lng=$4,
           geofence_radius_m=COALESCE($5, assets.geofence_radius_m), open_hour=COALESCE($6, assets.open_hour),
           close_hour=COALESCE($7, assets.close_hour), cooler_serial=COALESCE($8, assets.cooler_serial),
           model=COALESCE($9, assets.model), imei=COALESCE($10, assets.imei), device_token_hash=$11,
           provisioned_at=$12, provisioned_by=$13, status='active', is_virtual=false, updated_at=$12`,
        [
          id, input.retailer_id, input.anchor_lat, input.anchor_lng, input.geofence_radius_m ?? null, input.open_hour ?? null,
          input.close_hour ?? null, input.cooler_serial ?? null, input.model ?? null, input.imei ?? null, hashDeviceToken(token),
          nowIso, actor.name,
        ]
      );
      await audit(q, actor, 'asset.provisioned', id, { retailer_id: input.retailer_id, radius: input.geofence_radius_m }, ip);
    });
    const asset = (await this.asset(id))!;
    this.emit({ type: 'asset.updated', asset });
    return { asset, device_token: token };
  }

  // ---- Background sweeps ---------------------------------------------------------------------

  /** Opens signal-lost incidents for beacons that went silent; expires stale relocations. */
  async sweep(): Promise<void> {
    const now = this.now();
    const nowIso = now.toISOString();
    const cutoff = new Date(now.getTime() - this.cfg.offlineAfterMin * 60_000).toISOString();
    const silent = await this.db.query<Record<string, any>>(
      `SELECT a.*, r.name AS retailer_name, s.risk_score, s.severity, s.reasons
         FROM assets a JOIN asset_state s ON s.asset_id = a.id LEFT JOIN retailers r ON r.id = a.retailer_id
        WHERE a.status = 'active' AND s.last_seen < $1
          AND NOT EXISTS (SELECT 1 FROM incidents i WHERE i.asset_id = a.id AND i.kind = 'signal_lost' AND i.status <> 'resolved')`,
      [cutoff]
    );
    for (const a of silent) {
      // Going silent mid-breach is a strong tamper signal.
      const severity = a.severity === 'critical' ? 'critical' : 'warning';
      const id = await this.db.tx((q) =>
        this.openIncident(q, a, 'signal_lost', severity, { score: a.risk_score, severity, confidence: 0, geofenceBreached: false, reasons: a.reasons }, nowIso)
      );
      const asset = (await this.asset(a.id))!;
      await this.publish(asset, [{ kind: 'opened', incidentId: id }]);
    }
    await this.db.query(`UPDATE relocations SET status = 'expired' WHERE status IN ('approved','pending') AND window_end < $1`, [nowIso]);
  }

  async pruneTelemetry(): Promise<number> {
    const cutoff = new Date(this.now().getTime() - this.cfg.telemetryRetentionDays * 86_400_000).toISOString();
    const rows = await this.db.query(`DELETE FROM telemetry WHERE received_at < $1 RETURNING id`, [cutoff]);
    return rows.length;
  }
}
