// Small shared helpers: structured logging, HTTP errors, ids, CSV.
import crypto from 'node:crypto';

type Level = 'debug' | 'info' | 'warn' | 'error';
const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[(process.env.LOG_LEVEL as Level) ?? 'info'] ?? 20;

/** JSON-lines logger (easy to ship to any log platform). */
export const log = {
  write(level: Level, msg: string, data?: Record<string, unknown>) {
    if (LEVELS[level] < threshold || process.env.NODE_ENV === 'test') return;
    const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...data });
    (level === 'error' || level === 'warn' ? console.error : console.log)(line);
  },
  debug: (m: string, d?: Record<string, unknown>) => log.write('debug', m, d),
  info: (m: string, d?: Record<string, unknown>) => log.write('info', m, d),
  warn: (m: string, d?: Record<string, unknown>) => log.write('warn', m, d),
  error: (m: string, d?: Record<string, unknown>) => log.write('error', m, d),
};

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const newId = (prefix: string) => `${prefix}_${crypto.randomBytes(9).toString('base64url')}`;

/** RFC-4180-ish CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    // Neutralise spreadsheet formula injection.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}
