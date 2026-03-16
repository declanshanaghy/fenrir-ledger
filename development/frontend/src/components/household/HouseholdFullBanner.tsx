"use client";

/**
 * HouseholdFullBanner — shown when household is at max capacity (3/3 members).
 * Replaces the invite code block entirely.
 *
 * @see ux/wireframes/household/settings-household.html § C
 * Issue #1123
 */

export function HouseholdFullBanner() {
  return (
    <div
      className="border-2 border-border p-3 flex items-start gap-3 karl-bling-card"
      role="status"
      aria-label="Household is full"
    >
      <span className="text-xl leading-none flex-shrink-0 mt-0.5" aria-hidden="true">
        &#x2694;
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-heading font-bold text-foreground">
          Household is full
        </p>
        <p className="text-xs text-muted-foreground font-body">
          Max 3 members reached. No invite codes can be issued.
        </p>
      </div>
    </div>
  );
}
