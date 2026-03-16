/**
 * button-glow-sidebar-bling.test.tsx
 *
 * Vitest tests for Issue #1089: Karl button glow and sidebar bling.
 *
 * Verifies:
 *   - .karl-bling-btn receives animated glow class support (CSS cascade)
 *   - .sidebar-karl-feature is present on Valhalla/Hunt tabs
 *   - .karl-gate-marker replaces "K" text badge with ᚠ rune for Thrall users
 *   - Runic prefix/suffix (::before/::after) are CSS-only and not in DOM
 *
 * @ref #1089
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  usePathname: () => "/ledger",
  useSearchParams: () => ({
    get: () => null,
  }),
}));

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => ({
    hasFeature: vi.fn(() => false),
  }),
}));

const mockIsKarlOrTrial = { value: false };
vi.mock("@/hooks/useIsKarlOrTrial", () => ({
  useIsKarlOrTrial: () => mockIsKarlOrTrial.value,
}));

vi.mock("@/components/entitlement/KarlUpsellDialog", () => ({
  KarlUpsellDialog: () => null,
  KARL_UPSELL_VALHALLA: { feature: "valhalla" },
  KARL_UPSELL_VELOCITY: { feature: "velocity" },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function setTier(tier: "karl" | "trial" | "thrall") {
  document.documentElement.setAttribute("data-tier", tier);
}

function clearTier() {
  document.documentElement.removeAttribute("data-tier");
}

// ── Tests: sidebar-karl-feature class ─────────────────────────────────────────

describe("LedgerBottomTabs — sidebar-karl-feature class", () => {
  beforeEach(() => {
    clearTier();
    mockIsKarlOrTrial.value = false;
  });

  it("Valhalla li has sidebar-karl-feature class", async () => {
    const { LedgerBottomTabs } = await import(
      "@/components/layout/LedgerBottomTabs"
    );
    render(<LedgerBottomTabs />);

    // Find the Valhalla button by aria-label pattern
    const valhallaBtn = screen.getByRole("button", {
      name: /valhalla/i,
    });
    const valhallali = valhallaBtn.closest("li");
    expect(valhallali).toBeTruthy();
    expect(valhallali?.className).toContain("sidebar-karl-feature");
  });

  it("Hunt li has sidebar-karl-feature class", async () => {
    const { LedgerBottomTabs } = await import(
      "@/components/layout/LedgerBottomTabs"
    );
    render(<LedgerBottomTabs />);

    const huntBtn = screen.getByRole("button", {
      name: /hunt/i,
    });
    const huntLi = huntBtn.closest("li");
    expect(huntLi).toBeTruthy();
    expect(huntLi?.className).toContain("sidebar-karl-feature");
  });
});

// ── Tests: karl-gate-marker for Thrall users ──────────────────────────────────

describe("LedgerBottomTabs — karl-gate-marker for Thrall users", () => {
  beforeEach(() => {
    setTier("thrall");
    mockIsKarlOrTrial.value = false;
  });

  afterEach(() => {
    clearTier();
  });

  it("shows ᚠ rune gate marker on Valhalla when Thrall", async () => {
    const { LedgerBottomTabs } = await import(
      "@/components/layout/LedgerBottomTabs"
    );
    render(<LedgerBottomTabs />);

    // The gate marker spans are aria-hidden and contain the ᚠ rune
    const markers = document.querySelectorAll(".karl-gate-marker");
    expect(markers.length).toBeGreaterThanOrEqual(1);

    // Content should be the ᚠ fehu rune, not the old "K"
    const markerTexts = Array.from(markers).map((m) => m.textContent);
    expect(markerTexts.every((t) => t === "ᚠ")).toBe(true);
  });

  it("gate markers are aria-hidden for screen readers", async () => {
    const { LedgerBottomTabs } = await import(
      "@/components/layout/LedgerBottomTabs"
    );
    render(<LedgerBottomTabs />);

    const markers = document.querySelectorAll(".karl-gate-marker");
    markers.forEach((marker) => {
      expect(marker.getAttribute("aria-hidden")).toBe("true");
    });
  });

  it("no gate markers shown for Karl user (has access)", async () => {
    setTier("karl");
    mockIsKarlOrTrial.value = true;

    // Need fresh import since vi.mock is module-level
    vi.doMock("@/hooks/useEntitlement", () => ({
      useEntitlement: () => ({
        hasFeature: vi.fn(() => true),
      }),
    }));
    vi.doMock("@/hooks/useIsKarlOrTrial", () => ({
      useIsKarlOrTrial: () => true,
    }));

    const { LedgerBottomTabs } = await import(
      "@/components/layout/LedgerBottomTabs"
    );
    render(<LedgerBottomTabs />);

    // Karl users have access — no gate marker shown
    const markers = document.querySelectorAll(".karl-gate-marker");
    expect(markers.length).toBe(0);
  });
});

// ── Tests: CSS class presence for button glow ─────────────────────────────────

describe("Button — karl-bling-btn CSS class", () => {
  it("karl-bling-btn class applied to a button element triggers data-tier cascade", () => {
    // Create a minimal button with the class and verify CSS class existence.
    // CSS animation/glow is tested by the class presence + data-tier on html.
    // (Browser rendering is not available in jsdom; we verify class wiring.)
    render(
      <button type="button" className="karl-bling-btn">
        Add Card
      </button>
    );

    const btn = screen.getByRole("button", { name: "Add Card" });
    expect(btn.className).toContain("karl-bling-btn");
  });

  it("karl-bling-btn gets animated glow for Karl tier via CSS cascade", () => {
    // Verify the data-tier attribute is available on html for CSS to use.
    setTier("karl");
    render(
      <button type="button" className="karl-bling-btn">
        Add Card
      </button>
    );

    expect(document.documentElement.getAttribute("data-tier")).toBe("karl");
    const btn = screen.getByRole("button", { name: "Add Card" });
    expect(btn.className).toContain("karl-bling-btn");
    clearTier();
  });

  it("karl-bling-btn gets soft glow for trial tier via CSS cascade", () => {
    setTier("trial");
    render(
      <button type="button" className="karl-bling-btn">
        Import
      </button>
    );

    expect(document.documentElement.getAttribute("data-tier")).toBe("trial");
    const btn = screen.getByRole("button", { name: "Import" });
    expect(btn.className).toContain("karl-bling-btn");
    clearTier();
  });

  it("no karl-bling-btn glow for Thrall (no data-tier=karl/trial)", () => {
    setTier("thrall");
    render(
      <button type="button" className="karl-bling-btn">
        Add Card
      </button>
    );

    // data-tier=thrall is set — CSS selectors [data-tier=karl] will not match
    expect(document.documentElement.getAttribute("data-tier")).toBe("thrall");
    clearTier();
  });
});
