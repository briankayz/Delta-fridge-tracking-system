// Power monitor. Firmware equivalent:
//   AC presence: opto-isolated mains detector on a GPIO (interrupt on change), optional RMS voltage
//                via a calibrated divider/transformer on an ADC channel; frequency from zero crossings.
//   Backup:      Li-ion cell voltage on an ADC channel -> % via discharge curve; charger STAT pin.
// Phone twin: with "charger as mains sensor" on, the phone's charger stands in for the cooler's
// mains supply (unplug the charger = cooler unplugged). Voltage and frequency are always simulated:
// a phone cannot measure them.
import * as Battery from 'expo-battery';
import { SerialPort } from '../serial';
import { PowerBlock, round } from '../telemetryPayload';

export const NOMINAL_VAC = 230;
export const NOMINAL_HZ = 50;

export interface PowerReading extends PowerBlock {
  simulated: string[];
}

export class PowerMonitorModule {
  private batteryAvailable = false;
  private level: number | null = null; // 0..1
  private charging = false;
  private subs: { remove: () => void }[] = [];
  private lastMains: boolean | null = null;

  constructor(
    private readonly serial: SerialPort,
    private opts: { chargerAsMains: boolean }
  ) {}

  async begin() {
    this.batteryAvailable = await Battery.isAvailableAsync().catch(() => false);
    if (this.batteryAvailable) {
      const lvl = await Battery.getBatteryLevelAsync().catch(() => -1);
      this.level = lvl >= 0 ? lvl : null;
      this.charging = this.isCharging(await Battery.getBatteryStateAsync().catch(() => Battery.BatteryState.UNKNOWN));
      this.subs.push(Battery.addBatteryLevelListener(({ batteryLevel }) => (this.level = batteryLevel)));
      this.subs.push(Battery.addBatteryStateListener(({ batteryState }) => (this.charging = this.isCharging(batteryState))));
    }
    this.serial.println('PWR', 'AC sense: opto on GPIO34 | Li-ion ADC GPIO35 | charger STAT GPIO32', { sim: true });
    this.serial.println(
      'PWR',
      this.opts.chargerAsMains
        ? this.batteryAvailable
          ? `mains sensor = phone charger (${this.charging ? 'connected' : 'not connected'})`
          : 'charger state unavailable on this device: mains assumed ON'
        : 'mains sensor simulated: ON',
      { sim: !this.opts.chargerAsMains || !this.batteryAvailable }
    );
  }

  setChargerAsMains(v: boolean) {
    this.opts.chargerAsMains = v;
    this.serial.println('PWR', v ? 'mains sensor -> phone charger' : 'mains sensor -> simulated ON', { sim: !v });
  }

  private isCharging(s: Battery.BatteryState) {
    return s === Battery.BatteryState.CHARGING || s === Battery.BatteryState.FULL;
  }

  read(mode: 'nominal' | 'breach'): PowerReading {
    const simulated = ['power.voltage_ac', 'power.frequency_hz'];
    let mains: boolean;
    if (mode === 'breach') {
      mains = false; // simulated theft: cooler unplugged
      simulated.push('power.mains_connected');
    } else if (this.opts.chargerAsMains && this.batteryAvailable) {
      mains = this.charging;
    } else {
      mains = true;
      simulated.push('power.mains_connected');
    }
    if (!this.batteryAvailable || this.level == null) simulated.push('power.battery_level_pct');

    if (this.lastMains !== null && mains !== this.lastMains) {
      this.serial.println('PWR', mains ? 'AC RESTORED' : 'AC LOST -> running on Li-ion backup', { level: mains ? 'info' : 'warn', sim: simulated.includes('power.mains_connected') });
    }
    this.lastMains = mains;

    const r: PowerReading = {
      mains_connected: mains,
      voltage_ac: mains ? round(NOMINAL_VAC + (Math.random() * 6 - 3), 1) : 0,
      frequency_hz: mains ? round(NOMINAL_HZ + (Math.random() * 0.1 - 0.05), 2) : 0,
      battery_level_pct: this.level != null ? Math.round(this.level * 100) : 92,
      battery_charging: this.batteryAvailable ? this.charging : mains,
      simulated,
    };
    this.serial.println(
      'PWR',
      mains ? `AC ${r.voltage_ac.toFixed(1)}V ${r.frequency_hz.toFixed(2)}Hz | BAT ${r.battery_level_pct}%` : `AC 0V (LOST) | BAT ${r.battery_level_pct}%`,
      { sim: true, level: mains ? 'info' : 'warn' }
    );
    return r;
  }

  end() {
    this.subs.forEach((s) => s.remove());
    this.subs = [];
  }
}
