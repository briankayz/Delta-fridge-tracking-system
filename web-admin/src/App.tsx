import { useEffect, useState } from 'react';
import { CloudOff } from 'lucide-react';
import { timeAgo, useTelemetryFeed } from './services/useTelemetryFeed';
import { Sidebar, NAV_ITEMS, NavId } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { PageHeader } from './components/PageHeader';
import { KpiSummaryStrip } from './components/KpiSummaryStrip';
import { FleetMap } from './components/FleetMap';
import { IncidentQueue } from './components/IncidentQueue';
import { FleetHealthPanel } from './components/FleetHealthPanel';
import { AssetRegister } from './components/AssetRegister';
import { RiskDetailInspectorModal } from './components/RiskDetailInspectorModal';
import { ToastNotification } from './components/ToastNotification';
import { CoolerAsset } from './types';
import { API_BASE } from './services/api';

/** Highlights the sidebar item for the section currently in view. */
function useScrollSpy(): NavId {
  const [active, setActive] = useState<NavId>('overview');
  useEffect(() => {
    // Callbacks only report sections whose visibility changed, so keep the full visible set.
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id)));
        const first = NAV_ITEMS.find(({ id }) => visible.has(id));
        if (first) setActive(first.id);
      },
      { rootMargin: '-80px 0px -55% 0px' }
    );
    NAV_ITEMS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);
  return active;
}

export function App() {
  const {
    fleet,
    alerts,
    kpiCounts,
    flashingRowId,
    connection,
    toastMessage,
    triggerToast,
    dismissToast,
    inspectRequest,
    simulateBreach,
    resetAsset,
    now,
  } = useTelemetryFeed();

  // Store only the id: the inspector always renders the latest live state of that cooler.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const selectedCooler = fleet.find((c) => c.id === selectedId) ?? null;
  const activeNav = useScrollSpy();

  // A newly opened incident pops the Risk Inspector for that asset.
  useEffect(() => {
    if (inspectRequest) setSelectedId(inspectRequest.id);
  }, [inspectRequest]);

  const selectCooler = (cooler: CoolerAsset) => setSelectedId(cooler.id);

  const displayedFleet = fleet.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.id.toLowerCase().includes(q) ||
      item.retailer.toLowerCase().includes(q) ||
      item.locationName.toLowerCase().includes(q) ||
      (item.imei ?? '').includes(q)
    );
  });

  const openById = (assetId: string) => {
    if (fleet.some((c) => c.id === assetId)) setSelectedId(assetId);
    else triggerToast('Asset not tracked', `${assetId} is not reporting to this console.`, 'info');
  };

  const handleDispatch = (assetId: string) => {
    triggerToast(
      'Recovery team notified',
      `Asset Protection has been asked to intercept ${assetId}. (Prototype: no dispatch system is connected yet.)`,
      'critical'
    );
  };

  const handleCallRetailer = (assetId: string) => {
    const retailer = fleet.find((c) => c.id === assetId)?.retailer ?? 'the retailer';
    triggerToast('Call retailer', `Contact ${retailer} about ${assetId}. (Prototype: retailer contact numbers are not stored yet.)`, 'info');
  };

  const handleExportCsv = () => {
    const header = 'asset_id,retailer,status,risk_pct,lat,lng,speed_kmh,power,battery_pct,temp_c,last_seen';
    const rows = fleet.map((c) =>
      [c.id, `"${c.retailer}"`, c.status, c.riskScore, c.lat, c.lng, c.speedKmh, `"${c.powerSource}"`, c.batteryPct, c.internalTemp, c.lastSeen ?? ''].join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `delta-asset-register-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    triggerToast('Export ready', `${fleet.length} live beacons exported to CSV.`, 'success');
  };

  const handleProvisionClick = () => {
    triggerToast(
      'Provision a beacon',
      `Open the Beacon app on the phone in the cooler and tap "Lock & Start". It registers with ${API_BASE.replace(/^https?:\/\//, '')}.`,
      'info'
    );
  };

  const openAlerts = alerts.filter((a) => a.severity !== 'resolved');
  const openIncidents = openAlerts.filter((a) => a.severity === 'critical').length;
  const liveReporting = fleet.filter((c) => c.lastSeen && now - Date.parse(c.lastSeen) < 60_000).length;
  const newest = fleet.reduce<string | null>((m, c) => (c.lastSeen && (!m || c.lastSeen > m) ? c.lastSeen : m), null);

  return (
    <div className="min-h-screen bg-canvas text-slate-900">
      <Sidebar active={activeNav} incidentCount={openIncidents} connection={connection} apiHost={API_BASE} />

      <div className="lg:pl-60 flex flex-col min-h-screen">
        <TopBar
          onSearchChange={setSearchQuery}
          onSimulateBreach={() => simulateBreach()}
          connection={connection}
          alertCount={openAlerts.length}
        />

        <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
          {connection !== 'live' && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <CloudOff className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
              <div>
                <div className="font-medium">
                  {connection === 'connecting' ? 'Connecting to telemetry service…' : 'Telemetry service unreachable, retrying'}
                </div>
                <div className="text-amber-800">
                  Expected at <code className="font-mono">{API_BASE}</code>. Start it with{' '}
                  <code className="font-mono">cd backend && npm run dev</code>.
                </div>
              </div>
            </div>
          )}

          <PageHeader
            liveCount={liveReporting}
            lastUpdate={newest ? timeAgo(newest, now).toLowerCase() : 'never'}
            onExportCsv={handleExportCsv}
            onProvisionClick={handleProvisionClick}
          />

          <KpiSummaryStrip
            totalTracked={kpiCounts.totalTracked}
            activeCompliant={kpiCounts.activeCompliant}
            powerOutages={kpiCounts.powerOutages}
            anomalyAlerts={kpiCounts.anomalyAlerts}
            liveReporting={liveReporting}
            liveTotal={fleet.length}
            openIncidents={openIncidents}
          />

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            <div className="xl:col-span-8 min-w-0">
              <FleetMap fleet={displayedFleet} onSelectCooler={selectCooler} />
            </div>
            <div className="xl:col-span-4 min-w-0 space-y-6">
              <IncidentQueue alerts={alerts} onOpen={openById} onDispatch={handleDispatch} onCallRetailer={handleCallRetailer} />
              <FleetHealthPanel fleet={fleet} now={now} />
            </div>
          </div>

          <AssetRegister fleet={displayedFleet} onSelectCooler={selectCooler} flashingRowId={flashingRowId} />
        </main>

        <footer className="border-t border-line bg-white px-6 py-3 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span>Delta Asset Guard · prototype for Delta Beverages, Harare</span>
          <span>© {new Date().getFullYear()} Delta Corporation Limited</span>
        </footer>
      </div>

      {selectedCooler && (
        <RiskDetailInspectorModal
          cooler={selectedCooler}
          now={now}
          onClose={() => setSelectedId(null)}
          onActionFeedback={(msg) => triggerToast('Action logged', msg, 'info')}
          onAuthorizeMove={(id) => resetAsset(id, 'authorized')}
          onDispatch={handleDispatch}
          onCallRetailer={handleCallRetailer}
        />
      )}

      <ToastNotification toast={toastMessage} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
