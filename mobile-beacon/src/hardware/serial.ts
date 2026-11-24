// UART debug console emulation (ESP32 Serial @ 115200). Every module logs through here, using the
// same tags and wording the C++ firmware should print, so hardware developers can compare logs
// line-for-line. Lines produced by simulation rather than real measurement carry `sim: true`.

export type SerialTag = 'BOOT' | 'FSM' | 'GPS' | 'ACCEL' | 'PWR' | 'TEMP' | 'MODEM' | 'HTTP' | 'BUF';

export interface SerialLine {
  id: number;
  /** millis() since boot, like the ESP32 */
  ms: number;
  tag: SerialTag;
  text: string;
  sim: boolean;
  level: 'info' | 'warn' | 'error';
}

const MAX_LINES = 400;

export class SerialPort {
  private readonly bootAt = Date.now();
  private lines: SerialLine[] = [];
  private nextId = 1;
  private listeners = new Set<(lines: SerialLine[]) => void>();

  /** Equivalent of millis(). */
  millis(): number {
    return Date.now() - this.bootAt;
  }

  println(tag: SerialTag, text: string, opts: { sim?: boolean; level?: SerialLine['level'] } = {}) {
    this.lines.push({ id: this.nextId++, ms: this.millis(), tag, text, sim: !!opts.sim, level: opts.level ?? 'info' });
    if (this.lines.length > MAX_LINES) this.lines.splice(0, this.lines.length - MAX_LINES);
    this.listeners.forEach((l) => l(this.lines));
  }

  clear() {
    this.lines = [];
    this.listeners.forEach((l) => l(this.lines));
  }

  subscribe(fn: (lines: SerialLine[]) => void): () => void {
    this.listeners.add(fn);
    fn(this.lines);
    return () => this.listeners.delete(fn);
  }

  /** `[   12.345] [GPS] FIX OK 12 SATS` - the format the firmware prints. */
  static format(l: SerialLine): string {
    return `[${(l.ms / 1000).toFixed(3).padStart(9)}] [${l.tag}]${l.sim ? ' [SIM]' : ''} ${l.text}`;
  }
}
