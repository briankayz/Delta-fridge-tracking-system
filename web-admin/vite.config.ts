import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dashboard talks to the API on its own origin (/api, /ws) so the secure, httpOnly
// session cookie works. In development Vite proxies to the backend; in production the
// backend serves this build directly (see backend/src/server.ts).
const API = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8787';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': { target: API, changeOrigin: false },
      '/health': { target: API },
      '/ws': { target: API.replace(/^http/, 'ws'), ws: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
});
