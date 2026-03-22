# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

COPY package.json ./
RUN pnpm install --ignore-scripts

# Copy all source
COPY tsconfig.json tsconfig.ui.json vite.config.ts index.html ./
COPY src/ ./src/
COPY ui/ ./ui/
COPY public/ ./public/

# Build Vite UI output (dist-ui/)
RUN pnpm run build:ui

# Compile TypeScript backend (type-check only; runtime uses tsx or node ESM)
RUN pnpm run build:api

# Prune dev deps
RUN pnpm prune --prod

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

ENV NODE_ENV=production \
    PORT=3001

WORKDIR /app

# Copy only production artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist-ui ./dist-ui
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/healthz || exit 1

CMD ["node", "--import", "tsx/esm", "src/index.ts"]
