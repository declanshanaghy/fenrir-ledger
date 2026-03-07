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
 *   - auth/callback/page.tsx: error state → link "Return to the gate" href="/sign-in"
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
 */

import { test, expect } from "@playwright/test";
import { clearAllStorage } from "../helpers/test-fixtures";

// ─── Shared setup ─────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto("/");
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

    await page.goto("/auth/callback", { waitUntil: "networkidle" });

    const fatal = errors.filter(
      (e) => !e.includes("hydration") && !e.includes("HMR")
    );
    expect(fatal).toHaveLength(0);
  });

  test("shows error message when code and state params are absent", async ({
    page,
  }) => {
    // Spec: auth/callback/page.tsx — !code || !stateParam → "Missing code or state in callback URL."
    await page.goto("/auth/callback", { waitUntil: "networkidle" });

    await expect(
      page.locator("text=Missing code or state in callback URL.")
    ).toBeVisible({ timeout: 5000 });
  });

  test("shows error heading 'The Bifrost trembled' when params are absent", async ({
    page,
  }) => {
    // Spec: auth/callback/page.tsx — error state renders destructive heading "The Bifrost trembled"
    await page.goto("/auth/callback", { waitUntil: "networkidle" });

    // The heading uses the Norse name with ö — match either variant for robustness
    const heading = page.locator("text=The Bifr");
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test("'Return to the gate' link is visible and points to /sign-in", async ({
    page,
  }) => {
    // Spec: auth/callback/page.tsx — error state renders <a href="/sign-in">Return to the gate</a>
    await page.goto("/auth/callback", { waitUntil: "networkidle" });

    const link = page.locator("a:has-text('Return to the gate')");
    await expect(link).toBeVisible({ timeout: 5000 });
    await expect(link).toHaveAttribute("href", "/sign-in");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Google Error Param
// ════════════════════════════════════════════════════════════════════════════

test.describe("Auth Callback — Google Error Param", () => {
  test("shows Google error message when error=access_denied", async ({
    page,
  }) => {
    // Spec: auth/callback/page.tsx — errorParam → `Google returned: ${errorParam}`
    await page.goto("/auth/callback?error=access_denied", {
      waitUntil: "networkidle",
    });

    await expect(
      page.locator("text=Google returned: access_denied")
    ).toBeVisible({ timeout: 5000 });
  });

  test("shows error heading when Google returns an error", async ({ page }) => {
    // Spec: auth/callback/page.tsx — error state renders destructive heading
    await page.goto("/auth/callback?error=access_denied", {
      waitUntil: "networkidle",
    });

    const heading = page.locator("text=The Bifr");
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test("shows error for any non-standard Google error code", async ({
    page,
  }) => {
    // Edge case: arbitrary error string from Google should not crash
    await page.goto(
      "/auth/callback?error=server_error",
      { waitUntil: "networkidle" }
    );

    await expect(
      page.locator("text=Google returned: server_error")
    ).toBeVisible({ timeout: 5000 });
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
    await page.goto("/auth/callback?code=fake_code&state=fake_state", {
      waitUntil: "networkidle",
    });

    // Wait for the error message to appear (100ms delay + React render time)
    // Use waitFor with a longer timeout to account for component mount, effect run, and re-render
    await expect(
      page.locator("text=PKCE session data missing")
    ).toBeVisible({ timeout: 10000 });
  });

  test("shows 'Return to the gate' link when PKCE data is missing", async ({
    page,
  }) => {
    // Spec: error state always renders the sign-in recovery link
    // Note: callback page has a 100ms delay to prevent race conditions with React StrictMode
    await page.goto("/auth/callback?code=fake_code&state=fake_state", {
      waitUntil: "networkidle",
    });

    // Wait for the error state to render with a longer timeout
    const link = page.locator("a:has-text('Return to the gate')");
    await expect(link).toBeVisible({ timeout: 10000 });
  });
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
    await page.goto("/");
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
    await page.goto("/auth/callback?code=fake_code&state=different-state-xyz", {
      waitUntil: "networkidle",
    });

    await expect(
      page.locator("text=State mismatch")
    ).toBeVisible({ timeout: 5000 });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 5 — Loading / Exchanging State
// ════════════════════════════════════════════════════════════════════════════

test.describe("Auth Callback — Loading State", () => {
  test("Suspense fallback contains 'Binding the oath...' text", async ({
    page,
  }) => {
    // Spec: auth/callback/page.tsx Suspense fallback renders "Binding the oath..."
    // This is visible during the initial hydration before client JS runs.
    // We intercept the token exchange request so the page stays in 'exchanging' state.
    await page.route("/api/auth/token", async (route) => {
      // Stall indefinitely to observe the exchanging state
      await new Promise(() => {}); // never resolves
    });

    // Seed valid PKCE data so the page proceeds to the exchange step
    await page.goto("/");
    await page.evaluate(() => {
      sessionStorage.setItem(
        "fenrir:pkce",
        JSON.stringify({
          verifier: "test-verifier",
          state: "consistent-state",
          callbackUrl: "/",
        })
      );
    });

    // Navigate — the exchange is stalled so page stays in "exchanging"
    const navPromise = page.goto(
      "/auth/callback?code=fake_code&state=consistent-state",
      { waitUntil: "domcontentloaded", timeout: 5000 }
    );

    await expect(
      page.locator("text=Binding the oath...")
    ).toBeVisible({ timeout: 5000 });

    // Unroute so cleanup doesn't hang
    await page.unroute("/api/auth/token");
    navPromise.catch(() => {}); // swallow timeout
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 6 — Corrupt PKCE Data
// ════════════════════════════════════════════════════════════════════════════

test.describe("Auth Callback — Corrupt PKCE Data", () => {
  test("shows corrupt PKCE error when sessionStorage contains invalid JSON", async ({
    page,
  }) => {
    // Spec: auth/callback/page.tsx — JSON.parse throws → "Corrupt PKCE session data."
    await page.goto("/");
    await page.evaluate(() => {
      sessionStorage.setItem("fenrir:pkce", "this-is-not-valid-json{{{{");
    });

    await page.goto("/auth/callback?code=fake_code&state=any-state", {
      waitUntil: "networkidle",
    });

    await expect(
      page.locator("text=Corrupt PKCE session data.")
    ).toBeVisible({ timeout: 5000 });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 7 — Responsive at 375px
// ════════════════════════════════════════════════════════════════════════════

test.describe("Auth Callback — Responsive (375px)", () => {
  test("error state is readable at 375px viewport", async ({ page }) => {
    // Spec: team norms — minimum 375px. Callback error card uses max-w-xs.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/auth/callback", { waitUntil: "networkidle" });

    // Error message must not overflow — it uses max-w-xs
    const errorMsg = page.locator("text=Missing code or state in callback URL.");
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
  });
});
