import { useState } from 'react';
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

export function App() {
  const {
    fleet,
    alerts,
    kpiCounts,
    flashingRowId,
    toastMessage,
    triggerToast,
    simulateTestBreach,
  } = useTelemetryFeed();

  const [selectedCooler, setSelectedCooler] = useState<CoolerAsset | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const displayedFleet = fleet.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.id.toLowerCase().includes(q) ||
      item.retailer.toLowerCase().includes(q) ||
      item.locationName.toLowerCase().includes(q)
    );
  });

  const handleSelectCoolerId = (assetId: string) => {
    const found = fleet.find((c) => c.id === assetId);
    if (found) {
      setSelectedCooler(found);
    } else {
      triggerToast('Asset Selected', `Opening telemetry inspector for ${assetId}...`, 'info');
    }
  };

  const handleDispatchResponse = (assetId: string) => {
    triggerToast(
      'Rapid Response Dispatched',
      `Delta Asset Protection & Security team routed to intercept ${assetId}. Estimated arrival: 12 mins.`,
      'critical'
    );
  };

  const handleLockout = (assetId: string) => {
    triggerToast(
      'Remote Immobilization Active',
      `Firmware cryptographic lockout commanded for ${assetId}. Compressor feed disabled (0V).`,
      'info'
    );
  };

  const handleCallMerchant = (assetId: string) => {
    triggerToast(
      'Merchant Dialing',
      `Connecting to authorized retailer store contact for ${assetId}...`,
      'info'
    );
  };

  const handleExportCsv = () => {
    triggerToast(
      'Export Generated',
      `Telemetry audit log across 1,420 assets generated. Downloading CSV...`,
      'success'
    );
  };

  const handleProvisionClick = () => {
    triggerToast(
      'Provisioning Wizard Active',
      `BLE Scanner ready. Connect to Phone A Beacon Node for cryptographic enrollment.`,
      'info'
    );
  };

  return (
    <div className="bg-[#faf8ff] min-h-screen flex flex-col font-sans text-[#131b2e]">
      {/* 1. Header Bar */}
      <HeaderBar
        onSearchChange={setSearchQuery}
        onSimulateBreach={simulateTestBreach}
        activeCoolersCount={kpiCounts.totalTracked}
      />

      {/* Main Content Area */}
      <main className="w-full pt-16 flex-1 flex flex-col">
        {/* 2. Sub-Header & Controls Bar */}
        <SubHeaderBar
          onExportCsv={handleExportCsv}
          onProvisionClick={handleProvisionClick}
        />

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
            {/* Left 8 Cols: Map */}
            <div className="xl:col-span-8">
              <FleetMap
                fleet={displayedFleet}
                onSelectCooler={setSelectedCooler}
                selectedCooler={selectedCooler}
              />
            </div>

            {/* Right 4 Cols: AI Risk Radar Panel */}
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
            onSelectCooler={setSelectedCooler}
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
              Telemetry Engine: <strong className="text-[#131b2e] font-semibold">v4.18.2-prod</strong>
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">
              Broker: <strong className="text-[#131b2e] font-semibold">aws.af-south-1.iot</strong>
            </span>
            <span className="hidden md:inline">•</span>
            <span className="hidden md:inline">
              Connected Fleets: <strong className="text-[#131b2e] font-semibold">1,420 Active Assets</strong>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0062a1] animate-pulse"></span>
              <span>Real-Time Ingest Active</span>
            </span>
            <span>© 2026 Delta Beverages Operations Ltd.</span>
          </div>
        </div>
      </footer>

      {/* Risk Detail Inspector Modal */}
      {selectedCooler && (
        <RiskDetailInspectorModal
          cooler={selectedCooler}
          onClose={() => setSelectedCooler(null)}
          onActionFeedback={(msg) => triggerToast('Action Acknowledged', msg, 'info')}
        />
      )}

      {/* Floating Toast Notification */}
      <ToastNotification
        toast={toastMessage}
        onDismiss={() => triggerToast('', '', 'info')}
      />
    </div>
  );
}

export default App;
