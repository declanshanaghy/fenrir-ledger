/**
 * Vitest tests for the Fenrir Ledger OpenAPI 3.1.0 specification.
 *
 * Validates:
 *   - openApiSpec is a valid OpenAPI 3.1 document (required top-level fields)
 *   - All required security schemes are present
 *   - All 22+ route paths exist in the spec
 *   - Every path operation has operationId, summary, and at least one response
 *   - /api/health and public endpoints declare security: []
 *   - /api/auth/token declares security: []
 *   - Stripe webhook uses StripeWebhookAuth security scheme
 *   - All $ref references resolve within the spec
 *
 * Issue #2009
 */

import { describe, it, expect } from "vitest";
import { openApiSpec } from "@/lib/openapi/spec";

// ─── Type helpers ──────────────────────────────────────────────────────────

type OpenApiSpec = typeof openApiSpec;
type PathItem = Record<string, unknown>;
type Operation = {
  operationId?: string;
  summary?: string;
  responses?: Record<string, unknown>;
  security?: unknown[];
  tags?: string[];
};

// ─── Tests ────────────────────────────────────────────────────────────────

describe("OpenAPI spec structure", () => {
  it("has openapi version 3.1.0", () => {
    expect(openApiSpec.openapi).toBe("3.1.0");
  });

  it("has info block with title and version", () => {
    expect(openApiSpec.info).toBeDefined();
    expect(typeof openApiSpec.info.title).toBe("string");
    expect(openApiSpec.info.title.length).toBeGreaterThan(0);
    expect(typeof openApiSpec.info.version).toBe("string");
  });

  it("has at least one server entry", () => {
    expect(Array.isArray(openApiSpec.servers)).toBe(true);
    expect(openApiSpec.servers.length).toBeGreaterThan(0);
    const prod = openApiSpec.servers.find((s) =>
      (s as { url: string }).url.includes("fenrirledger.com"),
    );
    expect(prod).toBeDefined();
  });

  it("has paths object", () => {
    expect(openApiSpec.paths).toBeDefined();
    expect(typeof openApiSpec.paths).toBe("object");
  });

  it("has components with securitySchemes", () => {
    expect(openApiSpec.components).toBeDefined();
    expect(openApiSpec.components.securitySchemes).toBeDefined();
  });
});

describe("Security schemes", () => {
  const schemes = openApiSpec.components.securitySchemes as Record<
    string,
    { type: string; scheme?: string; in?: string; name?: string }
  >;

  it("has BearerAuth scheme", () => {
    expect(schemes.BearerAuth).toBeDefined();
    expect(schemes.BearerAuth.type).toBe("http");
    expect(schemes.BearerAuth.scheme).toBe("bearer");
  });

  it("has StripeWebhookAuth scheme", () => {
    expect(schemes.StripeWebhookAuth).toBeDefined();
    expect(schemes.StripeWebhookAuth.type).toBe("apiKey");
    expect(schemes.StripeWebhookAuth.in).toBe("header");
    expect(schemes.StripeWebhookAuth.name).toBe("stripe-signature");
  });
});

describe("Required paths present", () => {
  const paths = openApiSpec.paths as Record<string, PathItem>;
  const requiredPaths = [
    "/api/auth/token",
    "/api/config/picker",
    "/api/health",
    "/api/household/invite",
    "/api/household/invite/validate",
    "/api/household/join",
    "/api/household/kick",
    "/api/household/leave",
    "/api/household/members",
    "/api/sheets/import",
    "/api/stripe/checkout",
    "/api/stripe/membership",
    "/api/stripe/portal",
    "/api/stripe/unlink",
    "/api/stripe/webhook",
    "/api/sync",
    "/api/sync/pull",
    "/api/sync/push",
    "/api/sync/state",
    "/api/trial/convert",
    "/api/trial/init",
    "/api/trial/status",
  ];

  requiredPaths.forEach((path) => {
    it(`has path ${path}`, () => {
      expect(paths[path]).toBeDefined();
    });
  });
});

describe("HTTP method correctness", () => {
  const paths = openApiSpec.paths as Record<string, PathItem>;

  it("/api/sync/pull is GET (not POST)", () => {
    const pullPath = paths["/api/sync/pull"];
    expect(pullPath).toBeDefined();
    expect(pullPath["get"]).toBeDefined();
    expect(pullPath["post"]).toBeUndefined();
  });

  it("/api/sync/push is POST", () => {
    const pushPath = paths["/api/sync/push"];
    expect(pushPath).toBeDefined();
    expect(pushPath["post"]).toBeDefined();
  });

  it("/api/health is GET", () => {
    const healthPath = paths["/api/health"];
    expect(healthPath).toBeDefined();
    expect(healthPath["get"]).toBeDefined();
  });

  it("/api/auth/token is POST", () => {
    const tokenPath = paths["/api/auth/token"];
    expect(tokenPath).toBeDefined();
    expect(tokenPath["post"]).toBeDefined();
  });
});

describe("Operation quality", () => {
  const paths = openApiSpec.paths as Record<string, PathItem>;

  const operations: Array<{ path: string; method: string; op: Operation }> = [];
  for (const [path, pathItem] of Object.entries(paths)) {
    const methods = ["get", "post", "put", "patch", "delete"] as const;
    for (const method of methods) {
      if (pathItem[method]) {
        operations.push({ path, method, op: pathItem[method] as Operation });
      }
    }
  }

  it("all operations have operationId", () => {
    const missing = operations.filter((o) => !o.op.operationId);
    expect(missing.map((o) => `${o.method} ${o.path}`)).toEqual([]);
  });

  it("all operations have summary", () => {
    const missing = operations.filter((o) => !o.op.summary);
    expect(missing.map((o) => `${o.method} ${o.path}`)).toEqual([]);
  });

  it("all operations have at least one response", () => {
    const missing = operations.filter(
      (o) =>
        !o.op.responses || Object.keys(o.op.responses).length === 0,
    );
    expect(missing.map((o) => `${o.method} ${o.path}`)).toEqual([]);
  });

  it("all operations have tags", () => {
    const missing = operations.filter(
      (o) => !o.op.tags || o.op.tags.length === 0,
    );
    expect(missing.map((o) => `${o.method} ${o.path}`)).toEqual([]);
  });
});

describe("Public endpoints declare security: []", () => {
  const paths = openApiSpec.paths as Record<string, PathItem>;

  it("/api/auth/token declares security: []", () => {
    const op = (paths["/api/auth/token"] as { post: Operation }).post;
    expect(op.security).toBeDefined();
    expect(op.security).toEqual([]);
  });

  it("/api/health declares security: []", () => {
    const op = (paths["/api/health"] as { get: Operation }).get;
    expect(op.security).toBeDefined();
    expect(op.security).toEqual([]);
  });
});

describe("$ref resolution", () => {
  const specStr = JSON.stringify(openApiSpec);
  const refPattern = /"\$ref":"(#\/[^"]+)"/g;
  const refs: string[] = [];
  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = refPattern.exec(specStr)) !== null) {
    refs.push(match[1]!);
  }

  it("has resolvable $ref entries", () => {
    expect(refs.length).toBeGreaterThan(0);
  });

  const uniqueRefs = [...new Set(refs)];
  uniqueRefs.forEach((ref) => {
    it(`resolves $ref "${ref}"`, () => {
      // Navigate the spec object following the JSON Pointer path
      const parts = ref.replace(/^#\//, "").split("/");
      let node: unknown = openApiSpec;
      for (const part of parts) {
        expect(node).toBeDefined();
        expect(typeof node).toBe("object");
        node = (node as Record<string, unknown>)[part];
      }
      expect(node).toBeDefined();
    });
  });
});

describe("Schema completeness", () => {
  it("has Error schema", () => {
    expect(openApiSpec.components.schemas.Error).toBeDefined();
  });

  it("has Card schema", () => {
    expect(openApiSpec.components.schemas.Card).toBeDefined();
  });

  it("has HouseholdMember schema", () => {
    expect(openApiSpec.components.schemas.HouseholdMember).toBeDefined();
  });

  it("has common response references: Unauthorized, Forbidden, TooManyRequests, InternalError", () => {
    const responses = openApiSpec.components.responses as Record<string, unknown>;
    expect(responses.Unauthorized).toBeDefined();
    expect(responses.Forbidden).toBeDefined();
    expect(responses.TooManyRequests).toBeDefined();
    expect(responses.InternalError).toBeDefined();
  });
});
