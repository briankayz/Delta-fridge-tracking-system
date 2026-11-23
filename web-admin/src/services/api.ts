import { AssetState, AuthUser, Incident, Permission, Resolution, TrailPoint } from '../types';

// Same-origin by default (Vite proxy in dev, backend-served build in production).
// VITE_API_URL points the dashboard at another host if needed.
export const API_BASE: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export const WS_URL = API_BASE
  ? `${API_BASE.replace(/^http/, 'ws')}/ws/telemetry`
  : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/telemetry`;

export const API_HOST_LABEL = API_BASE ? API_BASE.replace(/^https?:\/\//, '') : `${window.location.host} (proxied)`;

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

/** Called on any 401 so the app can return to the sign-in screen. */
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => (onUnauthorized = fn);

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  if (res.status === 401 && !path.startsWith('/api/v1/auth/')) onUnauthorized?.();
  const type = res.headers.get('content-type') ?? '';
  const body = type.includes('application/json') ? await res.json().catch(() => ({})) : await res.text();
  if (!res.ok) {
    const b = body as { error?: string; details?: unknown };
    throw new ApiError(res.status, b?.error ?? `Request failed (${res.status})`, b?.details);
  }
  return body as T;
}

const post = <T>(path: string, body: unknown = {}) => request<T>(path, { method: 'POST', body: JSON.stringify(body) });

export interface Meta {
  version: string;
  demo_mode: boolean;
  offline_after_min: number;
  register_columns: string[];
}

export interface UserRecord extends AuthUser {
  active: boolean;
  created_at: string;
  last_login_at: string | null;
}

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

export interface Retailer {
  id: string;
  name: string;
  region: string;
  address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  lat: number | null;
  lng: number | null;
  coolers: number;
}

export interface ImportResult {
  rows: number;
  retailers_upserted: number;
  assets_created: number;
  assets_updated: number;
  errors: { row: number; message: string }[];
}

export interface RegionReport {
  region: string;
  coolers: number;
  incidents: number;
  displacement: number;
  power: number;
  signal_lost: number;
  recovered: number;
  still_open: number;
  mtta_min: number | null;
  mttr_min: number | null;
}

export interface AuditRow {
  id: number;
  at: string;
  actor_name: string;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
  ip: string | null;
}

export interface NotificationRow {
  id: number;
  at: string;
  channel: string;
  recipient: string;
  subject: string;
  body: string;
  incident_id: string | null;
  status: string;
  error: string | null;
}

export const api = {
  meta: () => request<Meta>('/api/v1/meta'),
  me: () => request<{ user: AuthUser; permissions: Permission[] }>('/api/v1/auth/me'),
  login: (email: string, password: string) =>
    post<{ user: AuthUser; permissions: Permission[] }>('/api/v1/auth/login', { email, password }),
  logout: () => post<{ ok: boolean }>('/api/v1/auth/logout'),
  changePassword: (current_password: string, new_password: string) =>
    post<{ ok: boolean }>('/api/v1/auth/change-password', { current_password, new_password }),

  getAsset: (id: string) =>
    request<{ asset: AssetState; history: TrailPoint[]; incident: Incident | null; incidents: Incident[] }>(
      `/api/v1/assets/${encodeURIComponent(id)}`
    ),
  retailers: () => request<Retailer[]>('/api/v1/retailers'),
  simulateBreach: (id: string) => post<{ started: boolean }>(`/api/v1/assets/${encodeURIComponent(id)}/simulate-breach`),
  demoReset: (id: string) => post<{ ok: boolean }>(`/api/v1/assets/${encodeURIComponent(id)}/demo-reset`),

  incidents: (status: 'open' | 'resolved' | 'all' = 'all', limit = 200) =>
    request<Incident[]>(`/api/v1/incidents?status=${status}&limit=${limit}`),
  incident: (id: string) => request<Incident>(`/api/v1/incidents/${encodeURIComponent(id)}`),
  acknowledge: (id: string) => post<Incident>(`/api/v1/incidents/${encodeURIComponent(id)}/acknowledge`),
  assign: (id: string, userId: string) => post<Incident>(`/api/v1/incidents/${encodeURIComponent(id)}/assign`, { user_id: userId }),
  note: (id: string, message: string) => post<Incident>(`/api/v1/incidents/${encodeURIComponent(id)}/notes`, { message }),
  dispatch: (id: string, note?: string) => post<Incident>(`/api/v1/incidents/${encodeURIComponent(id)}/dispatch`, { note }),
  resolve: (id: string, resolution: Resolution, note?: string) =>
    post<Incident>(`/api/v1/incidents/${encodeURIComponent(id)}/resolve`, { resolution, note }),
  assignable: () => request<{ id: string; name: string; role: string; region: string | null }[]>('/api/v1/users/assignable'),

  relocations: () => request<Relocation[]>('/api/v1/relocations'),
  requestRelocation: (body: { asset_id: string; reason: string; to_retailer_id?: string; hours: number; start?: string }) =>
    post<Relocation>('/api/v1/relocations', body),
  decideRelocation: (id: string, approve: boolean) => post<Relocation>(`/api/v1/relocations/${encodeURIComponent(id)}/decision`, { approve }),

  importRegister: (csv: string, dryRun: boolean) => post<ImportResult>('/api/v1/register/import', { csv, dry_run: dryRun }),
  registerTemplateUrl: `${API_BASE}/api/v1/register/template.csv`,
  incidentsCsvUrl: (days: number) => `${API_BASE}/api/v1/incidents/export.csv?days=${days}`,

  users: () => request<UserRecord[]>('/api/v1/users'),
  createUser: (body: { email: string; name: string; role: string; region?: string | null; phone?: string | null; password: string }) =>
    post<UserRecord>('/api/v1/users', body),
  updateUser: (id: string, patch: Partial<{ name: string; role: string; region: string | null; phone: string | null; active: boolean; password: string }>) =>
    request<UserRecord>(`/api/v1/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  audit: (limit = 200) => request<AuditRow[]>(`/api/v1/audit?limit=${limit}`),
  notifications: (limit = 100) => request<NotificationRow[]>(`/api/v1/notifications?limit=${limit}`),
  report: (days: number) => request<{ days: number; since: string; regions: RegionReport[] }>(`/api/v1/reports/summary?days=${days}`),
};
