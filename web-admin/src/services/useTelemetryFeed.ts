import { useState, useEffect, useCallback } from 'react';
import { CoolerAsset, RiskAlertItem, LiveBeaconTelemetryPayload } from '../types';

export const INITIAL_COOLER_FLEET: CoolerAsset[] = [
  {
    id: 'DLTA-BCN-8821',
    coolerModel: 'Commercial Double Door',
    retailer: 'OK Supermarket (Avondale)',
    locationName: 'Highfield Res. Zone (+3.4 km)',
    lat: -17.8641,
    lng: 31.0024,
    status: 'critical',
    statusLabel: 'Geofence Breach',
    internalTemp: 4.8,
    powerSource: 'Mains Cut (0V)',
    batteryPct: 84,
    lastPing: '5 sec ago',
    speedKmh: 24.1,
    riskScore: 94,
    geofenceRadiusM: 50,
    displacementM: 3400,
    routeOrigin: {
      name: 'OK Supermarket Avondale (Origin)',
      lat: -17.7942,
      lng: 31.0378,
    },
    isBreached: true,
    isPowerCut: true,
    imei: '358920110482910',
    assetType: 'Double G-Door',
  },
  {
    id: 'DLTA-BCN-4012',
    coolerModel: 'Single Door Chiller',
    retailer: 'Chitepo Bottle Store',
    locationName: 'Harare Central (Avenue)',
    lat: -17.8182,
    lng: 31.0489,
    status: 'warning',
    statusLabel: 'Outage > 8h',
    internalTemp: 8.2,
    powerSource: 'Battery Backup',
    batteryPct: 61,
    lastPing: '12 sec ago',
    speedKmh: 0,
    riskScore: 68,
    geofenceRadiusM: 100,
    displacementM: 12,
    isBreached: false,
    isPowerCut: true,
    imei: '358920110484012',
    assetType: 'Single Chiller',
  },
  {
    id: 'DLTA-BCN-9402',
    coolerModel: 'Mega Visual Merchandiser',
    retailer: 'TM Pick n Pay (Jason Moyo)',
    locationName: 'Harare CBD Commercial',
    lat: -17.8285,
    lng: 31.0522,
    status: 'nominal',
    statusLabel: 'Nominal',
    internalTemp: 3.1,
    powerSource: '230V AC Mains',
    batteryPct: 98,
    lastPing: '18 sec ago',
    speedKmh: 0,
    riskScore: 0,
    geofenceRadiusM: 50,
    displacementM: 2.1,
    isBreached: false,
    isPowerCut: false,
    imei: '358920110489402',
    assetType: 'Mega Merchandiser',
  },
  {
    id: 'DLTA-BCN-3109',
    coolerModel: 'Standard Beverage Cooler',
    retailer: 'Spar (Borrowdale Village)',
    locationName: 'Borrowdale Village Forecourt',
    lat: -17.7538,
    lng: 31.0852,
    status: 'nominal',
    statusLabel: 'Nominal',
    internalTemp: 3.4,
    powerSource: '230V AC Mains',
    batteryPct: 99,
    lastPing: '25 sec ago',
    speedKmh: 0,
    riskScore: 0,
    geofenceRadiusM: 100,
    displacementM: 1.8,
    isBreached: false,
    isPowerCut: false,
    imei: '358920110483109',
    assetType: 'Standard Cooler',
  },
  {
    id: 'DLTA-BCN-1194',
    coolerModel: 'Compact Countertop Cooler',
    retailer: 'TotalEnergies Samora Machel',
    locationName: 'Eastlea Sector Express',
    lat: -17.8229,
    lng: 31.0768,
    status: 'nominal',
    statusLabel: 'Nominal',
    internalTemp: 2.9,
    powerSource: '230V AC Mains',
    batteryPct: 94,
    lastPing: '42 sec ago',
    speedKmh: 0,
    riskScore: 0,
    geofenceRadiusM: 50,
    displacementM: 0.8,
    isBreached: false,
    isPowerCut: false,
    imei: '358920110481194',
    assetType: 'Countertop Cooler',
  },
];

export const INITIAL_RISK_ALERTS: RiskAlertItem[] = [
  {
    id: 'ALERT-01',
    assetId: 'DLTA-BCN-8821',
    title: 'Commercial Display Fridge #8821',
    severity: 'critical',
    timeAgo: 'T+ 08m ago',
    description: 'Moved 3.4km outside geofence boundary into unapproved residential sector.',
    originStore: 'OK Supermarket — Avondale Branch',
    currentLocation: 'Highfield West Res. (-17.8641, 31.0024)',
    speedKmh: 24.1,
    powerStatus: 'BAT 84%',
    riskPct: 94,
    timestamp: '23:45 CAT',
  },
  {
    id: 'ALERT-02',
    assetId: 'DLTA-BCN-4012',
    title: 'Double Door Chiller #4012',
    severity: 'warning',
    timeAgo: 'T+ 2h 15m ago',
    description: 'Mains cut overnight. Internal temperature rising (8.2°C).',
    originStore: 'Chitepo Beverage Outlet • Harare Central',
    currentLocation: 'Harare Central Ave (-17.8182, 31.0489)',
    speedKmh: 0,
    powerStatus: '0V (61%)',
    riskPct: 68,
    timestamp: '21:30 CAT',
  },
  {
    id: 'ALERT-03',
    assetId: 'DLTA-BCN-3109',
    title: 'Fridge #3109 • Geofence Re-entry',
    severity: 'resolved',
    timeAgo: 'T+ 14m ago',
    description: 'Confirmed safe at Spar Borrowdale • T+ 14m ago',
    originStore: 'Spar Borrowdale Village',
    currentLocation: 'Borrowdale Village Hub',
    speedKmh: 0,
    powerStatus: '230V AC',
    riskPct: 0,
    timestamp: '23:35 CAT',
  },
];

export function useTelemetryFeed() {
  const [fleet, setFleet] = useState<CoolerAsset[]>(INITIAL_COOLER_FLEET);
  const [alerts, setAlerts] = useState<RiskAlertItem[]>(INITIAL_RISK_ALERTS);
  const [flashingRowId, setFlashingRowId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{
    id: number;
    title: string;
    description: string;
    type: 'critical' | 'success' | 'info';
  } | null>(null);

  const [kpiCounts, setKpiCounts] = useState({
    totalTracked: 1420,
    activeCompliant: 1385,
    powerOutages: 23,
    anomalyAlerts: 12,
  });

  const triggerToast = useCallback(
    (title: string, description: string, type: 'critical' | 'success' | 'info' = 'info') => {
      setToastMessage({ id: Date.now(), title, description, type });
      setTimeout(() => {
        setToastMessage((prev) => (prev?.title === title ? null : prev));
      }, 5000);
    },
    []
  );

  const handleIncomingPayload = useCallback(
    (payload: LiveBeaconTelemetryPayload) => {
      const deviceId = payload.device_id;
      const isBreached = payload.geofence_breached;
      const speed = payload.speed_kmh;
      const risk = payload.risk_score_pct;

      // Update fleet state
      setFleet((prevFleet) => {
        const existingIdx = prevFleet.findIndex((item) => item.id === deviceId);
        const updatedAsset: CoolerAsset = {
          id: deviceId,
          coolerModel: payload.cooler_id ?? 'Industrial Refrig-V4',
          retailer: payload.retailer_name ?? 'OK Supermarket (Avondale)',
          locationName: isBreached ? 'Sector 4 Transit (Displaced)' : 'In-Store Nominal Zone',
          lat: payload.gps?.latitude ?? -17.7812,
          lng: payload.gps?.longitude ?? 31.0543,
          status: isBreached ? 'critical' : 'nominal',
          statusLabel: isBreached ? 'Geofence Breach' : 'Nominal',
          internalTemp: payload.cold_chain?.internal_temp_c ?? 3.8,
          powerSource: payload.power?.mains_connected ? '230V AC Mains' : 'Mains Cut (0V)',
          batteryPct: payload.power?.battery_level_pct ?? 92,
          lastPing: 'Just now',
          speedKmh: speed,
          riskScore: risk,
          geofenceRadiusM: payload.geofence_radius_m ?? 50,
          displacementM: payload.displacement_distance_m ?? (isBreached ? 2420 : 3.4),
          routeOrigin: {
            name: `${payload.retailer_name ?? 'OK Supermarket Avondale'} (Origin)`,
            lat: -17.7942,
            lng: 31.0378,
          },
          isBreached,
          isPowerCut: !payload.power?.mains_connected,
          imei: payload.imei ?? '864920041289123',
        };

        if (existingIdx >= 0) {
          const updated = [...prevFleet];
          updated[existingIdx] = updatedAsset;
          return updated;
        } else {
          return [updatedAsset, ...prevFleet];
        }
      });

      // Flashing table row
      if (isBreached) {
        setFlashingRowId(deviceId);
        setTimeout(() => setFlashingRowId(null), 3000);

        // Update KPI Anomaly count
        setKpiCounts((prev) => ({
          ...prev,
          anomalyAlerts: Math.max(13, prev.anomalyAlerts + 1),
          powerOutages: prev.powerOutages + 1,
          activeCompliant: prev.activeCompliant - 1,
        }));

        // Push new alert to AI Risk Radar
        const newAlert: RiskAlertItem = {
          id: `ALERT-${Date.now()}`,
          assetId: deviceId,
          title: `Sentinel Beacon #${deviceId.split('-').pop()}`,
          severity: 'critical',
          timeAgo: 'Just now',
          description: `UNAUTHORIZED DISPLACEMENT: Moved ${((payload.displacement_distance_m ?? 2420) / 1000).toFixed(1)} km outside geofence boundary at ${speed} km/h.`,
          originStore: payload.retailer_name ?? 'OK Supermarket Avondale',
          currentLocation: `Sector 4 Transit (${payload.gps?.latitude.toFixed(4)}, ${payload.gps?.longitude.toFixed(4)})`,
          speedKmh: speed,
          powerStatus: 'BAT 92%',
          riskPct: risk,
          timestamp: new Date().toLocaleTimeString(),
        };

        setAlerts((prev) => [newAlert, ...prev.filter((a) => a.assetId !== deviceId)]);

        triggerToast(
          `CRITICAL BREACH: ${deviceId}`,
          `Unauthorized movement at ${speed} km/h detected in Sector 4 Transit. Multi-sensor fusion risk: ${risk}%.`,
          'critical'
        );
      }
    },
    [triggerToast]
  );

  // Set up WebSocket & BroadcastChannel
  useEffect(() => {
    let ws: WebSocket | null = null;
    let broadcastChannel: BroadcastChannel | null = null;

    try {
      broadcastChannel = new BroadcastChannel('delta-telemetry-bus');
      broadcastChannel.onmessage = (event) => {
        if (event.data) {
          handleIncomingPayload(event.data);
        }
      };
    } catch {
      // BroadcastChannel unsupported fallback
    }

    const connectWs = () => {
      try {
        ws = new WebSocket('ws://127.0.0.1:8080/ws/telemetry');
        ws.onopen = () => {
          setIsConnected(true);
        };
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleIncomingPayload(data);
          } catch {
            // parse error
          }
        };
        ws.onclose = () => {
          setIsConnected(false);
          setTimeout(connectWs, 5000);
        };
        ws.onerror = () => {
          setIsConnected(false);
        };
      } catch {
        setIsConnected(false);
      }
    };

    connectWs();

    // Listen to in-window custom events
    const customListener = (event: Event) => {
      const customEvt = event as CustomEvent<LiveBeaconTelemetryPayload>;
      if (customEvt.detail) {
        handleIncomingPayload(customEvt.detail);
      }
    };

    window.addEventListener('delta-telemetry-event', customListener);

    return () => {
      if (ws) ws.close();
      if (broadcastChannel) broadcastChannel.close();
      window.removeEventListener('delta-telemetry-event', customListener);
    };
  }, [handleIncomingPayload]);

  // Test simulation helper
  const simulateTestBreach = () => {
    const mockBreach: LiveBeaconTelemetryPayload = {
      device_id: 'DLTA-BCN-9042',
      cooler_id: 'DLT-COOLER-8821',
      timestamp: new Date().toISOString(),
      retailer_id: 'RET-HRE-0419',
      retailer_name: 'OK Supermarket - Avondale',
      status: 'BREACH_ALERT',
      geofence_breached: true,
      geofence_radius_m: 50,
      displacement_distance_m: 2420,
      speed_kmh: 38.5,
      bearing_deg: 42,
      bearing_text: 'Bearing 42° NE (Rapid Transit)',
      risk_score_pct: 94.0,
      theft_prediction_confidence_pct: 98.4,
      gps: {
        latitude: -17.7812,
        longitude: 31.05431,
        altitude_m: 1488,
        accuracy_m: 2.8,
        satellites: 13,
      },
      power: {
        mains_connected: false,
        voltage_ac: 0,
        current_amps: 0.0,
        battery_level_pct: 92,
      },
      cold_chain: {
        internal_temp_c: 5.6,
        status: 'Warning',
      },
    };

    handleIncomingPayload(mockBreach);
  };

  return {
    fleet,
    alerts,
    kpiCounts,
    flashingRowId,
    isConnected,
    toastMessage,
    triggerToast,
    simulateTestBreach,
  };
}

