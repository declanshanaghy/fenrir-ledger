# Deployment Security Checklist — Fenrir Ledger

**Owner**: Heimdall
**Last reviewed**: 2026-03-05 (updated for Stripe Direct — Patreon removed; Stripe env vars added)

Run this checklist before every production deployment. Items marked [AUTOMATED] are
covered by the Playwright test suite or CI. Items marked [MANUAL] require human review.

---

## 1. Secret Hygiene

- [ ] [MANUAL] **`.env.local` is in `.gitignore`**
  - Verify: `git check-ignore -v development/frontend/.env.local`
  - Expected: `.gitignore` matches the file

- [ ] [MANUAL] **No secrets in `.env.example`**
  - `.env.example` should contain only placeholder values (e.g., `your-client-id-here`)
  - Real values must never be committed to `.env.example`

- [ ] [MANUAL] **Grep for hardcoded secrets in source**
  ```
  grep -r "AIza" development/frontend/src/      # Google API keys
  grep -r "sk-ant-" development/frontend/src/   # Anthropic keys
  grep -r "sk-" development/frontend/src/       # OpenAI keys
  grep -r "client_secret" development/frontend/src/ # OAuth secrets
  ```
  All results should be references to `process.env.*`, not literal values.

- [ ] [MANUAL] **All required env vars are set in Vercel**
  ```
  vercel env ls
  ```
  Required vars:
  - `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `GOOGLE_PICKER_API_KEY`
  - `FENRIR_ANTHROPIC_API_KEY`
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - `KV_REST_API_URL`, `KV_REST_API_TOKEN`
  - `APP_BASE_URL` (production URL for Stripe redirects)

- [ ] [MANUAL] **No server secrets use `NEXT_PUBLIC_` prefix**
  ```
  grep -r "NEXT_PUBLIC_GOOGLE_CLIENT_SECRET" development/frontend/
  grep -r "NEXT_PUBLIC_FENRIR" development/frontend/
  grep -r "NEXT_PUBLIC_GOOGLE_PICKER" development/frontend/
  grep -r "NEXT_PUBLIC_STRIPE_SECRET" development/frontend/
  grep -r "NEXT_PUBLIC_STRIPE_WEBHOOK" development/frontend/
  ```
  All should return no results. (`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is intentionally public.)

---

## 2. API Route Authentication

- [ ] [MANUAL] **Every API route calls `requireAuth()` as first operation**
  ```
  grep -rn "export async function" development/frontend/src/app/api/ | grep -v "token/route" | grep -v "webhook/route"
  ```
  For each route found (except `/api/auth/token` and `/api/stripe/webhook`), open the file
  and confirm `requireAuth(request)` is the first call.

- [ ] [MANUAL] **`/api/stripe/webhook` uses SHA-256 HMAC verification**
  - Confirm `stripe.webhooks.constructEvent()` is called with `request.text()` (raw body)
  - Confirm `STRIPE_WEBHOOK_SECRET` is read from process.env and never logged

- [ ] [MANUAL] **`/api/auth/token` has rate limiting and origin validation**
  - Confirm `rateLimit()` is called before any processing
  - Confirm `isAllowedRedirectUri()` is called before token exchange

---

## 3. Content Security Policy

- [ ] [MANUAL] **CSP is configured in `next.config.ts`**
  - Confirm `headers()` function exists and returns security headers
  - Confirm `Content-Security-Policy` header is present

- [ ] [MANUAL] **CSP does not include `unsafe-eval` in production**
  - The current config adds `unsafe-eval` only when `NODE_ENV !== "production"`
  - Verify production build does not include `unsafe-eval` in script-src

- [ ] [MANUAL] **CSP `connect-src` does not include wildcard domains**
  - Review all `connect-src` entries; each should be a specific domain

- [ ] [MANUAL] **`X-Frame-Options: DENY` is set**
- [ ] [MANUAL] **`Strict-Transport-Security` is set with `preload`**
- [ ] [MANUAL] **`X-Content-Type-Options: nosniff` is set**

---

## 4. OAuth Configuration

- [ ] [MANUAL] **Google Cloud Console: OAuth redirect URIs are restricted**
  - Verify only these redirect URIs are registered:
    - `https://fenrir-ledger.vercel.app/auth/callback`
    - `http://localhost:9653/auth/callback`
  - No wildcard redirect URIs

- [ ] [MANUAL] **Google Cloud Console: OAuth app is not in Testing mode for production**
  - Testing mode limits users to the explicit test user list
  - For production: publish the app (requires Google verification for sensitive scopes)

- [ ] [MANUAL] **`GOOGLE_PICKER_API_KEY` has HTTP referrer restrictions in GCP Console**
  - Restrict to: `https://fenrir-ledger.vercel.app/*`
  - Without this restriction, the key can be used from any domain

---

## 5. Dependency Audit

- [ ] [AUTOMATED / CI] **No critical or high CVEs in npm dependencies**
  ```
  cd development/frontend && npm audit --audit-level=high
  ```
  Expected: 0 vulnerabilities at high or critical severity

- [ ] [MANUAL] **Lock file is committed and up to date**
  - `package-lock.json` or `yarn.lock` should be committed
  - `npm ci` should succeed without modifying the lock file

- [ ] [MANUAL] **Review any dependency added or updated in this release**
  - Check for unexpected new transitive dependencies
  - Verify the package author and download count on npmjs.com for new direct dependencies

---

## 6. Build Verification

- [ ] [AUTOMATED / CI] **Production build succeeds without TypeScript errors**
  ```
  cd development/frontend && npm run build
  ```

- [ ] [AUTOMATED / CI] **Full Playwright test suite passes**
  ```
  cd development/frontend && npx playwright test
  ```
  Expected: 0 failures (baseline count grows with each sprint)

- [ ] [MANUAL] **Verify Next.js build output does not include server secrets**
  - Check `.next/static/` for any files containing `GOOGLE_CLIENT_SECRET` or `FENRIR_ANTHROPIC_API_KEY`
  - These values must not appear in client-side JS bundles

---

## 7. Stripe Configuration

- [ ] [MANUAL] **Stripe webhook endpoint is registered in Stripe Dashboard**
  - Endpoint URL: `https://fenrir-ledger.vercel.app/api/stripe/webhook`
  - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
  - `STRIPE_WEBHOOK_SECRET` in Vercel matches the signing secret from Stripe Dashboard

- [ ] [MANUAL] **Stripe Dashboard redirect URL allowlist is configured**
  - Add `https://fenrir-ledger.vercel.app/settings` to allowed redirect URLs
  - This is a defence-in-depth control (primary control is `APP_BASE_URL` in code)

- [ ] [MANUAL] **`APP_BASE_URL` is set in Vercel production environment**
  - Value: `https://fenrir-ledger.vercel.app`
  - Used by checkout and portal routes for success/cancel redirect URLs
  - If unset, `VERCEL_URL` is used as fallback (automatically set by Vercel)

---

## 9. Vercel Deployment Configuration

- [ ] [MANUAL] **Vercel Protection Bypass secret is not exposed in PR comments or logs**
  - The bypass secret must only travel via `extraHTTPHeaders` in the Playwright runner
  - Never append it to URLs in GitHub Actions step summaries or PR comments

- [ ] [MANUAL] **Production environment variables are scoped to Production only**
  - Do not use the same API keys for Preview and Production environments
  - Preview environments should use test/sandbox API keys where available

---

## 10. Post-Deployment Verification

- [ ] [MANUAL] **Sign-in flow works end-to-end on the production URL**
  - Navigate to production URL
  - Click "Sign in to Google"
  - Complete OAuth flow
  - Verify redirect lands on the dashboard

- [ ] [MANUAL] **Security headers are present on production responses**
  ```
  curl -I https://fenrir-ledger.vercel.app/ | grep -E "Content-Security|X-Frame|X-Content|Strict-Transport|Referrer"
  ```

- [ ] [MANUAL] **Import pipeline works end-to-end**
  - Test URL import with a known-good Google Sheets URL
  - Test CSV upload with a known-good CSV file

---

## Rollback Criteria

Initiate rollback if any of the following are observed post-deployment:

- Auth failure rate > 5% (OAuth callback errors)
- `/api/auth/token` returning 500 errors
- CSP violations reported in browser console for any first-party resource
- Any hardcoded secret discovered in the deployed client-side bundle
- Any API route returning stack traces or internal paths to clients
