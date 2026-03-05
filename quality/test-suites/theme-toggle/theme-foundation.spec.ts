/**
 * Theme Foundation Test Suite — Story 1: Theme Foundation + CSS Variables
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates the theme foundation layer against Story 1 acceptance criteria:
 *   - next-themes ThemeProvider wraps the app in layout.tsx
 *   - globals.css has :root (light) and .dark (dark) CSS variable blocks
 *   - Hardcoded "dark" class is removed from layout.tsx static source
 *   - suppressHydrationWarning is added to <html> in layout.tsx
 *   - Default theme is "system" with localStorage key "fenrir-theme"
 *   - Dark mode applies the .dark class and dark CSS variables
 *   - Light mode applies :root CSS variables (no .dark class) after hydration
 *   - App renders without React hydration errors
 *
 * Spec reference: specs/dark-light-theme-toggle.md — Story 1 Acceptance Criteria
 *
 * ALL assertions are derived from the acceptance criteria, NOT from observed
 * code behavior. Each failing test reveals a genuine requirement violation.
 *
 * NOTE: Story 1 provides only the foundation — no toggle UI exists yet.
 * Theme switching is tested by manipulating localStorage and reloading.
 *
 * IMPORTANT: next-themes SSR behavior — the library renders the HTML with the
 * dark class server-side and then hydrates to the correct OS preference
 * client-side. suppressHydrationWarning on <html> handles this mismatch.
 * Tests that check post-hydration state must wait for networkidle.
 */

import { test, expect } from "@playwright/test";

// ── Constants (from acceptance criteria) ─────────────────────────────────────

/** Storage key specified in Story 1 AC: "localStorage key fenrir-theme" */
const THEME_STORAGE_KEY = "fenrir-theme";

/** ThemeProvider config from acceptance criteria: attribute="class" */
const DARK_CLASS = "dark";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Clears the fenrir-theme localStorage key to simulate a fresh visit. */
async function clearThemeStorage(page: import("@playwright/test").Page) {
  await page.evaluate((key) => localStorage.removeItem(key), THEME_STORAGE_KEY);
}

/** Reads the fenrir-theme value from localStorage. */
async function getStoredTheme(
  page: import("@playwright/test").Page
): Promise<string | null> {
  return page.evaluate(
    (key) => localStorage.getItem(key),
    THEME_STORAGE_KEY
  );
}

/** Returns the list of classes on <html> after hydration. */
async function getHtmlClasses(
  page: import("@playwright/test").Page
): Promise<string[]> {
  const cls = await page.evaluate(
    () => document.documentElement.className
  );
  return cls.split(/\s+/).filter(Boolean);
}

/**
 * Reads a CSS custom property value from the <html> element's computed style.
 * Returns the raw string (e.g. "36  33% 88%") as stored in globals.css.
 */
async function getCSSVariable(
  page: import("@playwright/test").Page,
  varName: string
): Promise<string> {
  return page.evaluate(
    (name) =>
      getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim(),
    varName
  );
}

/**
 * Parses the lightness percentage from an HSL CSS variable value.
 * Input format: "H  S% L%" (e.g. "36  33% 88%")
 * Returns the lightness as a number (e.g. 88).
 */
function parseLightness(hslValue: string): number {
  // Split on whitespace, pick the third token, strip "%"
  const parts = hslValue.trim().split(/\s+/);
  const lightnessPart = parts[2] ?? "";
  return parseFloat(lightnessPart.replace("%", ""));
}

// ════════════════════════════════════════════════════════════════════════════
// TC-TF-001: layout.tsx has suppressHydrationWarning on <html>
// ════════════════════════════════════════════════════════════════════════════

test("TC-TF-001: layout.tsx contains suppressHydrationWarning on <html>", async () => {
  /**
   * Spec: "suppressHydrationWarning is added to <html>" (Story 1 AC)
   *
   * React strips suppressHydrationWarning before sending HTML to the client,
   * so we verify it exists in the source file, not in the rendered DOM.
   * This is a file-level check via Node.js fs (not browser automation).
   */
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");

  const layoutPath = path.resolve(
    __dirname,
    "../../..",
    "development/frontend/src/app/layout.tsx"
  );

  const source = fs.readFileSync(layoutPath, "utf-8");
  expect(source).toContain("suppressHydrationWarning");
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TF-002: layout.tsx does NOT have hardcoded "dark" class on <html>
// ════════════════════════════════════════════════════════════════════════════

test('TC-TF-002: layout.tsx does NOT have hardcoded className="dark" on <html>', async () => {
  /**
   * Spec: "Hardcoded 'dark' class is removed from <html>" (Story 1 AC)
   *
   * The layout.tsx source must not contain 'className="dark"' or 'class="dark"'
   * on the <html> element. next-themes manages the class dynamically.
   * We check the source file directly.
   */
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");

  const layoutPath = path.resolve(
    __dirname,
    "../../..",
    "development/frontend/src/app/layout.tsx"
  );

  const source = fs.readFileSync(layoutPath, "utf-8");

  // Must NOT contain standalone 'className="dark"' — that would be hardcoded
  // The existing font variable classes are allowed; only "dark" alone is forbidden
  expect(source).not.toMatch(/className=["']dark["']/);
  // Also must not have "dark" as the only class on html
  expect(source).not.toMatch(/<html[^>]+className=["'][^"']*\bdark\b[^"']*["']/);
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TF-003: layout.tsx imports ThemeProvider from next-themes
// ════════════════════════════════════════════════════════════════════════════

test("TC-TF-003: layout.tsx imports ThemeProvider from next-themes", async () => {
  /**
   * Spec: "next-themes is installed and ThemeProvider wraps the app in layout.tsx" (Story 1 AC)
   */
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");

  const layoutPath = path.resolve(
    __dirname,
    "../../..",
    "development/frontend/src/app/layout.tsx"
  );

  const source = fs.readFileSync(layoutPath, "utf-8");
  expect(source).toContain('from "next-themes"');
  expect(source).toContain("ThemeProvider");
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TF-004: layout.tsx ThemeProvider has defaultTheme="system"
// ════════════════════════════════════════════════════════════════════════════

test('TC-TF-004: layout.tsx ThemeProvider has defaultTheme="system"', async () => {
  /**
   * Spec: "Default theme is 'system' with localStorage key fenrir-theme" (Story 1 AC)
   */
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");

  const layoutPath = path.resolve(
    __dirname,
    "../../..",
    "development/frontend/src/app/layout.tsx"
  );

  const source = fs.readFileSync(layoutPath, "utf-8");
  expect(source).toContain('defaultTheme="system"');
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TF-005: layout.tsx ThemeProvider has storageKey="fenrir-theme"
// ════════════════════════════════════════════════════════════════════════════

test('TC-TF-005: layout.tsx ThemeProvider has storageKey="fenrir-theme"', async () => {
  /**
   * Spec: "Default theme is 'system' with localStorage key fenrir-theme" (Story 1 AC)
   */
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");

  const layoutPath = path.resolve(
    __dirname,
    "../../..",
    "development/frontend/src/app/layout.tsx"
  );

  const source = fs.readFileSync(layoutPath, "utf-8");
  expect(source).toContain('storageKey="fenrir-theme"');
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TF-006: layout.tsx ThemeProvider has attribute="class"
// ════════════════════════════════════════════════════════════════════════════

test('TC-TF-006: layout.tsx ThemeProvider has attribute="class" (required for Tailwind)', async () => {
  /**
   * Spec: Tailwind config uses darkMode: ["class"]; ThemeProvider must match.
   * Without attribute="class", Tailwind dark: utilities and .dark CSS variables
   * would not be activated by next-themes.
   */
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");

  const layoutPath = path.resolve(
    __dirname,
    "../../..",
    "development/frontend/src/app/layout.tsx"
  );

  const source = fs.readFileSync(layoutPath, "utf-8");
  expect(source).toContain('attribute="class"');
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TF-007: next-themes is in package.json dependencies
// ════════════════════════════════════════════════════════════════════════════

test("TC-TF-007: next-themes is installed in package.json dependencies", async () => {
  /**
   * Spec: "next-themes is installed and ThemeProvider wraps the app" (Story 1 AC)
   */
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");

  const pkgPath = path.resolve(
    __dirname,
    "../../..",
    "development/frontend/package.json"
  );

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
    dependencies?: Record<string, string>;
  };

  expect(pkg.dependencies).toBeDefined();
  expect(pkg.dependencies!["next-themes"]).toBeDefined();
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TF-008: globals.css has both :root and .dark variable blocks
// ════════════════════════════════════════════════════════════════════════════

test("TC-TF-008: globals.css has both :root (light) and .dark (dark) variable blocks", async () => {
  /**
   * Spec: "globals.css has :root (light) and .dark (dark) variable blocks" (Story 1 AC)
   */
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");

  const cssPath = path.resolve(
    __dirname,
    "../../..",
    "development/frontend/src/app/globals.css"
  );

  const source = fs.readFileSync(cssPath, "utf-8");

  // Must have :root { block with --background
  expect(source).toMatch(/:root\s*\{/);
  // Must have .dark { block with --background
  expect(source).toMatch(/\.dark\s*\{/);

  // Both blocks must define --background
  const rootBlock = source.match(/:root\s*\{[^}]+\}/)?.[0] ?? "";
  const darkBlock = source.match(/\.dark\s*\{[^}]+\}/)?.[0] ?? "";
  expect(rootBlock).toContain("--background");
  expect(darkBlock).toContain("--background");
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TF-009: No stray dark: Tailwind prefixes in .tsx/.ts source files
// ════════════════════════════════════════════════════════════════════════════

test("TC-TF-009: No stray dark: Tailwind prefixed classes in component source files", async () => {
  /**
   * Spec: Story 1 task — "Remove stray dark: prefixed classes from CardTile.tsx
   * and Dashboard.tsx" (QA Handoff notes + Story 1 implementation)
   *
   * The CSS variable system handles both themes; dark: Tailwind prefixes are
   * redundant and break the theme system design.
   */
  const { execSync } = require("child_process") as typeof import("child_process");
  const path = require("path") as typeof import("path");

  const srcPath = path.resolve(
    __dirname,
    "../../..",
    "development/frontend/src"
  );

  let output = "";
  try {
    output = execSync(
      `grep -rn 'dark:' "${srcPath}" --include='*.tsx' --include='*.ts'`,
      { encoding: "utf-8" }
    );
  } catch (e: unknown) {
    // grep returns exit code 1 when no matches found — that is success for us
    const err = e as { status?: number };
    if (err.status === 1) {
      output = ""; // No matches — this is what we want
    } else {
      throw e;
    }
  }

  expect(output.trim()).toBe("");
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TF-010: Dark mode applied when fenrir-theme is "dark" in localStorage
// ════════════════════════════════════════════════════════════════════════════

test('TC-TF-010: Setting fenrir-theme="dark" in localStorage applies .dark class to <html>', async ({
  page,
}) => {
  /**
   * Spec: "App renders correctly in dark mode" + "ThemeProvider wraps the app" (Story 1 AC)
   *
   * next-themes reads the fenrir-theme key on page load. When set to "dark",
   * it must apply the .dark class to <html> so .dark CSS variables take effect.
   */
  // Pre-set before navigation so next-themes reads it on load
  await page.addInitScript((key) => {
    localStorage.setItem(key, "dark");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TF-011: Light mode — no .dark class when fenrir-theme is "light"
// ════════════════════════════════════════════════════════════════════════════

test('TC-TF-011: Setting fenrir-theme="light" in localStorage removes .dark class from <html>', async ({
  page,
}) => {
  /**
   * Spec: "globals.css has :root (light) and .dark (dark) variable blocks" (Story 1 AC)
   *
   * When fenrir-theme is explicitly "light", .dark must NOT be on <html>.
   * The :root light palette must be active.
   */
  await page.addInitScript((key) => {
    localStorage.setItem(key, "light");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const classes = await getHtmlClasses(page);
  expect(classes).not.toContain(DARK_CLASS);
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TF-012: System mode + OS dark → .dark class on <html>
// ════════════════════════════════════════════════════════════════════════════

test("TC-TF-012: System mode with OS dark preference applies .dark class to <html>", async ({
  page,
}) => {
  /**
   * Spec: "Default theme is 'system'" (Story 1 AC)
   *
   * With no localStorage key and OS set to dark, next-themes must add .dark
   * to <html> after hydration.
   */
  await page.emulateMedia({ colorScheme: "dark" });
  // No init script — fresh visit with no stored theme
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TF-013: System mode + OS light → no .dark class on <html>
// ════════════════════════════════════════════════════════════════════════════

test("TC-TF-013: System mode with OS light preference removes .dark class from <html>", async ({
  page,
}) => {
  /**
   * Spec: "Default theme is 'system'" (Story 1 AC)
   *
   * With no localStorage key and OS set to light, next-themes must remove
   * .dark from <html> after client-side hydration.
   *
   * NOTE: next-themes SSR behavior renders the page with the "dark" class by
   * default (it cannot read prefers-color-scheme on the server). After
   * hydration, next-themes reads the OS preference and updates <html>.
   * We wait for networkidle to capture the post-hydration state.
   */
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const classes = await getHtmlClasses(page);
  expect(classes).not.toContain(DARK_CLASS);
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TF-014: Theme persists across page reload via localStorage
// ════════════════════════════════════════════════════════════════════════════

test("TC-TF-014: Theme persists across page reloads via localStorage", async ({
  page,
}) => {
  /**
   * Spec: "localStorage key fenrir-theme" — persistence is the whole point (Story 1 AC)
   */
  await page.addInitScript((key) => {
    localStorage.setItem(key, "dark");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const classesBeforeReload = await getHtmlClasses(page);
  expect(classesBeforeReload).toContain(DARK_CLASS);

  await page.reload({ waitUntil: "networkidle" });
  const classesAfterReload = await getHtmlClasses(page);
  expect(classesAfterReload).toContain(DARK_CLASS);

  // Second reload for belt-and-suspenders
  await page.reload({ waitUntil: "networkidle" });
  const classesAfterSecondReload = await getHtmlClasses(page);
  expect(classesAfterSecondReload).toContain(DARK_CLASS);
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TF-015: Dark mode CSS --background is low-lightness (dark)
// ════════════════════════════════════════════════════════════════════════════

test("TC-TF-015: Dark mode --background CSS variable is dark (low lightness)", async ({
  page,
}) => {
  /**
   * Spec: ".dark variable block" with --background: 28 15% 7% (~#12100e) (Story 1 AC)
   *
   * In dark mode, --background must have low lightness (< 20%).
   * CSS variables are stored as raw HSL components: "H S% L%"
   */
  await page.addInitScript((key) => {
    localStorage.setItem(key, "dark");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const bg = await getCSSVariable(page, "--background");
  expect(bg).toBeTruthy();

  const lightness = parseLightness(bg);
  expect(lightness).toBeGreaterThanOrEqual(0);
  expect(lightness).toBeLessThan(20); // Dark background spec: 7% lightness
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TF-016: Light mode CSS --background is high-lightness (parchment)
// ════════════════════════════════════════════════════════════════════════════

test("TC-TF-016: Light mode --background CSS variable is parchment (high lightness)", async ({
  page,
}) => {
  /**
   * Spec: ":root variable block" with --background: 36 33% 88% (~#e8dcc8) (Story 1 AC)
   *
   * In light mode, --background must have high lightness (> 70%).
   */
  await page.addInitScript((key) => {
    localStorage.setItem(key, "light");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const bg = await getCSSVariable(page, "--background");
  expect(bg).toBeTruthy();

  const lightness = parseLightness(bg);
  expect(lightness).toBeGreaterThan(70); // Light parchment spec: 88% lightness
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TF-017: Dark mode CSS --foreground is high-lightness (light text)
// ════════════════════════════════════════════════════════════════════════════

test("TC-TF-017: Dark mode --foreground CSS variable is light text (high lightness)", async ({
  page,
}) => {
  /**
   * Spec: ".dark" --foreground: 40 27% 91% (~#f0ede4) (Story 1 AC)
   */
  await page.addInitScript((key) => {
    localStorage.setItem(key, "dark");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const fg = await getCSSVariable(page, "--foreground");
  expect(fg).toBeTruthy();

  const lightness = parseLightness(fg);
  expect(lightness).toBeGreaterThan(80); // Dark mode spec: 91% lightness foreground
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TF-018: Light mode CSS --foreground is low-lightness (dark text)
// ════════════════════════════════════════════════════════════════════════════

test("TC-TF-018: Light mode --foreground CSS variable is dark text (low lightness)", async ({
  page,
}) => {
  /**
   * Spec: ":root" --foreground: 25 30% 12% (~#2a1f14) (Story 1 AC)
   */
  await page.addInitScript((key) => {
    localStorage.setItem(key, "light");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const fg = await getCSSVariable(page, "--foreground");
  expect(fg).toBeTruthy();

  const lightness = parseLightness(fg);
  expect(lightness).toBeLessThan(20); // Light mode spec: 12% lightness foreground
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TF-019: --primary differs between light and dark themes
// ════════════════════════════════════════════════════════════════════════════

test("TC-TF-019: --primary CSS variable differs between light and dark themes", async ({
  page,
}) => {
  /**
   * Spec: Both :root and .dark define --primary with different values (Story 1 AC)
   * Light: 42 80% 38% (#ae8510 — darker gold for light bg)
   * Dark:  42 75% 48% (#d4a520 — brighter gold)
   */

  // Light
  await page.addInitScript((key) => {
    localStorage.setItem(key, "light");
  }, THEME_STORAGE_KEY);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const primaryLight = await getCSSVariable(page, "--primary");
  expect(primaryLight).toBeTruthy();

  // Dark
  await page.evaluate((key) => localStorage.setItem(key, "dark"), THEME_STORAGE_KEY);
  await page.reload({ waitUntil: "networkidle" });
  // Wait for next-themes to apply the .dark class after hydration
  await page.waitForSelector("html.dark", { timeout: 5000 });
  const primaryDark = await getCSSVariable(page, "--primary");
  expect(primaryDark).toBeTruthy();

  // They must differ (different gold brightness for each background)
  expect(primaryLight).not.toEqual(primaryDark);
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TF-020: No React hydration errors on page load in dark mode
// ════════════════════════════════════════════════════════════════════════════

test("TC-TF-020: No React hydration errors on page load in dark mode", async ({
  page,
}) => {
  /**
   * Spec: "App renders correctly in dark mode (no visual regression)" (Story 1 AC)
   *
   * suppressHydrationWarning + next-themes pattern must prevent hydration
   * mismatch errors. We capture console errors and filter for hydration terms.
   */
  const hydrationErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text().toLowerCase();
      if (
        text.includes("hydrat") ||
        text.includes("did not match") ||
        text.includes("server rendered") ||
        text.includes("client rendered")
      ) {
        hydrationErrors.push(msg.text());
      }
    }
  });

  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  expect(hydrationErrors).toHaveLength(0);
});
