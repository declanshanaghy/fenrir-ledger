/**
 * Vitest integration tests for GET /api/openapi.json
 *
 * Tests:
 *   - Returns 200 with Content-Type application/json
 *   - Body parses as valid JSON with openapi: "3.1.0"
 *   - Cache-Control header is public, max-age=300
 *   - No auth required (no 401 when unauthenticated)
 *   - StripeWebhookAuth security scheme present
 *   - /api/health path present
 *   - /api/sync/pull documented as GET (not POST)
 *
 * Issue #2009
 */

import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/openapi.json/route";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/openapi.json", () => {
  it("returns 200", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("returns Content-Type application/json", async () => {
    const res = await GET();
    const ct = res.headers.get("Content-Type");
    expect(ct).toContain("application/json");
  });

  it("body parses as valid JSON", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body).toBeDefined();
    expect(typeof body).toBe("object");
  });

  it("body has openapi 3.1.0", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.openapi).toBe("3.1.0");
  });

  it("sets Cache-Control with public and max-age=300", async () => {
    const res = await GET();
    const cc = res.headers.get("Cache-Control");
    expect(cc).toContain("public");
    expect(cc).toContain("max-age=300");
  });

  it("does not require auth — no 401 when unauthenticated", async () => {
    // Route has no requireAuth call; calling directly should return 200
    const res = await GET();
    expect(res.status).not.toBe(401);
    expect(res.status).toBe(200);
  });

  it("has StripeWebhookAuth security scheme", async () => {
    const res = await GET();
    const body = await res.json() as { components: { securitySchemes: Record<string, unknown> } };
    expect(body.components.securitySchemes).toHaveProperty("StripeWebhookAuth");
  });

  it("has BearerAuth security scheme", async () => {
    const res = await GET();
    const body = await res.json() as { components: { securitySchemes: Record<string, unknown> } };
    expect(body.components.securitySchemes).toHaveProperty("BearerAuth");
  });

  it("has /api/health path", async () => {
    const res = await GET();
    const body = await res.json() as { paths: Record<string, unknown> };
    expect(body.paths).toHaveProperty("/api/health");
  });

  it("/api/sync/pull is documented as GET, not POST", async () => {
    const res = await GET();
    const body = await res.json() as { paths: Record<string, Record<string, unknown>> };
    const syncPull = body.paths["/api/sync/pull"];
    expect(syncPull).toBeDefined();
    expect(syncPull).toHaveProperty("get");
    expect(syncPull).not.toHaveProperty("post");
  });

  it("all $ref references resolve within the spec", async () => {
    const res = await GET();
    const body = await res.json() as Record<string, unknown>;

    // Collect all $ref values in the document recursively
    const refs: string[] = [];
    function collectRefs(obj: unknown): void {
      if (!obj || typeof obj !== "object") return;
      if (Array.isArray(obj)) { obj.forEach(collectRefs); return; }
      const record = obj as Record<string, unknown>;
      for (const [k, v] of Object.entries(record)) {
        if (k === "$ref" && typeof v === "string") refs.push(v);
        else collectRefs(v);
      }
    }
    collectRefs(body);

    // Only local refs (#/...) are expected in this spec
    const localRefs = refs.filter((r) => r.startsWith("#/"));
    for (const ref of localRefs) {
      const parts = ref.slice(2).split("/");
      let node: unknown = body;
      for (const part of parts) {
        expect(node).toBeDefined();
        node = (node as Record<string, unknown>)[part];
      }
      expect(node).toBeDefined();
    }
  });
});
