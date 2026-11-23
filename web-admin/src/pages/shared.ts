import { Feed } from '../services/useTelemetryFeed';
import { CoolerAsset } from '../types';

export interface PageProps {
  feed: Feed;
  /** Global search box text. */
  search: string;
  /** Opens the Risk Inspector for a cooler. */
  inspect: (assetId: string) => void;
}

export function matches(c: CoolerAsset, q: string): boolean {
  if (!q) return true;
  const s = q.toLowerCase();
  return [c.id, c.retailer, c.locationName, c.region, c.coolerSerial ?? '', c.imei ?? ''].some((v) => v.toLowerCase().includes(s));
}
