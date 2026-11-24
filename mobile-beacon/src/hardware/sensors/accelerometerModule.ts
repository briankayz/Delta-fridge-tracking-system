// MPU6050 accelerometer (I2C 0x68, ±2g, 16384 LSB/g, DLPF ~21 Hz, sampled at 20 Hz).
// Firmware equivalent:
//   setup(): write PWR_MGMT_1=0x00, ACCEL_CONFIG=0x00 (±2g), CONFIG=0x04 (DLPF), check WHO_AM_I == 0x68
//   loop():  read ACCEL_XOUT_H..ACCEL_ZOUT_L into a ring buffer; per heartbeat compute mean vector,
//            tilt and RMS of dynamic acceleration (|a| - 1 g).
// Phone twin: the phone's accelerometer (already in g) feeds the same window and maths.
import { Accelerometer } from 'expo-sensors';
import { SerialPort } from '../serial';
import { AccelerometerBlock, round } from '../telemetryPayload';

export const LSB_PER_G = 16384; // ±2g full scale
const SAMPLE_HZ = 20;
const WINDOW = SAMPLE_HZ * 2; // 2 s window
export const RMS_WARNING_G = 0.02;
export const RMS_ELEVATED_G = 0.08;

type Sample = { x: number; y: number; z: number };

export interface AccelReading extends AccelerometerBlock {
  simulated: string[];
}

const toRaw = (g: number) => Math.max(-32768, Math.min(32767, Math.round(g * LSB_PER_G)));

export class AccelerometerModule {
  private samples: Sample[] = [];
  private sub: { remove: () => void } | null = null;
  private physical = false;

  constructor(private readonly serial: SerialPort) {}

  async begin() {
    this.physical = await Accelerometer.isAvailableAsync().catch(() => false);
    if (this.physical) {
      Accelerometer.setUpdateInterval(1000 / SAMPLE_HZ);
      this.sub = Accelerometer.addListener((s) => {
        this.samples.push({ x: s.x, y: s.y, z: s.z });
        if (this.samples.length > WINDOW) this.samples.shift();
      });
      this.serial.println('ACCEL', 'WHO_AM_I=0x68 OK, range ±2g, DLPF 21Hz, 20Hz sampling (phone IMU)', { sim: true });
    } else {
      this.serial.println('ACCEL', 'no IMU on this device: generating MPU6050 idle readings', { sim: true, level: 'warn' });
    }
  }

  read(mode: 'nominal' | 'breach'): AccelReading {
    let window: Sample[];
    const simulated: string[] = [];
    if (mode === 'breach') {
      // Transit vibration: road shocks plus a tilted cooler on a truck bed.
      window = Array.from({ length: WINDOW }, () => ({
        x: 0.26 + (Math.random() - 0.5) * 0.4,
        y: -0.12 + (Math.random() - 0.5) * 0.4,
        z: 0.95 + (Math.random() - 0.5) * 0.5,
      }));
      simulated.push('accelerometer');
    } else if (this.physical && this.samples.length >= 4) {
      window = [...this.samples];
    } else {
      window = Array.from({ length: WINDOW }, () => ({
        x: 0.002 + (Math.random() - 0.5) * 0.002,
        y: -0.001 + (Math.random() - 0.5) * 0.002,
        z: 0.998 + (Math.random() - 0.5) * 0.002,
      }));
      simulated.push('accelerometer');
    }

    const n = window.length;
    const mean = window.reduce((m, s) => ({ x: m.x + s.x / n, y: m.y + s.y / n, z: m.z + s.z / n }), { x: 0, y: 0, z: 0 });
    const mag = Math.hypot(mean.x, mean.y, mean.z) || 1;
    const tilt = (Math.acos(Math.min(1, Math.abs(mean.z) / mag)) * 180) / Math.PI;
    const rms = Math.sqrt(window.reduce((acc, s) => acc + (Math.hypot(s.x, s.y, s.z) - 1) ** 2, 0) / n);
    const status: AccelReading['vibration_status'] = rms >= RMS_ELEVATED_G ? 'Elevated' : rms >= RMS_WARNING_G ? 'Warning' : 'Nominal';

    const r: AccelReading = {
      accel_x: round(mean.x, 3),
      accel_y: round(mean.y, 3),
      accel_z: round(mean.z, 3),
      accel_raw: [toRaw(mean.x), toRaw(mean.y), toRaw(mean.z)],
      tilt_deg: round(tilt, 1),
      vibration_rms: round(rms, 4),
      vibration_status: status,
      simulated,
    };
    this.serial.println(
      'ACCEL',
      `RAW ${r.accel_raw.join(',')} | ${r.accel_x.toFixed(2)},${r.accel_y.toFixed(2)},${r.accel_z.toFixed(2)} g | tilt ${r.tilt_deg.toFixed(1)}° | rms ${r.vibration_rms.toFixed(3)}g ${status === 'Nominal' ? 'STABLE' : status.toUpperCase()}`,
      { sim: simulated.length > 0, level: status === 'Elevated' ? 'warn' : 'info' }
    );
    return r;
  }

  end() {
    this.sub?.remove();
    this.sub = null;
    this.samples = [];
  }
}
