const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Great-circle distance in metres. */
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** Point reached travelling `distanceM` from (lat, lng) on `bearingDeg`. */
export function destinationPoint(lat: number, lng: number, bearingDeg: number, distanceM: number) {
  const δ = distanceM / EARTH_RADIUS_M;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(lat);
  const λ1 = toRad(lng);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: toDeg(φ2), lng: toDeg(λ2) };
}

/** Approximate Harare suburb centroids, used to label positions for operators. */
const HARARE_PLACES: { name: string; lat: number; lng: number }[] = [
  { name: 'Avondale', lat: -17.795, lng: 31.038 },
  { name: 'Borrowdale', lat: -17.754, lng: 31.085 },
  { name: 'Mount Pleasant', lat: -17.77, lng: 31.045 },
  { name: 'Marlborough', lat: -17.755, lng: 31.02 },
  { name: 'Harare CBD', lat: -17.8292, lng: 31.0522 },
  { name: 'Milton Park', lat: -17.816, lng: 31.03 },
  { name: 'Belvedere', lat: -17.827, lng: 31.015 },
  { name: 'Eastlea', lat: -17.823, lng: 31.075 },
  { name: 'Greendale', lat: -17.813, lng: 31.1 },
  { name: 'Tafara', lat: -17.81, lng: 31.15 },
  { name: 'Mbare', lat: -17.858, lng: 31.04 },
  { name: 'Highfield', lat: -17.878, lng: 30.997 },
];

export function nearestPlace(lat: number, lng: number): string {
  let best = HARARE_PLACES[0];
  let bestD = Infinity;
  for (const p of HARARE_PLACES) {
    const d = haversineM(lat, lng, p.lat, p.lng);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return bestD > 15_000 ? 'Outside Harare Metro' : best.name;
}

export function bearingText(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}
