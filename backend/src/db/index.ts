// Database adapter. Same SQL runs on:
//   - PostgreSQL server (DATABASE_URL set)  -> node-postgres pool
//   - embedded PostgreSQL (PGlite, WASM)    -> zero-setup local/dev/test
import { PGlite, types } from '@electric-sql/pglite';
import pg from 'pg';
import { MIGRATIONS } from './migrations.ts';

export type Row = Record<string, unknown>;

export interface Queryable {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  one<T = Row>(sql: string, params?: unknown[]): Promise<T | undefined>;
}

export interface Db extends Queryable {
  /** Runs fn in a transaction; rolls back on throw. */
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  kind: 'postgres' | 'pglite';
}

// Plain objects -> JSON text (for jsonb). Arrays pass through as PostgreSQL arrays; JSON-encode
// arrays destined for jsonb columns explicitly with JSON.stringify.
const prep = (params: unknown[] = []) =>
  params.map((p) => (p !== null && typeof p === 'object' && !Array.isArray(p) && !(p instanceof Date) ? JSON.stringify(p) : p));

function wrap(run: (sql: string, params: unknown[]) => Promise<{ rows: unknown[] }>): Queryable {
  return {
    async query<T>(sql: string, params?: unknown[]) {
      return (await run(sql, prep(params))).rows as T[];
    },
    async one<T>(sql: string, params?: unknown[]) {
      return (await run(sql, prep(params))).rows[0] as T | undefined;
    },
  };
}

export async function openDb(opts: { databaseUrl?: string; dataDir: string }): Promise<Db> {
  let db: Db;
  if (opts.databaseUrl) {
    const pool = new pg.Pool({ connectionString: opts.databaseUrl, max: 10 });
    // timestamptz -> ISO string, int8 -> number (counts / ids fit in 2^53)
    pg.types.setTypeParser(1184, (v) => new Date(v).toISOString());
    pg.types.setTypeParser(20, (v) => Number(v));
    const base = wrap((sql, params) => pool.query(sql, params));
    db = {
      ...base,
      kind: 'postgres',
      async tx(fn) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await fn(wrap((sql, params) => client.query(sql, params)));
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      },
      close: () => pool.end(),
    };
  } else {
    const lite = new PGlite(opts.dataDir === 'memory://' ? undefined : opts.dataDir);
    await lite.waitReady;
    // PGlite only honours parsers per query (constructor-level timestamptz parsers are ignored).
    const parsers = {
      [types.TIMESTAMPTZ]: (v: string) => new Date(v).toISOString(),
      [types.INT8]: (v: string) => Number(v),
    };
    const base = wrap((sql, params) => lite.query(sql, params, { parsers }));
    db = {
      ...base,
      kind: 'pglite',
      tx: (fn) => lite.transaction((t) => fn(wrap((sql, params) => t.query(sql, params, { parsers })))),
      close: () => lite.close(),
    };
  }
  await migrate(db);
  return db;
}

async function migrate(db: Db) {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version int PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Set((await db.query<{ version: number }>('SELECT version FROM schema_migrations')).map((r) => r.version));
  for (const [i, sql] of MIGRATIONS.entries()) {
    const version = i + 1;
    if (done.has(version)) continue;
    await db.tx(async (q) => {
      for (const stmt of sql.split(/;\s*$/m).map((s) => s.trim()).filter(Boolean)) await q.query(stmt);
      await q.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
    });
  }
}
