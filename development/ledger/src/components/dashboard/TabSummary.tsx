"use client";

/**
 * TabSummary — dismissable dynamic summary sub-header showing card counts.
 *
 * Renders below the TabHeader (or at top if header dismissed) with:
 * - Dynamic counts by status (e.g., "2 with fee due, 1 promo expiring")
 * - Only shown when tab has cards (not shown on empty tabs)
 * - X button to dismiss independently from header
 *
 * Issue #586 — Dismissable tab headers and summary sub-headers
 * Wireframe: ux/wireframes/chrome/dashboard-tab-headers.html — Scenarios 1-5
 * Interaction spec: dashboard-tab-headers-interaction-spec.md — Sections 2, 5
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardTab } from "@/lib/constants";
import type { Card } from "@/lib/types";
import { daysUntil, formatCurrency } from "@/lib/card-utils";

/** localStorage key pattern for summary dismissal */
function getSummaryStorageKey(tabId: DashboardTab): string {
  return `fenrir:tab-summary-dismissed:${tabId}`;
}

// ─── Summary text generators per tab ──────────────────────────────────────────

/**
 * ALL tab: "{total} cards total: {active} active, {hunt} hunting, {howl} howling, {valhalla} in Valhalla"
 * Segments with zero count are omitted.
 */
function allSummary(cards: Card[]): React.ReactNode[] {
  const active = cards.filter((c) => c.status === "active").length;
  const hunt = cards.filter((c) => c.status === "bonus_open").length;
  const howl = cards.filter(
    (c) =>
      c.status === "fee_approaching" ||
      c.status === "promo_expiring" ||
      c.status === "overdue"
  ).length;
  const valhalla = cards.filter(
    (c) => c.status === "closed" || c.status === "graduated"
  ).length;

  const segments: string[] = [];
  if (active > 0) segments.push(`${active} active`);
  if (hunt > 0) segments.push(`${hunt} hunting`);
  if (howl > 0) segments.push(`${howl} howling`);
  if (valhalla > 0) segments.push(`${valhalla} in Valhalla`);

  const parts: React.ReactNode[] = [];
  parts.push(
    <span key="total" className="font-bold">
      {cards.length} card{cards.length !== 1 ? "s" : ""}
    </span>
  );
  if (segments.length > 0) {
    parts.push(` total: ${segments.join(", ")}`);
  } else {
    parts.push(" total");
  }
  return parts;
}

/**
 * VALHALLA tab: "{closed} closed, {graduated} graduated -- chains broken, plunder secured"
 */
function valhallaSummary(cards: Card[]): React.ReactNode[] {
  const closed = cards.filter((c) => c.status === "closed").length;
  const graduated = cards.filter((c) => c.status === "graduated").length;

  const segments: string[] = [];
  if (closed > 0) segments.push(`${closed} closed`);
  if (graduated > 0) segments.push(`${graduated} graduated`);

  const parts: React.ReactNode[] = [];
  parts.push(
    <span key="counts" className="font-bold">
      {segments.join(", ")}
    </span>
  );
  parts.push(" \u2014 chains broken, plunder secured");
  return parts;
}

/**
 * ACTIVE tab: "{count} active cards in good standing"
 */
function activeSummary(cards: Card[]): React.ReactNode[] {
  return [
    <span key="count" className="font-bold">
      {cards.length} active card{cards.length !== 1 ? "s" : ""}
    </span>,
    " in good standing",
  ];
}

/**
 * THE HUNT tab: aggregate spend progress across all hunt cards.
 *
 * Format: "{count} cards · $X of $Y total min spend · {approaching} approaching deadline"
 * Issue #1792 — show aggregate min spend progress in the summary bar.
 */
function huntSummary(cards: Card[]): React.ReactNode[] {
  const totalSpent = cards.reduce((sum, c) => sum + (c.amountSpent ?? 0), 0);
  const totalRequired = cards.reduce(
    (sum, c) => sum + (c.signUpBonus?.spendRequirement ?? 0),
    0
  );
  const approaching = cards.filter((c) => {
    if (!c.signUpBonus?.deadline) return false;
    const days = daysUntil(c.signUpBonus.deadline);
    return days >= 0 && days <= 30;
  }).length;

  const parts: React.ReactNode[] = [];
  parts.push(
    <span key="count" className="font-bold">
      {cards.length} card{cards.length !== 1 ? "s" : ""}
    </span>
  );

  if (totalRequired > 0) {
    const pct = Math.min(
      100,
      Math.round((totalSpent / totalRequired) * 100)
    );
    parts.push(" · ");
    parts.push(
      <span key="spend" className="font-bold">
        {formatCurrency(totalSpent)}
      </span>
    );
    parts.push(` of ${formatCurrency(totalRequired)} min spend`);
    parts.push(
      <span key="pct" className="font-bold">
        {" "}({pct}%)
      </span>
    );
  } else {
    parts.push(" with open bonus windows");
  }

  if (approaching > 0) {
    parts.push(", ");
    parts.push(
      <span key="approaching" className="font-bold">
        {approaching}
      </span>
    );
    parts.push(` approaching ${approaching === 1 ? "its" : "their"} deadline`);
  }
  return parts;
}

/**
 * THE HOWL tab: "{fee} with fee due, {promo} promo expiring, {overdue} overdue"
 * Segments with zero count are omitted.
 */
function howlSummary(cards: Card[]): React.ReactNode[] {
  const fee = cards.filter((c) => c.status === "fee_approaching").length;
  const promo = cards.filter((c) => c.status === "promo_expiring").length;
  const overdue = cards.filter((c) => c.status === "overdue").length;

  const segments: React.ReactNode[] = [];
  if (fee > 0) {
    segments.push(
      <span key="fee">
        <span className="font-bold">
          {fee} card{fee !== 1 ? "s" : ""}
        </span>{" "}
        with fee due
      </span>
    );
  }
  if (promo > 0) {
    segments.push(
      <span key="promo">
        <span className="font-bold">
          {promo} card{promo !== 1 ? "s" : ""}
        </span>{" "}
        with promo expiring
      </span>
    );
  }
  if (overdue > 0) {
    segments.push(
      <span key="overdue">
        <span className="font-bold">
          {overdue}
        </span>{" "}
        overdue
      </span>
    );
  }

  // Join with ", "
  const parts: React.ReactNode[] = [];
  segments.forEach((seg, i) => {
    if (i > 0) parts.push(", ");
    parts.push(seg);
  });
  return parts;
}

/** Trash tab summary: "{N} deleted cards" */
function trashSummary(cards: Card[]): React.ReactNode[] {
  return [
    <span key="count" className="font-bold">
      {cards.length} deleted card{cards.length !== 1 ? "s" : ""}
    </span>,
    " — restore to return to active, or expunge to erase permanently.",
  ];
}

/** Map tab ID to its summary text generator */
const SUMMARY_GENERATORS: Record<
  DashboardTab,
  (cards: Card[]) => React.ReactNode[]
> = {
  all: allSummary,
  valhalla: valhallaSummary,
  active: activeSummary,
  hunt: huntSummary,
  howl: howlSummary,
  trash: trashSummary,
};

// ─── Component ────────────────────────────────────────────────────────────────

interface TabSummaryProps {
  /** Which tab this summary belongs to */
  tabId: DashboardTab;
  /** The filtered cards for this tab. Summary text is computed from this array. */
  cards: Card[];
}

export function TabSummary({ tabId, cards }: TabSummaryProps) {
  const [dismissed, setDismissed] = useState<boolean>(true); // default hidden until hydration
  const containerRef = useRef<HTMLDivElement>(null);

  // Read dismissed state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(getSummaryStorageKey(tabId));
      setDismissed(stored === "true");
    } catch {
      // localStorage unavailable — show by default
      setDismissed(false);
    }
  }, [tabId]);

  const handleDismiss = useCallback(() => {
    // Capture the parent tab panel before removing from DOM
    const panel = containerRef.current?.closest("[role='tabpanel']");

    try {
      localStorage.setItem(getSummaryStorageKey(tabId), "true");
    } catch {
      // Ignore write errors
    }
    setDismissed(true);

    // Focus management: move to first card or grid container
    requestAnimationFrame(() => {
      if (!panel) return;
      const focusable = panel.querySelector<HTMLElement>("[tabindex='-1']");
      focusable?.focus();
    });
  }, [tabId]);

  // Not rendered when empty — nothing to summarize
  if (cards.length === 0) return null;
  if (dismissed) return null;

  const generate = SUMMARY_GENERATORS[tabId];
  const summaryParts = generate(cards);

  return (
    <div
      ref={containerRef}
      className="flex items-center gap-3 px-4 py-2.5 border-b border-border"
      aria-label={`${tabId} tab summary`}
    >
      <div className="flex-1 text-xs text-muted-foreground">
        {summaryParts}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="flex items-center justify-center min-w-[28px] min-h-[28px] p-0.5 border border-border text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Dismiss tab summary"
        style={{ touchAction: "manipulation" }}
      >
        {"\u2715"}
      </button>
    </div>
  );
}
