// Planned cooler moves (store refits, transfers between outlets). An approved request lets the cooler
// travel without raising a theft alert during its time window; arrival re-anchors the geofence.
import { Db } from '../db/index.ts';
import { AuthUser } from '../types.ts';
import { HttpError, newId } from '../util.ts';
import { canSeeRegion } from '../auth/security.ts';
import { audit } from './audit.ts';

export interface Relocation {
  id: string;
  asset_id: string;
  reason: string;
  to_retailer_id: string | null;
  to_retailer_name: string | null;
  to_lat: number;
  to_lng: number;
  window_start: string;
  window_end: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'expired';
  requested_by: string;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
  completed_at: string | null;
  region: string | null;
}

const SELECT = `
SELECT x.*, rt.name AS to_retailer_name, r.region
  FROM relocations x
  JOIN assets a ON a.id = x.asset_id
  LEFT JOIN retailers r ON r.id = a.retailer_id
  LEFT JOIN retailers rt ON rt.id = x.to_retailer_id`;

export class RelocationService {
  constructor(private readonly db: Db, private readonly now: () => Date = () => new Date()) {}

  async list(user: AuthUser, status?: string): Promise<Relocation[]> {
    const rows = await this.db.query<Relocation>(
      `${SELECT} WHERE ($1::text IS NULL OR x.status = $1) AND ($2::text IS NULL OR lower(r.region) = lower($2))
       ORDER BY x.requested_at DESC LIMIT 200`,
      [status ?? null, user.region]
    );
    return rows;
  }

  async request(
    body: { asset_id: string; reason: string; to_retailer_id?: string; to_lat?: number; to_lng?: number; start?: string; hours: number },
    user: AuthUser,
    ip?: string
  ): Promise<Relocation> {
    const id = newId('REL');
    await this.db.tx(async (q) => {
      const asset = await q.one<{ id: string; region: string | null }>(
        `SELECT a.id, r.region FROM assets a LEFT JOIN retailers r ON r.id = a.retailer_id WHERE a.id = $1 AND a.status = 'active'`,
        [body.asset_id]
      );
      if (!asset || !canSeeRegion(user, asset.region)) throw new HttpError(404, 'Asset not found');
      let { to_lat, to_lng } = body;
      if (body.to_retailer_id) {
        const dest = await q.one<{ lat: number | null; lng: number | null }>('SELECT lat, lng FROM retailers WHERE id = $1', [body.to_retailer_id]);
        if (!dest) throw new HttpError(400, 'Destination retailer not found');
        to_lat ??= dest.lat ?? undefined;
        to_lng ??= dest.lng ?? undefined;
      }
      if (to_lat == null || to_lng == null) throw new HttpError(400, 'Give a destination retailer or coordinates');
      const start = body.start ? new Date(body.start) : this.now();
      if (Number.isNaN(start.getTime())) throw new HttpError(400, 'Invalid start time');
      const end = new Date(start.getTime() + body.hours * 3_600_000);
      await q.query(
        `INSERT INTO relocations (id, asset_id, reason, to_retailer_id, to_lat, to_lng, window_start, window_end, requested_by, requested_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [id, body.asset_id, body.reason, body.to_retailer_id ?? null, to_lat, to_lng, start.toISOString(), end.toISOString(), user.name, this.now().toISOString()]
      );
      await audit(q, { id: user.id, name: user.name }, 'relocation.requested', body.asset_id, { relocation_id: id }, ip);
    });
    return (await this.db.one<Relocation>(`${SELECT} WHERE x.id = $1`, [id]))!;
  }

  async decide(id: string, approve: boolean, user: AuthUser, ip?: string): Promise<Relocation> {
    await this.db.tx(async (q) => {
      const rel = await q.one<Relocation>(`${SELECT} WHERE x.id = $1`, [id]);
      if (!rel || !canSeeRegion(user, rel.region)) throw new HttpError(404, 'Relocation not found');
      if (rel.status !== 'pending') throw new HttpError(409, `Relocation is already ${rel.status}`);
      await q.query(`UPDATE relocations SET status = $2, decided_by = $3, decided_at = $4 WHERE id = $1`, [
        id,
        approve ? 'approved' : 'rejected',
        user.name,
        this.now().toISOString(),
      ]);
      await audit(q, { id: user.id, name: user.name }, approve ? 'relocation.approved' : 'relocation.rejected', rel.asset_id, { relocation_id: id }, ip);
    });
    return (await this.db.one<Relocation>(`${SELECT} WHERE x.id = $1`, [id]))!;
  }
}
