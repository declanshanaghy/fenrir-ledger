/**
 * Footer — Component render tests
 *
 * Validates landmarks, aria-labels, and structural elements
 * that were previously tested via E2E Playwright (layout/footer.spec.ts).
 * These assertions run in ~50ms vs 6+ seconds in a real browser.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "@/components/layout/Footer";

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock GleipnirFishBreath (easter egg — not relevant to structural tests)
vi.mock("@/components/cards/GleipnirFishBreath", () => ({
  GleipnirFishBreath: () => null,
  useGleipnirFragment5: () => ({
    open: false,
    trigger: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

// Mock AboutModal
vi.mock("@/components/layout/AboutModal", () => ({
  AboutModal: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">About Fenrir Ledger</div> : null,
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Footer — Landmarks & ARIA", () => {
  beforeEach(() => {
    render(<Footer />);
  });

  it("renders a <footer> element with role='contentinfo'", () => {
    const footer = screen.getByRole("contentinfo");
    expect(footer).toBeDefined();
    expect(footer.tagName.toLowerCase()).toBe("footer");
  });

  it("has aria-label 'App footer' on the footer landmark", () => {
    const footer = screen.getByRole("contentinfo");
    expect(footer.getAttribute("aria-label")).toBe("App footer");
  });

  it("renders the 'About Fenrir Ledger' button", () => {
    const aboutButton = screen.getByRole("button", {
      name: "About Fenrir Ledger",
    });
    expect(aboutButton).toBeDefined();
  });

  it("renders the brand text 'FENRIR LEDGER'", () => {
    const aboutButton = screen.getByRole("button", {
      name: "About Fenrir Ledger",
    });
    expect(aboutButton.textContent).toContain("FENRIR LEDGER");
  });

  it("renders the tagline text", () => {
    const footer = screen.getByRole("contentinfo");
    expect(footer.textContent).toContain(
      "Break free. Harvest every reward. Let no chain hold."
    );
  });

  it("renders the copyright text", () => {
    const footer = screen.getByRole("contentinfo");
    expect(footer.textContent).toContain("2026 Fenrir Ledger");
  });

  it("renders the Loki button with aria-label", () => {
    const lokiButton = screen.getByRole("button", { name: "Loki" });
    expect(lokiButton).toBeDefined();
    expect(lokiButton.getAttribute("tabindex")).toBe("0");
  });

  it("renders the copyright symbol with aria-label", () => {
    const copyright = screen.getByLabelText("Copyright");
    expect(copyright).toBeDefined();
    expect(copyright.textContent).toContain("\u00A9");
  });

  it("renders the team colophon text", () => {
    const footer = screen.getByRole("contentinfo");
    expect(footer.textContent).toContain("Forged by FiremanDecko");
    expect(footer.textContent).toContain("Guarded by Freya");
    expect(footer.textContent).toContain("Tested by");
  });
});
