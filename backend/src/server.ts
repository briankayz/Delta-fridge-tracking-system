import os from 'node:os';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { seedDemo } from './seedDemo.ts';
import { log } from './util.ts';

const cfg = loadConfig();
const svc = await createApp({ cfg });

if (cfg.demoMode) await seedDemo(svc.db, cfg, svc.fleet, svc.users);
await svc.users.bootstrapAdmin(cfg.adminEmail, cfg.adminPassword);

svc.server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    log.error(`Port ${cfg.port} is already in use. Set PORT to another value.`);
    process.exit(1);
  }
  throw err;
});

svc.server.listen(cfg.port, cfg.host, () => {
  svc.startBackground();
  const lan = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i!.address);
  log.info('Delta Asset Guard API ready', {
    port: cfg.port,
    database: cfg.databaseUrl ? 'postgres' : `embedded (${cfg.dataDir})`,
    demo_mode: cfg.demoMode,
    lan: lan.map((ip) => `http://${ip}:${cfg.port}`),
  });
  if (cfg.demoMode) {
    log.info('Demo sign-in', { emails: ['ops@delta.demo', 'tech@delta.demo', 'security@delta.demo', 'admin@delta.demo'], password: cfg.demoPassword });
  }
});

const shutdown = (signal: string) => {
  log.info('shutting down', { signal });
  svc.close().then(() => process.exit(0));
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
