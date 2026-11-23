import { Db } from '../db/index.ts';
import { AuthUser, Role } from '../types.ts';
import { HttpError, log, newId } from '../util.ts';
import { hashPassword, passwordProblem, verifyPassword } from '../auth/security.ts';
import { audit, SYSTEM } from './audit.ts';

export interface UserRecord extends AuthUser {
  active: boolean;
  created_at: string;
  last_login_at: string | null;
}

const PUBLIC_COLS = 'id, email, name, phone, role, region, active, created_at, last_login_at';

export class UserService {
  private cache = new Map<string, { user: AuthUser & { token_version: number; active: boolean }; at: number }>();

  constructor(private readonly db: Db) {}

  async list(): Promise<UserRecord[]> {
    return this.db.query<UserRecord>(`SELECT ${PUBLIC_COLS} FROM users ORDER BY active DESC, name`);
  }

  async create(
    input: { email: string; name: string; role: Role; region?: string | null; phone?: string | null; password: string },
    actor: { id: string | null; name: string },
    ip?: string
  ): Promise<UserRecord> {
    const problem = passwordProblem(input.password);
    if (problem) throw new HttpError(400, problem);
    const email = input.email.trim().toLowerCase();
    if (await this.db.one('SELECT 1 FROM users WHERE email = $1', [email])) throw new HttpError(409, 'A user with that email already exists');
    const id = newId('usr');
    await this.db.tx(async (q) => {
      await q.query(
        `INSERT INTO users (id, email, name, phone, role, region, password_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, email, input.name.trim(), input.phone ?? null, input.role, input.region || null, await hashPassword(input.password)]
      );
      await audit(q, actor, 'user.created', id, { email, role: input.role, region: input.region ?? null }, ip);
    });
    return (await this.db.one<UserRecord>(`SELECT ${PUBLIC_COLS} FROM users WHERE id = $1`, [id]))!;
  }

  async update(
    id: string,
    patch: { name?: string; role?: Role; region?: string | null; phone?: string | null; active?: boolean; password?: string },
    actor: { id: string | null; name: string },
    ip?: string
  ): Promise<UserRecord> {
    if (patch.password) {
      const problem = passwordProblem(patch.password);
      if (problem) throw new HttpError(400, problem);
    }
    if (actor.id === id && (patch.active === false || (patch.role && patch.role !== 'admin'))) {
      throw new HttpError(400, 'You cannot deactivate or demote your own account');
    }
    await this.db.tx(async (q) => {
      const existing = await q.one('SELECT id FROM users WHERE id = $1', [id]);
      if (!existing) throw new HttpError(404, 'User not found');
      const hash = patch.password ? await hashPassword(patch.password) : null;
      // Changing password, role, region or active status revokes existing sessions.
      const revoke = !!(patch.password || patch.role || patch.region !== undefined || patch.active === false);
      await q.query(
        `UPDATE users SET name = COALESCE($2, name), role = COALESCE($3, role),
                region = CASE WHEN $4::boolean THEN $5 ELSE region END, phone = CASE WHEN $6::boolean THEN $7 ELSE phone END,
                active = COALESCE($8, active), password_hash = COALESCE($9, password_hash),
                token_version = token_version + CASE WHEN $10::boolean THEN 1 ELSE 0 END
          WHERE id = $1`,
        [
          id, patch.name ?? null, patch.role ?? null, patch.region !== undefined, patch.region || null,
          patch.phone !== undefined, patch.phone || null, patch.active ?? null, hash, revoke,
        ]
      );
      const detail = { ...patch, password: patch.password ? '(changed)' : undefined };
      await audit(q, actor, 'user.updated', id, detail, ip);
    });
    this.cache.delete(id);
    return (await this.db.one<UserRecord>(`SELECT ${PUBLIC_COLS} FROM users WHERE id = $1`, [id]))!;
  }

  async authenticate(email: string, password: string, ip?: string) {
    const row = await this.db.one<Record<string, any>>('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    // Verify against a dummy hash when the user is unknown to keep timing uniform.
    const ok = await verifyPassword(password, row?.password_hash ?? 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$' + 'A'.repeat(86));
    if (!row || !ok || !row.active) {
      await audit(this.db, { id: row?.id ?? null, name: email }, 'auth.login_failed', null, undefined, ip);
      return null;
    }
    await this.db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [row.id]);
    await audit(this.db, { id: row.id, name: row.name }, 'auth.login', null, undefined, ip);
    return row as AuthUser & { token_version: number; active: boolean };
  }

  /** Session lookup with a 30 s cache (revocation applies within that window). */
  async byId(id: string): Promise<(AuthUser & { token_version: number; active: boolean }) | null> {
    const hit = this.cache.get(id);
    if (hit && Date.now() - hit.at < 30_000) return hit.user;
    const row = await this.db.one<AuthUser & { token_version: number; active: boolean }>(
      'SELECT id, email, name, phone, role, region, active, token_version FROM users WHERE id = $1',
      [id]
    );
    if (row) this.cache.set(id, { user: row, at: Date.now() });
    return row ?? null;
  }

  /** First start: create the admin from ADMIN_EMAIL / ADMIN_PASSWORD if no users exist. */
  async bootstrapAdmin(email?: string, password?: string) {
    const count = await this.db.one<{ n: number }>('SELECT count(*)::int AS n FROM users');
    if (count!.n > 0) return;
    if (!email || !password) {
      log.warn('No users exist. Set ADMIN_EMAIL and ADMIN_PASSWORD (or DEMO_MODE=1) to create the first administrator.');
      return;
    }
    await this.create({ email, name: 'Administrator', role: 'admin', password }, SYSTEM);
    log.info('Created first administrator', { email });
  }
}
