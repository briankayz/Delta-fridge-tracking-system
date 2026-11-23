import { Queryable } from '../db/index.ts';
import { Actor } from '../types.ts';

export async function audit(
  q: Queryable,
  actor: Actor,
  action: string,
  target: string | null,
  detail?: Record<string, unknown>,
  ip?: string | null
): Promise<void> {
  await q.query(
    'INSERT INTO audit_log (actor_id, actor_name, action, target, detail, ip) VALUES ($1,$2,$3,$4,$5::jsonb,$6)',
    [actor.id, actor.name, action, target, detail ?? null, ip ?? null]
  );
}

export const SYSTEM: Actor = { id: null, name: 'System' };
