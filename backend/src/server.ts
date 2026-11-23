import os from 'node:os';
import { createApp } from './app.ts';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';

const { server, close } = createApp({
  ingestToken: process.env.INGEST_TOKEN || undefined,
  forceCurfew: process.env.DEMO_FORCE_CURFEW === '1',
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use by another program. Start with another port, e.g. PORT=8788 npm run dev`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  const lan = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i!.address);
  console.log(`Delta Asset Guard backend listening on :${PORT}`);
  console.log(`  local:  http://localhost:${PORT}/health`);
  for (const ip of lan) {
    console.log(`  LAN:    http://${ip}:${PORT}/api/v1   ws://${ip}:${PORT}/ws/telemetry`);
  }
  if (process.env.DEMO_FORCE_CURFEW === '1') console.log('  DEMO_FORCE_CURFEW=1: all hours treated as after-hours');
});

const shutdown = () => close().then(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
