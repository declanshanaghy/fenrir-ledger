/**
 * ThemeToggle — unit tests for Issues #848, #1927
 *
 * Verifies:
 *  - cycleTheme uses resolvedTheme (not raw "system") to determine next theme
 *  - Icon variant calls setTheme with opposite of resolvedTheme, not theme
 *  - Inline variant (Issue #1927): single cycling button, no radiogroup, icon/aria-label swap
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { cycleTheme, ThemeToggle } from "@/components/layout/ThemeToggle";

// ── Shared mock ─────────────────────────────────────────────────────────────

const mockSetTheme = vi.hoisted(() => vi.fn());

// Mock state that tests can mutate via mockThemeState
const mockThemeState = {
  theme: "dark" as string | undefined,
  resolvedTheme: "dark" as string | undefined,
};

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: mockThemeState.theme,
    resolvedTheme: mockThemeState.resolvedTheme,
    setTheme: mockSetTheme,
  }),
}));

beforeEach(() => {
  mockSetTheme.mockClear();
  mockThemeState.theme = "dark";
  mockThemeState.resolvedTheme = "dark";
});

// ── cycleTheme helper ───────────────────────────────────────────────────────

describe("cycleTheme", () => {
  it('returns "light" when current theme is "dark"', () => {
    expect(cycleTheme("dark")).toBe("light");
  });

  it('returns "dark" when current theme is "light"', () => {
    expect(cycleTheme("light")).toBe("dark");
  });

  it('returns "dark" when current theme is "system" (since "system" !== "dark")', () => {
    // This shows why using raw `theme` ("system") in cycleTheme is wrong —
    // cycleTheme("system") → "dark" even when system is already dark.
    // The fix is to pass resolvedTheme ?? theme to cycleTheme in the component.
    expect(cycleTheme("system")).toBe("dark");
  });

  it("returns \"dark\" when current theme is undefined", () => {
    expect(cycleTheme(undefined)).toBe("dark");
  });
});

// ── ThemeToggle — icon variant ───────────────────────────────────────────────

describe("ThemeToggle — icon variant (Issue #848 fix)", () => {
  it("uses resolvedTheme to cycle: resolvedTheme='dark' → setTheme('light')", () => {
    mockThemeState.theme = "system";
    mockThemeState.resolvedTheme = "dark";

    render(<ThemeToggle variant="icon" />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    // Before fix: cycleTheme("system") = "dark" → setTheme("dark") (no change!)
    // After fix:  cycleTheme("dark")   = "light" → setTheme("light") ✓
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("uses resolvedTheme to cycle: resolvedTheme='light' → setTheme('dark')", () => {
    mockThemeState.theme = "system";
    mockThemeState.resolvedTheme = "light";

    render(<ThemeToggle variant="icon" />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("explicit theme='dark' → setTheme('light')", () => {
    mockThemeState.theme = "dark";
    mockThemeState.resolvedTheme = "dark";

    render(<ThemeToggle variant="icon" />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("explicit theme='light' → setTheme('dark')", () => {
    mockThemeState.theme = "light";
    mockThemeState.resolvedTheme = "light";

    render(<ThemeToggle variant="icon" />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });
});

// ── ThemeToggle — inline variant (Issue #1927: single cycling button) ─────────

describe("ThemeToggle — inline variant (Issue #1927)", () => {
  it("renders a single button — no radiogroup", () => {
    mockThemeState.theme = "dark";
    mockThemeState.resolvedTheme = "dark";

    render(<ThemeToggle variant="inline" />);
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByRole("button")).toBeDefined();
  });

  it("dark mode: aria-label is 'Switch to light mode'", () => {
    mockThemeState.theme = "dark";
    mockThemeState.resolvedTheme = "dark";

    render(<ThemeToggle variant="inline" />);
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeDefined();
  });

  it("light mode: aria-label is 'Switch to dark mode'", () => {
    mockThemeState.theme = "light";
    mockThemeState.resolvedTheme = "light";

    render(<ThemeToggle variant="inline" />);
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeDefined();
  });

  it("dark mode: clicking calls setTheme('light')", () => {
    mockThemeState.theme = "dark";
    mockThemeState.resolvedTheme = "dark";

    render(<ThemeToggle variant="inline" />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("light mode: clicking calls setTheme('dark')", () => {
    mockThemeState.theme = "light";
    mockThemeState.resolvedTheme = "light";

    render(<ThemeToggle variant="inline" />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("resolvedTheme='dark' with theme='system': clicking calls setTheme('light')", () => {
    mockThemeState.theme = "system";
    mockThemeState.resolvedTheme = "dark";

    render(<ThemeToggle variant="inline" />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });
});
