# --------------------------------------------------------------------------
# Fenrir Ledger — Multi-stage Dockerfile for Next.js Standalone Build
#
# Produces a minimal production image (~150MB) using Next.js standalone output.
# Designed for GKE Autopilot deployment with 0.5 vCPU / 512MB resource limits.
#
# Build context: repository root
# Usage: docker build -t fenrir-app .
# --------------------------------------------------------------------------

# ── Stage 1: Dependencies ─────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Install pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# Copy workspace manifest and lockfile so pnpm can resolve the workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy each package's package.json so pnpm can install all workspace deps
COPY development/frontend/package.json ./development/frontend/
COPY development/odins-spear/package.json ./development/odins-spear/
COPY development/monitor/package.json ./development/monitor/
COPY development/monitor-ui/package.json ./development/monitor-ui/

# Install all workspace dependencies with frozen lockfile
# pnpm-workspace.yaml allowBuilds is included so native modules (esbuild, sharp) build
RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Stage 2: Build ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# Accept build-time args for public env vars
ARG NEXT_PUBLIC_BUILD_ID=unknown
ARG NEXT_PUBLIC_APP_VERSION=1.0.0
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_UMAMI_WEBSITE_ID

ENV NEXT_PUBLIC_BUILD_ID=${NEXT_PUBLIC_BUILD_ID}
ENV NEXT_PUBLIC_APP_VERSION=${NEXT_PUBLIC_APP_VERSION}
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
ENV NEXT_PUBLIC_UMAMI_WEBSITE_ID=${NEXT_PUBLIC_UMAMI_WEBSITE_ID}
# Next.js telemetry opt-out
ENV NEXT_TELEMETRY_DISABLED=1

# Copy deps from previous stage (workspace node_modules at root)
COPY --from=deps /app/node_modules ./node_modules

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy frontend source (outputFileTracingRoot points to workspace root /app,
# so nft can trace pnpm symlinks in node_modules/.pnpm/)
COPY development/frontend/ ./development/frontend/

# Build the Next.js app in standalone mode via pnpm workspace filter
RUN pnpm --filter fenrir-ledger run build

# ── Stage 3: Production Runner ────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy standalone output — includes server.js and required node_modules
COPY --from=builder --chown=nextjs:nodejs /app/development/frontend/.next/standalone ./
# Copy static assets
COPY --from=builder --chown=nextjs:nodejs /app/development/frontend/.next/static ./.next/static
# Copy public assets
COPY --from=builder --chown=nextjs:nodejs /app/development/frontend/public ./public

USER nextjs

EXPOSE 3000

# Health check for container runtime (Docker/K8s liveness fallback)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
