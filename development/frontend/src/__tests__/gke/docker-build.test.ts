/**
 * Vitest integration tests for Docker build and containerization — Issue #680
 *
 * These tests verify that the multi-stage Dockerfile correctly:
 * 1. Builds Next.js app in standalone mode
 * 2. Includes all necessary production dependencies
 * 3. Runs as non-root user
 * 4. Exposes correct port and health checks
 *
 * Note: These are read-only tests that verify Dockerfile contents and structure.
 * Actual Docker build validation happens in CI via docker/build-push-action.
 *
 * @ref #680
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("Dockerfile — GKE Deployment", () => {
  let dockerfileContent: string;

  beforeAll(() => {
    const dockerfilePath = resolve(process.cwd(), "Dockerfile");
    dockerfileContent = readFileSync(dockerfilePath, "utf-8");
  });

  describe("Multi-stage build structure", () => {
    it("has three build stages: deps, builder, runner", () => {
      expect(dockerfileContent).toContain("FROM node:20-alpine AS deps");
      expect(dockerfileContent).toContain("FROM node:20-alpine AS builder");
      expect(dockerfileContent).toContain("FROM node:20-alpine AS runner");
    });

    it("uses Node 20 Alpine for all stages (minimal size)", () => {
      const stageMatches = dockerfileContent.match(/FROM node:20-alpine/g);
      expect(stageMatches).toHaveLength(3);
    });

    it("copies deps stage into builder", () => {
      expect(dockerfileContent).toContain("COPY --from=deps /app/node_modules");
    });

    it("copies builder output into runner (standalone mode)", () => {
      expect(dockerfileContent).toContain(
        "COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone"
      );
    });
  });

  describe("Next.js standalone build", () => {
    it("runs 'npm run build' in builder stage", () => {
      const builderSection = dockerfileContent.substring(
        dockerfileContent.indexOf("FROM node:20-alpine AS builder"),
        dockerfileContent.indexOf("FROM node:20-alpine AS runner")
      );
      expect(builderSection).toContain("RUN npm run build");
    });

    it("sets NEXT_TELEMETRY_DISABLED=1 to skip telemetry", () => {
      expect(dockerfileContent).toContain("ENV NEXT_TELEMETRY_DISABLED=1");
    });

    it("accepts build-time args for version and build ID", () => {
      expect(dockerfileContent).toContain("ARG NEXT_PUBLIC_BUILD_ID=unknown");
      expect(dockerfileContent).toContain("ARG NEXT_PUBLIC_APP_VERSION=1.0.0");
    });

    it("copies static assets from .next/static", () => {
      expect(dockerfileContent).toContain(
        "COPY --from=builder --chown=nextjs:nodejs /app/.next/static"
      );
    });

    it("copies public folder for public assets", () => {
      expect(dockerfileContent).toContain(
        "COPY --from=builder --chown=nextjs:nodejs /app/public ./public"
      );
    });
  });

  describe("Security and runtime", () => {
    it("creates non-root user 'nextjs' with gid 1001 and uid 1001", () => {
      expect(dockerfileContent).toContain("addgroup --system --gid 1001");
      expect(dockerfileContent).toContain("adduser --system --uid 1001 nextjs");
    });

    it("sets USER to nextjs (non-root execution)", () => {
      expect(dockerfileContent).toContain("USER nextjs");
    });

    it("sets NODE_ENV=production", () => {
      expect(dockerfileContent).toContain("ENV NODE_ENV=production");
    });
  });

  describe("Port and health checks", () => {
    it("exposes port 3000", () => {
      expect(dockerfileContent).toContain("EXPOSE 3000");
    });

    it("sets PORT and HOSTNAME env vars", () => {
      expect(dockerfileContent).toContain("ENV PORT=3000");
      expect(dockerfileContent).toContain("ENV HOSTNAME=0.0.0.0");
    });

    it("includes HEALTHCHECK command pointing to /api/health", () => {
      expect(dockerfileContent).toContain("HEALTHCHECK");
      expect(dockerfileContent).toContain("http://localhost:3000/api/health");
    });

    it("healthcheck uses wget with retries and timeout", () => {
      expect(dockerfileContent).toContain("--tries=1");
      expect(dockerfileContent).toContain("--spider");
    });

    it("starts server with 'node server.js'", () => {
      expect(dockerfileContent).toContain('CMD ["node", "server.js"]');
    });
  });

  describe("Build optimizations", () => {
    it("uses npm ci instead of npm install for reproducible builds", () => {
      expect(dockerfileContent).toContain("npm ci --ignore-scripts");
    });

    it("sets appropriate working directories", () => {
      expect(dockerfileContent).toContain("WORKDIR /app");
    });

    it("owns standalone and static files as nextjs:nodejs", () => {
      expect(dockerfileContent).toContain("--chown=nextjs:nodejs");
    });
  });
});
