import { useEffect, useState } from 'react';
import { useTelemetryFeed } from './services/useTelemetryFeed';
import { HeaderBar } from './components/HeaderBar';
import { SubHeaderBar } from './components/SubHeaderBar';
import { KpiSummaryStrip } from './components/KpiSummaryStrip';
import { FleetMap } from './components/FleetMap';
import { AiRiskRadarPanel } from './components/AiRiskRadarPanel';
import { TelemetryIngestTable } from './components/TelemetryIngestTable';
import { RiskDetailInspectorModal } from './components/RiskDetailInspectorModal';
import { ToastNotification } from './components/ToastNotification';
import { CoolerAsset } from './types';
import { API_BASE } from './services/api';

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

  const handleSelectCoolerId = (assetId: string) => {
    if (fleet.some((c) => c.id === assetId)) {
      setSelectedId(assetId);
    } else {
      triggerToast('Asset not tracked', `${assetId} is not reporting to this console.`, 'info');
    }
  };

  const handleDispatchResponse = (assetId: string) => {
    triggerToast(
      'Rapid Response Dispatched',
      `Delta Asset Protection & Security team routed to intercept ${assetId}.`,
      'critical'
    );
  };

  const handleLockout = (assetId: string) => {
    triggerToast(
      'Remote Immobilization Requested',
      `Lockout command queued for ${assetId}. (Prototype: no firmware command channel yet.)`,
      'info'
    );
  };

  const handleCallMerchant = (assetId: string) => {
    const retailer = fleet.find((c) => c.id === assetId)?.retailer ?? 'retailer';
    triggerToast('Merchant Dialing', `Connecting to ${retailer} for ${assetId}...`, 'info');
  };

  const handleExportCsv = () => {
    const header = 'asset_id,retailer,status,risk_pct,lat,lng,speed_kmh,power,battery_pct,temp_c,last_seen';
    const rows = fleet.map((c) =>
      [c.id, `"${c.retailer}"`, c.status, c.riskScore, c.lat, c.lng, c.speedKmh, `"${c.powerSource}"`, c.batteryPct, c.internalTemp, c.lastSeen ?? '']
        .join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `delta-telemetry-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    triggerToast('Export Generated', `${fleet.length} tracked assets exported to CSV.`, 'success');
  };

  const handleProvisionClick = () => {
    triggerToast(
      'Provisioning',
      `Open the Beacon app on Phone A and tap "Lock & Start Sentinel Tracker" to enrol it with ${API_BASE}.`,
      'info'
    );
  };

  const openAlertCount = alerts.filter((a) => a.severity !== 'resolved').length;

  return (
    <div className="bg-[#faf8ff] min-h-screen flex flex-col font-sans text-[#131b2e]">
      {/* 1. Header Bar */}
      <HeaderBar
        onSearchChange={setSearchQuery}
        onSimulateBreach={() => simulateBreach()}
        activeCoolersCount={kpiCounts.totalTracked}
        connection={connection}
        alertCount={openAlertCount}
      />

      {/* Main Content Area */}
      <main className="w-full pt-16 flex-1 flex flex-col">
        {/* 2. Sub-Header & Controls Bar */}
        <SubHeaderBar
          onExportCsv={handleExportCsv}
          onProvisionClick={handleProvisionClick}
        />

        {connection !== 'live' && (
          <div className="w-full max-w-[1600px] mx-auto px-6 pt-4">
            <div className="rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-4 py-2.5 text-[12px] text-[#735c00] flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">cloud_off</span>
              {connection === 'connecting' ? 'Connecting to telemetry backend' : 'Telemetry backend offline, retrying'} at{' '}
              <code className="font-mono">{API_BASE}</code>. Start it with <code className="font-mono">cd backend && npm run dev</code>.
            </div>
          </div>
        )}

        {/* 3. Main Container Restricted Max-Width */}
        <div className="w-full max-w-[1600px] mx-auto px-6 py-6 flex flex-col gap-6">
          {/* KPI Summary Strip */}
          <KpiSummaryStrip
            totalTracked={kpiCounts.totalTracked}
            activeCompliant={kpiCounts.activeCompliant}
            powerOutages={kpiCounts.powerOutages}
            anomalyAlerts={kpiCounts.anomalyAlerts}
          />

          {/* Split View: Map (Left 8 cols) + AI Risk Radar (Right 4 cols) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            <div className="xl:col-span-8">
              <FleetMap
                fleet={displayedFleet}
                onSelectCooler={selectCooler}
                selectedCooler={selectedCooler}
                summary={kpiCounts}
              />
            </div>

            <div className="xl:col-span-4">
              <AiRiskRadarPanel
                alerts={alerts}
                onSelectCoolerId={handleSelectCoolerId}
                onDispatchResponse={handleDispatchResponse}
                onLockout={handleLockout}
                onCallMerchant={handleCallMerchant}
              />
            </div>
          </div>

          {/* Bottom Table: Telemetry Ingest Table */}
          <TelemetryIngestTable
            fleet={displayedFleet}
            onSelectCooler={selectCooler}
            flashingRowId={flashingRowId}
            onIntercept={(id) => {
              handleSelectCoolerId(id);
              handleDispatchResponse(id);
            }}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-[#f2f3ff] border-t border-[#eaedff] py-3 px-6 text-[#42474d] text-[11px]">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span>
              Telemetry API: <strong className="text-[#131b2e] font-semibold font-mono">{API_BASE}</strong>
            </span>
            <span className="hidden md:inline">•</span>
            <span className="hidden md:inline">
              Live-tracked beacons: <strong className="text-[#131b2e] font-semibold">{fleet.length}</strong>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  connection === 'live' ? 'bg-[#10B981] animate-pulse' : connection === 'connecting' ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'
                }`}
              ></span>
              <span>{connection === 'live' ? 'Real-Time Ingest Active' : connection === 'connecting' ? 'Connecting…' : 'Ingest Offline'}</span>
            </span>
            <span>© 2026 Delta Beverages Operations Ltd.</span>
          </div>
        </div>
      </footer>

      {/* Risk Detail Inspector Modal */}
      {selectedCooler && (
        <RiskDetailInspectorModal
          cooler={selectedCooler}
          now={now}
          onClose={() => setSelectedId(null)}
          onActionFeedback={(msg) => triggerToast('Action Acknowledged', msg, 'info')}
          onAuthorizeMove={(id) => resetAsset(id, 'authorized')}
          onDispatch={handleDispatchResponse}
          onCallRetailer={handleCallMerchant}
        />
      )}

      {/* Floating Toast Notification */}
      <ToastNotification toast={toastMessage} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
