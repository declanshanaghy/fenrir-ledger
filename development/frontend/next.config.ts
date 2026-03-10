// Next.js configuration for Fenrir Ledger
import type { NextConfig } from "next";

/**
 * Next.js Configuration
 *
 * Security headers are now injected by middleware (src/middleware.ts) with
 * per-request nonce generation for CSP. See src/lib/csp-headers.ts for the
 * complete CSP configuration.
 */

const nextConfig: NextConfig = {};

export default nextConfig;
