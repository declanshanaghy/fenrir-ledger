# API Route Security Checklist — Fenrir Ledger

**Owner**: Heimdall
**Last reviewed**: 2026-03-20 (updated distributed rate limiting guidance — Upstash Redis removed in issue #1521)

Use this checklist whenever adding, modifying, or reviewing an API route under
`development/frontend/src/app/api/`.

---

## Mandatory Requirements

Every route handler MUST pass all items in this section before merge.

### 1. Authentication

- [ ] **Route calls `requireAuth(request)` as the first operation in the handler body**
  - Pattern: `const auth = await requireAuth(request); if (!auth.ok) return auth.response;`
  - Exception: `/api/auth/token` is the only accepted exception (OAuth token exchange proxy cannot require a Bearer token because the client is obtaining its token there — document any new exceptions with rationale)
  - Reference: `development/frontend/src/lib/auth/require-auth.ts`

- [ ] **Handler returns `auth.response` immediately if `!auth.ok`**
  - No handler logic executes before this check
  - No partial processing before the auth return

### 2. Input Validation

- [ ] **All user-supplied inputs are validated before use**
  - Request body: parsed with `await request.json()` inside a try/catch; return 400 on parse failure
  - String inputs: type-checked (`typeof x === "string"`) before use
  - Enum inputs: checked against an allowlist
  - URL inputs: parsed with `new URL()` and hostname validated

- [ ] **Request body fields are not spread directly into data structures**
  - Destructure only the fields you need: `const { url, csv } = body`
  - Never do `saveCard({ ...body })` or equivalent

- [ ] **At most one input path is accepted per operation**
  - Example from import route: exactly one of `url` or `csv`, not both

### 3. Error Responses

- [ ] **Error responses use generic messages for clients**
  - No stack traces in responses
  - No internal file paths
  - No database/service implementation details
  - No raw third-party error messages forwarded verbatim (see SEV-007)

- [ ] **Internal errors are logged server-side with full context**
  - Use `log.error("routeName: description", { context })` from `@/lib/logger` (fenrir structured logger)
  - Use `log.debug` at entry and exit of every handler (with return value summary)
  - Never use raw `console.*` in API routes — always use the fenrir logger
  - Include route context and relevant non-sensitive metadata

- [ ] **HTTP status codes are semantically correct**
  - 400: malformed request (bad JSON, missing fields, invalid input)
  - 401: missing or invalid authentication
  - 403: authenticated but not authorized (audience mismatch, forbidden resource)
  - 404: resource not found
  - 429: rate limited
  - 500: unexpected server error
  - 502: upstream service unreachable (e.g., Google API down)

### 4. Secrets and Configuration

- [ ] **Server secrets are read only from `process.env`**
  - No hardcoded API keys, passwords, or tokens

- [ ] **Server secrets do NOT have the `NEXT_PUBLIC_` prefix**
  - `GOOGLE_CLIENT_SECRET` — correct
  - `FENRIR_ANTHROPIC_API_KEY` — correct
  - Never: `NEXT_PUBLIC_ANTHROPIC_API_KEY`

- [ ] **Secrets are not included in response bodies**
  - If an API key must be served to the browser, it must be auth-gated
  - Add `Cache-Control: no-store` to any response containing a secret or API key

- [ ] **Missing required env vars are handled gracefully**
  - Return 500 with a generic message if a required secret is not configured
  - Log the missing variable name server-side

### 5. Rate Limiting (for unauthenticated or expensive routes)

- [ ] **Unauthenticated routes implement rate limiting**
  - At minimum: in-memory rate limit via `rateLimit()` from `src/lib/rate-limit.ts`
  - For production: prefer a distributed rate limiter (Firestore or external Redis) — Upstash Redis has been removed (issue #1521)

- [ ] **Routes that call external services (LLM, Google APIs) are rate-limited**
  - Consider per-user rate limits (keyed on `auth.user.sub`) in addition to per-IP

### 5a. Firestore / Household Authorization

Routes that access Firestore on behalf of the authenticated user MUST derive the `householdId`
from the server-side user record, never from client-supplied inputs.

- [ ] **Routes accessing Firestore household data derive `householdId` from `getUser(auth.user.sub)`**
  - Pattern:
    ```typescript
    const user = await getUser(auth.user.sub);
    if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    // Use user.householdId — never request.nextUrl.searchParams.get("householdId")
    ```
  - If the route receives a `householdId` parameter (e.g., for validation), compare it against
    `user.householdId` and return 403 if they differ
  - Override any client-supplied `householdId` on write payloads (e.g., card objects) with the
    server-derived value before writing to Firestore

### 6. SSRF Prevention

- [ ] **Routes that fetch external URLs validate the URL before fetching**
  - Allowlist of permitted hostnames or domains
  - Reject private IP ranges if any external fetching is introduced
  - Do not use `redirect: "follow"` unless the destination domain is trusted

### 7. Response Headers

- [ ] **API routes do not override or remove security headers set by `next.config.ts`**
  - Security headers are set globally; do not set `headers()` in individual routes unless adding route-specific headers

---

## Accepted Exceptions

| Route | Exception | Rationale | Compensating Control |
|-------|-----------|-----------|----------------------|
| `/api/auth/token` | No `requireAuth()` call | Token exchange proxy: the client is obtaining its Bearer token here. | redirect_uri allowlist, rate limiting |
| `/api/stripe/webhook` | No `requireAuth()` call | Stripe delivers webhooks server-to-server; no Bearer token is available. | SHA-256 HMAC via `stripe.webhooks.constructEvent()` with `STRIPE_WEBHOOK_SECRET` |

To add a new exception, it must be:
1. Documented in this table with rationale
2. Reviewed and approved by Heimdall
3. Protected by a compensating control (rate limit, allowlist, etc.)

---

## Code Template

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { log } from "@/lib/logger";

export async function POST(request: NextRequest): Promise<NextResponse> {
  log.debug("POST /api/your-route called");

  // 1. Auth guard — MUST be first
  const auth = await requireAuth(request);
  if (!auth.ok) {
    log.debug("POST /api/your-route returning", { status: 401 });
    return auth.response;
  }
  // auth.user: { sub, email, name, picture }

  // 2. Parse and validate input
  let body: { field: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    log.debug("POST /api/your-route returning", { status: 400, error: "invalid_json" });
    return NextResponse.json(
      { error: "invalid_request", error_description: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const { field } = body;
  if (!field || typeof field !== "string") {
    log.debug("POST /api/your-route returning", { status: 400, error: "missing_field" });
    return NextResponse.json(
      { error: "invalid_request", error_description: "Missing required field: field." },
      { status: 400 }
    );
  }

  // 3. Handler logic
  try {
    // ... your logic here
    log.debug("POST /api/your-route returning", { status: 200 });
    return NextResponse.json({ result: "ok" });
  } catch (err) {
    // 4. Generic error response + server-side logging
    const message = err instanceof Error ? err.message : String(err);
    log.error("POST /api/your-route: unexpected error", { error: message });
    log.debug("POST /api/your-route returning", { status: 500, error: "server_error" });
    return NextResponse.json(
      { error: "server_error", error_description: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
```

---

## Review Checklist (for code reviewers)

When reviewing a PR that adds or modifies an API route, verify:

1. Open the route file and confirm `requireAuth()` is the first call in every exported handler
2. Confirm `if (!auth.ok) return auth.response` immediately follows
3. Check all `request.json()` calls are wrapped in try/catch with 400 response
4. Grep the file for `process.env.NEXT_PUBLIC_` — flag any server secret using this prefix
5. Search for `console.log` / `console.error` / `console.info` — should use `log.*` from `@/lib/logger` instead
6. Check error responses for raw error messages forwarded from third parties
7. Check for any `fetch()` calls — verify hostname validation exists
