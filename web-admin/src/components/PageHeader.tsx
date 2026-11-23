import React from 'react';
import { Download, Plus } from 'lucide-react';
import { Button } from './ui';

interface PageHeaderProps {
  liveCount: number;
  lastUpdate: string;
  onExportCsv: () => void;
  onProvisionClick: () => void;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ liveCount, lastUpdate, onExportCsv, onProvisionClick }) => (
  <div id="overview" className="flex flex-col md:flex-row md:items-end justify-between gap-4">
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-gold-700">Harare operations</div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Fleet command centre</h1>
      <p className="mt-1 text-sm text-slate-500">
        Cooler location, power and theft risk across the Harare trade fleet ·{' '}
        <span className="tabular">{liveCount}</span> beacons reporting live · updated {lastUpdate}
      </p>
    </div>
    <div className="flex items-center gap-2">
      <Button icon={Download} onClick={onExportCsv}>
        Export CSV
      </Button>
      <Button variant="primary" icon={Plus} onClick={onProvisionClick}>
        Provision beacon
      </Button>
    </div>
  </div>
);
