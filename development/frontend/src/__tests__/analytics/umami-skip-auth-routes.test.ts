/**
 * Vitest — oauth2-proxy skip-auth route pattern validation — Issue #931
 *
 * Validates that the skip-auth regex patterns deployed via Helm correctly
 * allow unauthenticated access to Umami tracking endpoints while enforcing
 * auth on all other paths (including the dashboard root).
 *
 * Acceptance criteria tested:
 *   AC1: /script.js is accessible without auth (tracking script loads)
 *   AC2: POST /api/send is accessible without auth (events are ingested)
 *   AC3: / (dashboard root) requires auth — NOT in skip patterns
 *
 * These are pure-logic regex tests — no file I/O, no network, no YAML.
 * The patterns mirror --skip-auth-route args in infrastructure/helm/umami/templates/deployment.yaml.
 *
 * @ref #931
 */

import { describe, it, expect } from "vitest";

/**
 * The oauth2-proxy skip-auth-route patterns as deployed:
 *   --skip-auth-route=GET=^/script\.js$
 *   --skip-auth-route=POST=^/api/send$
 *
 * In oauth2-proxy these are matched against the request path. We test the
 * regex portion directly.
 */
const SKIP_AUTH_PATTERNS = {
  /** GET requests matching this path bypass oauth2-proxy auth */
  scriptJs: /^\/script\.js$/,
  /** POST requests matching this path bypass oauth2-proxy auth */
  apiSend: /^\/api\/send$/,
};

// ---------------------------------------------------------------------------
describe("oauth2-proxy skip-auth patterns — Issue #931", () => {
  // ─── GET /script.js — Umami tracking script (AC1) ─────────────────────
  describe("GET /script.js pattern — Umami tracking script must be public", () => {
    it("matches /script.js exactly (tracking script loads without auth)", () => {
      expect(SKIP_AUTH_PATTERNS.scriptJs.test("/script.js")).toBe(true);
    });

    it("does not match /script.jsx (extension boundary enforced)", () => {
      expect(SKIP_AUTH_PATTERNS.scriptJs.test("/script.jsx")).toBe(false);
    });

    it("does not match /script.js/extra (end anchor enforced)", () => {
      expect(SKIP_AUTH_PATTERNS.scriptJs.test("/script.js/extra")).toBe(false);
    });

    it("does not match /other/script.js (start anchor enforced)", () => {
      expect(SKIP_AUTH_PATTERNS.scriptJs.test("/other/script.js")).toBe(false);
    });

    it("does not match /scriptXjs (dot is escaped, not wildcard)", () => {
      // Unescaped `.` would match any character — confirm it is escaped
      expect(SKIP_AUTH_PATTERNS.scriptJs.test("/scriptXjs")).toBe(false);
    });

    it("does not match empty string", () => {
      expect(SKIP_AUTH_PATTERNS.scriptJs.test("")).toBe(false);
    });
  });

  // ─── POST /api/send — Umami event ingestion (AC2) ─────────────────────
  describe("POST /api/send pattern — event ingestion must be public", () => {
    it("matches /api/send exactly (events ingested without auth)", () => {
      expect(SKIP_AUTH_PATTERNS.apiSend.test("/api/send")).toBe(true);
    });

    it("does not match /api/send/extra (end anchor enforced)", () => {
      expect(SKIP_AUTH_PATTERNS.apiSend.test("/api/send/extra")).toBe(false);
    });

    it("does not match /api/sender (partial suffix)", () => {
      expect(SKIP_AUTH_PATTERNS.apiSend.test("/api/sender")).toBe(false);
    });

    it("does not match /api (missing /send segment)", () => {
      expect(SKIP_AUTH_PATTERNS.apiSend.test("/api")).toBe(false);
    });

    it("does not match /v2/api/send (different prefix)", () => {
      expect(SKIP_AUTH_PATTERNS.apiSend.test("/v2/api/send")).toBe(false);
    });

    it("does not match empty string", () => {
      expect(SKIP_AUTH_PATTERNS.apiSend.test("")).toBe(false);
    });
  });

  // ─── Dashboard root / — must require auth (AC3) ────────────────────────
  describe("Dashboard root / — auth must be enforced", () => {
    it("/ does not match script.js pattern (dashboard root requires auth)", () => {
      expect(SKIP_AUTH_PATTERNS.scriptJs.test("/")).toBe(false);
    });

    it("/ does not match /api/send pattern (dashboard root requires auth)", () => {
      expect(SKIP_AUTH_PATTERNS.apiSend.test("/")).toBe(false);
    });

    it("/login does not match either skip pattern", () => {
      expect(SKIP_AUTH_PATTERNS.scriptJs.test("/login")).toBe(false);
      expect(SKIP_AUTH_PATTERNS.apiSend.test("/login")).toBe(false);
    });

    it("/api/websites does not match skip patterns (dashboard API requires auth)", () => {
      expect(SKIP_AUTH_PATTERNS.scriptJs.test("/api/websites")).toBe(false);
      expect(SKIP_AUTH_PATTERNS.apiSend.test("/api/websites")).toBe(false);
    });
  });

  // ─── No cross-contamination between patterns ───────────────────────────
  describe("Pattern isolation — no cross-contamination", () => {
    it("script.js pattern does not match /api/send", () => {
      expect(SKIP_AUTH_PATTERNS.scriptJs.test("/api/send")).toBe(false);
    });

    it("/api/send pattern does not match /script.js", () => {
      expect(SKIP_AUTH_PATTERNS.apiSend.test("/script.js")).toBe(false);
    });
  });
});
