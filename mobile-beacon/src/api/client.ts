import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { Asset, Incident, Meta, Retailer, User } from './types';

const BACKEND_PORT = 8787;
const TIMEOUT_MS = 10_000;

// ---- storage (secure on device, localStorage on web) ----------------------------------------
const secure = {
  async get(key: string) {
    return Platform.OS === 'web' ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string) {
    return Platform.OS === 'web' ? AsyncStorage.setItem(key, value) : SecureStore.setItemAsync(key, value);
  },
  async del(key: string) {
    return Platform.OS === 'web' ? AsyncStorage.removeItem(key) : SecureStore.deleteItemAsync(key);
  },
};

/** Default server: EXPO_PUBLIC_API_URL, else the laptop running Expo, else the page host (web). */
export function defaultServer(): string {
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env) return env.replace(/\/$/, '');
  const hostUri: string | undefined =
    Constants.expoConfig?.hostUri ?? (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost;
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:${BACKEND_PORT}`;
  if (typeof window !== 'undefined' && window.location?.hostname) return `http://${window.location.hostname}:${BACKEND_PORT}`;
  return `http://127.0.0.1:${BACKEND_PORT}`;
}

let server = defaultServer();
let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const session = {
  async load() {
    server = (await AsyncStorage.getItem('dag.server')) ?? defaultServer();
    token = await secure.get('dag.token');
    return { server, token };
  },
  get server() {
    return server;
  },
  async setServer(url: string) {
    server = url.trim().replace(/\/$/, '');
    await AsyncStorage.setItem('dag.server', server);
  },
  async setToken(t: string | null) {
    token = t;
    if (t) await secure.set('dag.token', t);
    else await secure.del('dag.token');
  },
  onUnauthorized(fn: () => void) {
    onUnauthorized = fn;
  },
  /** Device credentials issued when this phone installed a beacon (used by demo beacon mode). */
  async saveDeviceToken(deviceId: string, deviceToken: string) {
    await secure.set(`dag.device.${deviceId}`, deviceToken);
    const ids = new Set<string>(JSON.parse((await AsyncStorage.getItem('dag.devices')) ?? '[]'));
    ids.add(deviceId);
    await AsyncStorage.setItem('dag.devices', JSON.stringify([...ids]));
  },
  async deviceIds(): Promise<string[]> {
    return JSON.parse((await AsyncStorage.getItem('dag.devices')) ?? '[]');
  },
  deviceToken: (deviceId: string) => secure.get(`dag.device.${deviceId}`),
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export class NetworkError extends Error {}

export async function request<T>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${server}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
  } catch (err) {
    throw new NetworkError((err as Error).message);
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith('/api/v1/auth/login') && !path.startsWith('/api/v1/telemetry')) onUnauthorized?.();
  if (!res.ok) throw new ApiError(res.status, (body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

// ---- offline outbox for field actions ---------------------------------------------------------
const OUTBOX = 'dag.outbox';
type Pending = { path: string; body: unknown; at: string };

export const outbox = {
  async list(): Promise<Pending[]> {
    return JSON.parse((await AsyncStorage.getItem(OUTBOX)) ?? '[]');
  },
  async add(p: Pending) {
    const items = await outbox.list();
    items.push(p);
    await AsyncStorage.setItem(OUTBOX, JSON.stringify(items));
  },
  /** Sends queued actions in order; keeps the ones that still can't reach the server. */
  async flush(): Promise<number> {
    const items = await outbox.list();
    const left: Pending[] = [];
    for (const item of items) {
      try {
        await request(item.path, { method: 'POST', body: item.body });
      } catch (err) {
        if (err instanceof NetworkError) left.push(item);
        // Server rejections (e.g. already resolved) are dropped: retrying cannot succeed.
      }
    }
    await AsyncStorage.setItem(OUTBOX, JSON.stringify(left));
    return left.length;
  },
};

/** POST that survives no-signal: queued and retried later. Returns 'sent' or 'queued'. */
export async function postOrQueue(path: string, body: unknown): Promise<'sent' | 'queued'> {
  try {
    await request(path, { method: 'POST', body });
    return 'sent';
  } catch (err) {
    if (err instanceof NetworkError) {
      await outbox.add({ path, body, at: new Date().toISOString() });
      return 'queued';
    }
    throw err;
  }
}

// ---- endpoints ----------------------------------------------------------------------------------
export const api = {
  meta: () => request<Meta>('/api/v1/meta'),
  login: (email: string, password: string) =>
    request<{ user: User; permissions: string[]; token: string }>('/api/v1/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request<{ user: User; permissions: string[] }>('/api/v1/auth/me'),
  logout: () => request('/api/v1/auth/logout', { method: 'POST', body: {} }).catch(() => undefined),
  openIncidents: () => request<Incident[]>('/api/v1/incidents?status=open&limit=200'),
  incident: (id: string) => request<Incident>(`/api/v1/incidents/${encodeURIComponent(id)}`),
  asset: (id: string) => request<{ asset: Asset }>(`/api/v1/assets/${encodeURIComponent(id)}`),
  retailers: () => request<Retailer[]>('/api/v1/retailers'),
  provision: (id: string, body: { retailer_id: string; anchor_lat: number; anchor_lng: number; geofence_radius_m: number }) =>
    request<{ asset: Asset; device_token: string }>(`/api/v1/assets/${encodeURIComponent(id)}/provision`, { method: 'POST', body }),
  fieldUpdate: (id: string, body: { outcome: 'found' | 'not_found' | 'recovered' | 'authorized'; note?: string; lat?: number; lng?: number }) =>
    postOrQueue(`/api/v1/incidents/${encodeURIComponent(id)}/field-update`, body),
  simulateBreach: (id: string) => request(`/api/v1/assets/${encodeURIComponent(id)}/simulate-breach`, { method: 'POST', body: {} }),
  demoReset: (id: string) => request(`/api/v1/assets/${encodeURIComponent(id)}/demo-reset`, { method: 'POST', body: {} }),
};
