/**
 * Footer.test.tsx
 *
 * Vitest suite for Footer component — Issue #813 QA validation.
 * Tests ARIA structure, easter egg triggers, and Loki Mode event dispatch.
 *
 * Written by Loki, QA Tester. Devil's advocate mindset.
 * FiremanDecko already tested LedgerShell renders a Footer — here we test
 * the Footer internals that matter for correctness and easter egg integrity.
 *
 * Uses @testing-library/jest-dom for DOM assertions (issue #1371).
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Footer } from "@/components/layout/Footer";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/components/cards/GleipnirFishBreath", () => ({
  GleipnirFishBreath: ({ open }: { open: boolean; onClose: () => void }) => (
    <div data-testid="gleipnir-fish-breath" data-open={String(open)}>
      GleipnirFishBreath
    </div>
  ),
  useGleipnirFragment5: () => ({
    open: false,
    trigger: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock("@/components/layout/AboutModal", () => ({
  AboutModal: ({ open }: { open: boolean; onOpenChange: () => void }) => (
    <div data-testid="about-modal" data-open={String(open)}>
      About Modal
    </div>
  ),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderFooter() {
  return render(<Footer />);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Footer — ARIA structure", () => {
  it("renders a <footer> with role=contentinfo", () => {
    renderFooter();
    // getByRole throws if not found — implicit assertion
    const footer = screen.getByRole("contentinfo");
    expect(footer.tagName.toLowerCase()).toBe("footer");
  });

  it("has aria-label='App footer' on the footer element", () => {
    renderFooter();
    const footer = screen.getByRole("contentinfo");
    expect(footer.getAttribute("aria-label")).toBe("App footer");
  });

  it("renders the Fenrir Ledger wordmark button", () => {
    renderFooter();
    const btn = screen.getByRole("button", { name: /About Fenrir Ledger/i });
    expect(btn).toBeTruthy();
  });
});

describe("Footer — Easter Egg #3: Loki Mode", () => {
  it("has a Loki trigger element with data-loki-trigger", () => {
    renderFooter();
    const trigger = document.querySelector("[data-loki-trigger]");
    expect(trigger).toBeInTheDocument();
  });

  it("Loki trigger has accessible aria-label='Loki'", () => {
    renderFooter();
    // getByRole throws if not found
    const trigger = screen.getByRole("button", { name: "Loki" });
    expect(trigger).toBeTruthy();
  });

  it("dispatches fenrir:loki-mode {active:true} after exactly 7 clicks on Loki", () => {
    renderFooter();
    const lokiBtn = screen.getByRole("button", { name: "Loki" });

    const events: CustomEvent[] = [];
    const handler = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener("fenrir:loki-mode", handler);

    // 6 clicks — should NOT yet fire
    for (let i = 0; i < 6; i++) fireEvent.click(lokiBtn);
    expect(events).toHaveLength(0);

    // 7th click — MUST fire
    fireEvent.click(lokiBtn);
    expect(events).toHaveLength(1);
    expect(events[0].detail).toEqual({ active: true });

    window.removeEventListener("fenrir:loki-mode", handler);
  });

  it("resets click counter after Loki Mode activates (requires another 7 clicks)", () => {
    renderFooter();
    const lokiBtn = screen.getByRole("button", { name: "Loki" });

    const events: CustomEvent[] = [];
    const handler = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener("fenrir:loki-mode", handler);

    // First 7 clicks — activates
    for (let i = 0; i < 7; i++) fireEvent.click(lokiBtn);
    expect(events).toHaveLength(1);

    // Only 6 more — should NOT fire again
    for (let i = 0; i < 6; i++) fireEvent.click(lokiBtn);
    expect(events).toHaveLength(1);

    // 7th additional click — fires again
    fireEvent.click(lokiBtn);
    expect(events).toHaveLength(2);
    expect(events[1].detail).toEqual({ active: true });

    window.removeEventListener("fenrir:loki-mode", handler);
  });

  it("Loki Mode shows a toast with 'Loki was here'", () => {
    renderFooter();
    const lokiBtn = screen.getByRole("button", { name: "Loki" });

    for (let i = 0; i < 7; i++) fireEvent.click(lokiBtn);

    const toast = screen.getByRole("status");
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveTextContent("Loki was here");
  });
});

describe("Footer — Easter Egg #5: Gleipnir Fragment (Breath of a Fish)", () => {
  it("has the © element with data-gleipnir='breath-of-a-fish'", () => {
    renderFooter();
    const copyrightEl = document.querySelector('[data-gleipnir="breath-of-a-fish"]');
    expect(copyrightEl).toBeInTheDocument();
  });

  it("© element has aria-label='Copyright'", () => {
    renderFooter();
    const copyrightEl = document.querySelector('[data-gleipnir="breath-of-a-fish"]');
    expect(copyrightEl?.getAttribute("aria-label")).toBe("Copyright");
  });
});

describe("Footer — copyright line", () => {
  it("shows current year 2026 in the copyright text", () => {
    renderFooter();
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent("2026 Fenrir Ledger");
  });

  it("mentions FiremanDecko, Freya, and Loki in the colophon", () => {
    renderFooter();
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent("FiremanDecko");
    expect(footer).toHaveTextContent("Freya");
    expect(footer).toHaveTextContent("Loki");
  });
});

describe("Footer — mobile overflow fix — issue #2047", () => {
  it("left span does not apply whitespace-nowrap unconditionally (only sm:)", () => {
    renderFooter();
    const footer = screen.getByRole("contentinfo");
    // Find the left span (wordmark + tagline)
    const leftSpan = footer.querySelector(
      'span[class*="text-muted-foreground"]'
    );
    expect(leftSpan).toBeInTheDocument();
    // Must NOT have bare 'whitespace-nowrap' — only sm: prefixed variant is allowed
    const cls = leftSpan?.className ?? "";
    expect(cls).not.toMatch(/(?<![:\w])whitespace-nowrap/);
  });

  it("right span does not apply whitespace-nowrap unconditionally (only sm:)", () => {
    renderFooter();
    const footer = screen.getByRole("contentinfo");
    const allSpans = footer.querySelectorAll(
      'span[class*="text-muted-foreground"]'
    );
    // Second span is the colophon
    const rightSpan = allSpans[1];
    expect(rightSpan).toBeInTheDocument();
    const cls = rightSpan?.className ?? "";
    expect(cls).not.toMatch(/(?<![:\w])whitespace-nowrap/);
  });

  it("both footer text spans allow wrapping on mobile via sm: prefix", () => {
    renderFooter();
    const footer = screen.getByRole("contentinfo");
    const allSpans = footer.querySelectorAll(
      'span[class*="text-muted-foreground"]'
    );
    expect(allSpans.length).toBeGreaterThanOrEqual(2);
    [allSpans[0], allSpans[1]].forEach((span) => {
      const cls = span.className;
      // sm:whitespace-nowrap is acceptable (only applies at >= 640px)
      if (cls.includes("whitespace-nowrap")) {
        expect(cls).toContain("sm:whitespace-nowrap");
      }
    });
  });
});

describe("Footer — LokiToast overflow safety — issue #2047", () => {
  it("LokiToast uses position:fixed so it is removed from document flow and cannot expand the scroll area", () => {
    renderFooter();
    const lokiBtn = screen.getByRole("button", { name: "Loki" });
    for (let i = 0; i < 7; i++) fireEvent.click(lokiBtn);

    const toast = screen.getByRole("status");
    // position:fixed takes the element out of the normal document flow,
    // ensuring it cannot contribute to the document's scrollable width.
    expect(toast).toHaveStyle({ position: "fixed" });
  });

  it("LokiToast is centered (left:50%) so it cannot push the right edge of the viewport", () => {
    renderFooter();
    const lokiBtn = screen.getByRole("button", { name: "Loki" });
    for (let i = 0; i < 7; i++) fireEvent.click(lokiBtn);

    const toast = screen.getByRole("status");
    // Centered via left:50% + translateX(-50%) — cannot overflow the right viewport edge.
    expect(toast).toHaveStyle({ left: "50%" });
  });
});
