import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { FridgeTelemetryPayload, RetailerProfile } from '../types/telemetry';
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
  isDisplaced: boolean;
  isLockdownActive: boolean;
  isMuted: boolean;
  telemetry: FridgeTelemetryPayload;
  countdown: number;
  lastPayloadLabel: string;
  payloadCount: number;
  setGeofenceRadius: (radius: number) => void;
  commitProvisioning: () => Promise<void>;
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
  const [isDisplaced, setIsDisplaced] = useState<boolean>(false);
  const [isLockdownActive, setIsLockdownActive] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(8);
  const [lastPayloadLabel, setLastPayloadLabel] = useState<string>('2s ago');
  const [payloadCount, setPayloadCount] = useState<number>(1);

  const [telemetry, setTelemetry] = useState<FridgeTelemetryPayload>(() => {
    return telemetryStream.broadcastCurrentState();
  });

  useEffect(() => {
    const unsubTelemetry = telemetryStream.subscribeTelemetry((newPayload) => {
      setTelemetry(newPayload);
      setLastPayloadLabel('Just now');
      setTimeout(() => {
        setLastPayloadLabel('2s ago');
      }, 2000);
    });

    const unsubStatus = telemetryStream.subscribeStatus((status) => {
      setPayloadCount(status.payloadCount);
    });

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return telemetryStream.getIsDisplaced() ? 1 : 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      unsubTelemetry();
      unsubStatus();
      clearInterval(timer);
    };
  }, []);

  const setGeofenceRadius = (radius: number) => {
    setGeofenceRadiusState(radius);
    telemetryStream.setGeofenceRadius(radius);
  };

  const commitProvisioning = async () => {
    setIsProvisioningInProgress(true);
    await new Promise((resolve) => setTimeout(resolve, 1600));
    setIsProvisioned(true);
    setIsProvisioningInProgress(false);
    setCurrentScreen('active');
    setActiveTab('telemetry');
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
        isDisplaced,
        isLockdownActive,
        isMuted,
        telemetry,
        countdown,
        lastPayloadLabel,
        payloadCount,
        setGeofenceRadius,
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

