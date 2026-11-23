import type { Asset, Incident } from './api/types';
import type { Tone } from './components/ui';
import { ago } from './services/location';
import { t } from './i18n';

/** Plain-language status for a cooler: one word + one sentence. */
export function assetStatus(a: Asset): { tone: Tone; title: string; detail: string } {
  const kinds = new Set(a.open_incidents.map((i) => i.kind));
  if (!a.provisioned && !a.last_seen) return { tone: 'offline', title: t.statusNotInstalled, detail: `Registered at ${a.retailer_name}.` };
  if (kinds.has('displacement') || a.risk.severity === 'critical') {
    const km = (a.distance_m / 1000).toFixed(1);
    return { tone: 'danger', title: t.statusMoved, detail: `${km} km from ${a.retailer_name}. The control room has been alerted.` };
  }
  if (a.relocation) return { tone: 'info', title: t.statusMoving, detail: 'This move was approved, so no alarm is raised.' };
  if (kinds.has('signal_lost') || !a.online) return { tone: 'offline', title: t.statusOffline, detail: `${t.lastReport} ${ago(a.last_seen)}.` };
  if (!a.mains_connected) {
    return { tone: 'warn', title: t.statusUnplugged, detail: `Power was cut ${ago(a.mains_off_since)}. Ask the store to plug it back in.` };
  }
  return { tone: 'safe', title: t.statusProtected, detail: t.statusProtectedHint };
}

export const KIND_TITLE: Record<Incident['kind'], string> = {
  displacement: t.kindDisplacement,
  power: t.kindPower,
  signal_lost: t.kindSignal,
};

export function minutesOpen(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h} h ${m % 60} min` : `${Math.floor(h / 24)} days`;
}
