"use client";

/**
 * ThemeToggle -- three-way theme switcher: Light / Dark / System.
 *
 * Uses `useTheme()` from `next-themes` to read and set the active theme.
 * Renders as a segmented button group with Sun, Moon, and Monitor icons.
 *
 * SSR-safe: renders a placeholder until the component is mounted to avoid
 * hydration mismatches (next-themes resolves the theme client-side).
 *
 * Accessibility:
 *   - `role="radiogroup"` with `aria-label="Theme"`
 *   - Each option is `role="radio"` with `aria-checked`
 *   - Touch-friendly: min 44x44px tap targets
 *
 * Styling:
 *   - border-border, text-muted-foreground baseline
 *   - Active state: text-gold, bg-secondary
 *   - Norse aesthetic: sharp corners, gold accent
 */

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";

const THEME_OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

interface ThemeToggleProps {
  /**
   * Layout variant.
   * - "inline": segmented button group for dropdown menus (default)
   * - "icon": single cycling icon button for compact spaces
   */
  variant?: "inline" | "icon";
}

export function ThemeToggle({ variant = "inline" }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // SSR guard: avoid hydration mismatch by rendering placeholder until mounted.
  useEffect(() => {
    setMounted(true);
  }, []);

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
    return (
      <div
        className="h-[36px] w-[132px] rounded-sm bg-secondary/30"
        aria-hidden="true"
      />
    );
  }

  // Icon variant: single cycling button
  if (variant === "icon") {
    const current = THEME_OPTIONS.find((o) => o.value === theme) ?? THEME_OPTIONS[2];
    const nextIndex = (THEME_OPTIONS.indexOf(current) + 1) % THEME_OPTIONS.length;
    const next = THEME_OPTIONS[nextIndex] ?? THEME_OPTIONS[0];

    return (
      <button
        type="button"
        onClick={() => setTheme(next.value)}
        className="flex items-center justify-center rounded-sm border border-border
                   text-muted-foreground hover:text-gold transition-colors"
        style={{ minWidth: 44, minHeight: 44 }}
        aria-label={`Theme: ${current.label}. Click to switch to ${next.label}.`}
        title={`Theme: ${current.label}`}
      >
        <current.Icon className="h-4 w-4" />
      </button>
    );
  }

  // Inline variant: segmented button group
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center rounded-sm border border-border overflow-hidden"
    >
      {THEME_OPTIONS.map(({ value, label, Icon }) => {
        const isActive = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            onClick={() => setTheme(value)}
            className={[
              "flex items-center justify-center transition-colors",
              "border-r border-border last:border-r-0",
              isActive
                ? "bg-secondary text-gold"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
            ].join(" ")}
            style={{ minWidth: 44, minHeight: 36 }}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
