/**
 * Vitest integration tests for GET /api/openapi.yml
 *
 * Tests:
 *   - Returns 200 with Content-Type application/yaml
 *   - Body is valid YAML (can be parsed)
 *   - Parsed YAML has openapi: "3.1.0"
 *   - Cache-Control header is public, max-age=300
 *   - No auth required (no 401 when unauthenticated)
 *   - YAML round-trips to same structure as JSON spec
 *   - Nested objects serialize correctly (no [object Object] truncation)
 *   - StripeWebhookAuth security scheme present
 *   - /api/health path present
 *   - /api/sync/pull documented as GET (not POST)
 *
 * Issue #2009
 */

import { describe, it, expect } from "vitest";
import { parse } from "yaml";
import { GET } from "@/app/api/openapi.yml/route";
import { openApiSpec } from "@/lib/openapi/spec";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/openapi.yml", () => {
  it("returns 200", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("returns Content-Type application/yaml", async () => {
    const res = await GET();
    const ct = res.headers.get("Content-Type");
    expect(ct).toContain("application/yaml");
  });

  it("body is valid YAML (parses without error)", async () => {
    const res = await GET();
    const text = await res.text();
    expect(() => parse(text)).not.toThrow();
  });

  it("parsed YAML has openapi 3.1.0", async () => {
    const res = await GET();
    const text = await res.text();
    const body = parse(text) as Record<string, unknown>;
    expect(body.openapi).toBe("3.1.0");
  });

  it("sets Cache-Control with public and max-age=300", async () => {
    const res = await GET();
    const cc = res.headers.get("Cache-Control");
    expect(cc).toContain("public");
    expect(cc).toContain("max-age=300");
  });

  it("does not require auth — no 401 when unauthenticated", async () => {
    const res = await GET();
    expect(res.status).not.toBe(401);
    expect(res.status).toBe(200);
  });

  it("YAML round-trips to same keys as JSON spec", async () => {
    const res = await GET();
    const text = await res.text();
    const parsed = parse(text) as Record<string, unknown>;

    // Top-level keys match
    expect(parsed.openapi).toBe(openApiSpec.openapi);
    expect((parsed.info as typeof openApiSpec.info).title).toBe(openApiSpec.info.title);
    expect((parsed.info as typeof openApiSpec.info).version).toBe(openApiSpec.info.version);
  });

  it("nested objects serialize correctly — no [object Object] truncation", async () => {
    const res = await GET();
    const text = await res.text();

    // If any value was coerced to [object Object], the YAML would contain that literal string
    expect(text).not.toContain("[object Object]");
  });

  it("YAML paths match JSON spec paths", async () => {
    const res = await GET();
    const text = await res.text();
    const parsed = parse(text) as { paths: Record<string, unknown> };

    const jsonPaths = Object.keys(openApiSpec.paths);
    const yamlPaths = Object.keys(parsed.paths);

    expect(yamlPaths.sort()).toEqual(jsonPaths.sort());
  });

  it("has StripeWebhookAuth security scheme", async () => {
    const res = await GET();
    const text = await res.text();
    const body = parse(text) as { components: { securitySchemes: Record<string, unknown> } };
    expect(body.components.securitySchemes).toHaveProperty("StripeWebhookAuth");
  });

  it("has BearerAuth security scheme", async () => {
    const res = await GET();
    const text = await res.text();
    const body = parse(text) as { components: { securitySchemes: Record<string, unknown> } };
    expect(body.components.securitySchemes).toHaveProperty("BearerAuth");
  });

  it("has /api/health path", async () => {
    const res = await GET();
    const text = await res.text();
    const body = parse(text) as { paths: Record<string, unknown> };
    expect(body.paths).toHaveProperty("/api/health");
  });

  it("/api/sync/pull is documented as GET, not POST", async () => {
    const res = await GET();
    const text = await res.text();
    const body = parse(text) as { paths: Record<string, Record<string, unknown>> };
    const syncPull = body.paths["/api/sync/pull"];
    expect(syncPull).toBeDefined();
    expect(syncPull).toHaveProperty("get");
    expect(syncPull).not.toHaveProperty("post");
  });

  it("YAML servers block contains production URL", async () => {
    const res = await GET();
    const text = await res.text();
    const body = parse(text) as { servers: Array<{ url: string }> };
    const prod = body.servers.find((s) => s.url.includes("fenrirledger.com"));
    expect(prod).toBeDefined();
  });
});
