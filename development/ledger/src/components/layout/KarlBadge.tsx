"use client";

/**
 * KarlBadge — header badge for Karl-tier subscribers only.
 *
 * Renders ONLY for active Karl subscribers (tier === "karl" && isActive).
 * Trial and Thrall users see nothing — this component returns null.
 *
 * Runic accents (ᚠ Fehu left, ᛟ Othala right) are aria-hidden — purely decorative.
 *
 * Issue: #1779, #1943
 */

import { useEntitlement } from "@/hooks/useEntitlement";

// ── Inner rune + text ────────────────────────────────────────────────────────

function BadgeInner() {
  return (
    <>
      <span className="karl-badge-rune" aria-hidden="true">ᚠ</span>
      KARL
      <span className="karl-badge-rune" aria-hidden="true">ᛟ</span>
    </>
  );
}

// ── KarlBadge ────────────────────────────────────────────────────────────────

export function KarlBadge() {
  const { tier, isActive } = useEntitlement();

  if (tier !== "karl" || !isActive) {
    return null;
  }

  return (
    <span
      className="karl-bling-badge"
      aria-label="Karl subscriber"
      role="img"
    >
      <BadgeInner />
    </span>
  );
}
