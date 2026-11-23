import { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';
import { loadConfig, Config } from '../src/config.ts';
import { TelemetryPayload } from '../src/schema.ts';

export const PASSWORD = 'Test-Password-123';

/** A fresh in-memory PostgreSQL + API for each test file. */
export async function startTestApp(overrides: Partial<Config> = {}, now?: () => Date) {
  const cfg = loadConfig({ NODE_ENV: 'test' } as NodeJS.ProcessEnv, {
    dataDir: 'memory://',
    jwtSecret: 'test-secret-test-secret-test-secret-123',
    demoMode: true,
    ...overrides,
  });
  const svc = await createApp({ cfg, now, fetchImpl: (async () => new Response('{}', { status: 200 })) as typeof fetch });
  await new Promise<void>((r) => svc.server.listen(0, '127.0.0.1', r));
  const { port } = svc.server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  const call = async (method: string, path: string, body?: unknown, token?: string, extra: Record<string, string> = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = text;
    try {
      json = JSON.parse(text);
    } catch {
      /* csv etc. */
    }
    return { status: res.status, body: json, headers: res.headers };
  };

  const login = async (email: string, password = PASSWORD) => {
    const r = await call('POST', '/api/v1/auth/login', { email, password });
    if (r.status !== 200) throw new Error(`login failed for ${email}: ${JSON.stringify(r.body)}`);
    return r.body.token as string;
  };

  return { svc, cfg, base, port, call, login };
}

/** Seeds one store and users for each role directly through services. */
export async function seedBasics(svc: Awaited<ReturnType<typeof startTestApp>>['svc']) {
  const sys = { id: null, name: 'test' };
  const roles = ['admin', 'ops_lead', 'area_manager', 'asset_protection', 'technician', 'viewer'] as const;
  for (const role of roles) {
    await svc.users.create(
      { email: `${role}@test.local`, name: `${role} user`, role, region: role === 'area_manager' ? 'Harare North' : null, password: PASSWORD },
      sys
    );
  }
  await svc.db.query(
    `INSERT INTO retailers (id, name, region, contact_phone, lat, lng) VALUES
       ('RET-A','OK Avondale','Harare North','+263770000001',-17.79421,31.03784),
       ('RET-B','Mbare Bottle Store','Harare South',NULL,-17.858,31.04)`
  );
}

export const nominal = (id: string, lat = -17.79421, lng = 31.03784): TelemetryPayload => ({
  device_id: id,
  speed_kmh: 0,
  gps: { latitude: lat, longitude: lng },
  power: { mains_connected: true, voltage_ac: 230, battery_level_pct: 98 },
  cold_chain: { internal_temp_c: 3.8, target_max_temp_c: 6 },
});

export const breach = (id: string, i = 0): TelemetryPayload => ({
  device_id: id,
  speed_kmh: 38.5,
  bearing_deg: 42,
  gps: { latitude: -17.778 + i * 0.0001, longitude: 31.053 },
  power: { mains_connected: false, voltage_ac: 0, battery_level_pct: 92 },
  accelerometer: { tilt_deg: 14.8, vibration_status: 'Elevated' },
  cold_chain: { internal_temp_c: 5.6, target_max_temp_c: 6 },
});
