import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { FridgeTelemetryPayload, LinkStatus, RetailerProfile, ServerAssessment } from '../types/telemetry';
import { telemetryStream } from '../services/telemetryStream';
import { DEFAULT_RETAILER, DEVICE_METADATA } from '../services/sensorEngine';

interface BeaconContextType {
  currentScreen: 'setup' | 'active' | 'breach';
  activeTab: 'scan' | 'queue' | 'telemetry' | 'security';
  deviceId: string;
  coolerId: string;
  retailer: RetailerProfile;
  geofenceRadius: number;
  isProvisioned: boolean;
  isProvisioningInProgress: boolean;
  provisioningError: string | null;
  isDisplaced: boolean;
  isLockdownActive: boolean;
  isMuted: boolean;
  useRealGps: boolean;
  telemetry: FridgeTelemetryPayload;
  /** Latest backend risk verdict; null while the backend is unreachable. */
  assessment: ServerAssessment | null;
  link: LinkStatus;
  countdown: number;
  lastPayloadLabel: string;
  payloadCount: number;
  setGeofenceRadius: (radius: number) => void;
  selectRetailer: (retailer: RetailerProfile) => void;
  setUseRealGps: (enabled: boolean) => void;
  commitProvisioning: () => Promise<boolean>;
  simulateDisplacement: () => void;
  resetDisplacement: () => void;
  toggleLockdown: () => void;
  toggleMute: () => void;
  setActiveTab: (tab: 'scan' | 'queue' | 'telemetry' | 'security') => void;
  setCurrentScreen: (screen: 'setup' | 'active' | 'breach') => void;
}

const BeaconContext = createContext<BeaconContextType | undefined>(undefined);

export const AVAILABLE_RETAILERS: RetailerProfile[] = [
  DEFAULT_RETAILER,
  {
    id: 'RET-HRE-0102',
    name: 'TM Pick n Pay - Borrowdale',
    site_code: 'RET-HRE-0102',
    cluster: 'Borrowdale Village North',
    zone: 'Harare North',
    anchor_lat: -17.7538,
    anchor_lon: 31.0852,
  },
  {
    id: 'RET-HRE-0891',
    name: 'Spar Express - Eastlea',
    site_code: 'RET-HRE-0891',
    cluster: 'Eastlea Central Hub',
    zone: 'Harare East',
    anchor_lat: -17.8211,
    anchor_lon: 31.0744,
  },
  {
    id: 'RET-HRE-0344',
    name: 'Bon Marché - Mount Pleasant',
    site_code: 'RET-HRE-0344',
    cluster: 'The Bridge Shopping Centre',
    zone: 'Harare North',
    anchor_lat: -17.7694,
    anchor_lon: 31.0422,
  },
];

export const BeaconProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentScreen, setCurrentScreen] = useState<'setup' | 'active' | 'breach'>('active');
  const [activeTab, setActiveTab] = useState<'scan' | 'queue' | 'telemetry' | 'security'>('telemetry');
  const [retailer, setRetailer] = useState<RetailerProfile>(DEFAULT_RETAILER);
  const [geofenceRadius, setGeofenceRadiusState] = useState<number>(50);
  const [isProvisioned, setIsProvisioned] = useState<boolean>(true);
  const [isProvisioningInProgress, setIsProvisioningInProgress] = useState<boolean>(false);
  const [provisioningError, setProvisioningError] = useState<string | null>(null);
  const [isDisplaced, setIsDisplaced] = useState<boolean>(false);
  const [isLockdownActive, setIsLockdownActive] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [useRealGps, setUseRealGpsState] = useState<boolean>(telemetryStream.getUseRealGps());
  const [countdown, setCountdown] = useState<number>(5);
  const [lastPayloadLabel, setLastPayloadLabel] = useState<string>('—');
  const [payloadCount, setPayloadCount] = useState<number>(0);
  const [assessment, setAssessment] = useState<ServerAssessment | null>(null);
  const [link, setLink] = useState<LinkStatus>({
    connected: false,
    apiBase: telemetryStream.getApiBase(),
    lastSyncTime: null,
    lastError: null,
    payloadCount: 0,
    cadenceSeconds: 5,
  });

  const [telemetry, setTelemetry] = useState<FridgeTelemetryPayload>(
    () => telemetryStream.getLastPayload() ?? telemetryStream.broadcastCurrentState()
  );

  useEffect(() => {
    let labelTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubTelemetry = telemetryStream.subscribeTelemetry((newPayload) => {
      setTelemetry(newPayload);
      setLastPayloadLabel('Just now');
      clearTimeout(labelTimer);
      labelTimer = setTimeout(() => setLastPayloadLabel('2s ago'), 2000);
      setCountdown(telemetryStream.getIsDisplaced() ? 1 : 5);
    });

    const unsubStatus = telemetryStream.subscribeStatus((status) => {
      setPayloadCount(status.payloadCount);
      setLink(status);
    });

    const unsubAssessment = telemetryStream.subscribeAssessment(setAssessment);

    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : prev));
    }, 1000);

    return () => {
      unsubTelemetry();
      unsubStatus();
      unsubAssessment();
      clearInterval(timer);
      clearTimeout(labelTimer);
    };
  }, []);

  const setGeofenceRadius = (radius: number) => {
    setGeofenceRadiusState(radius);
    telemetryStream.setGeofenceRadius(radius);
  };

  const selectRetailer = (next: RetailerProfile) => {
    setRetailer(next);
    telemetryStream.setRetailer(next);
  };

  const setUseRealGps = (enabled: boolean) => {
    setUseRealGpsState(enabled);
    telemetryStream.setUseRealGps(enabled);
  };

  const commitProvisioning = async (): Promise<boolean> => {
    setIsProvisioningInProgress(true);
    setProvisioningError(null);
    const result = await telemetryStream.provision();
    setIsProvisioningInProgress(false);
    if (!result.ok) {
      setProvisioningError(result.error ?? 'Provisioning failed');
      return false;
    }
    setIsProvisioned(true);
    setCurrentScreen('active');
    setActiveTab('telemetry');
    return true;
  };

  const simulateDisplacement = () => {
    setIsDisplaced(true);
    setCurrentScreen('breach');
    telemetryStream.simulateDisplacementEvent();
  };

  const resetDisplacement = () => {
    setIsDisplaced(false);
    setIsLockdownActive(false);
    setCurrentScreen('active');
    telemetryStream.resetDisplacementEvent();
  };

  const toggleLockdown = () => {
    setIsLockdownActive((prev) => !prev);
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  return (
    <BeaconContext.Provider
      value={{
        currentScreen,
        activeTab,
        deviceId: DEVICE_METADATA.deviceId,
        coolerId: DEVICE_METADATA.coolerId,
        retailer,
        geofenceRadius,
        isProvisioned,
        isProvisioningInProgress,
        provisioningError,
        isDisplaced,
        isLockdownActive,
        isMuted,
        useRealGps,
        telemetry,
        assessment,
        link,
        countdown,
        lastPayloadLabel,
        payloadCount,
        setGeofenceRadius,
        selectRetailer,
        setUseRealGps,
        commitProvisioning,
        simulateDisplacement,
        resetDisplacement,
        toggleLockdown,
        toggleMute,
        setActiveTab,
        setCurrentScreen,
      }}
    >
      {children}
    </BeaconContext.Provider>
  );
};

export const useBeacon = () => {
  const context = useContext(BeaconContext);
  if (!context) {
    throw new Error('useBeacon must be used within a BeaconProvider');
  }
  return context;
};
