// Read model: SQL -> API DTOs. Shared by REST routes, the WebSocket hub and services.
import { Queryable } from '../db/index.ts';
import { nearestPlace } from '../geo.ts';
import { AssetState, FleetSummary, Incident, IncidentEvent, IncidentKind, TrailPoint } from '../types.ts';

const ASSET_SQL = `
SELECT a.id, a.cooler_serial, a.model, a.asset_type, a.imei, a.is_virtual, a.retailer_id,
       a.anchor_lat, a.anchor_lng, a.geofence_radius_m, a.open_hour, a.close_hour,
       (a.device_token_hash IS NOT NULL) AS provisioned,
       r.name AS retailer_name, r.region, r.contact_name, r.contact_phone,
       s.lat, s.lng, s.speed_kmh, s.bearing_deg, s.distance_m, s.internal_temp_c, s.mains_connected,
       s.mains_off_since, s.voltage_ac, s.battery_pct, s.device_status, s.last_seen,
       s.risk_score, s.severity, s.confidence, s.geofence_breached, s.reasons,
       COALESCE((SELECT json_agg(json_build_object('id', i.id, 'kind', i.kind, 'status', i.status, 'opened_at', i.opened_at)
                                 ORDER BY i.opened_at)
                   FROM incidents i WHERE i.asset_id = a.id AND i.status <> 'resolved'), '[]'::json) AS open_incidents,
       (SELECT json_build_object('id', x.id, 'window_end', x.window_end, 'to_lat', x.to_lat, 'to_lng', x.to_lng)
          FROM relocations x
         WHERE x.asset_id = a.id AND x.status = 'approved' AND $1::timestamptz BETWEEN x.window_start AND x.window_end
         ORDER BY x.window_end DESC LIMIT 1) AS relocation
  FROM assets a
  LEFT JOIN retailers r ON r.id = a.retailer_id
  LEFT JOIN asset_state s ON s.asset_id = a.id
 WHERE a.status = 'active'`;

type AssetRow = Record<string, any>;
const KIND_PRIORITY: IncidentKind[] = ['displacement', 'signal_lost', 'power'];

export interface ReadOptions {
  now: Date;
  offlineAfterMin: number;
  simulating?: Set<string>;
}

async function trailFor(q: Queryable, row: AssetRow, since: string): Promise<TrailPoint[]> {
  const pts = await q.query<TrailPoint>(
    `SELECT received_at AS t, lat, lng, speed_kmh, risk_score AS score, battery_pct
       FROM telemetry WHERE asset_id = $1 AND received_at >= $2::timestamptz
      ORDER BY received_at ASC LIMIT 300`,
    [row.id, since]
  );
  return [{ t: since, lat: row.anchor_lat, lng: row.anchor_lng, speed_kmh: 0, score: 0, battery_pct: row.battery_pct }, ...pts];
}

async function toAsset(q: Queryable, row: AssetRow, o: ReadOptions): Promise<AssetState> {
  const open = (row.open_incidents ?? []) as { id: string; kind: IncidentKind; status: any; opened_at: string }[];
  const primary = [...open].sort((a, b) => KIND_PRIORITY.indexOf(a.kind) - KIND_PRIORITY.indexOf(b.kind))[0];
  const displacement = open.find((i) => i.kind === 'displacement');
  const lat = row.lat ?? row.anchor_lat;
  const lng = row.lng ?? row.anchor_lng;
  const online = !!row.last_seen && o.now.getTime() - Date.parse(row.last_seen) < o.offlineAfterMin * 60_000;
  const reported = !!row.last_seen;

  return {
    id: row.id,
    cooler_serial: row.cooler_serial,
    model: row.model,
    asset_type: row.asset_type,
    imei: row.imei ?? '',
    is_virtual: row.is_virtual,
    provisioned: row.provisioned,
    retailer_id: row.retailer_id,
    retailer_name: row.retailer_name ?? 'Unassigned retailer',
    region: row.region ?? 'Unassigned',
    retailer_contact: { name: row.contact_name ?? null, phone: row.contact_phone ?? null },
    anchor: { lat: row.anchor_lat, lng: row.anchor_lng },
    geofence_radius_m: row.geofence_radius_m,
    shift: { open_hour: row.open_hour, close_hour: row.close_hour },
    location_name: !reported
      ? 'Awaiting first report'
      : row.geofence_breached
      ? `Near ${nearestPlace(lat, lng)} (+${(row.distance_m / 1000).toFixed(1)} km)`
      : `${row.retailer_name ?? 'Store'} (in store)`,
    lat,
    lng,
    speed_kmh: row.speed_kmh ?? 0,
    bearing_deg: row.bearing_deg ?? 0,
    distance_m: row.distance_m ?? 0,
    internal_temp_c: row.internal_temp_c ?? null,
    mains_connected: row.mains_connected ?? true,
    mains_off_since: row.mains_off_since ?? null,
    voltage_ac: row.voltage_ac ?? null,
    battery_pct: row.battery_pct ?? null,
    device_status: row.device_status ?? null,
    last_seen: row.last_seen ?? null,
    online,
    risk: {
      score: row.risk_score ?? 0,
      severity: row.severity ?? 'nominal',
      confidence: row.confidence ?? 0,
      geofenceBreached: row.geofence_breached ?? false,
      reasons: row.reasons ?? [],
    },
    incident_id: primary?.id ?? null,
    open_incidents: open.map(({ id, kind, status }) => ({ id, kind, status })),
    relocation: row.relocation
      ? { id: row.relocation.id, window_end: row.relocation.window_end, to: { lat: row.relocation.to_lat, lng: row.relocation.to_lng } }
      : null,
    trail: displacement ? await trailFor(q, row, displacement.opened_at) : [],
    simulation_active: o.simulating?.has(row.id) ?? false,
  };
}

export async function getAsset(q: Queryable, id: string, o: ReadOptions): Promise<AssetState | undefined> {
  const row = await q.one<AssetRow>(`${ASSET_SQL} AND a.id = $2`, [o.now.toISOString(), id]);
  return row ? toAsset(q, row, o) : undefined;
}

export async function listAssets(q: Queryable, o: ReadOptions & { region?: string | null }): Promise<AssetState[]> {
  const rows = o.region
    ? await q.query<AssetRow>(`${ASSET_SQL} AND lower(r.region) = lower($2) ORDER BY a.id`, [o.now.toISOString(), o.region])
    : await q.query<AssetRow>(`${ASSET_SQL} ORDER BY a.id`, [o.now.toISOString()]);
  return Promise.all(rows.map((r) => toAsset(q, r, o)));
}

export async function assetHistory(q: Queryable, id: string, limit = 2000): Promise<TrailPoint[]> {
  const rows = await q.query<TrailPoint>(
    `SELECT received_at AS t, lat, lng, speed_kmh, risk_score AS score, battery_pct
       FROM (SELECT * FROM telemetry WHERE asset_id = $1 ORDER BY received_at DESC LIMIT $2) t
      ORDER BY received_at ASC`,
    [id, limit]
  );
  return rows;
}

export async function fleetSummary(q: Queryable, o: ReadOptions & { region?: string | null }): Promise<FleetSummary> {
  const cutoff = new Date(o.now.getTime() - o.offlineAfterMin * 60_000).toISOString();
  const region = o.region ?? null;
  const row = await q.one<Record<string, number>>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE s.last_seen >= $1)::int AS reporting,
            count(*) FILTER (WHERE s.last_seen IS NULL OR s.last_seen < $1)::int AS offline,
            count(*) FILTER (WHERE s.last_seen >= $1 AND s.severity = 'nominal' AND s.mains_connected)::int AS compliant,
            count(*) FILTER (WHERE s.last_seen >= $1 AND NOT s.mains_connected)::int AS outages
       FROM assets a
       LEFT JOIN asset_state s ON s.asset_id = a.id
       LEFT JOIN retailers r ON r.id = a.retailer_id
      WHERE a.status = 'active' AND ($2::text IS NULL OR lower(r.region) = lower($2))`,
    [cutoff, region]
  );
  const inc = await q.one<Record<string, number>>(
    `SELECT count(*) FILTER (WHERE i.kind = 'displacement')::int AS anomalies, count(*)::int AS open_incidents
       FROM incidents i JOIN assets a ON a.id = i.asset_id LEFT JOIN retailers r ON r.id = a.retailer_id
      WHERE i.status <> 'resolved' AND ($1::text IS NULL OR lower(r.region) = lower($1))`,
    [region]
  );
  return {
    total: row!.total,
    reporting: row!.reporting,
    offline: row!.offline,
    compliant: row!.compliant,
    outages: row!.outages,
    anomalies: inc!.anomalies,
    open_incidents: inc!.open_incidents,
  };
}

const INCIDENT_SQL = `
SELECT i.*, u.name AS assigned_name, r.name AS retailer_name, r.region
  FROM incidents i
  JOIN assets a ON a.id = i.asset_id
  LEFT JOIN retailers r ON r.id = a.retailer_id
  LEFT JOIN users u ON u.id = i.assigned_to`;

function toIncident(row: Record<string, any>): Incident {
  return {
    id: row.id,
    asset_id: row.asset_id,
    kind: row.kind,
    severity: row.severity,
    status: row.status,
    opened_at: row.opened_at,
    acknowledged_at: row.acknowledged_at,
    acknowledged_by: row.acknowledged_by,
    assigned_to: row.assigned_to,
    assigned_name: row.assigned_name ?? null,
    resolved_at: row.resolved_at,
    resolved_by: row.resolved_by,
    resolution: row.resolution,
    peak_score: row.peak_score,
    reasons: row.reasons ?? [],
    origin: { lat: row.origin_lat, lng: row.origin_lng, name: row.origin_name },
    retailer_name: row.retailer_name ?? null,
    region: row.region ?? null,
  };
}

export async function getIncident(q: Queryable, id: string, withEvents = false): Promise<Incident | undefined> {
  const row = await q.one(`${INCIDENT_SQL} WHERE i.id = $1`, [id]);
  if (!row) return undefined;
  const incident = toIncident(row);
  if (withEvents) {
    incident.events = await q.query<IncidentEvent>(
      `SELECT id, at, actor_name, type, message, data FROM incident_events WHERE incident_id = $1 ORDER BY at, id`,
      [id]
    );
  }
  return incident;
}

export async function listIncidents(
  q: Queryable,
  f: { status?: 'open' | 'resolved' | 'all'; kind?: string; region?: string | null; assetId?: string; limit?: number; since?: string }
): Promise<Incident[]> {
  const rows = await q.query(
    `${INCIDENT_SQL}
      WHERE ($1::text = 'all' OR ($1 = 'open' AND i.status <> 'resolved') OR ($1 = 'resolved' AND i.status = 'resolved'))
        AND ($2::text IS NULL OR i.kind = $2)
        AND ($3::text IS NULL OR lower(r.region) = lower($3))
        AND ($4::text IS NULL OR i.asset_id = $4)
        AND ($6::timestamptz IS NULL OR i.opened_at >= $6)
      ORDER BY (i.status = 'resolved'), i.opened_at DESC
      LIMIT $5`,
    [f.status ?? 'all', f.kind ?? null, f.region ?? null, f.assetId ?? null, Math.min(f.limit ?? 100, 1000), f.since ?? null]
  );
  return rows.map(toIncident);
}
