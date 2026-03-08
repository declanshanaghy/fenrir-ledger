"use client";

/**
 * HowlEmptyState -- shown when The Howl tab has no cards.
 *
 * Displays the Raido rune and "The wolf is silent" message per wireframe
 * scenario 4 (dashboard-tabs.html).
 *
 * Reuses the same copy and rune from the old HowlPanel PanelEmptyState.
 */

export function HowlEmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-4 text-center gap-3"
      data-testid="howl-empty-state"
    >
      {/* Raido rune -- journey rune; calm, all chains are loose */}
      <span
        aria-hidden="true"
        className="text-5xl text-muted-foreground/40 select-none"
        style={{ fontFamily: "serif" }}
      >
        {"\u16B1"}
      </span>
      <p className="text-base font-heading text-foreground">
        The wolf is silent.
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
        No cards need attention. All chains are loose.
      </p>
    </div>
  );
}
