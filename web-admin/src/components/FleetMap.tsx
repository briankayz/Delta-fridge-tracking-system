import React, { useEffect, useMemo, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Map as MapIcon, Maximize2, ShieldAlert, Unplug } from 'lucide-react';
import { CoolerAsset } from '../types';
import { Card, CardHeader, Segmented, StatusBadge, cx } from './ui';

interface FleetMapProps {
  fleet: CoolerAsset[];
  onSelectCooler: (cooler: CoolerAsset) => void;
}

// ---- Basemaps (all keyless). CARTO now watermarks unauthenticated tiles: do not use. ----
type MapLayer = 'light' | 'streets' | 'satellite';
const TILE_LAYERS: Record<MapLayer, { url: string; attribution: string; maxZoom: number }> = {
  light: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
    maxZoom: 16,
  },
  streets: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
};

const HARARE_CENTER: [number, number] = [-17.82485, 31.05303];

// ---- Markers --------------------------------------------------------------------------
// Reuse DivIcon instances: a new object per render makes Leaflet rebuild the marker DOM.
const ICON_CACHE = new Map<string, L.DivIcon>();
function cachedIcon(key: string, make: () => L.DivIcon): L.DivIcon {
  let icon = ICON_CACHE.get(key);
  if (!icon) {
    icon = make();
    if (ICON_CACHE.size > 500) ICON_CACHE.clear();
    ICON_CACHE.set(key, icon);
  }
  return icon;
}

const svg = (el: React.ReactElement) => renderToStaticMarkup(el);

const nominalIcon = () =>
  L.divIcon({
    className: 'dag-marker',
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:#123965;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,.35)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

const warningIcon = () =>
  L.divIcon({
    className: 'dag-marker',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:#D97706;border:2px solid #fff;box-shadow:0 2px 6px rgba(15,23,42,.3);color:#fff">${svg(
      <Unplug size={14} strokeWidth={2.5} />
    )}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

const breachIcon = (speed: string) =>
  L.divIcon({
    className: 'dag-marker',
    html: `<div style="position:relative;display:flex;flex-direction:column;align-items:center">
      <span class="dag-halo" style="position:absolute;top:-6px;width:44px;height:44px;border-radius:9999px;background:rgba(220,38,38,.35)"></span>
      <span style="position:relative;display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9999px;background:#DC2626;border:2.5px solid #fff;box-shadow:0 4px 10px rgba(220,38,38,.45);color:#fff">${svg(
        <ShieldAlert size={16} strokeWidth={2.5} />
      )}</span>
      <span style="margin-top:3px;padding:1px 6px;border-radius:4px;background:#fff;border:1px solid #FECACA;font:600 10px/16px Inter,sans-serif;color:#B91C1C;white-space:nowrap;box-shadow:0 1px 3px rgba(15,23,42,.15)">${speed}</span>
    </div>`,
    iconSize: [60, 56],
    iconAnchor: [30, 16],
  });

function iconFor(c: CoolerAsset): L.DivIcon {
  if (c.status === 'critical') {
    const speed = `${c.speedKmh.toFixed(0)} km/h`;
    return cachedIcon(`crit:${speed}`, () => breachIcon(speed));
  }
  if (!c.online) return cachedIcon('offline', offlineIcon);
  if (c.status === 'warning' || c.isPowerCut) return cachedIcon('warn', warningIcon);
  return cachedIcon('ok', nominalIcon);
}

const offlineIcon = () =>
  L.divIcon({
    className: 'dag-marker',
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:#94A3B8;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,.35)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

// ---- Map helpers ----------------------------------------------------------------------

function FitFleet({ fleet, trigger }: { fleet: CoolerAsset[]; trigger: number }) {
  const map = useMap();
  useEffect(() => {
    if (trigger === 0) return;
    const pts = fleet.map((c) => [c.lat, c.lng] as [number, number]);
    if (pts.length > 0) map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [40, 64], paddingBottomRight: [40, 40], maxZoom: 14 });
    // fleet intentionally excluded: only refit when the user asks
  }, [trigger, map]);
  return null;
}

// ---- Component ------------------------------------------------------------------------

export const FleetMap: React.FC<FleetMapProps> = ({ fleet, onSelectCooler }) => {
  const [showGeofences, setShowGeofences] = useState(true);
  const [layer, setLayer] = useState<MapLayer>('light');
  const [fitTrigger, setFitTrigger] = useState(0);
  // Narrow screens show less of Harare at the default zoom: fit the whole fleet once it loads.
  const hasFleet = fleet.length > 0;
  useEffect(() => {
    if (hasFleet && window.innerWidth < 1024) setFitTrigger((n) => (n === 0 ? 1 : n));
  }, [hasFleet]);

  const critical = fleet.filter((c) => c.status === 'critical');
  const counts = useMemo(
    () => ({
      secure: fleet.filter((c) => c.online && c.status === 'nominal' && !c.isPowerCut).length,
      power: fleet.filter((c) => c.online && c.status !== 'critical' && (c.status === 'warning' || c.isPowerCut)).length,
      offline: fleet.filter((c) => !c.online && c.status !== 'critical').length,
      critical: critical.length,
    }),
    [fleet, critical.length]
  );
  const lead = critical[0];

  return (
    <Card id="live-map" className="overflow-hidden flex flex-col">
      <CardHeader
        title="Live map"
        icon={MapIcon}
        subtitle={`Harare metro · ${fleet.length} live beacons`}
        actions={
          <>
            <Segmented<MapLayer>
              label="Basemap"
              value={layer}
              onChange={setLayer}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'streets', label: 'Streets' },
                { value: 'satellite', label: 'Satellite' },
              ]}
            />
            <label className="inline-flex items-center gap-2 h-7 px-2.5 rounded-md ring-1 ring-inset ring-slate-200 text-xs font-medium text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showGeofences}
                onChange={(e) => setShowGeofences(e.target.checked)}
                className="h-3.5 w-3.5 accent-delta-700"
              />
              Geofences
            </label>
          </>
        }
      />

      {/* `isolate` contains Leaflet's internal z-indexes (400+) so overlays/modals stay on top */}
      <div className="relative isolate w-full h-[380px] sm:h-[480px] lg:h-[560px]">
        <MapContainer center={HARARE_CENTER} zoom={12} scrollWheelZoom style={{ width: '100%', height: '100%' }}>
          <TileLayer key={layer} {...TILE_LAYERS[layer]} />
          <FitFleet fleet={fleet} trigger={fitTrigger} />

          {/* Geofences at true radius around each store anchor */}
          {showGeofences &&
            fleet.map(
              (c) =>
                c.routeOrigin && (
                  <Circle
                    key={`fence-${c.id}`}
                    center={[c.routeOrigin.lat, c.routeOrigin.lng]}
                    radius={c.geofenceRadiusM}
                    pathOptions={{
                      color: c.status === 'critical' ? '#DC2626' : '#123965',
                      fillColor: c.status === 'critical' ? '#DC2626' : '#123965',
                      fillOpacity: 0.12,
                      dashArray: '4,4',
                      weight: 1.5,
                    }}
                  />
                )
            )}

          {/* Breach trails: store anchor -> every reported fix since the incident opened */}
          {critical.map((c) => {
            const path: [number, number][] =
              c.trail.length > 1
                ? c.trail
                : c.routeOrigin
                ? [
                    [c.routeOrigin.lat, c.routeOrigin.lng],
                    [c.lat, c.lng],
                  ]
                : [];
            return path.length > 1 ? (
              <Polyline key={`trail-${c.id}`} positions={path} pathOptions={{ color: '#DC2626', weight: 3, dashArray: '6,6' }} />
            ) : null;
          })}

          {fleet.map((c) => (
            <Marker key={c.id} position={[c.lat, c.lng]} icon={iconFor(c)} eventHandlers={{ click: () => onSelectCooler(c) }}>
              <Popup>
                <div className="w-56">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[13px] text-slate-900">{c.id}</span>
                    <StatusBadge severity={c.status} label={c.statusLabel} />
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-700">{c.retailer}</div>
                  <div className="text-xs text-slate-500">{c.locationName}</div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-slate-500">Risk</dt>
                    <dd className="text-right font-medium tabular">{c.riskScore}%</dd>
                    <dt className="text-slate-500">Speed</dt>
                    <dd className="text-right font-medium tabular">{c.speedKmh.toFixed(1)} km/h</dd>
                    <dt className="text-slate-500">Cabinet</dt>
                    <dd className="text-right font-medium tabular">{c.internalTemp != null ? `${c.internalTemp.toFixed(1)}°C` : '—'}</dd>
                    <dt className="text-slate-500">Power</dt>
                    <dd className="text-right font-medium">{!c.lastSeen ? '—' : c.isPowerCut ? `Battery ${Math.round(c.batteryPct ?? 0)}%` : 'Mains'}</dd>
                  </dl>
                  <button
                    type="button"
                    onClick={() => onSelectCooler(c)}
                    className="mt-3 w-full h-8 rounded-md bg-delta-700 hover:bg-delta-800 text-white text-xs font-medium"
                  >
                    Open risk inspector
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Legend (counts are live beacons on this map) */}
        <div className="hidden sm:block absolute left-3 bottom-7 z-[500] rounded-md bg-white/95 backdrop-blur shadow-pop ring-1 ring-line px-3 py-2 text-xs text-slate-700 space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-delta-700 ring-2 ring-white shadow" />
            Secure <span className="ml-auto pl-3 tabular text-slate-500">{counts.secure}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-600 ring-2 ring-white shadow" />
            Power / warning <span className="ml-auto pl-3 tabular text-slate-500">{counts.power}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-slate-400 ring-2 ring-white shadow" />
            Offline <span className="ml-auto pl-3 tabular text-slate-500">{counts.offline}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-600 ring-2 ring-white shadow" />
            Theft / displacement <span className="ml-auto pl-3 tabular text-slate-500">{counts.critical}</span>
          </div>
        </div>

        {/* Fit to fleet */}
        <button
          type="button"
          onClick={() => setFitTrigger((n) => n + 1)}
          className="absolute right-3 bottom-8 z-[500] inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-white shadow-pop ring-1 ring-line text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          Fit fleet
        </button>

        {/* Highest-risk active breach */}
        {lead && (
          <button
            type="button"
            onClick={() => onSelectCooler(lead)}
            className={cx(
              'absolute top-3 right-3 left-14 sm:left-auto z-[500] flex items-center gap-2 rounded-md bg-white/95 backdrop-blur shadow-pop ring-1 ring-red-200 px-3 py-2 text-left hover:bg-white'
            )}
          >
            <ShieldAlert className="h-4 w-4 text-red-600" aria-hidden="true" />
            <span className="text-xs">
              <span className="font-semibold text-slate-900">{lead.id}</span>
              <span className="text-slate-500">
                {' '}
                · {(lead.displacementM / 1000).toFixed(1)} km from store · {lead.speedKmh.toFixed(0)} km/h
              </span>
            </span>
          </button>
        )}
      </div>
      {/* Phones: legend below the map so it never covers markers */}
      <div className="sm:hidden flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line px-4 py-2.5 text-xs text-slate-700">
        {[
          ['bg-delta-700', 'Secure', counts.secure],
          ['bg-amber-600', 'Power', counts.power],
          ['bg-slate-400', 'Offline', counts.offline],
          ['bg-red-600', 'Theft', counts.critical],
        ].map(([dot, label, n]) => (
          <span key={label as string} className="inline-flex items-center gap-1.5">
            <span className={cx('w-2.5 h-2.5 rounded-full', dot as string)} />
            {label} <span className="tabular text-slate-500">{n}</span>
          </span>
        ))}
      </div>
    </Card>
  );
};
