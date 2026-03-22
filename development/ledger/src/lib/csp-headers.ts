/**
 * CSP Headers Builder — Fenrir Ledger
 *
 * Uses 'unsafe-inline' for script-src. Nonce/hash-based CSP is incompatible
 * with PPR + CDN: the pre-rendered HTML shell has no nonces on RSC inline
 * scripts (built before middleware runs), and CDN caches the shell. A
 * per-request nonce in the CSP header never matches → blank page.
 */


/**
 * Build CSP directives using pre-computed hashes (no per-request nonce).
 *
 * Must allow:
 * - Google APIs (OAuth, Picker, Sheets, profile images)
 * - Analytics (Umami self-hosted, GA4 via GTM)
 * - Anthropic / OpenAI for LLM extraction (connect-src)
 * - Hash-based CSP for inline scripts (replaces nonce-based)
 * - data: URIs for fonts (some Google Fonts use data: encoding)
 * - Google Picker inline scripts via SHA-256 hash allowlist (Issue #527)
 */
export function buildCspDirectives(): string[] {
  return [
    // Default: only same-origin
    "default-src 'self'",

    // Scripts: 'unsafe-inline' required for PPR + CDN compatibility.
    // PPR pre-renders a static HTML shell at build time containing RSC payload
    // inline scripts. These scripts have no nonces (middleware doesn't run at
    // build time) and their hashes change every build. CDN caches the shell.
    // A per-request nonce or stale hashes → CSP violation → blank page.
    //
    // In development, Next.js HMR / React Fast Refresh requires 'unsafe-eval'.
    // https://www.googletagmanager.com is required for the external GA4 loader script.
    [
      "script-src 'self' 'unsafe-inline'",
      ...(process.env.NODE_ENV !== "production" ? ["'unsafe-eval'"] : []),
      "https://accounts.google.com",
      "https://apis.google.com",
      "https://js.stripe.com",
      "https://analytics.fenrirledger.com",
      "https://www.googletagmanager.com",
    ].join(" "),

    // Styles: self + unsafe-inline + Google Fonts + Google Accounts + Google APIs
    // unsafe-inline is required for style attributes (React, next-themes, Framer Motion,
    // Google Picker). CSP nonces only work on <style> tags, not style="" attributes.
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com https://apis.google.com`,

    // Images: self + Google profile pictures + YouTube thumbnails + data: URIs
    "img-src 'self' https://lh3.googleusercontent.com https://img.youtube.com data:",

    // Fonts: self + Google Fonts CDN + data: URIs
    "font-src 'self' https://fonts.gstatic.com data:",

    // Connections: self + Google APIs + Stripe + Anthropic + OpenAI
    [
      "connect-src 'self'",
      "https://accounts.google.com",
      "https://oauth2.googleapis.com",
      "https://www.googleapis.com",
      "https://sheets.googleapis.com",
      "https://content.googleapis.com",
      "https://docs.google.com",
      "https://apis.google.com",
      "https://api.stripe.com",
      "https://hooks.stripe.com",
      "https://api.anthropic.com",
      "https://api.openai.com",
      "https://analytics.fenrirledger.com",
    ].join(" "),

    // Frames: Google Picker, OAuth consent, Stripe.js, and YouTube embed (Heilung easter egg)
    "frame-src https://accounts.google.com https://docs.google.com https://drive.google.com https://js.stripe.com https://hooks.stripe.com https://www.youtube.com",

    // Form actions: self only
    "form-action 'self'",

    // Base URI: self only (prevent base-tag hijacking)
    "base-uri 'self'",
  ];
}

export interface SecurityHeader {
  key: string;
  value: string;
}

/** Security headers applied to every response (excludes CSP — set by middleware). */
export function buildSecurityHeaders(): SecurityHeader[] {
  return [
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    // Allow popups (Google OAuth consent, GIS token client) to communicate
    // back to the opener window. Without this, COOP blocks window.closed
    // detection and breaks the OAuth popup flow (Issue #771).
    {
      key: "Cross-Origin-Opener-Policy",
      value: "same-origin-allow-popups",
    },
    // Required companion to COOP for Google APIs — unsafe-none allows
    // cross-origin resources (Google Picker iframe, GIS script) to load
    // without CORP restrictions.
    {
      key: "Cross-Origin-Embedder-Policy",
      value: "unsafe-none",
    },
  ];
}
