// Next.js configuration for Fenrir Ledger
import type { NextConfig } from "next";

/**
 * Next.js Configuration
 *
 * Security headers are now injected by middleware (src/middleware.ts) with
 * per-request nonce generation for CSP. See src/lib/csp-headers.ts for the
 * complete CSP configuration.
 */

const nextConfig: NextConfig = {
  // Standalone output for containerized deployment (GKE Autopilot)
  // Produces a self-contained server.js with only required node_modules
  output: "standalone",

  // Pin the workspace root so Next.js doesn't infer it from stray lockfiles
  // in parent directories. This is the frontend directory itself.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
