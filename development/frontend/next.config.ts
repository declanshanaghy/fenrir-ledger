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

  // Scripts: self + Google APIs + Vercel analytics + unsafe-inline (Next.js requirement)
  `script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com https://va.vercel-scripts.com`,

  // Styles: self + unsafe-inline (Tailwind inline styles) + Google Fonts
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",

  // Images: self + Google profile pictures + data: URIs
  "img-src 'self' https://lh3.googleusercontent.com data:",

  // Fonts: self + Google Fonts CDN + data: URIs
  "font-src 'self' https://fonts.gstatic.com data:",

  // Connections: self + Google APIs + Anthropic + OpenAI + Vercel analytics
  [
    "connect-src 'self'",
    "https://accounts.google.com",
    "https://oauth2.googleapis.com",
    "https://www.googleapis.com",
    "https://sheets.googleapis.com",
    "https://docs.google.com",
    "https://apis.google.com",
    "https://api.anthropic.com",
    "https://api.openai.com",
    "https://va.vercel-scripts.com",
  ].join(" "),

  // Frames: Google Picker and OAuth consent
  "frame-src https://accounts.google.com https://docs.google.com https://drive.google.com",

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
  async rewrites() {
    return [
      { source: "/static", destination: "/static/index.html" },
      { source: "/sessions", destination: "/sessions/index.html" },
    ];
  },

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
