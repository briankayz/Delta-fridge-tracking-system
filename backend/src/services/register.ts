// Cooler register import: Delta's asset list (CSV export from SAP/ERP or a spreadsheet) becomes the
// source of truth for which coolers exist, where they belong and who the retailer contact is.
import { z } from 'zod';
import { Db } from '../db/index.ts';
import { Actor } from '../types.ts';
import { HttpError, parseCsv } from '../util.ts';
import { audit } from './audit.ts';

export const REGISTER_COLUMNS = [
  'device_id',
  'cooler_serial',
  'model',
  'retailer_id',
  'retailer_name',
  'region',
  'address',
  'contact_name',
  'contact_phone',
  'lat',
  'lng',
  'geofence_radius_m',
  'open_hour',
  'close_hour',
] as const;

const num = (min: number, max: number) =>
  z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().finite().min(min).max(max));
const optNum = (min: number, max: number) =>
  z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().finite().min(min).max(max).optional());
const optStr = (max: number) => z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim().max(max).optional());

const RowSchema = z.object({
  device_id: z.string().trim().regex(/^[A-Za-z0-9_-]{3,64}$/, 'device_id must be 3-64 letters, digits, - or _'),
  cooler_serial: optStr(64),
  model: optStr(80),
  retailer_id: optStr(64),
  retailer_name: z.string().trim().min(2).max(120),
  region: optStr(60),
  address: optStr(200),
  contact_name: optStr(80),
  contact_phone: optStr(30),
  lat: num(-90, 90),
  lng: num(-180, 180),
  geofence_radius_m: optNum(5, 5000),
  open_hour: optNum(0, 23),
  close_hour: optNum(0, 23),
});

export type RegisterRow = z.infer<typeof RowSchema>;

const slug = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

export interface ImportResult {
  rows: number;
  retailers_upserted: number;
  assets_created: number;
  assets_updated: number;
  errors: { row: number; message: string }[];
}

export function parseRegisterCsv(text: string): { rows: Record<string, string>[]; missing: string[] } {
  const grid = parseCsv(text.replace(/^﻿/, ''));
  if (grid.length === 0) throw new HttpError(400, 'The file is empty');
  const header = grid[0].map((h) => h.trim().toLowerCase());
  const missing = ['device_id', 'retailer_name', 'lat', 'lng'].filter((c) => !header.includes(c));
  const rows = grid.slice(1).map((cells) => Object.fromEntries(header.map((h, i) => [h, (cells[i] ?? '').trim()])));
  return { rows, missing };
}

export async function importRegister(db: Db, rawRows: Record<string, unknown>[], actor: Actor, opts: { dryRun?: boolean; ip?: string } = {}) {
  if (rawRows.length > 20_000) throw new HttpError(413, 'Import at most 20,000 rows at a time');
  const result: ImportResult = { rows: rawRows.length, retailers_upserted: 0, assets_created: 0, assets_updated: 0, errors: [] };
  const valid: RegisterRow[] = [];
  const seen = new Set<string>();

  rawRows.forEach((raw, i) => {
    const parsed = RowSchema.safeParse(raw);
    const rowNo = i + 2; // header is row 1
    if (!parsed.success) {
      result.errors.push({ row: rowNo, message: parsed.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ') });
    } else if (seen.has(parsed.data.device_id)) {
      result.errors.push({ row: rowNo, message: `Duplicate device_id ${parsed.data.device_id}` });
    } else {
      seen.add(parsed.data.device_id);
      valid.push(parsed.data);
    }
  });

  if (opts.dryRun || valid.length === 0) return result;

  await db.tx(async (q) => {
    const retailers = new Set<string>();
    for (const r of valid) {
      const region = r.region ?? 'Harare';
      const retailerId = r.retailer_id ?? `RET-${slug(region)}-${slug(r.retailer_name)}`;
      if (!retailers.has(retailerId)) {
        await q.query(
          `INSERT INTO retailers (id, name, region, address, contact_name, contact_phone, lat, lng)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (id) DO UPDATE SET name=$2, region=$3, address=COALESCE($4, retailers.address),
             contact_name=COALESCE($5, retailers.contact_name), contact_phone=COALESCE($6, retailers.contact_phone),
             lat=$7, lng=$8, updated_at=now()`,
          [retailerId, r.retailer_name, region, r.address ?? null, r.contact_name ?? null, r.contact_phone ?? null, r.lat, r.lng]
        );
        retailers.add(retailerId);
      }
      const existed = await q.one('SELECT 1 FROM assets WHERE id = $1', [r.device_id]);
      await q.query(
        `INSERT INTO assets (id, cooler_serial, model, asset_type, retailer_id, anchor_lat, anchor_lng, geofence_radius_m, open_hour, close_hour)
         VALUES ($1,$2,COALESCE($3,'Display cooler'),COALESCE($3,'Display cooler'),$4,$5,$6,COALESCE($7,50),COALESCE($8,7),COALESCE($9,22))
         ON CONFLICT (id) DO UPDATE SET cooler_serial=COALESCE($2, assets.cooler_serial), model=COALESCE($3, assets.model),
           retailer_id=$4, anchor_lat=$5, anchor_lng=$6, geofence_radius_m=COALESCE($7, assets.geofence_radius_m),
           open_hour=COALESCE($8, assets.open_hour), close_hour=COALESCE($9, assets.close_hour), status='active', updated_at=now()`,
        [r.device_id, r.cooler_serial ?? null, r.model ?? null, retailerId, r.lat, r.lng, r.geofence_radius_m ?? null, r.open_hour ?? null, r.close_hour ?? null]
      );
      if (existed) result.assets_updated++;
      else result.assets_created++;
    }
    result.retailers_upserted = retailers.size;
    await audit(q, actor, 'register.imported', null, { ...result, errors: result.errors.length }, opts.ip);
  });
  return result;
}
