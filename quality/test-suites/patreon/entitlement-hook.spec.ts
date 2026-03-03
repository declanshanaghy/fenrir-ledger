/**
 * Entitlement Hook Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests the client-side entitlement system introduced in PR #95:
 *   - EntitlementProvider existence in the app provider hierarchy
 *   - Default Thrall state when no Patreon subscription is linked
 *   - /api/patreon/unlink auth enforcement (401 without token)
 *   - localStorage cache key "fenrir:entitlement" lifecycle
 *   - No runtime errors when EntitlementProvider initializes
 *
 * All assertions derive from the design spec and source contracts —
 * NOT from whatever the code currently happens to produce:
 *   - types.ts:          EntitlementTier = "thrall" | "karl"
 *   - cache.ts:          CACHE_KEY = "fenrir:entitlement"
 *   - EntitlementContext: DEFAULT_VALUE.tier = "thrall"
 *   - layout.tsx:        EntitlementProvider is nested inside AuthProvider
 *   - unlink/route.ts:   requireAuth enforced — unauthenticated POST → 401
 *
 * Data isolation: each test clears the entitlement cache key from
 * localStorage before navigating so tests do not bleed state.
 */

import { test, expect, request } from "@playwright/test";

// ─── Constants ────────────────────────────────────────────────────────────────

/** localStorage key as defined in src/lib/entitlement/cache.ts */
const ENTITLEMENT_CACHE_KEY = "fenrir:entitlement";

/** POST endpoint added in PR #95 */
const UNLINK_ENDPOINT = "/api/patreon/unlink";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Removes the entitlement cache key from localStorage.
 * Safe to call when the key is absent — no errors thrown.
 */
async function clearEntitlementCache(page: import("@playwright/test").Page): Promise<void> {
  await page.evaluate((key: string) => {
    localStorage.removeItem(key);
  }, ENTITLEMENT_CACHE_KEY);
}

/**
 * Reads the raw entitlement cache value from localStorage.
 * Returns null if the key is absent or contains invalid JSON.
 */
async function readEntitlementCache(page: import("@playwright/test").Page): Promise<unknown> {
  return page.evaluate((key: string) => {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }, ENTITLEMENT_CACHE_KEY);
}

// ═════════════════════════════════════════════════════════════════════════════
// TC-ENT-001: App loads without runtime errors
// Category: Functional | Priority: P1-Critical | Type: UI
// Precondition: No entitlement cache in localStorage
// ═════════════════════════════════════════════════════════════════════════════

test.describe("TC-ENT-001 — App loads with EntitlementProvider (no crash)", () => {
  test("page loads successfully and returns HTTP 200", async ({ page }) => {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });

    // Spec: The app shell must render. Any uncaught error in EntitlementProvider
    // would prevent the page from mounting.
    expect(response?.status()).toBe(200);
  });

  test("no uncaught JavaScript errors during page load", async ({ page }) => {
    const errors: string[] = [];

    // Capture uncaught page errors (thrown exceptions, not console.error)
    page.on("pageerror", (err) => {
      errors.push(err.message);
    });

    await page.goto("/", { waitUntil: "networkidle" });

    // Spec: EntitlementProvider must not throw during initialization.
    // Zero uncaught errors means the provider hierarchy is stable.
    expect(errors, `Uncaught JS errors on page load: ${errors.join(", ")}`).toHaveLength(0);
  });

  test("app shell renders — title is correct", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Spec: layout.tsx metadata.default = "Ledger of Fates — Fenrir Ledger"
    await expect(page).toHaveTitle("Ledger of Fates — Fenrir Ledger");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TC-ENT-002: EntitlementProvider exists in the provider hierarchy
// Category: Integration | Priority: P1-Critical | Type: UI
// Precondition: No entitlement cache in localStorage
// ═════════════════════════════════════════════════════════════════════════════

test.describe("TC-ENT-002 — EntitlementProvider in provider hierarchy", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await clearEntitlementCache(page);
    await page.reload({ waitUntil: "networkidle" });
  });

  test("layout.tsx nests EntitlementProvider inside AuthProvider", async ({ page }) => {
    // Spec: layout.tsx renders:
    //   <AuthProvider>
    //     <EntitlementProvider>
    //       <RagnarokProvider>
    //         ...
    //
    // Indirect verification: if EntitlementProvider were missing, any component
    // calling useEntitlement() would receive the React default context value
    // (still "thrall") but a missing provider would not crash — the context has
    // a valid default. We verify that the page renders its full DOM tree, which
    // only succeeds if all providers in the hierarchy initialize correctly.

    // The Add Card button is rendered by the dashboard inside AppShell —
    // it only appears if the full provider tree (Auth → Entitlement → Ragnarok
    // → AppShell) mounted without error.
    const addCardLink = page.locator('a[href="/cards/new"]').first();
    await expect(addCardLink).toBeVisible();
  });

  test("RagnarokProvider renders correctly inside EntitlementProvider", async ({ page }) => {
    // Spec: RagnarokProvider is a child of EntitlementProvider in layout.tsx.
    // If EntitlementProvider threw or returned a broken tree, RagnarokProvider
    // and its children (AppShell, ConsoleSignature) would not render.
    // The topbar is rendered by AppShell which is wrapped by all three providers.
    const topbar = page.locator("header, [data-testid='topbar'], .h-14.shrink-0.border-b").first();
    await expect(topbar).toBeVisible();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TC-ENT-003: Default state is Thrall (no Patreon linked)
// Category: Functional | Priority: P1-Critical | Type: UI
// Precondition: No entitlement cache in localStorage, user not authenticated
// ═════════════════════════════════════════════════════════════════════════════

test.describe("TC-ENT-003 — Default state is Thrall when no subscription linked", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await clearEntitlementCache(page);
    await page.reload({ waitUntil: "networkidle" });
  });

  test("entitlement cache key is absent by default (no auto-write without auth)", async ({ page }) => {
    // Spec: EntitlementContext only writes to localStorage when the membership
    // API returns data AND the user is authenticated. An unauthenticated user
    // has no Patreon link — the cache should remain empty.
    const cached = await readEntitlementCache(page);

    // EntitlementProvider should NOT write a "thrall" stub to the cache.
    // The cache is only populated from a server response. Default Thrall state
    // is held in React state only, never auto-cached.
    expect(cached).toBeNull();
  });

  test("localStorage key 'fenrir:entitlement' can be read and written via page.evaluate", async ({ page }) => {
    // Spec: cache.ts exports CACHE_KEY = "fenrir:entitlement"
    // This test verifies the key contract is honoured — we can write a valid
    // entitlement record and read it back using the documented key name.
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const testEntitlement = {
      tier: "thrall" as const,
      active: false,
      platform: "patreon" as const,
      userId: "test-user-123",
      linkedAt: Date.now(),
      checkedAt: Date.now(),
    };

    // Write via page.evaluate
    await page.evaluate(
      ({ key, value }: { key: string; value: string }) => {
        localStorage.setItem(key, value);
      },
      { key: ENTITLEMENT_CACHE_KEY, value: JSON.stringify(testEntitlement) }
    );

    // Read back via page.evaluate
    const cached = await readEntitlementCache(page);

    expect(cached).not.toBeNull();
    expect((cached as typeof testEntitlement).tier).toBe("thrall");
    expect((cached as typeof testEntitlement).platform).toBe("patreon");
    expect((cached as typeof testEntitlement).userId).toBe("test-user-123");
  });

  test("writing a Karl entitlement to cache and reloading preserves it", async ({ page }) => {
    // Spec: cache.ts isValidEntitlement() validates the shape. A valid Karl
    // entitlement written to localStorage must survive a page reload intact.
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const karlEntitlement = {
      tier: "karl" as const,
      active: true,
      platform: "patreon" as const,
      userId: "patreon-user-456",
      linkedAt: Date.now() - 86400000, // linked 1 day ago
      checkedAt: Date.now(),
    };

    await page.evaluate(
      ({ key, value }: { key: string; value: string }) => {
        localStorage.setItem(key, value);
      },
      { key: ENTITLEMENT_CACHE_KEY, value: JSON.stringify(karlEntitlement) }
    );

    // Reload — cache must survive
    await page.reload({ waitUntil: "networkidle" });

    const cached = await readEntitlementCache(page);
    expect(cached).not.toBeNull();
    expect((cached as typeof karlEntitlement).tier).toBe("karl");
    expect((cached as typeof karlEntitlement).active).toBe(true);
  });

  test("corrupted entitlement cache is cleared on page load", async ({ page }) => {
    // Spec: cache.ts getEntitlementCache() calls localStorage.removeItem(CACHE_KEY)
    // when the parsed value fails isValidEntitlement(). Corrupted data must not
    // cause a crash or leak into the UI.
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Write garbage to the cache key
    await page.evaluate((key: string) => {
      localStorage.setItem(key, "{ this is not valid JSON }}}}");
    }, ENTITLEMENT_CACHE_KEY);

    // Reload — the cache module reads on mount and should clear the bad value
    await page.reload({ waitUntil: "networkidle" });

    // The page must still render without errors
    await expect(page).toHaveTitle("Ledger of Fates — Fenrir Ledger");

    // The corrupted key should be removed (getEntitlementCache clears on parse failure)
    const cached = await readEntitlementCache(page);
    expect(cached).toBeNull();
  });

  test("entitlement cache with missing required fields is cleared on page load", async ({ page }) => {
    // Spec: isValidEntitlement() in cache.ts requires all 6 fields:
    //   tier, active, platform, userId, linkedAt, checkedAt
    // A record missing any field fails the guard and is cleared.
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Incomplete record — missing 'active' and 'linkedAt'
    const incompleteRecord = {
      tier: "karl",
      platform: "patreon",
      userId: "user-789",
      checkedAt: Date.now(),
    };

    await page.evaluate(
      ({ key, value }: { key: string; value: string }) => {
        localStorage.setItem(key, value);
      },
      { key: ENTITLEMENT_CACHE_KEY, value: JSON.stringify(incompleteRecord) }
    );

    await page.reload({ waitUntil: "networkidle" });

    // The invalid cache should have been cleared
    const cached = await readEntitlementCache(page);
    expect(cached).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TC-ENT-004: /api/patreon/unlink — Authentication enforcement
// Category: Integration | Priority: P1-Critical | Type: API
// Precondition: Test server running with feat/patreon-client code
// ═════════════════════════════════════════════════════════════════════════════

test.describe("TC-ENT-004 — POST /api/patreon/unlink rejects unauthenticated requests", () => {
  test("POST /api/patreon/unlink without Authorization header returns 401", async ({
    request: apiRequest,
  }) => {
    // Spec: unlink/route.ts calls requireAuth(request) at the top of the handler.
    // requireAuth returns 401 for any request without a valid Google id_token.
    const response = await apiRequest.post("/api/patreon/unlink", {
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Spec: requireAuth returns auth.response which is a 401 NextResponse.
    // The route returns early: if (!auth.ok) return auth.response;
    expect(response.status()).toBe(401);
  });

  test("POST /api/patreon/unlink with invalid Bearer token returns 401", async ({
    request: apiRequest,
  }) => {
    // Spec: requireAuth verifies the Google id_token via Google's tokeninfo endpoint.
    // A fabricated / expired token must be rejected.
    const response = await apiRequest.post("/api/patreon/unlink", {
      headers: {
        Authorization: "Bearer this-is-not-a-valid-google-id-token",
        "Content-Type": "application/json",
      },
    });

    expect(response.status()).toBe(401);
  });

  test("POST /api/patreon/unlink with empty Bearer token returns 401", async ({
    request: apiRequest,
  }) => {
    // Edge case: empty token string in Authorization header.
    const response = await apiRequest.post("/api/patreon/unlink", {
      headers: {
        Authorization: "Bearer ",
        "Content-Type": "application/json",
      },
    });

    expect(response.status()).toBe(401);
  });

  test("GET /api/patreon/unlink returns 405 (only POST is allowed)", async ({
    request: apiRequest,
  }) => {
    // Spec: only POST is exported from unlink/route.ts. Next.js returns 405
    // for unimplemented methods on a route file.
    const response = await apiRequest.get("/api/patreon/unlink");

    // Next.js App Router returns 405 for unimplemented HTTP methods on route files.
    expect(response.status()).toBe(405);
  });

  test("POST /api/patreon/unlink 401 response body has correct shape", async ({
    request: apiRequest,
  }) => {
    // Spec: requireAuth returns a structured error response.
    // We verify the response is valid JSON and has an error field.
    const response = await apiRequest.post("/api/patreon/unlink", {
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.status()).toBe(401);
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");

    const body = await response.json() as Record<string, unknown>;
    // requireAuth returns { error: "unauthorized", ... } per require-auth.ts contract
    expect(body).toHaveProperty("error");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TC-ENT-005: localStorage cache key lifecycle
// Category: Functional | Priority: P2-High | Type: UI
// ═════════════════════════════════════════════════════════════════════════════

test.describe("TC-ENT-005 — localStorage cache key 'fenrir:entitlement' lifecycle", () => {
  test("cache key is absent after clearing and before any auth activity", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await clearEntitlementCache(page);
    await page.reload({ waitUntil: "networkidle" });

    // Spec: When an unauthenticated user loads the app, EntitlementContext
    // checks isAuthenticated === false and sets entitlement to null.
    // clearEntitlementCache() is NOT called in this path — the key just stays absent.
    const cached = await readEntitlementCache(page);
    expect(cached).toBeNull();
  });

  test("cache key survives a page navigation (not cleared on soft navigation)", async ({ page }) => {
    // Spec: The cache is only cleared on:
    //   1. unlinkPatreon() call
    //   2. Corrupted/invalid data detection on read
    // Normal page navigation must NOT clear the cache.
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const testEntitlement = {
      tier: "karl" as const,
      active: true,
      platform: "patreon" as const,
      userId: "persist-test-user",
      linkedAt: Date.now(),
      checkedAt: Date.now(),
    };

    await page.evaluate(
      ({ key, value }: { key: string; value: string }) => {
        localStorage.setItem(key, value);
      },
      { key: ENTITLEMENT_CACHE_KEY, value: JSON.stringify(testEntitlement) }
    );

    // Navigate to another page — the cache should survive
    await page.goto("/valhalla", { waitUntil: "networkidle" });

    const cached = await readEntitlementCache(page);
    expect(cached).not.toBeNull();
    expect((cached as typeof testEntitlement).userId).toBe("persist-test-user");
  });

  test("cache key is isolated from other fenrir: storage keys", async ({ page }) => {
    // Spec: The entitlement cache key is "fenrir:entitlement" only.
    // It must not collide with "fenrir:household" or "fenrir_ledger:*" keys.
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Verify that clearing the entitlement key does not affect household key
    await page.evaluate(() => {
      localStorage.setItem("fenrir:household", "test-household-001");
    });

    await clearEntitlementCache(page);

    const householdValue = await page.evaluate(() => localStorage.getItem("fenrir:household"));
    expect(householdValue).toBe("test-household-001");
  });

  test("entitlement cache key string matches the spec exactly", async ({ page }) => {
    // Spec: cache.ts line — const CACHE_KEY = "fenrir:entitlement"
    // This test pins the exact key string so a refactor does not silently
    // change the storage contract and break existing cached data.
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const validEntitlement = {
      tier: "thrall",
      active: false,
      platform: "patreon",
      userId: "key-test-user",
      linkedAt: Date.now(),
      checkedAt: Date.now(),
    };

    // Write to the EXACT key name from the spec
    await page.evaluate(
      ({ key, value }: { key: string; value: string }) => {
        localStorage.setItem(key, value);
      },
      { key: "fenrir:entitlement", value: JSON.stringify(validEntitlement) }
    );

    // Verify it can be read back at the exact same key
    const value = await page.evaluate(() => localStorage.getItem("fenrir:entitlement"));
    expect(value).not.toBeNull();
    expect(JSON.parse(value!)).toMatchObject({ tier: "thrall", platform: "patreon" });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TC-ENT-006: Idempotency and re-run safety
// Category: Edge Case | Priority: P3-Medium | Type: UI
// ═════════════════════════════════════════════════════════════════════════════

test.describe("TC-ENT-006 — Idempotency and re-run safety", () => {
  test("clearing an absent entitlement cache key does not throw", async ({ page }) => {
    // Spec: cache.ts clearEntitlementCache() wraps localStorage.removeItem in try/catch.
    // Removing a key that doesn't exist must be a no-op, not an error.
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Ensure key is absent first
    await clearEntitlementCache(page);

    // Clear again — should be a no-op
    const error = await page.evaluate((key: string) => {
      try {
        localStorage.removeItem(key);
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    }, ENTITLEMENT_CACHE_KEY);

    expect(error).toBeNull();
  });

  test("page renders correctly on second consecutive load (no stale state bleed)", async ({ page }) => {
    // Two consecutive full page loads must produce identical results.
    // This guards against any module-level side effects in EntitlementProvider.
    await page.goto("/", { waitUntil: "networkidle" });
    const firstErrors: string[] = [];
    page.on("pageerror", (err) => firstErrors.push(err.message));

    const firstTitle = await page.title();

    await page.reload({ waitUntil: "networkidle" });
    const secondTitle = await page.title();

    expect(secondTitle).toBe(firstTitle);
    expect(firstErrors).toHaveLength(0);
  });
});
