// Runs the test suite through the node-postgres driver (the production code path) without a
// PostgreSQL install: PGlite is exposed over the Postgres wire protocol, one fresh server per
// test file. CI additionally runs the suite against a real PostgreSQL 16 server.
import { spawn } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const FILES = ['test/fleet.test.ts', 'test/api.test.ts'];
let failed = 0;

for (const [i, file] of FILES.entries()) {
  const port = 5499 + i;
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 100 });
  await server.start();
  console.log(`# ${file} via node-postgres -> PGlite wire server :${port}`);
  const code = await new Promise<number>((resolve) => {
    spawn(process.execPath, ['--import', 'tsx', '--test', file], {
      stdio: 'inherit',
      // One connection: the wire bridge multiplexes sockets onto a single PGlite session.
      env: { ...process.env, DB_POOL_MAX: '1', TEST_DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${port}/postgres` },
    }).on('exit', (c) => resolve(c ?? 1));
  });
  if (code !== 0) failed++;
  await server.stop();
  await db.close();
}
process.exit(failed ? 1 : 0);
