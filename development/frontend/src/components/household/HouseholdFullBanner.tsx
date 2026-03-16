"use client";

/**
 * HouseholdFullBanner — Shown when household is at max capacity (3/3).
 *
 * Replaces the invite code block entirely. No invite code or Regenerate button
 * is rendered when household is full — the server also rejects with 409.
 *
 * Issue #1123 — household invite code flow
 */

export function HouseholdFullBanner() {
  return (
    <div
      className="border-2 border-border p-3 flex items-center gap-3"
      role="status"
      aria-label="Household is full"
    >
      <span className="text-xl flex-shrink-0" aria-hidden="true">
        ⚔
      </span>
      <div className="flex flex-col gap-1">
        <div className="text-[13px] font-bold text-foreground">
          Household is full
        </div>
        <div className="text-[11px] text-muted-foreground">
          Max 3 members reached. No invite codes can be issued.
        </div>
      </div>
    </div>
  );
}
