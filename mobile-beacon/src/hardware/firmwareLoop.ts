// Firmware loop emulation: the phone twin of the ESP32 sketch.
//
//   void setup() { serial; modem.begin(); gnss.begin(); mpu.begin(); power.begin(); probe.begin(); state = ... }
//   void loop()  { read sensors -> build payload -> flush offline buffer -> POST -> update FSM -> sleep(heartbeat) }
//
// State machine (same names as the firmware and the payload's firmware.state):
//   IDLE_PROVISIONING    no device credential yet: sample and log, never transmit
//   ARMED_NOMINAL        normal heartbeat
//   ALARM_BREACH_ACTIVE  fast heartbeat; entered by a displacement (simulated here) or a critical
//                        verdict from the server; left by an operator clear or 3 nominal verdicts
//
// Nothing here computes risk: the server owns it. The loop only reacts to the server's verdict.
import { SerialPort } from './serial';
import { buildPayload, FirmwareState, FridgeTelemetryPayload, ServerAssessment, toAssessment } from './telemetryPayload';
import { GpsModule } from './sensors/gpsModule';
import { AccelerometerModule } from './sensors/accelerometerModule';
import { PowerMonitorModule } from './sensors/powerMonitorModule';
import { TempProbeModule } from './sensors/tempProbeModule';
import { CellularModule } from './sensors/cellularModule';

export const FIRMWARE_VERSION = 'dag-fw-1.0.0-twin';
export const DEFAULT_HEARTBEAT_S = 5;
export const ALARM_HEARTBEAT_S = 1;
const OFFLINE_BUFFER_MAX = 200; // readings kept while the network is down
const FLUSH_PER_LOOP = 3; // stay under the server's 5 payloads/s per-device limit
const CLEAR_AFTER_NOMINAL = 3;
const SENSOR_INIT_TIMEOUT_MS = 3000;

export interface FirmwareConfig {
  deviceId: string;
  deviceToken: string | null;
  server: string;
  anchor: { lat: number; lng: number };
  heartbeatS?: number;
  alarmHeartbeatS?: number;
  chargerAsMains?: boolean;
  useDeviceGps?: boolean;
}

export interface FirmwareSnapshot {
  state: FirmwareState;
  seq: number;
  uptimeS: number;
  heartbeatS: number;
  buffered: number;
  connected: boolean | null;
  lastHttp: { status: number; ms: number; at: number } | null;
  lastPayload: FridgeTelemetryPayload | null;
  assessment: ServerAssessment | null;
  simulatingDisplacement: boolean;
}

export class FirmwareLoop {
  readonly serial = new SerialPort();
  private readonly gps: GpsModule;
  private readonly accel: AccelerometerModule;
  private readonly power: PowerMonitorModule;
  private readonly probe: TempProbeModule;
  private readonly modem: CellularModule;

  private state: FirmwareState = 'IDLE_PROVISIONING';
  private seq = 0;
  private heartbeatS: number;
  private alarmHeartbeatS: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private busy = false;
  private breachStartedAt = 0;
  private nominalStreak = 0;
  private buffer: string[] = [];
  private snap: FirmwareSnapshot;
  private listeners = new Set<(s: FirmwareSnapshot) => void>();

  constructor(private readonly cfg: FirmwareConfig) {
    this.heartbeatS = cfg.heartbeatS ?? DEFAULT_HEARTBEAT_S;
    this.alarmHeartbeatS = cfg.alarmHeartbeatS ?? ALARM_HEARTBEAT_S;
    this.gps = new GpsModule(this.serial, { anchor: cfg.anchor, useDeviceGps: !!cfg.useDeviceGps });
    this.accel = new AccelerometerModule(this.serial);
    this.power = new PowerMonitorModule(this.serial, { chargerAsMains: !!cfg.chargerAsMains });
    this.probe = new TempProbeModule(this.serial);
    this.modem = new CellularModule(this.serial);
    this.snap = this.snapshot(null, null, null);
  }

  // ---- setup() -------------------------------------------------------------------------------
  async setup() {
    this.serial.println('BOOT', `Delta Asset Guard beacon ${FIRMWARE_VERSION} | device ${this.cfg.deviceId}`);
    this.serial.println('BOOT', 'ESP32 @240MHz | SIM7000G | MPU6050 | DS18B20 (phone hardware twin)', { sim: true });
    this.modem.begin();
    // Like firmware sensor init: never let one module block boot.
    await this.initWithTimeout('GPS', () => this.gps.begin());
    await this.initWithTimeout('ACCEL', () => this.accel.begin());
    await this.initWithTimeout('PWR', () => this.power.begin());
    this.probe.begin();
    this.transition(this.cfg.deviceToken ? 'ARMED_NOMINAL' : 'IDLE_PROVISIONING', this.cfg.deviceToken ? 'CREDENTIAL_PRESENT' : 'NO_CREDENTIAL');
  }

  private async initWithTimeout(tag: 'GPS' | 'ACCEL' | 'PWR', init: () => Promise<void>, ms = SENSOR_INIT_TIMEOUT_MS) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'timeout'>((r) => (timer = setTimeout(() => r('timeout'), ms)));
    try {
      const r = await Promise.race([init().then(() => 'ok' as const), timeout]);
      if (r === 'timeout') this.serial.println(tag, `init timeout after ${ms} ms: continuing with fallback readings`, { level: 'warn' });
    } catch (err) {
      this.serial.println(tag, `init failed: ${(err as Error).message}`, { level: 'error' });
    } finally {
      clearTimeout(timer);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.schedule(0);
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.gps.end();
    this.accel.end();
    this.power.end();
    this.serial.println('BOOT', 'halted');
  }

  // ---- external controls (buttons on the twin; GPIO/BLE commands on real hardware) --------------
  /** Demo control: emulate the cooler being unplugged and driven away. */
  triggerDisplacement() {
    if (this.state === 'IDLE_PROVISIONING') return;
    this.breachStartedAt = Date.now();
    this.transition('ALARM_BREACH_ACTIVE', 'SIM_DISPLACEMENT');
    this.runNow();
  }

  /** Operator clear (supervisor confirmed on site). */
  clearAlarm() {
    this.breachStartedAt = 0;
    this.nominalStreak = 0;
    if (this.state === 'ALARM_BREACH_ACTIVE') this.transition('ARMED_NOMINAL', 'OPERATOR_CLEAR');
    this.runNow();
  }

  setHeartbeat(s: number) {
    this.heartbeatS = s;
    this.serial.println('FSM', `heartbeat set to ${s}s`);
    this.runNow();
  }

  setChargerAsMains(v: boolean) {
    this.power.setChargerAsMains(v);
  }

  subscribe(fn: (s: FirmwareSnapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.snap);
    return () => this.listeners.delete(fn);
  }

  // ---- loop() -------------------------------------------------------------------------------------
  private runNow() {
    if (!this.running) return;
    this.schedule(0);
  }

  private schedule(ms: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.loop(), ms);
  }

  private currentHeartbeat() {
    return this.state === 'ALARM_BREACH_ACTIVE' ? this.alarmHeartbeatS : this.heartbeatS;
  }

  private async loop() {
    if (!this.running) return;
    if (this.busy) return this.schedule(200);
    this.busy = true;
    const t0 = Date.now();
    try {
      const simulating = this.breachStartedAt > 0;
      const mode = simulating ? 'breach' : 'nominal';
      const breachS = simulating ? (Date.now() - this.breachStartedAt) / 1000 : 0;

      const gps = this.gps.read(mode, breachS);
      const accel = this.accel.read(mode);
      const power = this.power.read(mode);
      const temp = this.probe.read(power.mains_connected);
      const cell = this.modem.read();

      this.seq += 1;
      const payload = buildPayload({
        deviceId: this.cfg.deviceId,
        utc: gps.utc,
        speedKmh: gps.speed_kmh,
        courseDeg: gps.course_deg,
        gps: { latitude: gps.latitude, longitude: gps.longitude, altitude_m: gps.altitude_m, accuracy_m: gps.accuracy_m, hdop: gps.hdop, satellites: gps.satellites, fix: gps.fix },
        accelerometer: {
          accel_x: accel.accel_x,
          accel_y: accel.accel_y,
          accel_z: accel.accel_z,
          accel_raw: accel.accel_raw,
          tilt_deg: accel.tilt_deg,
          vibration_rms: accel.vibration_rms,
          vibration_status: accel.vibration_status,
        },
        power: {
          mains_connected: power.mains_connected,
          voltage_ac: power.voltage_ac,
          frequency_hz: power.frequency_hz,
          battery_level_pct: power.battery_level_pct,
          battery_charging: power.battery_charging,
        },
        coldChain: { internal_temp_c: temp.internal_temp_c, target_max_temp_c: temp.target_max_temp_c },
        cellular: { rssi_dbm: cell.rssi_dbm, csq: cell.csq, network: cell.network, registered: cell.registered },
        firmware: {
          version: FIRMWARE_VERSION,
          state: this.state,
          seq: this.seq,
          uptime_s: Math.floor(this.serial.millis() / 1000),
          heartbeat_s: this.currentHeartbeat(),
          buffered: this.buffer.length,
        },
        simulated: [...gps.simulated, ...accel.simulated, ...power.simulated, ...temp.simulated, ...cell.simulated],
      });

      if (this.state === 'IDLE_PROVISIONING' || !this.cfg.deviceToken) {
        this.serial.println('FSM', 'IDLE_PROVISIONING: no device credential, not transmitting', { level: 'warn' });
        this.emit(this.snapshot(payload, null, null));
        return;
      }

      const headers = { authorization: `Device ${this.cfg.deviceToken}` };
      // Oldest buffered readings first, a few per loop.
      let flushed = 0;
      while (this.buffer.length > 0 && flushed < FLUSH_PER_LOOP) {
        const r = await this.modem.post(this.cfg.server, '/api/v1/telemetry', this.buffer[0], headers);
        if (!r.network) break;
        this.buffer.shift();
        flushed++;
      }
      if (flushed) this.serial.println('BUF', `flushed ${flushed}, ${this.buffer.length} left`);

      const json = JSON.stringify(payload);
      const res = await this.modem.post(this.cfg.server, '/api/v1/telemetry', json, headers);
      if (!res.network) {
        this.buffer.push(json);
        if (this.buffer.length > OFFLINE_BUFFER_MAX) this.buffer.shift();
        this.serial.println('BUF', `stored seq ${this.seq} (${this.buffer.length} buffered)`, { level: 'warn' });
      }
      if (res.status === 401) this.serial.println('HTTP', 'device credential rejected: re-install the beacon', { level: 'error' });

      const assessment = toAssessment(res.body);
      if (assessment) this.react(assessment, simulating);
      this.emit(this.snapshot(payload, assessment ?? this.snap.assessment, res));
    } catch (err) {
      this.serial.println('BOOT', `loop error: ${(err as Error).message}`, { level: 'error' });
    } finally {
      this.busy = false;
      if (this.running) this.schedule(Math.max(0, this.currentHeartbeat() * 1000 - (Date.now() - t0)));
    }
  }

  /** Server-driven FSM transitions. */
  private react(a: ServerAssessment, simulating: boolean) {
    this.serial.println('HTTP', `verdict ${a.severity.toUpperCase()} risk ${a.risk_score_pct}%${a.incident_id ? ` ${a.incident_id}` : ''}`, {
      level: a.severity === 'critical' ? 'warn' : 'info',
    });
    if (this.state === 'ARMED_NOMINAL' && a.severity === 'critical') {
      this.transition('ALARM_BREACH_ACTIVE', 'SERVER_CRITICAL');
    } else if (this.state === 'ALARM_BREACH_ACTIVE' && !simulating) {
      this.nominalStreak = a.severity === 'nominal' ? this.nominalStreak + 1 : 0;
      if (this.nominalStreak >= CLEAR_AFTER_NOMINAL) {
        this.nominalStreak = 0;
        this.transition('ARMED_NOMINAL', 'SERVER_NOMINAL');
      }
    }
  }

  private transition(next: FirmwareState, reason: string) {
    if (next === this.state && this.seq > 0) return;
    this.serial.println('FSM', `${this.state} -> ${next} (${reason})`, { level: next === 'ALARM_BREACH_ACTIVE' ? 'warn' : 'info' });
    this.state = next;
    this.emit(this.snapshot(this.snap.lastPayload, this.snap.assessment, null));
  }

  private snapshot(p: FridgeTelemetryPayload | null, a: ServerAssessment | null, res: { status: number; ms: number; network: boolean } | null): FirmwareSnapshot {
    return {
      state: this.state,
      seq: this.seq,
      uptimeS: Math.floor(this.serial.millis() / 1000),
      heartbeatS: this.currentHeartbeat(),
      buffered: this.buffer.length,
      connected: res ? res.network && res.status > 0 && res.status < 500 : this.snap?.connected ?? null,
      lastHttp: res ? { status: res.status, ms: res.ms, at: Date.now() } : this.snap?.lastHttp ?? null,
      lastPayload: p,
      assessment: a,
      simulatingDisplacement: this.breachStartedAt > 0,
    };
  }

  private emit(s: FirmwareSnapshot) {
    this.snap = s;
    this.listeners.forEach((l) => l(s));
  }
}
