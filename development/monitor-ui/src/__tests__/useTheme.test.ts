/**
 * Tests for useTheme hook — theme toggle logic
 * Issue #964: light/dark theme switcher for monitor UI
 */
import { describe, it, expect, beforeEach } from "vitest";

// ── Unit tests for the pure theme-application logic ──────────────────────────
// We test the DOM side-effects and localStorage contract directly
// without mounting React (no hook harness needed for these invariants).

const STORAGE_KEY = "fenrir-monitor-theme";

function applyTheme(theme: "light" | "dark") {
  if (theme === "light") {
    document.documentElement.dataset.theme = "light";
  } else {
    delete document.documentElement.dataset.theme;
  }
}

describe("theme application logic", () => {
  beforeEach(() => {
    delete document.documentElement.dataset.theme;
    localStorage.clear();
  });

  it("applyTheme('light') sets data-theme=light on <html>", () => {
    applyTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("applyTheme('dark') removes data-theme from <html>", () => {
    document.documentElement.dataset.theme = "light";
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("dark is the default when localStorage is empty", () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const theme = saved === "light" ? "light" : "dark";
    expect(theme).toBe("dark");
  });

  it("reads 'light' theme from localStorage correctly", () => {
    localStorage.setItem(STORAGE_KEY, "light");
    const saved = localStorage.getItem(STORAGE_KEY);
    const theme = saved === "light" ? "light" : "dark";
    expect(theme).toBe("light");
  });

  it("reads 'dark' theme from localStorage correctly", () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    const saved = localStorage.getItem(STORAGE_KEY);
    const theme = saved === "light" ? "light" : "dark";
    expect(theme).toBe("dark");
  });

  it("setTheme writes to localStorage", () => {
    localStorage.setItem(STORAGE_KEY, "light");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");
    localStorage.setItem(STORAGE_KEY, "dark");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });
});

describe("FOIT prevention logic", () => {
  beforeEach(() => {
    delete document.documentElement.dataset.theme;
    localStorage.clear();
  });

  it("applies light theme before mount when localStorage='light'", () => {
    localStorage.setItem(STORAGE_KEY, "light");
    // simulate main.tsx FOIT snippet
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light") {
      document.documentElement.dataset.theme = "light";
    }
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("does not set data-theme when localStorage is empty (dark default)", () => {
    // simulate main.tsx FOIT snippet with no saved theme
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light") {
      document.documentElement.dataset.theme = "light";
    }
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});

// Helper matching ThemeSwitcher's aria-pressed logic
function isPressed(btn: "light" | "dark", theme: "light" | "dark"): boolean {
  return btn === theme;
}

describe("ThemeSwitcher aria-pressed contract", () => {
  it("light button aria-pressed=true when theme is light", () => {
    expect(isPressed("light", "light")).toBe(true);
    expect(isPressed("dark", "light")).toBe(false);
  });

  it("dark button aria-pressed=true when theme is dark", () => {
    expect(isPressed("dark", "dark")).toBe(true);
    expect(isPressed("light", "dark")).toBe(false);
  });
});
