// Next.js configuration for Fenrir Ledger
import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Next.js Configuration
 *
 * Security headers are now injected by middleware (src/middleware.ts) with
 * per-request nonce generation for CSP. See src/lib/csp-headers.ts for the
 * complete CSP configuration.
 */

const nextConfig: NextConfig = {
  // Pin the workspace root so Next.js doesn't infer it from stray lockfiles
  // in parent directories. This is the frontend directory itself.
  outputFileTracingRoot: path.resolve(__dirname),
};

export default nextConfig;
