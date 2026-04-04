/**
 * Unit tests for GET /openapi-ui
 *
 * Tests:
 *   - Returns 200 with text/html content type
 *   - Cache-Control is no-store
 *   - Nordic dark theme CSS variables are present (void-black bg, gold accents)
 *   - Auth gate script reads fenrir:auth from localStorage
 *   - Redirects unauthenticated users to /ledger/sign-in
 *   - Scalar CDN script tag is included
 *   - Loading state element is present
 *   - Token auto-injection logic targets id_token from session
 *   - Spec URL points to /api/openapi
 *
 * Issue #2057
 */

import { describe, it, expect } from "vitest";
import { GET } from "@/app/openapi-ui/route";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /openapi-ui", () => {
  it("returns HTTP 200", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("returns text/html content type", async () => {
    const res = await GET();
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });

  it("sets Cache-Control to no-store", async () => {
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("includes void-black background CSS variable", async () => {
    const res = await GET();
    const html = await res.text();
    expect(html).toContain("--scalar-background-1: #07070d");
  });

  it("includes gold accent CSS variable", async () => {
    const res = await GET();
    const html = await res.text();
    expect(html).toContain("--scalar-color-accent: #c9920a");
  });

  it("includes Scalar CDN script", async () => {
    const res = await GET();
    const html = await res.text();
    expect(html).toContain("cdn.jsdelivr.net/npm/@scalar/api-reference");
  });

  it("includes the fenrir-loading element", async () => {
    const res = await GET();
    const html = await res.text();
    expect(html).toContain("id=\"fenrir-loading\"");
  });

  it("reads session from fenrir:auth localStorage key", async () => {
    const res = await GET();
    const html = await res.text();
    expect(html).toContain("fenrir:auth");
  });

  it("redirects to /ledger/sign-in when unauthenticated", async () => {
    const res = await GET();
    const html = await res.text();
    expect(html).toContain("/ledger/sign-in");
  });

  it("fetches spec from /api/openapi", async () => {
    const res = await GET();
    const html = await res.text();
    expect(html).toContain("/api/openapi");
  });

  it("injects fenrir_token as Bearer token for Scalar Try It (issue #2060)", async () => {
    const res = await GET();
    const html = await res.text();
    // Auth gate passes fenrir_token to Scalar's authentication.http.bearer.token
    expect(html).toContain("fenrir_token");
    expect(html).toContain("Authorization");
  });

  it("checks expires_at for session expiry", async () => {
    const res = await GET();
    const html = await res.text();
    expect(html).toContain("expires_at");
  });

  it("includes returnTo=/openapi-ui in redirect URL", async () => {
    const res = await GET();
    const html = await res.text();
    expect(html).toContain("returnTo=/openapi-ui");
  });

  it("renders an #app mount point for Scalar", async () => {
    const res = await GET();
    const html = await res.text();
    expect(html).toContain("id=\"app\"");
  });

  it("uses Scalar.createApiReference to mount the explorer", async () => {
    const res = await GET();
    const html = await res.text();
    expect(html).toContain("Scalar.createApiReference");
  });

  it("sets darkMode: true in Scalar config", async () => {
    const res = await GET();
    const html = await res.text();
    expect(html).toContain("darkMode: true");
  });

  it("includes BearerAuth as preferredSecurityScheme", async () => {
    const res = await GET();
    const html = await res.text();
    expect(html).toContain("BearerAuth");
  });

  it("gracefully handles malformed localStorage (try/catch around JSON.parse)", async () => {
    const res = await GET();
    const html = await res.text();
    // The auth gate wraps localStorage read in try/catch and returns null on error
    expect(html).toContain("try {");
    expect(html).toContain("catch");
    expect(html).toContain("return null");
  });

  it("shows network error message on fetch failure", async () => {
    const res = await GET();
    const html = await res.text();
    expect(html).toContain("Network error");
  });

  it("shows error message when spec fetch returns non-200", async () => {
    const res = await GET();
    const html = await res.text();
    // Shows error with status code on non-ok response
    expect(html).toContain("Failed to load API spec");
  });
});
