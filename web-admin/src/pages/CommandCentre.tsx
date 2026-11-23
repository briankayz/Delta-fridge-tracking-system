import React, { useMemo } from 'react';
import { CloudOff } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { KpiSummaryStrip } from '../components/KpiSummaryStrip';
import { FleetMap } from '../components/FleetMap';
import { IncidentQueue } from '../components/IncidentQueue';
import { FleetHealthPanel } from '../components/FleetHealthPanel';
import { useAuth } from '../services/auth';
import { timeAgo } from '../services/useTelemetryFeed';
import { matches, PageProps } from './shared';

export const CommandCentre: React.FC<PageProps> = ({ feed, search, inspect }) => {
  const { user, meta } = useAuth();
  const { fleet, incidents, summary, connection, now } = feed;
  const shown = fleet.filter((c) => matches(c, search));
  const fleetById = useMemo(() => Object.fromEntries(fleet.map((c) => [c.id, c])), [fleet]);
  const newest = fleet.reduce<string | null>((m, c) => (c.lastSeen && (!m || c.lastSeen > m) ? c.lastSeen : m), null);

  return (
    <div className="space-y-6">
      {connection !== 'live' && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <CloudOff className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <div className="font-medium">{connection === 'connecting' ? 'Connecting to live telemetry…' : 'Live telemetry unavailable, retrying'}</div>
            <div className="text-amber-800">Figures below may be out of date until the connection returns.</div>
          </div>
        </div>
      )}

      <PageHeader
        kicker={user?.region ?? 'All regions'}
        title="Fleet command centre"
        description={
          <>
            Location, power and theft risk for every registered cooler · last report {newest ? timeAgo(newest, now).toLowerCase() : 'none yet'}
          </>
        }
      />

      <KpiSummaryStrip summary={summary} />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 min-w-0">
          <FleetMap fleet={shown} onSelectCooler={(c) => inspect(c.id)} />
        </div>
        <div className="xl:col-span-4 min-w-0 space-y-6">
          <IncidentQueue incidents={incidents} fleetById={fleetById} now={now} onInspect={inspect} />
          <FleetHealthPanel fleet={fleet} offlineAfterMin={meta?.offline_after_min ?? 15} />
        </div>
      </div>
    </div>
  );
};
