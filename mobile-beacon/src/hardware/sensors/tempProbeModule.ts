// DS18B20 cabinet probe (1-Wire). Firmware equivalent: requestTemperatures(); getTempCByIndex(0).
// Phone twin: always simulated (a phone has no cabinet probe). Models a cooler holding ~3.6 °C on
// mains and warming ~0.05 °C per minute once power is lost.
import { SerialPort } from '../serial';
import { ColdChainBlock, round } from '../telemetryPayload';

export const TARGET_MAX_C = 6;
const SETPOINT_C = 3.6;
const WARM_C_PER_S = 0.05 / 60;
const COOL_C_PER_S = 0.2 / 60;

export class TempProbeModule {
  private tempC = 3.8;
  private lastAt = Date.now();

  constructor(private readonly serial: SerialPort) {}

  begin() {
    this.serial.println('TEMP', 'DS18B20 on GPIO4 (1-Wire), 12-bit', { sim: true });
  }

  read(mainsOn: boolean): ColdChainBlock & { simulated: string[] } {
    const now = Date.now();
    const dt = (now - this.lastAt) / 1000;
    this.lastAt = now;
    this.tempC = mainsOn ? Math.max(SETPOINT_C, this.tempC - COOL_C_PER_S * dt) : this.tempC + WARM_C_PER_S * dt;
    const t = round(this.tempC + (Math.random() * 0.1 - 0.05), 1);
    this.serial.println('TEMP', `${t.toFixed(1)}°C ${t > TARGET_MAX_C ? 'ABOVE LIMIT' : 'OK'}`, { sim: true, level: t > TARGET_MAX_C ? 'warn' : 'info' });
    return { internal_temp_c: t, target_max_temp_c: TARGET_MAX_C, simulated: ['cold_chain'] };
  }
}
