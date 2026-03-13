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

# Install only production + build dependencies
COPY development/frontend/package.json development/frontend/package-lock.json ./
RUN npm ci --ignore-scripts

# ── Stage 2: Build ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Accept build-time args for public env vars
ARG NEXT_PUBLIC_BUILD_ID=unknown
ARG NEXT_PUBLIC_APP_VERSION=1.0.0

ENV NEXT_PUBLIC_BUILD_ID=${NEXT_PUBLIC_BUILD_ID}
ENV NEXT_PUBLIC_APP_VERSION=${NEXT_PUBLIC_APP_VERSION}
# Next.js telemetry opt-out
ENV NEXT_TELEMETRY_DISABLED=1

# Copy deps from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code — only what's needed for the build
COPY development/frontend/ ./

# Build the Next.js app in standalone mode
RUN npm run build

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
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Copy static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copy public assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# Health check for container runtime (Docker/K8s liveness fallback)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
