# Security Review: Stripe Direct Integration

**Reviewer**: Heimdall
**Date**: 2026-03-04
**Scope**: Stripe Direct integration (Story 3) — all API routes under `src/app/api/stripe/`, supporting libraries under `src/lib/stripe/`, and KV entitlement store at `src/lib/kv/entitlement-store.ts`; reviewed from worktree at `development/frontend-trees/feat/stripe-foundation/`
**Report**: security/reports/2026-03-04-stripe-direct-integration.md

## Verdict: BLOCK

One critical finding (SEV-001) must be remediated before this branch is merged: real secrets are present in the worktree's `.env.local`. All other findings are medium or lower and do not individually block merge, but should be addressed in the current sprint.

---

## Executive Summary

The Stripe Direct integration is architecturally sound. Webhook signature verification uses `stripe.webhooks.constructEvent()` with SHA-256 HMAC and correctly reads the raw body before any JSON parsing. All five routes are guarded by `isStripe()`. The three routes that require user identity (`membership`, `portal`, `unlink`) call `requireAuth` and return early on failure. The dual-path checkout route (authenticated + anonymous) correctly handles both flows and applies IP-based rate limiting. The KV entitlement store uses consistent key namespacing, TTL expiry, and clean reverse-index maintenance.

However, one critical issue blocks merge: the worktree's `.env.local` contains real credentials including the Google OAuth client secret, Anthropic API key, Patreon secrets, and KV REST API token. While `.gitignore` covers `*.env` and `.env.*`, the worktree itself is stored under a path managed by the repository, and the file must be scrubbed immediately. Beyond that, two medium-severity issues require attention: the `origin` header used for Stripe redirect URLs is user-controllable (open-redirect risk), and the CSP in `next.config.ts` does not include Stripe's required domains, which will break the hosted payment page in browsers enforcing CSP on the return journey.

---

## Risk Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 1     |
| HIGH     | 0     |
| MEDIUM   | 2     |
| LOW      | 3     |
| INFO     | 3     |

---

## Findings

### [SEV-001] CRITICAL — Real Secrets Committed to Worktree `.env.local`

- **Severity**: Critical
- **Location**: `development/frontend-trees/feat/stripe-foundation/development/frontend/.env.local`
- **Category**: A02 Cryptographic Failures / Secret Exposure
- **Description**: The worktree's `.env.local` file contains live credentials. Confirmed values include:
  - `GOOGLE_CLIENT_SECRET` — value present (masked: `GOCSxxxxxxxxxxxxxxxxxxxxxxxxx606`)
  - `FENRIR_ANTHROPIC_API_KEY` — value present (masked: `sk-axxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxNQAA`)
  - `PATREON_CLIENT_ID` — value present
  - `PATREON_CLIENT_SECRET` — value present
  - `PATREON_WEBHOOK_SECRET` — value present
  - `ENTITLEMENT_ENCRYPTION_KEY` — value present (64-char hex key)
  - `KV_REST_API_TOKEN` — value present (masked: `ARDqxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxMzMA`)
  These are not placeholder values; they are real operational credentials.
- **Impact**: If the worktree directory is accidentally committed, archived, shared, or inspected by an unauthorized party, all of these credentials are immediately compromised. The Anthropic key can be used to run arbitrary LLM inference billed to the project. The KV token grants full read/write access to the entitlement store, allowing an attacker to grant or revoke subscription access for any user. The Google OAuth secret enables impersonation of the OAuth application. The Patreon secrets enable webhook spoofing and member data access.
- **Remediation**:
  1. Immediately rotate all credentials present in the file: `GOOGLE_CLIENT_SECRET`, `FENRIR_ANTHROPIC_API_KEY`, `PATREON_CLIENT_SECRET`, `PATREON_WEBHOOK_SECRET`, `ENTITLEMENT_ENCRYPTION_KEY`, `KV_REST_API_TOKEN`.
  2. Replace `.env.local` in the worktree with placeholder values matching `.env.example` before any further commits.
  3. Verify via `git log --all --full-history -- "**/.env.local"` that the file has never been committed to any branch.
  4. Add a pre-commit hook or CI check (e.g., `git-secrets` or `trufflehog`) to prevent secrets from being committed.
- **Status**: Open

---

### [SEV-002] MEDIUM — User-Controlled `origin` Header Used in Stripe Redirect URLs

- **Severity**: Medium
- **Location**: `development/frontend-trees/feat/stripe-foundation/development/frontend/src/app/api/stripe/checkout/route.ts:112`, `development/frontend-trees/feat/stripe-foundation/development/frontend/src/app/api/stripe/portal/route.ts:82`
- **Category**: A01 Broken Access Control / Open Redirect
- **Description**: Both the checkout and portal routes construct `success_url`, `cancel_url`, and `return_url` by reading the `Origin` request header first, falling back to `APP_BASE_URL`, then to `http://localhost:9653`. The `Origin` header is attacker-controllable in non-browser contexts (server-to-server calls, proxied requests, `curl`). A malicious actor could set `Origin: https://evil.example.com` and cause Stripe to redirect the user to an attacker-controlled domain after payment.
- **Impact**: Open redirect after Stripe Checkout or Customer Portal. A user completing payment could be silently redirected to a phishing page. The severity is partially mitigated because Stripe validates redirect URLs against an allowlist configured in the Stripe Dashboard — if the Dashboard is correctly configured, Stripe will reject the session creation. However, relying on Stripe's validation as the sole control is a defence-in-depth failure.
- **Remediation**: Remove the `Origin` header read entirely. Use `APP_BASE_URL` exclusively for all environments:
  ```typescript
  const baseUrl = process.env.APP_BASE_URL;
  if (!baseUrl) {
    log.error("APP_BASE_URL is not configured");
    return NextResponse.json({ error: "config_error" }, { status: 500 });
  }
  // Use baseUrl for success_url, cancel_url, return_url
  ```
  Configure `APP_BASE_URL` in Vercel for all environments (production and preview). Preview deployments should use the deployment URL, which Vercel can inject via `VERCEL_URL`.
- **Evidence**:
  ```typescript
  // checkout/route.ts:112 — origin is attacker-controllable
  const origin = request.headers.get("origin") ?? process.env.APP_BASE_URL ?? "http://localhost:9653";
  ```
- **Status**: Open

---

### [SEV-003] MEDIUM — CSP Missing Stripe Domains

- **Severity**: Medium
- **Location**: `development/frontend-trees/feat/stripe-foundation/development/frontend/next.config.ts`
- **Category**: A05 Security Misconfiguration
- **Description**: The Content Security Policy in `next.config.ts` does not include Stripe's required domains. When the browser is redirected to a Stripe-hosted checkout page (`checkout.stripe.com`) or returns to the application, and if the application hosts any Stripe.js elements, the CSP will block required resources. Specifically missing from `connect-src` and `frame-src`:
  - `https://js.stripe.com` (Stripe.js)
  - `https://checkout.stripe.com` (hosted checkout)
  - `https://billing.stripe.com` (customer portal)
  The `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is declared in `.env.example`, implying Stripe.js may be loaded client-side in a future story. If Stripe.js is ever added without a CSP update, it will silently fail in strict CSP environments.
- **Impact**: Stripe.js or embedded Stripe elements will be blocked by CSP, breaking payment functionality in browsers enforcing the policy. Security-conscious browsers (Safari, Firefox with strict settings) will refuse to load the scripts.
- **Remediation**: Add Stripe domains to the relevant CSP directives:
  ```typescript
  // script-src — add:
  "https://js.stripe.com"

  // connect-src — add:
  "https://api.stripe.com"

  // frame-src — add:
  "https://js.stripe.com"
  "https://hooks.stripe.com"
  ```
  Reference: https://docs.stripe.com/security/guide#content-security-policy
- **Status**: Open

---

### [SEV-004] LOW — In-Memory Rate Limiter Does Not Persist Across Serverless Instances

- **Severity**: Low
- **Location**: `development/frontend-trees/feat/stripe-foundation/development/frontend/src/lib/rate-limit.ts`
- **Category**: A04 Insecure Design / Missing Rate Limiting
- **Description**: The rate limiter uses an in-process `Map`. On Vercel, each serverless function invocation may run in a different container, so the rate limit counter resets on cold starts and is not shared across concurrent instances. An attacker with multiple IP addresses or who can force cold starts can bypass the limit entirely. This was noted as a known limitation in the module's own documentation.
- **Impact**: The anonymous checkout endpoint (`POST /api/stripe/checkout`) has the most exposure: an attacker can create unlimited Stripe checkout sessions for arbitrary email addresses, potentially consuming rate quota on Stripe's API and generating spam checkout emails. The 10-request-per-minute-per-IP limit is not enforced at scale.
- **Remediation**: Replace the in-memory store with a distributed rate limiter backed by Vercel KV (already in use for entitlements) or Upstash Redis. The `@upstash/ratelimit` library integrates directly with Vercel KV. The fix is a drop-in replacement for the `rateLimit()` call.
- **Status**: Open

---

### [SEV-005] LOW — Webhook Does Not Deduplicate Events (No Idempotency Check)

- **Severity**: Low
- **Location**: `development/frontend-trees/feat/stripe-foundation/development/frontend/src/app/api/stripe/webhook/route.ts`
- **Category**: A08 Software and Data Integrity Failures
- **Description**: Stripe may deliver the same webhook event more than once (guaranteed-delivery with at-least-once semantics). The webhook handler processes events without checking whether the event ID (`event.id`) has already been processed. For `checkout.session.completed`, duplicate delivery would call `stripe.subscriptions.retrieve()` again and overwrite the KV entry — generally idempotent in effect, but wasted API calls and potential race conditions during overlapping deliveries.
- **Impact**: Low risk in the current implementation because the KV writes are effectively idempotent (overwriting with the same data). However, if the handler is extended with non-idempotent operations (e.g., sending a welcome email, crediting a one-time bonus), duplicates could cause double-actions.
- **Remediation**: Store processed event IDs in KV with a short TTL (e.g., 24 hours) and check before processing:
  ```typescript
  const alreadyProcessed = await kv.get(`webhook-event:${event.id}`);
  if (alreadyProcessed) {
    return NextResponse.json({ status: "duplicate" });
  }
  await kv.set(`webhook-event:${event.id}`, true, { ex: 86400 });
  ```
- **Status**: Open

---

### [SEV-006] LOW — Anonymous Checkout Email Validation Is Weak

- **Severity**: Low
- **Location**: `development/frontend-trees/feat/stripe-foundation/development/frontend/src/app/api/stripe/checkout/route.ts:86`
- **Category**: A03 Injection / Input Validation
- **Description**: The anonymous checkout path validates the email only by checking that it is a non-empty string containing `@`. This accepts values like `@`, `a@`, `@b`, `not an email@`, and `a@b` (no TLD). While Stripe itself validates the email format before creating the session, the application should not rely on a downstream API for input validation.
- **Impact**: Malformed email addresses reach Stripe's API. Stripe may reject them (adding latency and a failed API call) or accept degenerate formats, resulting in unusable checkout sessions associated with garbage email addresses.
- **Remediation**: Use a stricter email validation pattern. A simple RFC-5321-compatible regex is sufficient:
  ```typescript
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!body.email || !EMAIL_RE.test(body.email)) { ... }
  ```
  Alternatively, use the `zod` library already available in the project for schema validation.
- **Evidence**:
  ```typescript
  // checkout/route.ts:86 — only checks for presence of "@"
  if (!body.email || typeof body.email !== "string" || !body.email.includes("@")) {
  ```
- **Status**: Open

---

### [SEV-007] INFO — `googleSub` in Stripe Metadata Is Implicitly Trusted from Webhook

- **Severity**: Info
- **Location**: `development/frontend-trees/feat/stripe-foundation/development/frontend/src/app/api/stripe/webhook/route.ts:92`
- **Category**: A01 Broken Access Control / Trust Model
- **Description**: The webhook handler reads `session.metadata?.googleSub` and uses it directly as the KV key for the entitlement record without re-verifying that the value is a valid Google subject identifier. This is acceptable because: (1) the webhook signature is verified before this code runs; (2) the only source of `googleSub` in session metadata is the checkout route, which reads it from the verified Google id_token via `requireAuth`. The trust chain is intact.
  This is noted as an observation: if the metadata field were ever populated from an untrusted source (e.g., a Stripe Dashboard metadata edit), the trust chain would break.
- **Recommendation**: Add a comment to the webhook handler explicitly noting that `googleSub` in session metadata is considered trusted only because it originates from the auth-gated checkout route.
- **Status**: Open (non-blocking)

---

### [SEV-008] INFO — `deleteStripeEntitlement` Does Not Clean Up Reverse Index on KV Error

- **Severity**: Info
- **Location**: `development/frontend-trees/feat/stripe-foundation/development/frontend/src/lib/kv/entitlement-store.ts:396`
- **Category**: A08 Software and Data Integrity Failures / Data Consistency
- **Description**: `deleteStripeEntitlement` performs two sequential KV deletes: primary entitlement key, then reverse index. If the second delete fails (transient KV error), the primary entitlement is gone but the reverse index `stripe-customer:{id}` still points to the deleted Google sub. Subsequent `customer.subscription.updated` webhook events would resolve the reverse index, find a missing entitlement, and silently return 200 without error — effectively losing the subscription update.
- **Recommendation**: Wrap both deletes in a pipeline or handle the partial-delete case in `getStripeEntitlement` by returning null if the reverse index exists but the primary key is missing.
- **Status**: Open (non-blocking)

---

### [SEV-009] INFO — Stripe Publishable Key Present in `.env.example` But No Client Usage Detected

- **Severity**: Info
- **Location**: `development/frontend-trees/feat/stripe-foundation/development/frontend/.env.example:130`
- **Category**: A05 Security Misconfiguration
- **Description**: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is defined in `.env.example` with the correct `NEXT_PUBLIC_` prefix (publishable keys are safe for client exposure). No client-side code was found consuming this variable in the current branch. Its presence in `.env.example` suggests Stripe.js or Stripe Elements may be planned for a future story.
- **Recommendation**: When Stripe.js is added to client code, update the CSP in `next.config.ts` simultaneously (see SEV-003). Ensure the publishable key is never confused with the secret key (`sk_...`), which must remain server-side only.
- **Status**: Monitoring

---

## Data Flow Analysis

```
Anonymous checkout flow:
  Client (no auth)
    → POST /api/stripe/checkout { email }
    → [isStripe() guard]
    → [IP rate limit: 10/min]
    → [email validation: weak — SEV-006]
    → stripe.checkout.sessions.create({ customer_email, success_url from Origin header — SEV-002 })
    → returns { url: "https://checkout.stripe.com/..." }
    → Client redirects to Stripe-hosted page
    → Stripe processes payment
    → Stripe POST /api/stripe/webhook (checkout.session.completed, no googleSub)
    → [HMAC signature verified]
    → setAnonymousStripeEntitlement(customerId, entitlement) → KV

Authenticated checkout flow:
  Client (Google id_token)
    → POST /api/stripe/checkout { Authorization: Bearer <id_token> }
    → [isStripe() guard]
    → [IP rate limit: 10/min]
    → requireAuth → verified Google user { sub, email }
    → stripe.checkout.sessions.create({ customer_email, metadata: { googleSub }, success_url from Origin header — SEV-002 })
    → returns { url }
    → Stripe POST /api/stripe/webhook (checkout.session.completed, googleSub present)
    → [HMAC signature verified]
    → setStripeEntitlement(googleSub, entitlement) → KV

Webhook flow (subscription update/delete):
  Stripe → POST /api/stripe/webhook
    → [isStripe() guard]
    → request.text() (raw body preserved — CORRECT)
    → verifyWebhookSignature(rawBody, stripe-signature header)
    → stripe.webhooks.constructEvent() — SHA-256 HMAC — CORRECT
    → getGoogleSubByStripeCustomerId(customerId) → reverse index lookup
    → update/delete entitlement in KV

Membership check:
  Client (Google id_token)
    → GET /api/stripe/membership
    → [isStripe() guard]
    → [IP rate limit: 20/min]
    → requireAuth → googleSub
    → getStripeEntitlement(googleSub) → KV
    → return { tier, active, platform: "stripe" }
    [Cache-Control: no-store — CORRECT]
```

---

## Compliance Checklist

- [x] All API routes call `requireAuth()` where applicable
  - `/api/stripe/membership` — requireAuth, returns early on failure
  - `/api/stripe/portal` — requireAuth, returns early on failure
  - `/api/stripe/unlink` — requireAuth, returns early on failure
  - `/api/stripe/checkout` — dual path; requireAuth attempted, anonymous fallback is by design
  - `/api/stripe/webhook` — no auth (correct; HMAC signature verification used instead)
- [x] No server secrets use `NEXT_PUBLIC_` prefix (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` are server-only)
- [x] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` correctly uses `NEXT_PUBLIC_` prefix (publishable keys are safe)
- [x] `.env` files are in `.gitignore` (`.env.*` pattern covers `.env.local`)
- [FAIL] No real secrets in source-controlled files — `.env.local` in worktree contains real credentials (SEV-001)
- [x] Error responses do not leak stack traces or internal details (all errors return generic messages)
- [x] OAuth tokens have expiration handling (managed by existing `requireAuth` / JWKS flow)
- [x] User input is validated before use (weak for anonymous email — SEV-006)
- [x] CORS is not explicitly misconfigured (Next.js defaults apply)
- [PARTIAL] Security headers are present — CSP is missing Stripe domains (SEV-003)
- [x] `stripe.webhooks.constructEvent()` used correctly with raw body (not parsed JSON)
- [x] `STRIPE_WEBHOOK_SECRET` is never logged or returned to clients
- [x] KV TTL set on all entitlement writes (30-day expiry)
- [x] Reverse index maintained consistently on set/delete

---

## Recommendations

1. **[CRITICAL]** Immediately rotate all real credentials found in `.env.local` in the worktree (`GOOGLE_CLIENT_SECRET`, `FENRIR_ANTHROPIC_API_KEY`, `PATREON_CLIENT_SECRET`, `PATREON_WEBHOOK_SECRET`, `ENTITLEMENT_ENCRYPTION_KEY`, `KV_REST_API_TOKEN`). Replace the file with placeholders matching `.env.example`. Verify the file was never committed. Add a pre-commit secret-scanning hook (SEV-001).

2. **[MEDIUM]** Remove the `Origin` header read from `checkout/route.ts` and `portal/route.ts`. Use `APP_BASE_URL` exclusively for all redirect URLs. Make `APP_BASE_URL` a required config value that causes a startup error if absent. This eliminates the open-redirect attack surface (SEV-002).

3. **[MEDIUM]** Add Stripe's required domains to the Content Security Policy in `next.config.ts`: `js.stripe.com` to `script-src` and `frame-src`; `api.stripe.com` to `connect-src`; `hooks.stripe.com` to `frame-src`. Do this now, before Stripe.js is added, so the CSP is ready (SEV-003).

4. **[LOW]** Replace the in-memory rate limiter with a distributed implementation backed by Vercel KV or Upstash to ensure limits are enforced across serverless instances (SEV-004).

5. **[LOW]** Add webhook event ID deduplication using a short-TTL KV key to prevent double-processing on Stripe's at-least-once delivery retries (SEV-005).

6. **[LOW]** Strengthen the anonymous checkout email validation with a proper regex or `zod` schema rather than a bare `includes("@")` check (SEV-006).

7. **[INFO]** Add an explicit comment in `webhook/route.ts` near the `googleSub` metadata read noting the trust chain dependency on the checkout route (SEV-007).

8. **[INFO]** Consider wrapping the two-step KV delete in `deleteStripeEntitlement` in a pipeline to reduce partial-failure exposure (SEV-008).
