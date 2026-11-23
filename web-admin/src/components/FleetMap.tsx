import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { CoolerAsset } from '../types';

interface FleetMapProps {
  fleet: CoolerAsset[];
  onSelectCooler: (cooler: CoolerAsset) => void;
  selectedCooler?: CoolerAsset | null;
  summary?: { activeCompliant: number; powerOutages: number; anomalyAlerts: number };
}

// Custom Leaflet Icons builder
const createClusterIcon = (count: number) => {
  return L.divIcon({
    className: 'custom-fleet-cluster',
    html: `
      <div style="
        width: 34px;
        height: 34px;
        border-radius: 9999px;
        background-color: rgba(21, 67, 99, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        cursor: pointer;
      ">
        <div style="
          width: 24px;
          height: 24px;
          border-radius: 9999px;
          background-color: #154363;
          color: #ffffff;
          font-weight: 700;
          font-size: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', sans-serif;
        ">
          ${count}
        </div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
};

const createWarningIcon = () => {
  return L.divIcon({
    className: 'custom-warning-marker',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; cursor: pointer;">
        <span style="position: absolute; width: 32px; height: 32px; border-radius: 9999px; background-color: rgba(115, 92, 0, 0.3); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
        <div style="width: 26px; height: 26px; border-radius: 9999px; background-color: #735c00; color: #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.15);">
          <span class="material-symbols-outlined" style="font-size: 15px;">power_off</span>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const createBreachIcon = (speedText: string) => {
  return L.divIcon({
    className: 'custom-breach-marker',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
          <span style="position: absolute; width: 44px; height: 44px; border-radius: 9999px; background-color: rgba(186, 26, 26, 0.35); animation: ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
          <div style="width: 30px; height: 30px; border-radius: 9999px; background-color: #ba1a1a; color: #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 12px rgba(186, 26, 26, 0.4); z-index: 10;">
            <span class="material-symbols-outlined" style="font-size: 18px;">fmd_bad</span>
          </div>
        </div>
        <div style="background-color: #ffffff; border: 1.5px solid #ba1a1a; padding: 2px 6px; border-radius: 6px; box-shadow: 0 4px 8px rgba(0,0,0,0.15); margin-top: -4px; white-space: nowrap; z-index: 20;">
          <span style="font-size: 9px; font-weight: 800; color: #ba1a1a; font-family: monospace; text-transform: uppercase;">BREACH: ${speedText}</span>
        </div>
      </div>
    `,
    iconSize: [44, 52],
    iconAnchor: [22, 26],
  });
};

// Reuse DivIcon instances: a new icon object on every render makes Leaflet rebuild the
// marker DOM (restarting the pulse animation) each time telemetry ticks.
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

// Keyless basemaps. CARTO basemaps now return an "API KEY REQUIRED" watermark
// tile for unauthenticated requests, so they must not be used here.
type MapLayer = 'vector' | 'satellite' | 'heatmap';
const TILE_LAYERS: Record<MapLayer, { url: string; attribution: string; maxZoom: number }> = {
  vector: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  heatmap: {
    // Muted light-gray canvas so red breach pins stand out
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
    maxZoom: 16,
  },
};

// Default Harare Metro coordinates (module scope: a stable reference)
const HARARE_CENTER: [number, number] = [-17.82485, 31.05303];

// Map center controller helper — only re-centres when the coordinates actually change
function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  const [lat, lng] = center;
  useEffect(() => {
    map.flyTo([lat, lng], 12, { duration: 1.2 });
  }, [lat, lng, map]);
  return null;
}

export const FleetMap: React.FC<FleetMapProps> = ({
  fleet,
  onSelectCooler,
  summary,
}) => {
  const [showGeofences, setShowGeofences] = useState(true);
  const [mapLayer, setMapLayer] = useState<MapLayer>('vector');
  const [searchFilter, setSearchFilter] = useState('');

  const criticalCoolers = fleet.filter((c) => c.status === 'critical');
  // Fleet is sorted by severity then risk, so this is the highest-risk active breach.
  const criticalCooler = criticalCoolers[0];

  const filteredFleet = fleet.filter((cooler) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (
      cooler.id.toLowerCase().includes(q) ||
      cooler.retailer.toLowerCase().includes(q) ||
      cooler.locationName.toLowerCase().includes(q)
    );
  });

  return (
    <section className="bg-white rounded-xl shadow-sm border border-[#eaedff] flex flex-col overflow-hidden">
      {/* Map Header Controls */}
      <div className="p-4 bg-white border-b border-[#eaedff] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#0062a1] animate-pulse"></span>
            <span className="text-[16px] font-bold text-[#131b2e]">
              Harare Metro Live Telemetry Grid
            </span>
          </div>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-[#eaedff] text-[#42474d] text-[11px] font-semibold">
            Cluster: ZW-HRE-01
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Layer Switchers */}
          <div className="inline-flex rounded-lg bg-[#f2f3ff] p-0.5 border border-[#eaedff]">
            <button
              onClick={() => setMapLayer('vector')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                mapLayer === 'vector'
                  ? 'bg-white text-[#154363] shadow-sm'
                  : 'text-[#42474d] hover:text-[#131b2e]'
              }`}
            >
              Fleet Vector
            </button>
            <button
              onClick={() => setMapLayer('satellite')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                mapLayer === 'satellite'
                  ? 'bg-white text-[#154363] shadow-sm'
                  : 'text-[#42474d] hover:text-[#131b2e]'
              }`}
            >
              Satellite
            </button>
            <button
              onClick={() => setMapLayer('heatmap')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                mapLayer === 'heatmap'
                  ? 'bg-white text-[#154363] shadow-sm'
                  : 'text-[#42474d] hover:text-[#131b2e]'
              }`}
            >
              Heatmap
            </button>
          </div>

          {/* Geofence Toggle */}
          <label className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#f2f3ff] cursor-pointer select-none border border-[#eaedff]">
            <input
              type="checkbox"
              checked={showGeofences}
              onChange={(e) => setShowGeofences(e.target.checked)}
              className="rounded text-[#154363] w-3.5 h-3.5 cursor-pointer accent-[#154363]"
            />
            <span className="text-[11px] text-[#131b2e] font-semibold">
              Geofence [{showGeofences ? 'ON' : 'OFF'}]
            </span>
          </label>
        </div>
      </div>

      {/* Legend Ribbon */}
      <div className="px-4 py-1.5 bg-[#f2f3ff] border-b border-[#eaedff] flex flex-wrap items-center justify-between gap-2 text-[#42474d] text-[11px]">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#154363]"></span>
            <span>Compliant ({(summary?.activeCompliant ?? 0).toLocaleString()})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#735c00]"></span>
            <span>Unplugged / Battery ({summary?.powerOutages ?? 0})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ba1a1a] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ba1a1a]"></span>
            </span>
            <span className="text-[#ba1a1a] font-bold">Breach / Displacement ({summary?.anomalyAlerts ?? 0})</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 text-[#42474d]">
          <span>
            Accuracy: <strong className="text-[#131b2e]">±2.5m</strong>
          </span>
          <span>•</span>
          <span>
            Cell Cadence: <strong className="text-[#131b2e]">5s</strong>
          </span>
        </div>
      </div>

      {/* Map Canvas */}
      {/* `isolate` contains Leaflet's internal z-indexes (400+) so overlays/modals stay on top */}
      <div className="relative isolate w-full h-[580px] overflow-hidden">
        <MapContainer
          center={HARARE_CENTER}
          zoom={12}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer key={mapLayer} {...TILE_LAYERS[mapLayer]} />

          {/* Recenter helper */}
          <MapRecenter center={HARARE_CENTER} />

          {/* Per-asset geofences, drawn at true radius around each store anchor */}
          {showGeofences &&
            filteredFleet.map(
              (cooler) =>
                cooler.routeOrigin && (
                  <Circle
                    key={`fence-${cooler.id}`}
                    center={[cooler.routeOrigin.lat, cooler.routeOrigin.lng]}
                    radius={cooler.geofenceRadiusM}
                    pathOptions={{
                      color: cooler.status === 'critical' ? '#ba1a1a' : '#315B7C',
                      fillColor: cooler.status === 'critical' ? '#ba1a1a' : '#315B7C',
                      fillOpacity: 0.15,
                      dashArray: '4,4',
                      weight: 1.5,
                    }}
                  />
                )
            )}

          {/* Breach trails: anchor -> every reported fix since the incident opened */}
          {criticalCoolers.map((cooler) => {
            const path: [number, number][] =
              cooler.trail.length > 1
                ? cooler.trail
                : cooler.routeOrigin
                ? [[cooler.routeOrigin.lat, cooler.routeOrigin.lng], [cooler.lat, cooler.lng]]
                : [];
            return path.length > 1 ? (
              <Polyline
                key={`trail-${cooler.id}`}
                positions={path}
                pathOptions={{ color: '#ba1a1a', weight: 3, dashArray: '6,6' }}
              />
            ) : null;
          })}

          {/* Render Fleet Markers */}
          {filteredFleet.map((cooler) => {
            let icon: L.DivIcon;
            if (cooler.status === 'critical') {
              icon = cachedIcon(`breach:${cooler.speedKmh.toFixed(1)}`, () =>
                createBreachIcon(`${cooler.speedKmh.toFixed(1)} km/h`)
              );
            } else if (cooler.status === 'warning') {
              icon = cachedIcon('warning', createWarningIcon);
            } else {
              const count = cooler.id === 'DLTA-BCN-9402' ? 42 : cooler.id === 'DLTA-BCN-3109' ? 12 : 18;
              icon = cachedIcon(`cluster:${count}`, () => createClusterIcon(count));
            }

            return (
              <Marker
                key={cooler.id}
                position={[cooler.lat, cooler.lng]}
                icon={icon}
                eventHandlers={{
                  click: () => onSelectCooler(cooler),
                }}
              >
                <Popup>
                  <div className="p-1 max-w-[220px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[12px] text-[#131b2e]">{cooler.id}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          cooler.status === 'critical'
                            ? 'bg-[#ffdad6] text-[#ba1a1a]'
                            : cooler.status === 'warning'
                            ? 'bg-[#ffe088] text-[#735c00]'
                            : 'bg-[#eaf3ea] text-[#10B981]'
                        }`}
                      >
                        {cooler.statusLabel}
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-[#131b2e]">{cooler.retailer}</div>
                    <div className="text-[10px] text-[#42474d]">{cooler.locationName}</div>
                    <div className="grid grid-cols-2 gap-1 mt-2 text-[10px] bg-[#f2f3ff] p-1.5 rounded">
                      <div>Temp: <strong>{cooler.internalTemp}°C</strong></div>
                      <div>Speed: <strong>{cooler.speedKmh} km/h</strong></div>
                      <div>Power: <strong>{cooler.batteryPct}%</strong></div>
                      <div>Risk: <strong>{cooler.riskScore}%</strong></div>
                    </div>
                    <button
                      onClick={() => onSelectCooler(cooler)}
                      className="w-full mt-2 py-1 bg-[#154363] text-white text-[10px] font-bold rounded"
                    >
                      Inspect Risk Details
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Floating Quick Search Overlay */}
        <div className="absolute top-4 left-4 z-[400] flex items-center gap-2">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#42474d] text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Locate Asset / Store ID..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-60 h-9 pl-9 pr-3 rounded-lg bg-white/95 backdrop-blur text-[12px] text-[#131b2e] shadow-md border border-[#eaedff] placeholder:text-[#42474d] focus:outline-none focus:ring-2 focus:ring-[#0062a1] transition-all"
            />
          </div>
        </div>

        {/* Floating Displacement Pill */}
        {criticalCooler && (
          <div className="absolute top-4 right-4 z-[400] bg-white/95 backdrop-blur px-3 py-1.5 rounded-full shadow-md flex items-center gap-2 border border-[#ba1a1a]/30">
            <span className="w-2 h-2 rounded-full bg-[#ba1a1a] animate-ping"></span>
            <span className="text-[11px] text-[#ba1a1a] font-bold">
              +{(criticalCooler.displacementM / 1000).toFixed(1)} km displacement vector
            </span>
            <span className="text-[11px] text-[#42474d]">
              • {criticalCooler.speedKmh.toFixed(1)} km/h
            </span>
          </div>
        )}
      </div>
    </section>
  );
};
