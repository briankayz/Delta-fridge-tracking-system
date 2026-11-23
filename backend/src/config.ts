import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface Config {
  env: 'development' | 'production' | 'test';
  port: number;
  host: string;
  /** postgres://… for a real server; when unset an embedded PostgreSQL (PGlite) is used. */
  databaseUrl?: string;
  /** Embedded database directory. 'memory://' keeps it in RAM (tests). */
  dataDir: string;
  jwtSecret: string;
  sessionHours: number;
  /** Allowed browser origins for CORS (comma separated). Empty = same-origin only. */
  corsOrigins: string[];
  /** Enables demo seed data, the virtual fleet and the simulate-breach control. */
  demoMode: boolean;
  demoPassword: string;
  forceCurfew: boolean;
  /** A beacon silent for this long is "offline" and raises a signal-lost incident. */
  offlineAfterMin: number;
  telemetryRetentionDays: number;
  adminEmail?: string;
  adminPassword?: string;
  notify: {
    webhookUrl?: string;
    twilioSid?: string;
    twilioToken?: string;
    twilioSmsFrom?: string;
    twilioWhatsappFrom?: string;
  };
}

/** Dev convenience: persist a random JWT secret in the data dir so sessions survive restarts. */
function devSecret(dataDir: string): string {
  if (dataDir.startsWith('memory://')) return crypto.randomBytes(32).toString('hex');
  const file = path.join(path.dirname(path.resolve(dataDir)), '.jwt-secret');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    const s = crypto.randomBytes(32).toString('hex');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, s, { mode: 0o600 });
    return s;
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env, overrides: Partial<Config> = {}): Config {
  const mode = (env.NODE_ENV === 'production' ? 'production' : env.NODE_ENV === 'test' ? 'test' : 'development') as Config['env'];
  const dataDir = overrides.dataDir ?? env.DATA_DIR ?? './data/pg';
  const jwtSecret = overrides.jwtSecret ?? env.JWT_SECRET ?? (mode === 'production' ? '' : devSecret(dataDir));
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set to at least 32 characters in production.');
  }
  const cfg: Config = {
    env: mode,
    port: Number(env.PORT ?? 8787),
    host: env.HOST ?? '0.0.0.0',
    databaseUrl: env.DATABASE_URL || undefined,
    dataDir,
    jwtSecret,
    sessionHours: Number(env.SESSION_HOURS ?? 12),
    corsOrigins: (env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    demoMode: env.DEMO_MODE === '1',
    demoPassword: env.DEMO_PASSWORD ?? 'Delta-Demo-2026!',
    forceCurfew: env.DEMO_FORCE_CURFEW === '1',
    offlineAfterMin: Number(env.OFFLINE_AFTER_MIN ?? 15),
    telemetryRetentionDays: Number(env.TELEMETRY_RETENTION_DAYS ?? 90),
    adminEmail: env.ADMIN_EMAIL || undefined,
    adminPassword: env.ADMIN_PASSWORD || undefined,
    notify: {
      webhookUrl: env.NOTIFY_WEBHOOK_URL || undefined,
      twilioSid: env.TWILIO_ACCOUNT_SID || undefined,
      twilioToken: env.TWILIO_AUTH_TOKEN || undefined,
      twilioSmsFrom: env.TWILIO_SMS_FROM || undefined,
      twilioWhatsappFrom: env.TWILIO_WHATSAPP_FROM || undefined,
    },
    ...overrides,
  };
  return cfg;
}
