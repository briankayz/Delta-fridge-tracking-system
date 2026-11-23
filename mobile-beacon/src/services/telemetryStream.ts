import { FridgeTelemetryPayload, RetailerProfile } from '../types/telemetry';
import { sensorEngine, DEFAULT_RETAILER } from './sensorEngine';

type TelemetryListener = (payload: FridgeTelemetryPayload) => void;
type StatusListener = (status: {
  connected: boolean;
  lastSyncTime: Date | null;
  payloadCount: number;
  cadenceSeconds: number;
}) => void;

class TelemetryStreamService {
  private socket: WebSocket | null = null;
  private timer: NodeJS.Timeout | null = null;
  private cadenceSeconds = 5;
  private isDisplaced = false;
  private currentRetailer: RetailerProfile = DEFAULT_RETAILER;
  private currentGeofenceRadius = 50;

  private telemetryListeners: Set<TelemetryListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private lastPayload: FridgeTelemetryPayload | null = null;
  private payloadCount = 0;
  private isConnected = false;
  private wsUrl: string = 'ws://127.0.0.1:8080/ws/telemetry';
  private apiEndpoint: string = 'http://127.0.0.1:8000/api/v1/telemetry';

  constructor() {
    this.connectWebSocket();
    this.startStreaming();
  }

  public setEndpointConfig(wsUrl?: string, apiUrl?: string) {
    if (wsUrl) {
      this.wsUrl = wsUrl;
      this.connectWebSocket();
    }
    if (apiUrl) {
      this.apiEndpoint = apiUrl;
    }
  }

  private connectWebSocket() {
    try {
      if (this.socket) {
        this.socket.close();
      }
      this.socket = new WebSocket(this.wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.notifyStatus();
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.notifyStatus();
        // Automatic reconnection attempt after 5 seconds
        setTimeout(() => this.connectWebSocket(), 5000);
      };

      this.socket.onerror = () => {
        this.isConnected = false;
        this.notifyStatus();
      };
    } catch {
      this.isConnected = false;
      this.notifyStatus();
    }
  }

  public startStreaming(cadenceSec = 5) {
    this.stopStreaming();
    this.cadenceSeconds = cadenceSec;
    this.timer = setInterval(() => {
      this.broadcastCurrentState();
    }, this.cadenceSeconds * 1000);

    // Initial broadcast
    this.broadcastCurrentState();
  }

  public stopStreaming() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public setRetailer(retailer: RetailerProfile) {
    this.currentRetailer = retailer;
  }

  public setGeofenceRadius(radius: number) {
    this.currentGeofenceRadius = radius;
  }

  public broadcastCurrentState(): FridgeTelemetryPayload {
    const payload = sensorEngine.getPayload(
      this.isDisplaced,
      this.currentGeofenceRadius,
      this.currentRetailer
    );

    this.sendPayload(payload);
    return payload;
  }

  public simulateDisplacementEvent(): FridgeTelemetryPayload {
    this.isDisplaced = true;
    // Set emergency 1s cadence during active breach burst
    this.startStreaming(1);

    const breachPayload: FridgeTelemetryPayload = {
      ...sensorEngine.getPayload(true, this.currentGeofenceRadius, this.currentRetailer),
      geofence_breached: true,
      speed_kmh: 38.5,
      risk_score_pct: 94.0,
      theft_prediction_confidence_pct: 98.4,
      mains_power_cut: true,
      status: 'BREACH_ALERT',
      displacement_distance_m: 2420,
    };

    this.sendPayload(breachPayload);
    return breachPayload;
  }

  public resetDisplacementEvent(): FridgeTelemetryPayload {
    this.isDisplaced = false;
    // Return to standard 5-second cadence
    this.startStreaming(5);

    const normalPayload = sensorEngine.getPayload(false, this.currentGeofenceRadius, this.currentRetailer);
    this.sendPayload(normalPayload);
    return normalPayload;
  }

  private async sendPayload(payload: FridgeTelemetryPayload) {
    this.lastPayload = payload;
    this.payloadCount += 1;

    // 1. WebSocket Transmission
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(payload));
      } catch {
        // Fallback to local memory bus
      }
    }

    // 2. HTTP POST Telemetry Sync (from CLAUDE.md: POST /api/v1/telemetry)
    try {
      fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {
        // Silent catch for disconnected server environment
      });
    } catch {
      // Ignore network errors in offline/emulator mode
    }

    // 3. Local In-App Broadcaster to UI Subscribers
    this.telemetryListeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.error('Telemetry subscriber error:', err);
      }
    });

    this.notifyStatus();
  }

  private notifyStatus() {
    this.statusListeners.forEach((listener) => {
      try {
        listener({
          connected: this.isConnected,
          lastSyncTime: this.lastPayload ? new Date(this.lastPayload.timestamp) : null,
          payloadCount: this.payloadCount,
          cadenceSeconds: this.cadenceSeconds,
        });
      } catch (err) {
        console.error('Status subscriber error:', err);
      }
    });
  }

  public subscribeTelemetry(listener: TelemetryListener): () => void {
    this.telemetryListeners.add(listener);
    if (this.lastPayload) {
      listener(this.lastPayload);
    }
    return () => {
      this.telemetryListeners.delete(listener);
    };
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener({
      connected: this.isConnected,
      lastSyncTime: this.lastPayload ? new Date(this.lastPayload.timestamp) : null,
      payloadCount: this.payloadCount,
      cadenceSeconds: this.cadenceSeconds,
    });
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public getLastPayload(): FridgeTelemetryPayload | null {
    return this.lastPayload;
  }

  public getIsDisplaced(): boolean {
    return this.isDisplaced;
  }
}

export const telemetryStream = new TelemetryStreamService();

