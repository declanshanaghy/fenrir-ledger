// Next.js configuration for Fenrir Ledger
import type { NextConfig } from "next";

/**
 * Content Security Policy directives.
 *
 * Must allow:
 * - Google APIs (OAuth, Picker, Sheets, profile images)
 * - Vercel analytics
 * - Anthropic / OpenAI for LLM extraction (connect-src)
 * - Next.js requires 'unsafe-inline' for scripts; Tailwind uses inline styles
 * - data: URIs for fonts (some Google Fonts use data: encoding)
 */
const cspDirectives = [
  // Default: only same-origin
  "default-src 'self'",

  // Scripts: self + Google APIs + Stripe.js + Vercel analytics/live + unsafe-inline (Next.js requirement)
  // In development, Next.js HMR / React Fast Refresh requires 'unsafe-eval'.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""} https://accounts.google.com https://apis.google.com https://js.stripe.com https://va.vercel-scripts.com https://vercel.live`,

  // Styles: self + unsafe-inline (Tailwind inline styles) + Google Fonts
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",

  // Images: self + Google profile pictures + YouTube thumbnails + data: URIs
  "img-src 'self' https://lh3.googleusercontent.com https://img.youtube.com data:",

  // Fonts: self + Google Fonts CDN + data: URIs
  "font-src 'self' https://fonts.gstatic.com data:",

  // Connections: self + Google APIs + Stripe + Anthropic + OpenAI + Vercel analytics/live
  [
    "connect-src 'self'",
    "https://accounts.google.com",
    "https://oauth2.googleapis.com",
    "https://www.googleapis.com",
    "https://sheets.googleapis.com",
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

const ContentSecurityPolicy = cspDirectives.join("; ");

/** Security headers applied to every response. */
const securityHeaders = [
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

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply security headers to all routes.
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
