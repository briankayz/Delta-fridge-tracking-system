import React, { useEffect } from 'react';
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { CoolerAsset } from '../types';

/** Fits the view to anchor + current position whenever either moves meaningfully. */
function FitToRoute({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map(([a, b]) => `${a.toFixed(4)},${b.toFixed(4)}`).join('|');
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 16);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16 });
    }
  }, [key, map]);
  return null;
}

export const IncidentRouteMap: React.FC<{ cooler: CoolerAsset }> = ({ cooler }) => {
  const origin: [number, number] | null = cooler.routeOrigin ? [cooler.routeOrigin.lat, cooler.routeOrigin.lng] : null;
  const current: [number, number] = [cooler.lat, cooler.lng];
  const path: [number, number][] = cooler.trail.length > 1 ? cooler.trail : origin ? [origin, current] : [current];
  const tone = cooler.status === 'critical' ? '#DC2626' : cooler.status === 'warning' ? '#D97706' : '#059669';
  const fitPoints = origin ? [origin, current] : [current];

  return (
    <MapContainer center={current} zoom={14} scrollWheelZoom={false} style={{ width: '100%', height: '100%' }}>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
      <FitToRoute points={fitPoints} />

      {origin && (
        <>
          <Circle
            center={origin}
            radius={cooler.geofenceRadiusM}
            pathOptions={{ color: '#123965', fillColor: '#123965', fillOpacity: 0.15, dashArray: '4,4', weight: 2 }}
          />
          <CircleMarker center={origin} radius={6} pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#123965', fillOpacity: 1 }}>
            <Tooltip permanent direction="top" offset={[0, -8]}>
              {cooler.routeOrigin?.name}
            </Tooltip>
          </CircleMarker>
        </>
      )}

      {path.length > 1 && cooler.displacementM > cooler.geofenceRadiusM && (
        <Polyline positions={path} pathOptions={{ color: '#DC2626', weight: 3.5, dashArray: '8,6', lineCap: 'round' }} />
      )}

      {cooler.displacementM > cooler.geofenceRadiusM && (
        <CircleMarker center={current} radius={8} pathOptions={{ color: '#ffffff', weight: 2, fillColor: tone, fillOpacity: 1 }}>
          <Tooltip permanent direction="right" offset={[10, 0]}>
            {cooler.locationName}
          </Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
};
