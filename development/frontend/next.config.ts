// Next.js configuration for Fenrir Ledger
import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/lib/csp-headers";

/**
 * Next.js Configuration
 *
 * Security headers are set as static response headers via headers() so that
 * Cloud CDN can cache HTML pages. Hash-based CSP (pre-computed at build time
 * by scripts/compute-csp-hashes.mjs) keeps the Content-Security-Policy header
 * identical across all requests — a requirement for CDN caching.
 *
 * Previously, CSP was injected per-request in middleware with a unique nonce.
 * That approach prevented CDN caching (Issue #1144). See ADR for the migration.
 */

const nextConfig: NextConfig = {
  // Standalone output for containerized deployment (GKE Autopilot)
  // Produces a self-contained server.js with only required node_modules
  output: "standalone",

  // Pin the workspace root so Next.js doesn't infer it from stray lockfiles
  // in parent directories. This is the frontend directory itself.
  outputFileTracingRoot: __dirname,

  // Static security headers — same on every response, enabling CDN caching.
  // Middleware (src/middleware.ts) handles only canonical redirects.
  async headers() {
    const securityHeaders = buildSecurityHeaders();
    return [
      {
        // Apply to all routes except Next.js internals and static assets.
        // Mirrors the middleware matcher pattern.
        source:
          "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
