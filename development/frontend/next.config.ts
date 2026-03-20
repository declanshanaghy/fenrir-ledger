// Next.js configuration for Fenrir Ledger
import path from "path";
import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/lib/csp-headers";
import { CACHE_CONTROL } from "./src/lib/cache-headers";

/**
 * Next.js Configuration
 *
 * Non-CSP security headers are set as static response headers via headers().
 * CSP is set per-request in middleware (src/middleware.ts) with a nonce for
 * Next.js RSC inline scripts + hashes for known static inline scripts.
 *
 * Issue #1184: Pure hash-based CSP (Issue #1144) broke Next.js RSC streaming
 * because dynamic inline <script> tags can't be pre-hashed. Restored nonce
 * in middleware while keeping hashes for known static scripts.
 */

const nextConfig: NextConfig = {
  // Inject build-time env vars — available as process.env.NEXT_PUBLIC_* in the browser bundle.
  // NEXT_PUBLIC_BUILD_DATE is set at build time; runtime env var takes precedence if set.
  env: {
    NEXT_PUBLIC_BUILD_DATE:
      process.env.NEXT_PUBLIC_BUILD_DATE ?? new Date().toISOString(),
  },


  // Standalone output for containerized deployment (GKE Autopilot)
  // Produces a self-contained server.js with only required node_modules
  output: "standalone",

  // pnpm workspaces: set tracing root to workspace root so nft can follow
  // pnpm symlinks (node_modules/.pnpm/) that live above this package directory.
  outputFileTracingRoot: path.join(__dirname, "../.."),

  // Non-CSP security headers — static, same on every response.
  // CSP is set per-request in middleware (needs nonce for RSC scripts).
  async headers() {
    const securityHeaders = buildSecurityHeaders();
    return [
      {
        // Non-CSP security headers — apply to all routes except Next.js internals
        // and static assets. CSP is set in middleware, not here.
        source:
          "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
        headers: securityHeaders,
      },
      // ── Cache-Control for static assets (Issue #1145) ──────────────────────
      // These paths are excluded from the middleware matcher, so their
      // Cache-Control is set here instead of in middleware.ts.
      {
        // Content-hashed filenames — safe to cache for 1 year at both browser and edge
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: CACHE_CONTROL.STATIC_IMMUTABLE }],
      },
      {
        // Next.js image optimisation — 24h browser TTL + 24h edge TTL
        source: "/_next/image",
        headers: [{ key: "Cache-Control", value: CACHE_CONTROL.IMAGE }],
      },
      {
        // Root-level static assets: favicons, icons, images
        source: "/:path*\\.(ico|svg|png)",
        headers: [{ key: "Cache-Control", value: CACHE_CONTROL.STATIC_ASSET }],
      },
    ];
  },
};

export default nextConfig;
