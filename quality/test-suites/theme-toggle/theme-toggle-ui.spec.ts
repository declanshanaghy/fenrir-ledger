/**
 * Theme Toggle UI Test Suite — Story 2: ThemeToggle Component + TopBar Integration
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates Story 2 acceptance criteria:
 *   - ThemeToggle renders in TopBar dropdown (both auth states)
 *   - Three options: Light (Sun), Dark (Moon), System (Monitor)
 *   - Clicking each option changes the theme immediately
 *   - Light mode uses Norse parchment aesthetic (not white/modern)
 *   - No hardcoded hex colors in component inline styles
 *   - designs/ux-design/theme-system.md exists and contains required sections
 *   - Easter eggs accessible in both themes
 *   - WCAG AA contrast maintained in both themes
 *
 * Spec reference: specs/dark-light-theme-toggle.md — Story 2 Acceptance Criteria
 *
 * ALL assertions are derived from the acceptance criteria, NOT from observed
 * code behavior. Each failing test reveals a genuine requirement violation.
 *
 * TC-TH-001 through TC-TH-009 are the nine required test cases for Story 2.
 */

import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// ── Constants (from acceptance criteria) ─────────────────────────────────────

/** Storage key specified in acceptance criteria */
const THEME_STORAGE_KEY = "fenrir-theme";

/** CSS class applied by next-themes in dark mode */
const DARK_CLASS = "dark";

/** ARIA role for the toggle group, per acceptance criteria */
const TOGGLE_ROLE = "radiogroup";

/** ARIA label for the toggle, per acceptance criteria */
const TOGGLE_ARIA_LABEL = "Theme";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns current classes on <html> after hydration. */
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
 */
function parseLightness(hslValue: string): number {
  const parts = hslValue.trim().split(/\s+/);
  const lightnessPart = parts[2] ?? "";
  return parseFloat(lightnessPart.replace("%", ""));
}

/**
 * Opens the TopBar user panel (anonymous upsell prompt) by clicking the avatar button.
 * Uses aria-controls="anon-upsell-panel" to uniquely identify the TopBar trigger button.
 * Waits for the panel to appear.
 */
async function openAnonPanel(page: import("@playwright/test").Page) {
  // The anonymous avatar button is identified by aria-controls="anon-upsell-panel"
  // This is more specific than aria-label matching (which would match two buttons)
  const avatarBtn = page.locator('[aria-controls="anon-upsell-panel"]');
  await avatarBtn.click();
  // Wait for the panel to be visible
  await page.waitForSelector('[role="dialog"]', { state: "visible" });
}

// ── Repo paths ─────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, "../../..");
const THEME_SYSTEM_DOC = path.join(
  REPO_ROOT,
  "designs/ux-design/theme-system.md"
);

// ════════════════════════════════════════════════════════════════════════════
// TC-TH-001: Theme toggle is visible in TopBar anonymous state
// ════════════════════════════════════════════════════════════════════════════

test("TC-TH-001: ThemeToggle is visible in TopBar anonymous upsell panel", async ({
  page,
}) => {
  /**
   * Spec: "ThemeToggle component renders in TopBar dropdown (both auth states)"
   * (Story 2 AC)
   *
   * Anonymous users must be able to access the theme toggle from the TopBar
   * without signing in. The upsell panel contains a Theme row with the toggle.
   *
   * We test the anonymous state since it does not require auth setup.
   */
  // Navigate to the app in default system theme
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Open the anonymous upsell panel
  await openAnonPanel(page);

  // The ThemeToggle must be present as a radiogroup inside the panel
  const toggle = page.getByRole(TOGGLE_ROLE, { name: TOGGLE_ARIA_LABEL });
  await expect(toggle).toBeVisible();
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TH-002: Theme toggle has three options: Light, Dark, System
// ════════════════════════════════════════════════════════════════════════════

test("TC-TH-002: ThemeToggle has exactly three options: Light, Dark, System", async ({
  page,
}) => {
  /**
   * Spec: "Three options: Light (Sun), Dark (Moon), System (Monitor)"
   * (Story 2 AC)
   *
   * Each option must be a radio button with the correct aria-label.
   */
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await openAnonPanel(page);

  const toggle = page.getByRole(TOGGLE_ROLE, { name: TOGGLE_ARIA_LABEL });

  // Each option is role="radio"
  const lightOption = toggle.getByRole("radio", { name: /light/i });
  const darkOption = toggle.getByRole("radio", { name: /dark/i });
  const systemOption = toggle.getByRole("radio", { name: /system/i });

  await expect(lightOption).toBeVisible();
  await expect(darkOption).toBeVisible();
  await expect(systemOption).toBeVisible();
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TH-003: Clicking "Dark" applies .dark class to <html>
// ════════════════════════════════════════════════════════════════════════════

test("TC-TH-003: Clicking the Dark option applies .dark class to <html> immediately", async ({
  page,
}) => {
  /**
   * Spec: "Clicking each option changes the theme immediately" (Story 2 AC)
   * Spec: "Dark mode is unchanged from current aesthetic" (overall AC)
   *
   * When the user clicks "Dark", next-themes must add the .dark class to <html>
   * without a page reload.
   */
  // Start in light mode to make the dark transition observable
  await page.addInitScript((key) => {
    localStorage.setItem(key, "light");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Verify we're in light mode first
  let classes = await getHtmlClasses(page);
  expect(classes).not.toContain(DARK_CLASS);

  // Open the upsell panel and click Dark
  await openAnonPanel(page);

  const toggle = page.getByRole(TOGGLE_ROLE, { name: TOGGLE_ARIA_LABEL });
  const darkOption = toggle.getByRole("radio", { name: /dark/i });
  await darkOption.click();

  // Theme must change immediately — no reload required
  classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TH-004: Clicking "Light" removes .dark class from <html>
// ════════════════════════════════════════════════════════════════════════════

test("TC-TH-004: Clicking the Light option removes .dark class from <html> immediately", async ({
  page,
}) => {
  /**
   * Spec: "Clicking each option changes the theme immediately" (Story 2 AC)
   * Spec: "Light mode uses Norse parchment aesthetic" (Story 2 AC)
   *
   * When the user clicks "Light", .dark must be removed from <html> immediately.
   */
  // Start in dark mode
  await page.addInitScript((key) => {
    localStorage.setItem(key, "dark");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Verify we're in dark mode
  let classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);

  // Open the upsell panel and click Light
  await openAnonPanel(page);

  const toggle = page.getByRole(TOGGLE_ROLE, { name: TOGGLE_ARIA_LABEL });
  const lightOption = toggle.getByRole("radio", { name: /light/i });
  await lightOption.click();

  // .dark must be gone
  classes = await getHtmlClasses(page);
  expect(classes).not.toContain(DARK_CLASS);

  // --background must be parchment (high lightness > 70%)
  const bg = await getCSSVariable(page, "--background");
  const lightness = parseLightness(bg);
  expect(lightness).toBeGreaterThan(70);
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TH-005: Clicking "System" follows OS preference
// ════════════════════════════════════════════════════════════════════════════

test("TC-TH-005: Clicking System follows OS dark preference (dark OS → .dark class)", async ({
  page,
}) => {
  /**
   * Spec: "Clicking each option changes the theme immediately" (Story 2 AC)
   * Spec: "Default theme is System" — System mode must follow prefers-color-scheme
   *
   * We set OS to dark, then switch to System mode — expect .dark class.
   */
  // Simulate dark OS preference
  await page.emulateMedia({ colorScheme: "dark" });

  // Start in light mode so we can see the transition to System/dark
  await page.addInitScript((key) => {
    localStorage.setItem(key, "light");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Confirm light to start
  let classes = await getHtmlClasses(page);
  expect(classes).not.toContain(DARK_CLASS);

  // Open panel and click System
  await openAnonPanel(page);

  const toggle = page.getByRole(TOGGLE_ROLE, { name: TOGGLE_ARIA_LABEL });
  const systemOption = toggle.getByRole("radio", { name: /system/i });
  await systemOption.click();

  // With dark OS preference, System should apply .dark
  classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TH-006: Default is "System" on fresh visit (no localStorage)
// ════════════════════════════════════════════════════════════════════════════

test("TC-TH-006: Default is System on fresh visit — no fenrir-theme in localStorage", async ({
  page,
}) => {
  /**
   * Spec: "Default on fresh visit: System" (designs/ux-design/theme-system.md)
   * Spec: "Default theme is 'System' (follows OS prefers-color-scheme)" (overall AC)
   *
   * On a fresh visit with no localStorage key, next-themes must use System.
   * We verify: (1) localStorage has no key, and (2) the System radio is aria-checked.
   */
  // Light OS so we can reason about absence of .dark
  await page.emulateMedia({ colorScheme: "light" });
  // No init script — truly fresh visit

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Verify no stored preference
  const stored = await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY);
  // next-themes does NOT persist "system" to localStorage — it is the default
  // A null or absent key means system mode
  expect(stored).toBeNull();

  // Open panel — system option should appear selected (aria-checked=true)
  await openAnonPanel(page);

  const toggle = page.getByRole(TOGGLE_ROLE, { name: TOGGLE_ARIA_LABEL });
  const systemOption = toggle.getByRole("radio", { name: /system/i });

  // System is the default — it should be aria-checked
  await expect(systemOption).toHaveAttribute("aria-checked", "true");
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TH-007: Theme persists after page reload
// ════════════════════════════════════════════════════════════════════════════

test("TC-TH-007: Dark theme persists after page reload via localStorage key fenrir-theme", async ({
  page,
}) => {
  /**
   * Spec: "Theme preference persists across sessions via localStorage (key: fenrir-theme)"
   * (overall AC)
   *
   * When the user selects Dark via the toggle, the selection must survive a reload.
   * This verifies that next-themes writes to localStorage[fenrir-theme].
   */
  // Start fresh
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Open panel and click Dark
  await openAnonPanel(page);

  const toggle = page.getByRole(TOGGLE_ROLE, { name: TOGGLE_ARIA_LABEL });
  const darkOption = toggle.getByRole("radio", { name: /dark/i });
  await darkOption.click();

  // Verify .dark is applied
  let classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);

  // Verify localStorage was written
  const stored = await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY);
  expect(stored).toBe("dark");

  // Reload page
  await page.reload({ waitUntil: "networkidle" });

  // .dark must still be present after reload
  classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TH-008: ThemeToggle has proper ARIA attributes
// ════════════════════════════════════════════════════════════════════════════

test("TC-TH-008: ThemeToggle has role=radiogroup, aria-label=Theme, and options have aria-checked", async ({
  page,
}) => {
  /**
   * Spec: "Accessible: role='radiogroup' with aria-label='Theme'; each option
   * is role='radio' with aria-checked" (ThemeToggle.tsx spec comment + Story 2 AC)
   * Spec: "WCAG AA contrast maintained in both themes" (Story 2 AC) — screen reader
   * accessibility is part of WCAG compliance.
   */
  // Start in dark mode so we know dark option is active
  await page.addInitScript((key) => {
    localStorage.setItem(key, "dark");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await openAnonPanel(page);

  // role="radiogroup" with aria-label="Theme"
  const toggle = page.getByRole(TOGGLE_ROLE, { name: TOGGLE_ARIA_LABEL });
  await expect(toggle).toBeVisible();

  // Each option has role="radio"
  const lightOption = toggle.getByRole("radio", { name: /light/i });
  const darkOption = toggle.getByRole("radio", { name: /dark/i });
  const systemOption = toggle.getByRole("radio", { name: /system/i });

  await expect(lightOption).toHaveAttribute("aria-checked", "false");
  await expect(darkOption).toHaveAttribute("aria-checked", "true");
  await expect(systemOption).toHaveAttribute("aria-checked", "false");
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TH-009: designs/ux-design/theme-system.md exists with required sections
// ════════════════════════════════════════════════════════════════════════════

test("TC-TH-009: designs/ux-design/theme-system.md exists and contains required sections", async () => {
  /**
   * Spec: "designs/ux-design/theme-system.md documents both palettes and the
   * 'all future features must support both themes' rule" (Story 2 AC)
   *
   * This is a file-level check — no browser needed.
   * The doc must exist and contain the mandatory design rules section.
   */
  expect(fs.existsSync(THEME_SYSTEM_DOC)).toBe(true);

  const content = fs.readFileSync(THEME_SYSTEM_DOC, "utf-8");

  // Must document the light palette
  expect(content).toContain("Light Palette");

  // Must document the dark palette
  expect(content).toContain("Dark Palette");

  // Must contain the "all future features must support both themes" mandate
  // The doc should have design rules for future features
  expect(content).toMatch(/design rules for future features/i);

  // Must mention WCAG contrast
  expect(content).toMatch(/wcag/i);

  // Must document the localStorage storage key
  expect(content).toContain("fenrir-theme");

  // Must forbid dark: Tailwind prefix
  expect(content).toMatch(/dark:/);

  // Must mention the three theme modes
  expect(content).toMatch(/light/i);
  expect(content).toMatch(/dark/i);
  expect(content).toMatch(/system/i);
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TH-010: No hardcoded hex in .tsx component inline styles
// ════════════════════════════════════════════════════════════════════════════

test("TC-TH-010: No hardcoded hex colors in .tsx component inline styles", async () => {
  /**
   * Spec: "No hardcoded hex colors remain in component inline styles
   * (all use CSS variables or Tailwind tokens)" (Story 2 AC)
   *
   * Exceptions per QA Handoff and design spec:
   * - Google brand colors in sign-in page (mandated by Google brand guidelines)
   * - Code comments (not runtime values)
   * - ConsoleSignature.tsx (browser console.log styling only, not UI components)
   */
  const { execSync } = require("child_process") as typeof import("child_process");

  const srcPath = path.join(REPO_ROOT, "development/frontend/src");

  let output = "";
  try {
    // grep for style={{ ... }} blocks containing # followed by hex digits
    output = execSync(
      `grep -rn 'style={{' "${srcPath}" --include='*.tsx' | grep -i '#[0-9a-f]'`,
      { encoding: "utf-8" }
    );
  } catch (e: unknown) {
    const err = e as { status?: number };
    // grep exits 1 when no matches — that is success
    if (err.status === 1) {
      output = "";
    } else {
      throw e;
    }
  }

  expect(output.trim()).toBe(
    ""
  );
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TH-011: No stray dark: Tailwind prefixes in src files
// ════════════════════════════════════════════════════════════════════════════

test("TC-TH-011: No stray dark: Tailwind prefixed classes in component source files", async () => {
  /**
   * Spec (from designs/ux-design/theme-system.md Design Rules):
   * "MUST NOT: Never use the dark: Tailwind prefix — the CSS variable system
   * handles both themes automatically."
   *
   * This is also required by Story 2 color audit task.
   */
  const { execSync } = require("child_process") as typeof import("child_process");

  const srcPath = path.join(REPO_ROOT, "development/frontend/src");

  let output = "";
  try {
    output = execSync(
      `grep -rn 'dark:' "${srcPath}" --include='*.tsx' --include='*.ts'`,
      { encoding: "utf-8" }
    );
  } catch (e: unknown) {
    const err = e as { status?: number };
    if (err.status === 1) {
      output = "";
    } else {
      throw e;
    }
  }

  expect(output.trim()).toBe("");
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TH-012: Light mode parchment — --background is warm and light
// ════════════════════════════════════════════════════════════════════════════

test("TC-TH-012: Light mode sets Norse parchment background (high lightness CSS variable)", async ({
  page,
}) => {
  /**
   * Spec: "Light mode uses Norse parchment aesthetic (not white/modern)" (Story 2 AC)
   * Spec: ":root --background: 36 33% 88%" (theme-system.md Light Palette)
   *
   * The light background must be a warm parchment (high lightness > 70%),
   * not a stark white (which would be 100% lightness with 0% saturation).
   * We verify: lightness > 70% AND saturation > 0% (warm, not white).
   */
  await page.addInitScript((key) => {
    localStorage.setItem(key, "light");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const bg = await getCSSVariable(page, "--background");
  expect(bg).toBeTruthy();

  const parts = bg.trim().split(/\s+/);

  // Saturation > 0 means it's warm parchment, not plain white
  const satPart = parts[1] ?? "";
  const saturation = parseFloat(satPart.replace("%", ""));
  expect(saturation).toBeGreaterThan(0);

  // Lightness must be high (parchment)
  const lightness = parseLightness(bg);
  expect(lightness).toBeGreaterThan(70);

  // Must not be stark white (100% lightness = white)
  expect(lightness).toBeLessThan(100);
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TH-013: Active theme option is aria-checked=true after toggle click
// ════════════════════════════════════════════════════════════════════════════

test("TC-TH-013: Active state — aria-checked updates immediately when option is clicked", async ({
  page,
}) => {
  /**
   * Spec: "Clicking each option changes the theme immediately" (Story 2 AC)
   *
   * After clicking Light, the Light radio must be aria-checked=true
   * and Dark must be aria-checked=false.
   */
  // Start in dark mode
  await page.addInitScript((key) => {
    localStorage.setItem(key, "dark");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await openAnonPanel(page);

  const toggle = page.getByRole(TOGGLE_ROLE, { name: TOGGLE_ARIA_LABEL });
  const lightOption = toggle.getByRole("radio", { name: /light/i });
  const darkOption = toggle.getByRole("radio", { name: /dark/i });

  // Dark should be active initially
  await expect(darkOption).toHaveAttribute("aria-checked", "true");
  await expect(lightOption).toHaveAttribute("aria-checked", "false");

  // Click Light
  await lightOption.click();

  // Light is now active
  await expect(lightOption).toHaveAttribute("aria-checked", "true");
  await expect(darkOption).toHaveAttribute("aria-checked", "false");
});
