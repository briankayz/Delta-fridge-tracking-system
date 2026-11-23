import * as Location from 'expo-location';
import { haversineM } from './geo';

export type Fix = { lat: number; lng: number; accuracy: number | null };

/** Best-effort current position; null if permission is refused or no fix within the timeout. */
export async function currentFix(timeoutMs = 8000): Promise<Fix | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000 }).catch(() => null);
    const fresh = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((r) => setTimeout(() => r(null), timeoutMs)),
    ]).catch(() => null);
    const p = fresh ?? last;
    return p ? { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? null } : null;
  } catch {
    return null;
  }
}

export function distanceLabel(from: Fix | null, lat: number | null | undefined, lng: number | null | undefined): string | null {
  if (!from || lat == null || lng == null) return null;
  const m = haversineM(from.lat, from.lng, lat, lng);
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export function distanceM(from: Fix | null, lat: number | null | undefined, lng: number | null | undefined): number {
  if (!from || lat == null || lng == null) return Number.POSITIVE_INFINITY;
  return haversineM(from.lat, from.lng, lat, lng);
}

export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} days ago`;
}
