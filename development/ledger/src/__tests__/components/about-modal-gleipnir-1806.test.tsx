/**
 * AboutModal — Gleipnir section tests
 *
 * Tests found/unfound visual states, profile icons, fragment progress counter,
 * completion message, and quote truncation attributes.
 *
 * Issue: #1806
 * Author: FiremanDecko, Principal Engineer
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AboutModal } from "@/components/layout/AboutModal";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/components/shared/WolfHungerMeter", () => ({
  WolfHungerMeter: () => <div data-testid="wolf-hunger-meter" />,
}));

vi.mock("@/components/cards/GleipnirWomansBeard", () => ({
  GleipnirWomansBeard: ({ open }: { open: boolean; onClose: () => void }) => (
    <div data-testid="gleipnir-womans-beard" data-open={String(open)} />
  ),
  useGleipnirFragment2: () => ({
    open: false,
    trigger: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function setFragment(n: number) {
  localStorage.setItem(`egg:gleipnir-${n}`, "1");
}

function clearAllFragments() {
  for (let i = 1; i <= 6; i++) {
    localStorage.removeItem(`egg:gleipnir-${i}`);
  }
}

function renderModal() {
  return render(<AboutModal open={true} onOpenChange={vi.fn()} />);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("AboutModal — Gleipnir fragment visual states (#1806)", () => {
  beforeEach(() => {
    clearAllFragments();
  });

  afterEach(() => {
    clearAllFragments();
    vi.restoreAllMocks();
  });

  it("renders the Gleipnir list", () => {
    renderModal();
    expect(document.querySelector("[data-testid='gleipnir-list']")).toBeInTheDocument();
  });

  it("shows lock rune ᛜ for all unfound fragments", () => {
    renderModal();
    for (let i = 1; i <= 6; i++) {
      const status = document.querySelector(`[data-testid='gleipnir-status-${i}']`);
      expect(status?.textContent).toBe("ᛜ");
    }
  });

  it("shows checkmark ✓ for a found fragment", () => {
    setFragment(3);
    renderModal();
    const status = document.querySelector("[data-testid='gleipnir-status-3']");
    expect(status?.textContent).toBe("✓");
  });

  it("shows lock rune for unfound fragments when others are found", () => {
    setFragment(1);
    renderModal();
    // Fragment 2 should still show lock
    const status2 = document.querySelector("[data-testid='gleipnir-status-2']");
    expect(status2?.textContent).toBe("ᛜ");
  });

  it("aria-label says 'fragment N found' for found fragment", () => {
    setFragment(5);
    renderModal();
    const status = document.querySelector("[data-testid='gleipnir-status-5']");
    expect(status?.getAttribute("aria-label")).toBe("fragment 5 found");
  });

  it("aria-label says 'fragment N not yet found' for unfound fragment", () => {
    renderModal();
    const status = document.querySelector("[data-testid='gleipnir-status-1']");
    expect(status?.getAttribute("aria-label")).toBe("fragment 1 not yet found");
  });

  it("shows '0 of 6 fragments found' when none found", () => {
    renderModal();
    const progress = document.querySelector("[data-testid='gleipnir-progress']");
    expect(progress?.textContent).toContain("0 of 6 fragments found");
  });

  it("shows '3 of 6 fragments found' when 3 are found", () => {
    setFragment(1);
    setFragment(3);
    setFragment(5);
    renderModal();
    const progress = document.querySelector("[data-testid='gleipnir-progress']");
    expect(progress?.textContent).toContain("3 of 6 fragments found");
  });

  it("does NOT show completion message when fewer than 6 found", () => {
    setFragment(1);
    renderModal();
    expect(document.querySelector("[data-testid='gleipnir-complete']")).not.toBeInTheDocument();
  });

  it("shows '6 of 6 fragments found' and completion message when all found", () => {
    for (let i = 1; i <= 6; i++) setFragment(i);
    renderModal();
    const progress = document.querySelector("[data-testid='gleipnir-progress']");
    expect(progress?.textContent).toContain("6 of 6 fragments found");
    const complete = document.querySelector("[data-testid='gleipnir-complete']");
    expect(complete).toBeInTheDocument();
    expect(complete?.textContent).toContain("Gleipnir is complete");
  });

  it("Fragment II is a button with correct aria-label", () => {
    renderModal();
    const beardBtn = screen.getByRole("button", {
      name: /the beard of a woman — easter egg trigger/i,
    });
    expect(beardBtn).toBeInTheDocument();
  });
});

describe("AboutModal — Pack profile icons (#1806)", () => {
  it("renders a rune icon for each Pack member", () => {
    renderModal();
    const members = ["freya", "luna", "firemandecko", "loki"];
    for (const name of members) {
      const icon = document.querySelector(`[data-testid='pack-icon-${name}']`);
      expect(icon).toBeInTheDocument();
    }
  });

  it("Freya icon contains ᚠ rune", () => {
    renderModal();
    const icon = document.querySelector("[data-testid='pack-icon-freya']");
    expect(icon?.textContent).toBe("ᚠ");
  });

  it("Luna icon contains ᛚ rune", () => {
    renderModal();
    const icon = document.querySelector("[data-testid='pack-icon-luna']");
    expect(icon?.textContent).toBe("ᛚ");
  });

  it("FiremanDecko icon contains ᚦ rune", () => {
    renderModal();
    const icon = document.querySelector("[data-testid='pack-icon-firemandecko']");
    expect(icon?.textContent).toBe("ᚦ");
  });

  it("Loki icon contains ᛏ rune", () => {
    renderModal();
    const icon = document.querySelector("[data-testid='pack-icon-loki']");
    expect(icon?.textContent).toBe("ᛏ");
  });

  it("FiremanDecko quote uses shortened version without 'willingly'", () => {
    renderModal();
    const packList = document.querySelector("[data-testid='pack-list']");
    expect(packList?.textContent).not.toContain("willingly");
    expect(packList?.textContent).toContain("He forged the chain");
  });
});
