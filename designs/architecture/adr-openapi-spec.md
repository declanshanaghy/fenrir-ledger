# ADR: OpenAPI Specification for Backend API

**Status:** Accepted
**Date:** 2026-03-01
**Author:** FiremanDecko (Principal Engineer)
**Related:** ADR: Backend Server (adr-backend-server.md), Route Ownership (route-ownership.md)

---

## Context

### Current State

The Fenrir Ledger backend (`development/backend/`) is a Hono v4.7.0 + TypeScript server with the following API surface:

| Route | Method | Purpose |
|-------|--------|---------|
| `/health` | GET | Liveness probe returning `{ status, service, ts }` |
| `/import` | POST | Google Sheets import — accepts `{ url }`, returns `{ cards: ImportedCard[] }` |
| `/` | WebSocket | Duplex import streaming with typed messages |

The backend already has strong runtime type safety via Zod schemas (`CardSchema`, `CardsArraySchema` in `ws/handlers/import.ts`) and TypeScript message types (`ClientMessage`, `ServerMessage` in `types/messages.ts`). However, there is no machine-readable API specification. This creates several problems:

**1. No discoverable documentation**
A new developer or consumer of the API must read the source code to understand the endpoints, request/response shapes, and error codes. There is no interactive documentation surface.

**2. No contract enforcement between frontend and backend**
The frontend's `useSheetImport.ts` hook and the backend's route handlers share types informally via developer convention. There is no generated contract that would catch drift at build time.

**3. No client SDK generation path**
As the API surface grows (auth endpoints, sync endpoints at GA), manually maintaining fetch clients becomes error-prone. An OpenAPI spec enables automatic SDK generation via `openapi-typescript` or similar tools.

**4. No standardized error documentation**
The `ImportErrorCode` union (`INVALID_URL`, `SHEET_NOT_PUBLIC`, `FETCH_ERROR`, `ANTHROPIC_ERROR`, `PARSE_ERROR`, `NO_CARDS_FOUND`) is defined in TypeScript but not exposed to API consumers in a standard format.

### Constraints

- The backend uses Hono v4.7.0 — any OpenAPI solution must be Hono-native or compatible.
- Zod v3.24.1 is already the validation layer — the solution should derive schemas from existing Zod definitions, not duplicate them.
- WebSocket messages are not natively representable in OpenAPI — a pragmatic extension strategy is needed.
- The team is small — the solution must minimize maintenance burden, not add a separate YAML file to keep in sync.

---

## Options Considered

### Option A: Manual OpenAPI YAML/JSON File

**Description:** Write an `openapi.yaml` file by hand that describes all endpoints, then serve it statically.

**Pros:**
- Full control over the spec document
- No new dependencies
- Decoupled from runtime code

**Cons:**
- Falls out of sync with code immediately — the Zod schemas and route handlers are the source of truth, not the YAML file
- Requires discipline to update the spec every time a route changes
- Duplicates type information already expressed in Zod schemas
- No compile-time or runtime validation that the spec matches the implementation

**Verdict:** Rejected. Manual specs in a small, fast-moving team will inevitably drift from reality. The maintenance tax outweighs the simplicity benefit.

---

### Option B: `tsoa` (TypeScript OpenAPI Decorators)

**Description:** Adopt `tsoa`, which generates OpenAPI specs from TypeScript decorators on controller classes.

**Pros:**
- Mature ecosystem with Express/Koa support
- Generates both spec and route registrations from decorated classes

**Cons:**
- Not Hono-native — requires an Express compatibility layer or adapter, adding complexity
- Decorator-heavy style conflicts with Hono's functional routing pattern
- Would require rewriting all routes as decorated classes
- Adds `reflect-metadata` and experimental decorator dependencies
- Does not leverage existing Zod schemas — tsoa uses its own type-to-schema pipeline

**Verdict:** Rejected. Wrong framework fit. Hono's functional router is a better pattern than decorator-based controllers for this codebase size.

---

### Option C: `zod-to-openapi` Standalone

**Description:** Use the `@asteasolutions/zod-to-openapi` package to convert Zod schemas into OpenAPI component definitions, then manually wire them into a spec.

**Pros:**
- Reuses existing Zod schemas directly
- Framework-agnostic

**Cons:**
- Does not integrate with Hono routing — you get schema components but not path definitions
- Must manually construct the `paths` section of the OpenAPI spec, duplicating route information
- No automatic route registration or validation middleware
- Partial solution: handles schemas but not the full spec lifecycle

**Verdict:** Rejected. Solves only half the problem (schema conversion) without addressing route documentation or middleware integration.

---

### Option D: OpenAPI 3.2.0

**Description:** Target the latest OpenAPI 3.2.0 specification instead of 3.1.0.

**Pros:**
- Newest standard with incremental improvements

**Cons:**
- As of March 2026, tooling support for 3.2.0 is still maturing — `@hono/zod-openapi` targets 3.1.0
- Swagger UI and most code generators have not yet fully adopted 3.2.0
- Risk of encountering edge cases in tooling that break documentation rendering or SDK generation
- No features in 3.2.0 that are critical for our current API surface

**Verdict:** Rejected. The ecosystem is not ready. OpenAPI 3.1.0 already provides full JSON Schema 2020-12 compatibility, which is sufficient. Revisit when tooling catches up.

---

### Option E: `@hono/zod-openapi` + `@hono/swagger-ui` (Recommended)

**Description:** Use the first-party `@hono/zod-openapi` middleware to convert Hono routes + Zod schemas into an OpenAPI 3.1.0 spec, and serve interactive documentation via `@hono/swagger-ui`.

**Pros:**
- **First-party Hono integration** — maintained by the Hono team, designed for Hono's routing model
- **Single source of truth** — routes are defined with `createRoute()` which combines path, method, request schema, and response schemas in one declaration; the OpenAPI spec is derived from this
- **Reuses existing Zod schemas** — `CardSchema`, `CardsArraySchema`, and error shapes are referenced directly; no duplication
- **Runtime validation** — `@hono/zod-openapi` validates request bodies against the declared schemas automatically, replacing manual validation code
- **Interactive docs** — `@hono/swagger-ui` provides a Swagger UI at a configurable path, enabling developers and QA to explore and test the API directly in the browser
- **Client SDK generation** — the generated `openapi.json` can be fed into `openapi-typescript`, `openapi-fetch`, or any OpenAPI codegen tool
- **Minimal dependency footprint** — two packages, both lightweight, both Hono-native

**Cons:**
- Route definitions become slightly more verbose — `createRoute()` declarations are more explicit than bare `app.get("/path", handler)`
- Existing routes must be migrated from `new Hono()` to `new OpenAPIHono()` — one-time refactor
- WebSocket messages are not natively supported by OpenAPI — requires a custom extension strategy

**Verdict:** Recommended. Best fit for the existing stack, minimal friction, maximum value.

---

## Decision

**Adopt Option E: `@hono/zod-openapi` + `@hono/swagger-ui` targeting OpenAPI 3.1.0.**

### Specification Details

| Aspect | Decision |
|--------|----------|
| OpenAPI version | **3.1.0** — full JSON Schema 2020-12 compatibility, mature tooling |
| Schema source | Existing Zod schemas in `ws/handlers/import.ts` and `types/messages.ts` |
| Spec endpoint | `GET /openapi.json` — machine-readable spec |
| Docs endpoint | `GET /docs` — interactive Swagger UI |
| App constructor | Migrate `new Hono()` to `new OpenAPIHono()` in `index.ts` and route modules |
| Route definitions | Use `createRoute()` for each HTTP endpoint with request/response schemas |
| WebSocket documentation | Custom `x-websocket-messages` extension in the spec's `info` or `paths` section |

### Implementation Approach

**1. Refactor entry point**

Replace `new Hono()` with `new OpenAPIHono()` in `src/index.ts`. The `OpenAPIHono` class extends `Hono` and adds the `openapi()` method for route registration and `doc()` / `doc31()` for spec generation.

**2. Convert HTTP routes to OpenAPI routes**

Each route module (`health.ts`, `import.ts`) will define routes using `createRoute()`:

```typescript
import { createRoute, z } from "@hono/zod-openapi";

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: ["System"],
  summary: "Liveness probe",
  responses: {
    200: {
      description: "Server is healthy",
      content: {
        "application/json": {
          schema: HealthResponseSchema,
        },
      },
    },
  },
});
```

**3. Serve spec and docs**

```typescript
// OpenAPI JSON spec
app.doc("/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "Fenrir Ledger Backend API",
    version: "0.1.0",
    description: "Backend API for the Fenrir Ledger credit card churn tracker.",
  },
});

// Swagger UI
app.get("/docs", swaggerUI({ url: "/openapi.json" }));
```

**4. Document WebSocket messages via extension**

OpenAPI does not natively support WebSocket protocols. We will document WebSocket messages using a custom `x-websocket-messages` extension in the spec's `info` object:

```json
{
  "info": {
    "x-websocket-messages": {
      "endpoint": "ws://localhost:9753/",
      "client_messages": {
        "import_start": { "type": "import_start", "payload": { "url": "string" } },
        "import_cancel": { "type": "import_cancel" }
      },
      "server_messages": {
        "import_phase": { "type": "import_phase", "phase": "fetching_sheet | extracting | validating | done" },
        "import_progress": { "type": "import_progress", "rowsExtracted": "number", "totalRows": "number" },
        "import_complete": { "type": "import_complete", "cards": "ImportedCard[]" },
        "import_error": { "type": "import_error", "code": "ImportErrorCode", "message": "string" }
      }
    }
  }
}
```

This is a pragmatic approach: it keeps WebSocket documentation co-located with the API spec without pretending WebSocket fits the HTTP request/response model.

### New Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@hono/zod-openapi` | `^0.18` | Route-level OpenAPI definitions from Zod schemas |
| `@hono/swagger-ui` | `^0.5` | Interactive API documentation UI |

Both are official `@hono/*` packages maintained by the Hono team.

---

## Consequences

### Positive

- **Accurate, auto-generated documentation** — the spec is derived from the same Zod schemas that validate requests at runtime. It cannot drift from the implementation.
- **Interactive API explorer** — developers and QA can test endpoints directly from `GET /docs` without curl or Postman.
- **Client SDK generation** — `openapi-typescript` can generate TypeScript types from `openapi.json`, enabling type-safe fetch clients in the frontend.
- **API contract testing** — the spec can be used with tools like `openapi-backend` or custom validators to assert that responses match the declared schemas in CI.
- **Onboarding speed** — new developers can understand the full API surface from a single page instead of reading route handler source code.

### Negative / Trade-offs

- **Route definition verbosity increases.** Each route gains a `createRoute()` definition block that explicitly declares tags, summary, request schemas, and response schemas. This is approximately 15-25 lines per route. The verbosity is deliberate — it forces documentation to be a first-class concern.
- **Two new dependencies.** `@hono/zod-openapi` and `@hono/swagger-ui` are added to `package.json`. Both are maintained by the Hono team and have minimal transitive dependencies. The risk of abandonment is low given Hono's active development.
- **Migration effort.** Existing routes must be converted from plain `Hono()` to `OpenAPIHono()` with `createRoute()` definitions. This is a one-time refactor affecting `index.ts`, `routes/health.ts`, and `routes/import.ts`. The WebSocket server (`ws/server.ts`) is unaffected since it uses the `ws` library directly.
- **WebSocket documentation is non-standard.** The `x-websocket-messages` extension is a custom convention, not an OpenAPI-standard mechanism. Tools that consume the spec will ignore this extension. This is acceptable because WebSocket documentation is supplementary — the primary value of the spec is HTTP route documentation.

### Non-Consequences (Unchanged)

- **Zod schemas remain the source of truth.** The existing `CardSchema`, `CardsArraySchema`, and message types are not replaced or duplicated. `@hono/zod-openapi` wraps them with OpenAPI metadata but does not alter their validation behavior.
- **WebSocket server is unaffected.** The `ws` library integration in `ws/server.ts` does not change. `OpenAPIHono` handles HTTP routing; WebSocket upgrade is handled by the Node.js `http.Server` as before.
- **Frontend is unaffected.** No frontend changes are required. The spec is a backend-only addition. Frontend developers may optionally use the generated spec for SDK generation in a future sprint.
- **Deployment is unaffected.** The backend continues to run on the same port (9753) with the same entry point (`src/index.ts`). Two new routes (`/openapi.json`, `/docs`) are added but require no infrastructure changes.

---

## References

- [`@hono/zod-openapi` documentation](https://hono.dev/examples/zod-openapi)
- [`@hono/swagger-ui` documentation](https://hono.dev/examples/swagger-ui)
- [OpenAPI 3.1.0 specification](https://spec.openapis.org/oas/v3.1.0)
- [Fenrir Ledger backend entry point](../../development/backend/src/index.ts)
- [Existing Zod schemas](../../development/backend/src/ws/handlers/import.ts)
- [WebSocket message types](../../development/backend/src/types/messages.ts)
