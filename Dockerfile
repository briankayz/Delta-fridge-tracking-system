# Delta Asset Guard: one image serving the API, WebSocket hub and web dashboard.
# Build:  docker build -t delta-asset-guard .
# Run:    see docker-compose.yml (PostgreSQL 16 + this image)

# ---- 1. web dashboard -------------------------------------------------------------------------
FROM node:22-alpine AS web
WORKDIR /app/web-admin
COPY web-admin/package.json web-admin/package-lock.json ./
RUN npm ci
COPY web-admin/ ./
RUN npm run build

# ---- 2. backend runtime dependencies ------------------------------------------------------------
FROM node:22-alpine AS api-deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# ---- 3. runtime -----------------------------------------------------------------------------------
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8787 \
    HOST=0.0.0.0 \
    WEB_DIST=/app/web-admin/dist \
    DATA_DIR=/data/pg
WORKDIR /app/backend
COPY --from=api-deps /app/backend/node_modules ./node_modules
COPY backend/package.json ./
COPY backend/src ./src
COPY --from=web /app/web-admin/dist /app/web-admin/dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:8787/health >/dev/null || exit 1
CMD ["node", "--import", "tsx", "src/server.ts"]
