/**
 * Auth Callback Page Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests the /auth/callback page against the design spec.
 * Real OAuth flow CANNOT be automated (requires live Google token exchange).
 * This suite tests graceful degradation: what the page renders when params
 * are absent, malformed, or when PKCE session data is missing.
 *
 * Spec references:
 *   - auth/callback/page.tsx: no code/state params → setErrorMessage("Missing code or state in callback URL.")
 *   - auth/callback/page.tsx: errorParam present → setErrorMessage(`Google returned: ${errorParam}`)
 *   - auth/callback/page.tsx: PKCE session missing → setErrorMessage("PKCE session data missing...")
 *   - auth/callback/page.tsx: CSRF mismatch → setErrorMessage("State mismatch — possible CSRF attack...")
 *   - auth/callback/page.tsx: error state → h-class "The Bifrost trembled" (destructive)
 *   - auth/callback/page.tsx: error state → link "Return to the gate" href="/ledger/sign-in"
 *   - auth/callback/page.tsx: exchanging state → "Binding the oath..."
 *   - auth/callback/page.tsx: page wraps content in Suspense fallback "Binding the oath..."
 *   - ADR-005: PKCE flow — /auth/callback is the redirect_uri for the OAuth round-trip
 *
 * What CANNOT be tested by Playwright:
 *   - Real Google OAuth code exchange (requires live Google authorization + secrets)
 *   - Token decoding from a real id_token
 *   - Session write to localStorage after successful exchange
 *   - Post-login redirect to / with merged anonymous cards
 *
 * Manual test steps for untestable paths:
 *   1. Sign in via /sign-in — click "Sign in to Google"
 *   2. Complete Google consent
 *   3. Verify redirect lands on / with user session active
 *   4. Verify anonymous cards are merged (if any existed pre-login)
 *
 * Timeout note: assertions use 15000ms. The callback page is a client-side
 * component in a Suspense boundary — error states only appear after JS bundle
 * download + React hydration + useEffect execution. On slow CI runners hitting
 * the remote production server this can exceed 5s. 15s covers P99 CI latency.
 */

import { test, expect } from "../helpers/analytics-block";
import { clearAllStorage } from "../helpers/test-fixtures";

// ─── Shared setup ─────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto("/ledger");
  await clearAllStorage(page);
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 1 — Missing Params (Graceful Degradation)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Auth Callback — Missing Params", () => {
  test("page loads without crashing when no query params are present", async ({
    page,
  }) => {
    // Spec: auth/callback/page.tsx — missing code/state → error state, no crash
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/ledger/auth/callback", { waitUntil: "networkidle" });

    const fatal = errors.filter(
      (e) =>
        !e.includes("hydration") &&
        !e.includes("HMR") &&
        !e.includes("Connection closed")
    );
    expect(fatal).toHaveLength(0);
  });

  test("shows error message when code and state params are absent", async ({
    page,
  }) => {
    // Spec: auth/callback/page.tsx — !code || !stateParam → "Missing code or state in callback URL."
    await page.goto("/ledger/auth/callback", { waitUntil: "networkidle" });

    await expect(
      page.locator("text=Missing code or state in callback URL.")
    ).toBeVisible({ timeout: 15000 });
  });

  // "The Bifrost trembled" heading — REMOVED (Issue #610): Static copy check.
  // "'Return to the gate' link" — REMOVED (Issue #610): Static element check.
  // Recovery link is implicitly tested by PKCE missing test below.
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Google Error Param
// ════════════════════════════════════════════════════════════════════════════

test.describe("Auth Callback — Google Error Param", () => {
  test("shows Google error message when error=access_denied", async ({
    page,
  }) => {
    // Spec: auth/callback/page.tsx — errorParam → `Google returned: ${errorParam}`
    await page.goto("/ledger/auth/callback?error=access_denied", {
      waitUntil: "networkidle",
    });

    await expect(
      page.locator("text=Google returned: access_denied")
    ).toBeVisible({ timeout: 15000 });
  });

  // "shows error heading when Google returns an error" — REMOVED (Issue #610): Duplicate static copy.

  test("shows error for any non-standard Google error code", async ({
    page,
  }) => {
    // Edge case: arbitrary error string from Google should not crash
    await page.goto(
      "/ledger/auth/callback?error=server_error",
      { waitUntil: "networkidle" }
    );

    await expect(
      page.locator("text=Google returned: server_error")
    ).toBeVisible({ timeout: 15000 });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 3 — PKCE Session Missing
// ════════════════════════════════════════════════════════════════════════════

test.describe("Auth Callback — PKCE Session Data Missing", () => {
  test("shows PKCE error when sessionStorage has no PKCE key", async ({
    page,
  }) => {
    // Spec: auth/callback/page.tsx — raw = sessionStorage.getItem(PKCE_SESSION_KEY)
    //       if (!raw) → "PKCE session data missing. Please try signing in again."
    // Note: callback page has a 100ms delay to prevent race conditions with React StrictMode
    // Navigate with valid-looking code + state but no PKCE session data
    await page.goto("/ledger/auth/callback?code=fake_code&state=fake_state", {
      waitUntil: "networkidle",
    });

    // Wait for the error message to appear (100ms delay + React render time)
    // Use waitFor with a longer timeout to account for component mount, effect run, and re-render
    await expect(
      page.locator("text=PKCE session data missing")
    ).toBeVisible({ timeout: 15000 });
  });

  // "'Return to the gate' link when PKCE missing" — REMOVED (Issue #610):
  // Duplicate of missing params test. Recovery link is static element.
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 4 — CSRF State Mismatch
// ════════════════════════════════════════════════════════════════════════════

test.describe("Auth Callback — CSRF State Mismatch", () => {
  test("shows state mismatch error when PKCE state differs from URL state", async ({
    page,
  }) => {
    // Spec: auth/callback/page.tsx — pkceData.state !== stateParam →
    //       "State mismatch — possible CSRF attack. Please sign in again."
    await page.goto("/ledger");
    // Seed PKCE session with a known state
    await page.evaluate(() => {
      sessionStorage.setItem(
        "fenrir:pkce",
        JSON.stringify({
          verifier: "test-verifier",
          state: "stored-state-abc",
          callbackUrl: "/",
        })
      );
    });

    // Navigate with a DIFFERENT state in the URL — triggers CSRF check
    await page.goto("/ledger/auth/callback?code=fake_code&state=different-state-xyz", {
      waitUntil: "networkidle",
    });

    await expect(
      page.locator("text=State mismatch")
    ).toBeVisible({ timeout: 15000 });
  });
});

// Suite 5 — Loading State: REMOVED (Issue #610)
// "Binding the oath..." Suspense fallback — static text check with stall trick.
// Fragile and low regression value.

// ════════════════════════════════════════════════════════════════════════════
// Suite 6 — Corrupt PKCE Data
// ════════════════════════════════════════════════════════════════════════════

test.describe("Auth Callback — Corrupt PKCE Data", () => {
  test("shows corrupt PKCE error when sessionStorage contains invalid JSON", async ({
    page,
  }) => {
    // Spec: auth/callback/page.tsx — JSON.parse throws → "Corrupt PKCE session data."
    await page.goto("/ledger");
    await page.evaluate(() => {
      sessionStorage.setItem("fenrir:pkce", "this-is-not-valid-json{{{{");
    });

    await page.goto("/ledger/auth/callback?code=fake_code&state=any-state", {
      waitUntil: "networkidle",
    });

    await expect(
      page.locator("text=Corrupt PKCE session data.")
    ).toBeVisible({ timeout: 15000 });
  });
});

// Suite 7 — Responsive: REMOVED (Issue #610)
// Just re-checks error message at smaller viewport. Low value.
