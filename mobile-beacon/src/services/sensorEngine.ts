import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';
import * as Battery from 'expo-battery';
import { GpsLocation, Mpu6050Reading, PowerState, ColdChainState, FridgeTelemetryPayload, RetailerProfile } from '../types/telemetry';

export const DEFAULT_RETAILER: RetailerProfile = {
  id: 'RET-HRE-0419',
  name: 'OK Supermarket - Avondale',
  site_code: 'RET-HRE-0419',
  cluster: 'Harare North Commercial',
  zone: 'Harare Cluster',
  anchor_lat: -17.79421,
  anchor_lon: 31.03784,
};

export const DEVICE_METADATA = {
  deviceId: 'DLTA-BCN-9042',
  coolerId: 'DLT-COOLER-8821',
  imei: '864920041289123',
  firmwareVersion: 'v2.4.1',
  apn: 'iot.deltabev.co',
  assetType: 'Industrial Refrig-V4',
};

class SensorEngine {
  private hasPhysicalLocation = false;
  private hasPhysicalAccelerometer = false;
  private hasPhysicalBattery = false;

  private accelSubscription: { remove: () => void } | null = null;
  private rawAccel = { x: 0.002, y: -0.001, z: 0.998 };
  private realLocation: Location.LocationObject | null = null;
  private batteryLevel = 0.98;
  private isBatteryCharging = true;

  constructor() {
    this.initSensors();
  }

  private async initSensors() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        this.hasPhysicalLocation = true;
        Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 3000,
            distanceInterval: 1,
          },
          (loc) => {
            this.realLocation = loc;
          }
        ).catch(() => {
          this.hasPhysicalLocation = false;
        });
      }
    } catch {
      this.hasPhysicalLocation = false;
    }

    try {
      const isAvailable = await Accelerometer.isAvailableAsync();
      if (isAvailable) {
        this.hasPhysicalAccelerometer = true;
        Accelerometer.setUpdateInterval(250);
        this.accelSubscription = Accelerometer.addListener((data) => {
          this.rawAccel = data;
        });
      }
    } catch {
      this.hasPhysicalAccelerometer = false;
    }

    try {
      const isBatteryAvailable = await Battery.isAvailableAsync();
      if (isBatteryAvailable) {
        this.hasPhysicalBattery = true;
        const level = await Battery.getBatteryLevelAsync();
        if (level >= 0) this.batteryLevel = level;
        const state = await Battery.getBatteryStateAsync();
        this.isBatteryCharging = state === Battery.BatteryState.CHARGING;
      }
    } catch {
      this.hasPhysicalBattery = false;
    }
  }

  public getAccelerometerReading(isDisplaced = false): Mpu6050Reading {
    if (isDisplaced) {
      // Violent motion reading for displacement event
      const jitterX = (Math.random() * 0.4 - 0.2).toFixed(3);
      const jitterY = (Math.random() * 0.5 - 0.25).toFixed(3);
      return {
        accel_x: parseFloat((0.45 + parseFloat(jitterX)).toFixed(3)),
        accel_y: parseFloat((-0.62 + parseFloat(jitterY)).toFixed(3)),
        accel_z: parseFloat((1.38 + Math.random() * 0.3).toFixed(3)),
        tilt_deg: 14.8,
        vibration_rms: 0.185,
        vibration_status: 'Elevated',
      };
    }

    if (this.hasPhysicalAccelerometer && this.rawAccel) {
      const x = parseFloat(this.rawAccel.x.toFixed(3));
      const y = parseFloat(this.rawAccel.y.toFixed(3));
      const z = parseFloat(this.rawAccel.z.toFixed(3));
      const tilt = parseFloat((Math.atan2(Math.sqrt(x * x + y * y), z) * (180 / Math.PI)).toFixed(1));
      const rms = parseFloat((Math.sqrt((x * x + y * y + Math.pow(z - 1, 2)) / 3) * 0.05).toFixed(3));
      return {
        accel_x: x,
        accel_y: y,
        accel_z: z,
        tilt_deg: tilt,
        vibration_rms: Math.max(0.002, rms),
        vibration_status: 'Nominal',
      };
    }

    // Realistic baseline MPU-6050 idle readings with micro-jitter
    const microX = (0.002 + (Math.random() * 0.002 - 0.001)).toFixed(3);
    const microY = (-0.001 + (Math.random() * 0.002 - 0.001)).toFixed(3);
    const microZ = (0.998 + (Math.random() * 0.002 - 0.001)).toFixed(3);
    return {
      accel_x: parseFloat(microX),
      accel_y: parseFloat(microY),
      accel_z: parseFloat(microZ),
      tilt_deg: 0.4,
      vibration_rms: 0.004,
      vibration_status: 'Nominal',
    };
  }

  public getGpsReading(isDisplaced = false): GpsLocation {
    if (isDisplaced) {
      // Displaced coordinates along trajectory in Sector 4 Transit
      const latJitter = (Math.random() * 0.0003 - 0.00015);
      const lonJitter = (Math.random() * 0.0003 - 0.00015);
      return {
        latitude: parseFloat((-17.78120 + latJitter).toFixed(5)),
        longitude: parseFloat((31.05431 + lonJitter).toFixed(5)),
        altitude_m: 1488,
        accuracy_m: 2.8,
        satellites: 13,
        hdop: 0.9,
        elevation_asl: 1488,
      };
    }

    if (this.hasPhysicalLocation && this.realLocation) {
      return {
        latitude: parseFloat(this.realLocation.coords.latitude.toFixed(5)),
        longitude: parseFloat(this.realLocation.coords.longitude.toFixed(5)),
        altitude_m: Math.round(this.realLocation.coords.altitude ?? 1492),
        accuracy_m: parseFloat((this.realLocation.coords.accuracy ?? 3.0).toFixed(1)),
        satellites: 14,
        hdop: 0.7,
        elevation_asl: Math.round(this.realLocation.coords.altitude ?? 1492),
      };
    }

    // Default Avondale Harare Coordinates
    const microLat = (-17.79421 + (Math.random() * 0.00004 - 0.00002)).toFixed(5);
    const microLon = (31.03784 + (Math.random() * 0.00004 - 0.00002)).toFixed(5);
    return {
      latitude: parseFloat(microLat),
      longitude: parseFloat(microLon),
      altitude_m: 1492,
      accuracy_m: 3.0,
      satellites: 14,
      hdop: 0.7,
      elevation_asl: 1492,
    };
  }

  public getPowerReading(isDisplaced = false): PowerState {
    if (isDisplaced) {
      // Power disconnected during theft transit
      return {
        mains_connected: false,
        voltage_ac: 0,
        current_amps: 0.0,
        frequency_hz: 0,
        battery_level_pct: 92,
        battery_charging: false,
        backup_duration_hours: 14,
      };
    }

    // Standard Grid AC 234V
    const voltJitter = (Math.random() * 1.2 - 0.6).toFixed(1);
    const ampJitter = (Math.random() * 0.04 - 0.02).toFixed(2);
    return {
      mains_connected: true,
      voltage_ac: parseFloat((234.2 + parseFloat(voltJitter)).toFixed(1)),
      current_amps: parseFloat((1.42 + parseFloat(ampJitter)).toFixed(2)),
      frequency_hz: 50.1,
      battery_level_pct: Math.round(this.batteryLevel * 100),
      battery_charging: this.isBatteryCharging,
      backup_duration_hours: 18,
    };
  }

  public getColdChainReading(isDisplaced = false): ColdChainState {
    if (isDisplaced) {
      return {
        internal_temp_c: 5.6,
        target_min_temp_c: 2.0,
        target_max_temp_c: 6.0,
        compressor_active: false,
        status: 'Warning',
      };
    }

    const tempJitter = (Math.random() * 0.2 - 0.1).toFixed(1);
    return {
      internal_temp_c: parseFloat((3.8 + parseFloat(tempJitter)).toFixed(1)),
      target_min_temp_c: 2.0,
      target_max_temp_c: 6.0,
      compressor_active: true,
      status: 'Optimal',
    };
  }

  public getPayload(
    isDisplaced: boolean,
    geofenceRadiusM = 50,
    retailer: RetailerProfile = DEFAULT_RETAILER
  ): FridgeTelemetryPayload {
    const gps = this.getGpsReading(isDisplaced);
    const accel = this.getAccelerometerReading(isDisplaced);
    const power = this.getPowerReading(isDisplaced);
    const coldChain = this.getColdChainReading(isDisplaced);

    if (isDisplaced) {
      const speed = parseFloat((38.5 + (Math.random() * 1.6 - 0.8)).toFixed(1));
      return {
        device_id: DEVICE_METADATA.deviceId,
        cooler_id: DEVICE_METADATA.coolerId,
        timestamp: new Date().toISOString(),
        retailer_id: retailer.id,
        retailer_name: retailer.name,
        firmware_version: DEVICE_METADATA.firmwareVersion,
        imei: DEVICE_METADATA.imei,
        status: 'BREACH_ALERT',
        geofence_breached: true,
        geofence_radius_m: geofenceRadiusM,
        displacement_distance_m: 2420,
        speed_kmh: speed,
        bearing_deg: 42,
        bearing_text: 'Bearing 42° NE (Rapid Transit)',
        risk_score_pct: 94.0,
        theft_prediction_confidence_pct: 98.4,
        gps,
        accelerometer: accel,
        power,
        cold_chain: coldChain,
        tamper_seal_armed: true,
        curfew_anomaly: true,
        mains_power_cut: true,
      };
    }

    return {
      device_id: DEVICE_METADATA.deviceId,
      cooler_id: DEVICE_METADATA.coolerId,
      timestamp: new Date().toISOString(),
      retailer_id: retailer.id,
      retailer_name: retailer.name,
      firmware_version: DEVICE_METADATA.firmwareVersion,
      imei: DEVICE_METADATA.imei,
      status: 'SECURE_TRANSMITTING',
      geofence_breached: false,
      geofence_radius_m: geofenceRadiusM,
      displacement_distance_m: 3.4,
      speed_kmh: 0.0,
      bearing_deg: 0,
      bearing_text: 'Stationary / In-Store Anchor',
      risk_score_pct: 0.0,
      theft_prediction_confidence_pct: 0.0,
      gps,
      accelerometer: accel,
      power,
      cold_chain: coldChain,
      tamper_seal_armed: true,
      curfew_anomaly: false,
      mains_power_cut: false,
    };
  }

  public cleanup() {
    if (this.accelSubscription) {
      this.accelSubscription.remove();
    }
  }
}

export const sensorEngine = new SensorEngine();
