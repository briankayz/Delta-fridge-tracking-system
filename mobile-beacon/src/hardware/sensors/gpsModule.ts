// GNSS module (SIM7000G integrated GNSS). Firmware equivalent:
//   setup(): AT+CGNSPWR=1
//   loop():  AT+CGNSINF  ->  +CGNSINF: run,fix,utc,lat,lon,alt,speed,course,fixmode,,hdop,pdop,vdop,,inview,used,...
// Phone twin: uses the phone's location when enabled, otherwise the store anchor; during a
// simulated displacement it follows a route away from the anchor.
import * as Location from 'expo-location';
import { destinationPoint } from '../../services/geo';
import { SerialPort } from '../serial';
import { GpsBlock, round } from '../telemetryPayload';

export interface GpsReading extends GpsBlock {
  speed_kmh: number;
  course_deg: number;
  utc: string;
  simulated: string[];
}

export const ROUTE_BEARING_DEG = 42;
const ROUTE_START_M = 2400;
const ROUTE_SPEED_KMH = 38.5;
const UERE_M = 5; // user equivalent range error used to relate accuracy and HDOP

/** yyyyMMddhhmmss.sss as returned in +CGNSINF */
const cgnsUtc = (d: Date) => d.toISOString().replace(/[-:T]/g, '').replace('Z', '').slice(0, 18);

export class GpsModule {
  private sub: Location.LocationSubscription | null = null;
  private last: Location.LocationObject | null = null;

  constructor(
    private readonly serial: SerialPort,
    private opts: { anchor: { lat: number; lng: number }; useDeviceGps: boolean }
  ) {}

  async begin() {
    this.serial.println('GPS', 'AT+CGNSPWR=1 -> OK (GNSS power on)', { sim: true });
    if (!this.opts.useDeviceGps) {
      this.serial.println('GPS', `position source: store anchor ${this.opts.anchor.lat.toFixed(6)},${this.opts.anchor.lng.toFixed(6)}`, { sim: true });
      return;
    }
    const { status } = await Location.requestForegroundPermissionsAsync().catch(() => ({ status: 'denied' as const }));
    if (status !== 'granted') {
      this.serial.println('GPS', 'location permission denied: falling back to store anchor', { sim: true, level: 'warn' });
      this.opts.useDeviceGps = false;
      return;
    }
    this.sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 1 }, (loc) => {
      this.last = loc;
    }).catch(() => null);
    this.serial.println('GPS', 'position source: phone GNSS');
  }

  setUseDeviceGps(v: boolean) {
    this.opts.useDeviceGps = v;
  }

  read(mode: 'nominal' | 'breach', breachSeconds: number): GpsReading {
    const now = new Date();
    let r: GpsReading;

    if (mode === 'breach') {
      const travelled = ROUTE_START_M + (breachSeconds * ROUTE_SPEED_KMH * 1000) / 3600;
      const p = destinationPoint(this.opts.anchor.lat, this.opts.anchor.lng, ROUTE_BEARING_DEG, travelled);
      r = this.fix(p.lat, p.lng, 1488, 2.8, ROUTE_SPEED_KMH + (Math.random() * 1.6 - 0.8), ROUTE_BEARING_DEG, now, ['gps']);
    } else if (this.opts.useDeviceGps && this.last) {
      const c = this.last.coords;
      const acc = c.accuracy ?? 10;
      r = this.fix(c.latitude, c.longitude, c.altitude ?? 0, acc, Math.max(0, (c.speed ?? 0) * 3.6), c.heading ?? 0, now, ['gps.satellites', 'gps.hdop']);
    } else if (this.opts.useDeviceGps) {
      r = { latitude: this.opts.anchor.lat, longitude: this.opts.anchor.lng, altitude_m: 0, accuracy_m: 999, hdop: 99.9, satellites: 0, fix: 'none', speed_kmh: 0, course_deg: 0, utc: now.toISOString(), simulated: ['gps'] };
    } else {
      const j = () => (Math.random() - 0.5) * 0.00004; // ~2 m of fix noise
      r = this.fix(this.opts.anchor.lat + j(), this.opts.anchor.lng + j(), 1492, 3.0, 0, 0, now, ['gps']);
    }

    const fixmode = r.fix === '3d' ? 1 : 0;
    this.serial.println(
      'GPS',
      `+CGNSINF: 1,${fixmode},${cgnsUtc(now)},${r.latitude.toFixed(6)},${r.longitude.toFixed(6)},${r.altitude_m.toFixed(1)},${r.speed_kmh.toFixed(2)},${r.course_deg.toFixed(1)},1,,${r.hdop.toFixed(1)},,,,${r.satellites + 3},${r.satellites},,,,,`,
      { sim: r.simulated.includes('gps') }
    );
    this.serial.println(
      'GPS',
      r.fix === 'none' ? 'NO FIX' : `FIX OK ${r.satellites} SATS HDOP ${r.hdop.toFixed(1)} ${r.speed_kmh.toFixed(1)} km/h`,
      { sim: r.simulated.includes('gps'), level: r.fix === 'none' ? 'warn' : 'info' }
    );
    return r;
  }

  private fix(lat: number, lng: number, alt: number, acc: number, speed: number, course: number, now: Date, simulated: string[]): GpsReading {
    const hdop = Math.min(20, Math.max(0.5, acc / UERE_M));
    // A phone does not expose satellites-used; estimate from HDOP for parity (flagged as simulated).
    const sats = Math.max(4, Math.min(16, Math.round(14 - (hdop - 0.7) * 3)));
    return {
      latitude: round(lat, 6),
      longitude: round(lng, 6),
      altitude_m: round(alt, 1),
      accuracy_m: round(acc, 1),
      hdop: round(hdop, 1),
      satellites: sats,
      fix: '3d',
      speed_kmh: round(speed, 1),
      course_deg: round(course, 1),
      utc: now.toISOString(),
      simulated,
    };
  }

  end() {
    this.sub?.remove();
    this.sub = null;
  }
}
