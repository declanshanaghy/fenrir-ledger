/**
 * ThemeToggle — unit tests for Issue #848 and Issue #1926
 *
 * Verifies:
 *  - cycleTheme uses resolvedTheme (not raw "system") to determine next theme
 *  - Icon variant calls setTheme with opposite of resolvedTheme, not theme
 *  - Inline variant buttons call setTheme("light") / setTheme("dark") directly
 *  - Icon variant button has no border classes (Issue #1926)
 *  - Inline variant wrapper has no outer border classes (Issue #1926)
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

// ── ThemeToggle — inline variant ─────────────────────────────────────────────

describe("ThemeToggle — inline variant", () => {
  it("renders radiogroup with Light and Dark radio buttons", () => {
    mockThemeState.theme = "dark";
    mockThemeState.resolvedTheme = "dark";

    render(<ThemeToggle variant="inline" />);
    expect(screen.getByRole("radiogroup")).toBeDefined();
    expect(screen.getByRole("radio", { name: "Light" })).toBeDefined();
    expect(screen.getByRole("radio", { name: "Dark" })).toBeDefined();
  });

  it("Dark button is aria-checked when resolvedTheme='dark'", () => {
    mockThemeState.theme = "dark";
    mockThemeState.resolvedTheme = "dark";

    render(<ThemeToggle variant="inline" />);
    const darkButton = screen.getByRole("radio", { name: "Dark" });
    const lightButton = screen.getByRole("radio", { name: "Light" });
    expect(darkButton.getAttribute("aria-checked")).toBe("true");
    expect(lightButton.getAttribute("aria-checked")).toBe("false");
  });

  it("Light button is aria-checked when resolvedTheme='light'", () => {
    mockThemeState.theme = "light";
    mockThemeState.resolvedTheme = "light";

    render(<ThemeToggle variant="inline" />);
    const lightButton = screen.getByRole("radio", { name: "Light" });
    const darkButton = screen.getByRole("radio", { name: "Dark" });
    expect(lightButton.getAttribute("aria-checked")).toBe("true");
    expect(darkButton.getAttribute("aria-checked")).toBe("false");
  });

  it("clicking Light button calls setTheme('light')", () => {
    mockThemeState.theme = "dark";
    mockThemeState.resolvedTheme = "dark";

    render(<ThemeToggle variant="inline" />);
    fireEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("clicking Dark button calls setTheme('dark')", () => {
    mockThemeState.theme = "light";
    mockThemeState.resolvedTheme = "light";

    render(<ThemeToggle variant="inline" />);
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });
});

// ── ThemeToggle — Issue #1926: no border on header toggle ────────────────────

describe("ThemeToggle — Issue #1926: no border classes", () => {
  it("icon variant button has no border or border-border class", () => {
    mockThemeState.theme = "dark";
    mockThemeState.resolvedTheme = "dark";

    const { container } = render(<ThemeToggle variant="icon" />);
    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    const cls = button!.className;
    expect(cls).not.toContain("border-border");
    // Ensure no standalone "border" class (border-r or similar sub-strings are fine)
    const tokens = cls.split(/\s+/);
    expect(tokens).not.toContain("border");
  });

  it("inline variant wrapper has no outer border or border-border class", () => {
    mockThemeState.theme = "dark";
    mockThemeState.resolvedTheme = "dark";

    const { container } = render(<ThemeToggle variant="inline" />);
    const wrapper = container.querySelector('[role="radiogroup"]');
    expect(wrapper).not.toBeNull();
    const cls = wrapper!.className;
    expect(cls).not.toContain("border-border");
    const tokens = cls.split(/\s+/);
    expect(tokens).not.toContain("border");
  });

  it("icon variant retains hover and transition classes", () => {
    mockThemeState.theme = "dark";
    mockThemeState.resolvedTheme = "dark";

    const { container } = render(<ThemeToggle variant="icon" />);
    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    const cls = button!.className;
    expect(cls).toContain("hover:text-gold");
    expect(cls).toContain("transition-colors");
  });

  it("icon variant meets 44x44px touch target via inline style", () => {
    mockThemeState.theme = "dark";
    mockThemeState.resolvedTheme = "dark";

    const { container } = render(<ThemeToggle variant="icon" />);
    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.style.minWidth).toBe("44px");
    expect(button.style.minHeight).toBe("44px");
  });

  it("icon variant has no border classes in light theme (both themes borderless)", () => {
    mockThemeState.theme = "light";
    mockThemeState.resolvedTheme = "light";

    const { container } = render(<ThemeToggle variant="icon" />);
    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    const cls = button!.className;
    expect(cls).not.toContain("border-border");
    const tokens = cls.split(/\s+/);
    expect(tokens).not.toContain("border");
  });
});
