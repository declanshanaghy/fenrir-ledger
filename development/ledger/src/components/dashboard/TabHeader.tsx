"use client";

/**
 * TabHeader — dismissable tab guide showing the tab's purpose and status labels.
 *
 * Renders a bordered section at the top of each tab panel with:
 * - Tab name + rune as title
 * - 1-2 sentence description of what this tab is for (Norse-flavored)
 * - List of card statuses that appear in this tab
 * - X button to dismiss (persisted in localStorage)
 *
 * Issue #586 — Dismissable tab headers and summary sub-headers
 * Wireframe: ux/wireframes/chrome/dashboard-tab-headers.html — Scenarios 1-5
 * Interaction spec: dashboard-tab-headers-interaction-spec.md — Section 1
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardTab } from "@/lib/constants";
import { TAB_HEADER_CONTENT } from "@/lib/constants";

/** localStorage key pattern for header dismissal */
function getHeaderStorageKey(tabId: DashboardTab): string {
  return `fenrir:tab-header-dismissed:${tabId}`;
}

interface TabHeaderProps {
  /** Which tab this header belongs to */
  tabId: DashboardTab;
}

export function TabHeader({ tabId }: TabHeaderProps) {
  const [dismissed, setDismissed] = useState<boolean>(true); // default hidden until hydration
  const containerRef = useRef<HTMLDivElement>(null);

  // Read dismissed state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(getHeaderStorageKey(tabId));
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
      localStorage.setItem(getHeaderStorageKey(tabId), "true");
    } catch {
      // Ignore write errors (e.g. storage full)
    }
    setDismissed(true);

    // Focus management: move to next focusable element in tab panel
    // Per spec: summary dismiss button if visible, else first card, else empty state
    requestAnimationFrame(() => {
      if (!panel) return;
      const focusable = panel.querySelector<HTMLElement>(
        "button[aria-label='Dismiss tab summary'], [tabindex='-1']"
      );
      focusable?.focus();
    });
  }, [tabId]);

  if (dismissed) return null;

  const content = TAB_HEADER_CONTENT[tabId];

  return (
    <div
      ref={containerRef}
      className="flex items-start gap-3 px-4 py-3.5 border-b border-border"
      aria-label={`${tabId} tab guide`}
    >
      <div className="flex-1 flex flex-col gap-1">
        <p className="text-sm font-heading font-bold">{content.title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {content.description}
        </p>
        {/* Status list hidden on mobile (375px), visible sm+ per wireframe Scenario 8 */}
        <p className="hidden sm:block text-[11px] text-muted-foreground leading-relaxed mt-1">
          {content.statuses}
        </p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="flex items-center justify-center min-w-[32px] min-h-[32px] p-1 border border-border text-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Dismiss tab guide"
        style={{ touchAction: "manipulation" }}
      >
        {"\u2715"}
      </button>
    </div>
  );
}
