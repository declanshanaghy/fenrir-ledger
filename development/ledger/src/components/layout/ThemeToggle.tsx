"use client";

/**
 * ThemeToggle -- two-state dark ↔ light toggle.
 *
 * Uses `useTheme()` from `next-themes` to read and set the active theme.
 * Renders as a toggle button switching between Sun and Moon icons.
 *
 * First load: defaults to system preference via `prefers-color-scheme`.
 * After that, persists the user's explicit choice in localStorage.
 *
 * SSR-safe: renders a placeholder until the component is mounted to avoid
 * hydration mismatches (next-themes resolves the theme client-side).
 *
 * Accessibility:
 *   - `role="switch"` with `aria-checked` for the toggle variant
 *   - Touch-friendly: min 44x44px tap targets
 *
 * Styling:
 *   - text-muted-foreground baseline (no border)
 *   - Active state: text-gold, bg-secondary
 *   - Norse aesthetic: sharp corners, gold accent
 */

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

/** Toggle between dark and light themes */
export function cycleTheme(currentTheme: string | undefined): string {
  return currentTheme === "dark" ? "light" : "dark";
}

interface ThemeToggleProps {
  /**
   * Layout variant.
   * - "inline": segmented button group for dropdown menus (default)
   * - "icon": single cycling icon button for compact spaces
   * - "dropdown-icon": bare cycling icon for embedding inside a menu row
   */
  variant?: "inline" | "icon" | "dropdown-icon";
}

export function ThemeToggle({ variant = "inline" }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // SSR guard: avoid hydration mismatch by rendering placeholder until mounted.
  useEffect(() => {
    setMounted(true);
  }, []);

  // On first load, if theme is "system", resolve it to an explicit "dark" or "light"
  // based on the OS preference. This pins the choice and persists it to localStorage,
  // so the theme never re-evaluates on OS changes (Ref #556).
  useEffect(() => {
    if (mounted && theme === "system" && resolvedTheme) {
      setTheme(resolvedTheme);
    }
  }, [mounted, theme, resolvedTheme, setTheme]);

  if (!mounted) {
    // Placeholder with same dimensions to prevent layout shift.
    if (variant === "icon") {
      return (
        <div
          className="h-[44px] w-[44px] rounded-sm bg-secondary/30"
          aria-hidden="true"
        />
      );
    }
    if (variant === "dropdown-icon") {
      return (
        <div
          className="h-4 w-4 rounded-sm bg-secondary/30 shrink-0"
          aria-hidden="true"
        />
      );
    }
    return (
      <div
        className="h-[44px] w-[44px] rounded-sm bg-secondary/30"
        aria-hidden="true"
      />
    );
  }

  // Resolve effective theme: use resolvedTheme to handle the brief "system" → explicit transition
  const isDark = (resolvedTheme ?? theme) === "dark";
  const CurrentIcon = isDark ? Moon : Sun;
  const currentLabel = isDark ? "Dark" : "Light";
  const nextLabel = isDark ? "Light" : "Dark";

  // Dropdown-icon variant: display-only icon for embedding inside a clickable menu row.
  // The parent row handles the click — this just renders the current theme icon.
  if (variant === "dropdown-icon") {
    return (
      <span
        className="shrink-0 text-muted-foreground"
        aria-hidden="true"
      >
        <CurrentIcon className="h-4 w-4" />
      </span>
    );
  }

  // Icon variant: single toggle button
  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={() => setTheme(cycleTheme(resolvedTheme ?? theme))}
        className="flex items-center justify-center rounded-sm
                   text-muted-foreground hover:text-gold transition-colors"
        style={{ minWidth: 44, minHeight: 44 }}
        aria-label={`Theme: ${currentLabel}. Click to switch to ${nextLabel}.`}
      >
        <CurrentIcon className="h-4 w-4" />
      </button>
    );
  }

  // Inline variant: single cycling toggle button
  const ToggleIcon = isDark ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={() => setTheme(cycleTheme(resolvedTheme ?? theme))}
      className="flex items-center justify-center text-muted-foreground hover:text-gold transition-colors"
      style={{ minWidth: 44, minHeight: 44 }}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <ToggleIcon className="h-4 w-4" />
    </button>
  );
}
