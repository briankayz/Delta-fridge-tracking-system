// SIM7000G LTE-M / NB-IoT modem. Firmware equivalent (TinyGSM or raw AT):
//   setup(): AT, ATE0, AT+CPIN?, AT+CNMP=38 (LTE only), AT+CMNB=1 (CAT-M), AT+CGDCONT=1,"IP","<apn>", AT+CNACT=1
//   loop():  AT+CSQ for signal; HTTPS POST via AT+SH* (SHCONF/SHCONN/SHAHEAD/SHBOD/SHREQ/SHREAD)
// Phone twin: AT traffic and signal strength are simulated; the HTTP POST is real (over the phone's
// own network), so the server sees exactly what the firmware will send.
import { SerialPort } from '../serial';
import { CellularBlock } from '../telemetryPayload';

export const APN = 'iot.deltabev.co';
const HTTP_TIMEOUT_MS = 8000;

export interface HttpResult {
  ok: boolean;
  network: boolean; // false = no route to server (would be buffered)
  status: number;
  ms: number;
  body: Record<string, unknown>;
}

export class CellularModule {
  private csq = 20;
  private registered = true;
  private loops = 0;

  constructor(private readonly serial: SerialPort) {}

  begin() {
    const at = (cmd: string, reply: string) => this.serial.println('MODEM', `${cmd} -> ${reply}`, { sim: true });
    at('AT', 'OK');
    at('ATE0', 'OK');
    at('AT+CPIN?', '+CPIN: READY');
    at('AT+CNMP=38', 'OK (LTE only)');
    at('AT+CMNB=1', 'OK (CAT-M)');
    at(`AT+CGDCONT=1,"IP","${APN}"`, 'OK');
    at('AT+CNACT=1', '+APP PDP: ACTIVE');
    this.serial.println('MODEM', 'transport: phone network (Wi-Fi / 4G); modem responses are simulated', { sim: true });
  }

  /** Signal report. RSSI dBm = -113 + 2 * CSQ (3GPP 27.007). */
  read(): CellularBlock & { simulated: string[] } {
    this.csq = Math.max(10, Math.min(28, this.csq + Math.round(Math.random() * 2 - 1)));
    const rssi = -113 + 2 * this.csq;
    if (this.loops++ % 6 === 0) this.serial.println('MODEM', `AT+CSQ -> +CSQ: ${this.csq},99 (${rssi} dBm)`, { sim: true });
    return { rssi_dbm: rssi, csq: this.csq, network: 'LTE-M', registered: this.registered, simulated: ['cellular'] };
  }

  async post(url: string, path: string, json: string, headers: Record<string, string>): Promise<HttpResult> {
    this.serial.println('HTTP', `AT+SHREQ="${path}",3 POST ${json.length} B`, { sim: true });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    const t0 = Date.now();
    try {
      const res = await fetch(`${url}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: json, signal: controller.signal });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const ms = Date.now() - t0;
      this.registered = true;
      this.serial.println('HTTP', `POST ${res.status} ${res.ok ? 'OK' : String(body.error ?? 'ERROR')} (${ms} ms)`, { level: res.ok ? 'info' : 'error' });
      return { ok: res.ok, network: true, status: res.status, ms, body };
    } catch (err) {
      const ms = Date.now() - t0;
      this.registered = false;
      this.serial.println('HTTP', `POST FAILED: ${(err as Error).name === 'AbortError' ? 'timeout' : 'no route to server'} (${ms} ms)`, { level: 'error' });
      return { ok: false, network: false, status: 0, ms, body: {} };
    } finally {
      clearTimeout(timer);
    }
  }
}
