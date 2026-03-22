"use client";

/**
 * KarlBadge — header badge for Karl-tier and trial users.
 *
 * Always in the DOM when authenticated; CSS cascade controls visibility:
 *   [data-tier="karl"]  → full gold badge (active subscriber)
 *   [data-tier="trial"] → dimmed badge that links to /pricing (upsell nudge)
 *   [data-tier="thrall"] → hidden (display: none via CSS)
 *
 * Karl:  <span role="img"> — decorative, non-interactive
 * Trial: <Link href="/pricing"> — tappable upsell nudge to upgrade
 * Thrall: <span> in DOM but hidden by CSS (no JS branch needed)
 *
 * Runic accents (ᚷ Gebo) are aria-hidden — purely decorative.
 *
 * Issue: #1779
 */

import Link from "next/link";
import { useTrialStatus } from "@/hooks/useTrialStatus";

// ── Inner rune + text ────────────────────────────────────────────────────────

function BadgeInner() {
  return (
    <>
      <span className="karl-badge-rune" aria-hidden="true">ᚷ</span>
      KARL
      <span className="karl-badge-rune" aria-hidden="true">ᚷ</span>
    </>
  );
}

// ── KarlBadge ────────────────────────────────────────────────────────────────

export function KarlBadge() {
  const { status } = useTrialStatus();
  const isTrialActive = status === "active";

  if (isTrialActive) {
    // Trial: dimmed badge, links to pricing as upsell nudge
    return (
      <Link
        href="/pricing"
        className="karl-bling-badge"
        aria-label="Karl trial — upgrade to Karl"
        title="Upgrade to Karl"
      >
        <BadgeInner />
      </Link>
    );
  }

  // Karl (and thrall — CSS hides for thrall): non-interactive badge
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
