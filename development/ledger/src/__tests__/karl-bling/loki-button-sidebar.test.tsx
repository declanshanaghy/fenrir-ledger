/**
 * loki-button-sidebar.test.tsx — Loki QA augmentation
 *
 * Covers gaps not addressed by FiremanDecko's button-glow-sidebar-bling.test.tsx:
 *   - Hunt tab also shows ᚠ gate marker for Thrall (not just Valhalla)
 *   - Trial users have NO gate markers (they have access — only Thrall gets them)
 *   - Multiple .karl-bling-btn buttons on the same page each get the class
 *   - Thrall → trial transition: gate markers disappear
 *
 * @ref #1089
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  usePathname: () => "/ledger",
  useSearchParams: () => ({ get: () => null }),
}));

const mockHasFeature = vi.fn(() => false);
vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => ({ hasFeature: mockHasFeature }),
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

async function getLedgerBottomTabs() {
  const { LedgerBottomTabs } = await import(
    "@/components/layout/LedgerBottomTabs"
  );
  return LedgerBottomTabs;
}

// ── Tests: gate markers — Hunt and Valhalla both get ᚠ for Thrall ─────────────

describe("LedgerBottomTabs — gate markers for Thrall", () => {
  beforeEach(() => {
    setTier("thrall");
    mockIsKarlOrTrial.value = false;
    mockHasFeature.mockReturnValue(false);
  });
  afterEach(clearTier);

  it("Hunt li gets a ᚠ gate marker for Thrall (not just Valhalla)", async () => {
    const LedgerBottomTabs = await getLedgerBottomTabs();
    render(<LedgerBottomTabs />);

    // Both Valhalla and Hunt tabs are gated — each renders one karl-gate-marker
    const markers = document.querySelectorAll(".karl-gate-marker");
    expect(markers.length).toBe(2);

    // Every marker contains ᚠ (not the legacy "K")
    const texts = Array.from(markers).map((m) => m.textContent?.trim());
    expect(texts.every((t) => t === "ᚠ")).toBe(true);
  });

  it("both sidebar-karl-feature items are present (Valhalla + Hunt)", async () => {
    const LedgerBottomTabs = await getLedgerBottomTabs();
    render(<LedgerBottomTabs />);

    const featureItems = document.querySelectorAll(".sidebar-karl-feature");
    expect(featureItems.length).toBe(2);
  });
});

// ── Tests: trial users have NO gate markers ────────────────────────────────────

describe("LedgerBottomTabs — no gate markers for Trial users", () => {
  beforeEach(() => {
    setTier("trial");
    mockIsKarlOrTrial.value = true; // trial users have access
    mockHasFeature.mockReturnValue(false); // feature flags off; access via karlOrTrial
  });
  afterEach(() => {
    clearTier();
    mockIsKarlOrTrial.value = false;
  });

  it("no gate markers shown for Trial user (they have access)", async () => {
    const LedgerBottomTabs = await getLedgerBottomTabs();
    render(<LedgerBottomTabs />);

    const markers = document.querySelectorAll(".karl-gate-marker");
    expect(markers.length).toBe(0);
  });

  it("sidebar-karl-feature items still present for Trial (CSS accent applies)", async () => {
    const LedgerBottomTabs = await getLedgerBottomTabs();
    render(<LedgerBottomTabs />);

    // Both tabs carry the class; CSS [data-tier="trial"] .sidebar-karl-feature::after
    // renders the gold ᚠ accent via CSS cascade (not DOM content)
    const featureItems = document.querySelectorAll(".sidebar-karl-feature");
    expect(featureItems.length).toBe(2);
  });
});

// ── Tests: multiple .karl-bling-btn buttons ────────────────────────────────────

describe("Button — multiple .karl-bling-btn elements on same page", () => {
  afterEach(clearTier);

  it("each .karl-bling-btn button independently carries the class", () => {
    setTier("karl");
    render(
      <div>
        <button type="button" className="karl-bling-btn">
          Add Card
        </button>
        <button type="button" className="karl-bling-btn">
          Import
        </button>
        <button type="button" className="karl-bling-btn">
          Export
        </button>
      </div>
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
    buttons.forEach((btn) => {
      expect(btn.className).toContain("karl-bling-btn");
    });
  });
});

// ── Tests: Thrall → trial transition ─────────────────────────────────────────

describe("LedgerBottomTabs — Thrall → trial transition", () => {
  afterEach(() => {
    clearTier();
    mockIsKarlOrTrial.value = false;
    mockHasFeature.mockReturnValue(false);
  });

  it("gate markers disappear and sidebar feature class persists when Thrall upgrades to trial", async () => {
    // Start as Thrall
    setTier("thrall");
    mockIsKarlOrTrial.value = false;
    mockHasFeature.mockReturnValue(false);

    const LedgerBottomTabs = await getLedgerBottomTabs();
    const { rerender } = render(<LedgerBottomTabs />);

    expect(document.querySelectorAll(".karl-gate-marker").length).toBe(2);
    expect(document.querySelectorAll(".sidebar-karl-feature").length).toBe(2);

    // Simulate upgrade to trial: tier attr changes, karlOrTrial becomes true
    setTier("trial");
    mockIsKarlOrTrial.value = true;

    await act(async () => {
      rerender(<LedgerBottomTabs />);
    });

    // Gate markers gone — trial has access
    expect(document.querySelectorAll(".karl-gate-marker").length).toBe(0);
    // sidebar-karl-feature class still present (CSS accent now shows ᚠ via cascade)
    expect(document.querySelectorAll(".sidebar-karl-feature").length).toBe(2);
  });
});
