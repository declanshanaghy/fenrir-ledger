"use client";

/**
 * HowlEmptyState -- shown when The Howl tab has no cards.
 *
 * Issue #583 — simplified to unified runic pattern: `ᚲ No alerts ᚲ`
 * Uses the Kenaz rune (ᚲ) from The Howl tab config.
 */

export function HowlEmptyState() {
  return (
    <div
      className="flex items-center justify-center py-16 px-6 text-center"
      data-testid="howl-empty-state"
      aria-label="No alerts"
    >
      <p className="text-base font-heading text-muted-foreground tracking-wide">
        <span aria-hidden="true" style={{ fontFamily: "serif" }}>ᚲ</span>
        {" "}No alerts{" "}
        <span aria-hidden="true" style={{ fontFamily: "serif" }}>ᚲ</span>
      </p>
    </div>
  );
}
