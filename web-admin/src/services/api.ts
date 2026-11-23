import { AssetState, Incident, TrailPoint } from '../types';

// Backend location. Override with VITE_API_URL (e.g. http://192.168.1.20:8787).
// Default: same host the dashboard was loaded from, port 8787 — so opening the dashboard
// from Phone B at http://<laptop-ip>:5173 automatically talks to http://<laptop-ip>:8787.
export const API_BASE: string = (
  import.meta.env.VITE_API_URL ?? `${window.location.protocol}//${window.location.hostname}:8787`
).replace(/\/$/, '');

export const WS_URL = `${API_BASE.replace(/^http/, 'ws')}/ws/telemetry`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getAsset: (id: string) =>
    request<{ asset: AssetState; history: TrailPoint[]; incident: Incident | null }>(
      `/api/v1/assets/${encodeURIComponent(id)}`,
    ),
  simulateBreach: (id: string) =>
    request<{ started: boolean }>(`/api/v1/assets/${encodeURIComponent(id)}/simulate-breach`, { method: 'POST', body: '{}' }),
  reset: (id: string, resolution: 'authorized' | 'reset' = 'reset') =>
    request<{ incident: Incident | null }>(`/api/v1/assets/${encodeURIComponent(id)}/reset`, {
      method: 'POST',
      body: JSON.stringify({ resolution }),
    }),
};
