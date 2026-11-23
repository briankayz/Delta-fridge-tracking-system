import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { jwtVerify, SignJWT } from 'jose';
import { AuthUser, Role } from '../types.ts';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number, opts: crypto.ScryptOptions) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1, len: 64 };

// ---- Passwords --------------------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, SCRYPT.len, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await scrypt(password, Buffer.from(salt, 'base64url'), expected.length, { N: +n, r: +r, p: +p });
  return crypto.timingSafeEqual(actual, expected);
}

/** Minimum policy for staff accounts: 10+ chars with a letter and a digit. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return 'Password must be at least 10 characters.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password must contain letters and numbers.';
  return null;
}

// ---- Sessions (JWT, HS256) ---------------------------------------------------------------

export interface SessionClaims {
  sub: string;
  ver: number;
}

export async function signSession(user: { id: string; token_version: number }, secret: string, hours: number): Promise<string> {
  return new SignJWT({ ver: user.token_version })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setIssuer('delta-asset-guard')
    .setExpirationTime(`${hours}h`)
    .sign(new TextEncoder().encode(secret));
}

export async function verifySession(token: string, secret: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { issuer: 'delta-asset-guard' });
    return { sub: String(payload.sub), ver: Number(payload.ver ?? 0) };
  } catch {
    return null;
  }
}

// ---- Device credentials ------------------------------------------------------------------

export function newDeviceToken(): string {
  return `dag_dev_${crypto.randomBytes(32).toString('base64url')}`;
}

export function hashDeviceToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function deviceTokenMatches(token: string, storedHash: string | null): boolean {
  if (!storedHash) return false;
  const a = Buffer.from(hashDeviceToken(token), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---- Permissions -------------------------------------------------------------------------

export type Permission =
  | 'fleet:read'
  | 'incident:act'
  | 'incident:field'
  | 'asset:provision'
  | 'register:import'
  | 'relocation:request'
  | 'relocation:decide'
  | 'user:manage'
  | 'audit:read'
  | 'demo:control';

const MATRIX: Record<Permission, Role[]> = {
  'fleet:read': ['admin', 'ops_lead', 'area_manager', 'asset_protection', 'technician', 'viewer'],
  'incident:act': ['admin', 'ops_lead', 'area_manager', 'asset_protection'],
  'incident:field': ['admin', 'ops_lead', 'area_manager', 'asset_protection', 'technician'],
  'asset:provision': ['admin', 'ops_lead', 'technician'],
  'register:import': ['admin', 'ops_lead'],
  'relocation:request': ['admin', 'ops_lead', 'area_manager', 'technician'],
  'relocation:decide': ['admin', 'ops_lead'],
  'user:manage': ['admin'],
  'audit:read': ['admin', 'ops_lead'],
  'demo:control': ['admin', 'ops_lead'],
};

export function can(user: Pick<AuthUser, 'role'>, perm: Permission): boolean {
  return MATRIX[perm].includes(user.role);
}

export function permissionsFor(role: Role): Permission[] {
  return (Object.keys(MATRIX) as Permission[]).filter((p) => MATRIX[p].includes(role));
}

/** Users with a region only see assets/incidents in that region. */
export function canSeeRegion(user: Pick<AuthUser, 'region'>, region: string | null | undefined): boolean {
  return !user.region || !region || user.region.toLowerCase() === region.toLowerCase();
}

// ---- Simple fixed-window rate limiter (single instance) -----------------------------------

export class RateLimiter {
  private hits = new Map<string, { count: number; reset: number }>();
  constructor(private readonly limit: number, private readonly windowMs: number) {}

  /** Returns true if allowed. */
  take(key: string, now = Date.now()): boolean {
    const h = this.hits.get(key);
    if (!h || h.reset <= now) {
      this.hits.set(key, { count: 1, reset: now + this.windowMs });
      if (this.hits.size > 10_000) this.sweep(now);
      return true;
    }
    h.count += 1;
    return h.count <= this.limit;
  }

  reset(key: string) {
    this.hits.delete(key);
  }

  private sweep(now: number) {
    for (const [k, v] of this.hits) if (v.reset <= now) this.hits.delete(k);
  }
}
