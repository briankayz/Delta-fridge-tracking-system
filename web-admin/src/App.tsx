import { useEffect, useState } from 'react';
import { Loader2, ShieldOff } from 'lucide-react';
import { AuthProvider, useAuth } from './services/auth';
import { usePath, Link } from './services/router';
import { api } from './services/api';
import { DEMO_BEACON_ID, useTelemetryFeed } from './services/useTelemetryFeed';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { RiskDetailInspectorModal } from './components/RiskDetailInspectorModal';
import { ToastNotification } from './components/ToastNotification';
import { DeltaMark } from './components/ui';
import { LoginPage } from './pages/LoginPage';
import { CommandCentre } from './pages/CommandCentre';
import { IncidentsPage } from './pages/IncidentsPage';
import { RegisterPage } from './pages/RegisterPage';
import { RelocationsPage } from './pages/RelocationsPage';
import { ReportsPage } from './pages/ReportsPage';
import { AdminPage } from './pages/AdminPage';
import { PageProps } from './pages/shared';

function Shell() {
  const { can } = useAuth();
  const feed = useTelemetryFeed(true);
  const path = usePath();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // A new theft incident pops the Risk Inspector for that cooler.
  useEffect(() => {
    if (feed.inspectRequest) setSelectedId(feed.inspectRequest.id);
  }, [feed.inspectRequest]);

  const selected = feed.fleet.find((c) => c.id === selectedId) ?? null;
  const selectedIncident = selected?.incidentId ? feed.incidents.find((i) => i.id === selected.incidentId) ?? null : null;
  const openCount = feed.incidents.filter((i) => i.status !== 'resolved').length;
  const props: PageProps = { feed, search, inspect: setSelectedId };

  let page: JSX.Element;
  const incidentMatch = path.match(/^\/incidents(?:\/([^/]+))?$/);
  if (path === '/') page = <CommandCentre {...props} />;
  else if (incidentMatch) page = <IncidentsPage {...props} incidentId={incidentMatch[1] ? decodeURIComponent(incidentMatch[1]) : undefined} />;
  else if (path === '/register') page = <RegisterPage {...props} />;
  else if (path === '/relocations') page = <RelocationsPage {...props} />;
  else if (path === '/reports') page = <ReportsPage {...props} />;
  else if (path === '/admin' && can('audit:read')) page = <AdminPage {...props} />;
  else
    page = (
      <div className="py-24 text-center">
        <ShieldOff className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold text-slate-900">Page not available</h1>
        <p className="text-sm text-slate-500">It doesn’t exist or your role can’t open it.</p>
        <Link to="/" className="mt-4 inline-block text-sm font-medium text-delta-700 hover:underline">
          Back to the command centre
        </Link>
      </div>
    );

  return (
    <div className="min-h-screen bg-canvas text-slate-900">
      <Sidebar path={path} incidentCount={openCount} connection={feed.connection} />
      <div className="lg:pl-60 flex flex-col min-h-screen">
        <TopBar
          path={path}
          onSearchChange={setSearch}
          onSimulateBreach={() => void feed.run('Simulation', () => api.simulateBreach(DEMO_BEACON_ID))}
          connection={feed.connection}
          alertCount={openCount}
        />
        <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-6">{page}</main>
        <footer className="border-t border-line bg-white px-6 py-3 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span>Delta Asset Guard · Delta Beverages trade-asset protection</span>
          <span>© {new Date().getFullYear()} Delta Corporation Limited</span>
        </footer>
      </div>

      {selected && (
        <RiskDetailInspectorModal
          cooler={selected}
          incident={selectedIncident}
          now={feed.now}
          onClose={() => setSelectedId(null)}
          onIncidentChanged={feed.upsertIncident}
          run={feed.run}
        />
      )}
      <ToastNotification toast={feed.toastMessage} onDismiss={feed.dismissToast} />
    </div>
  );
}

function Gate() {
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-delta-900">
        <DeltaMark size={44} />
        <Loader2 className="h-5 w-5 animate-spin text-gold-300" aria-label="Loading" />
      </div>
    );
  }
  return status === 'signed-in' ? <Shell /> : <LoginPage />;
}

export function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

export default App;
