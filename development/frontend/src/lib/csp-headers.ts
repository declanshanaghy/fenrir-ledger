/**
 * CSP Headers Builder — Fenrir Ledger
 *
 * Builds security headers with optional nonce for CSP.
 */

/**
 * Google Picker inline-script SHA-256 hashes.
 *
 * The Google Picker API (apis.google.com) injects inline <script> tags that
 * do not carry our CSP nonce.  Rather than falling back to 'unsafe-inline'
 * for all scripts, we allowlist the specific hashes observed in the console
 * (see Issue #527).  If Google changes the inline payload, the hash will
 * fail-closed and we update it here.
 */
const GOOGLE_PICKER_SCRIPT_HASHES = [
  // Google Picker bootstrap inline script
  "'sha256-rty9vSWIkY+k7t72CZmyhd8qbxQ4FpRSyO4E/iy3xcI='",
];

/**
 * Build CSP directives with optional nonce
 *
 * Must allow:
 * - Google APIs (OAuth, Picker, Sheets, profile images)
 * - Vercel analytics
 * - Anthropic / OpenAI for LLM extraction (connect-src)
 * - Nonce-based CSP for scripts/styles (replaces unsafe-inline)
 * - data: URIs for fonts (some Google Fonts use data: encoding)
 * - Google Picker inline scripts via SHA-256 hash allowlist (Issue #527)
 */
export function buildCspDirectives(nonce?: string): string[] {
  const scriptSrcNonce = nonce ? `'nonce-${nonce}'` : "'unsafe-inline'";
  return [
    // Default: only same-origin
    "default-src 'self'",

    // Scripts: self + nonce + Google Picker inline-script hashes + Google APIs + Stripe.js + Vercel
    // In development, Next.js HMR / React Fast Refresh requires 'unsafe-eval'.
    // Google Picker inline script hashes are allowlisted for Issue #527.
    [
      "script-src 'self'",
      scriptSrcNonce,
      ...(process.env.NODE_ENV !== "production" ? ["'unsafe-eval'"] : []),
      ...GOOGLE_PICKER_SCRIPT_HASHES,
      "https://accounts.google.com",
      "https://apis.google.com",
      "https://js.stripe.com",
      "https://va.vercel-scripts.com",
      "https://vercel.live",
    ].join(" "),

    // Styles: self + unsafe-inline + Google Fonts + Google Accounts + Google APIs
    // unsafe-inline is required for style attributes (React, next-themes, Framer Motion,
    // Google Picker, and Vercel feedback widget). CSP nonces only work on <style> tags,
    // not style="" attributes — no practical alternative.
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com https://apis.google.com`,

    // Images: self + Google profile pictures + YouTube thumbnails + data: URIs
    "img-src 'self' https://lh3.googleusercontent.com https://img.youtube.com data:",

    // Fonts: self + Google Fonts CDN + Vercel Live toolbar fonts + data: URIs
    "font-src 'self' https://fonts.gstatic.com https://vercel.live data:",

    // Connections: self + Google APIs + Stripe + Anthropic + OpenAI + Vercel analytics/live
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
      "https://va.vercel-scripts.com",
      "https://vercel.live",
    ].join(" "),

    // Frames: Google Picker, OAuth consent, Stripe.js, and Vercel toolbar
    "frame-src https://accounts.google.com https://docs.google.com https://drive.google.com https://js.stripe.com https://hooks.stripe.com https://vercel.live",

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

/** Security headers applied to every response. */
export function buildSecurityHeaders(nonce?: string): SecurityHeader[] {
  const cspDirectives = buildCspDirectives(nonce);
  const ContentSecurityPolicy = cspDirectives.join("; ");

  return [
    {
      key: "Content-Security-Policy",
      value: ContentSecurityPolicy,
    },
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
  ];
}
