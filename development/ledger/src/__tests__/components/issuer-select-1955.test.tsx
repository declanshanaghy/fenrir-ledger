/**
 * IssuerSelect — Issue #1955
 *
 * Tests for the shared IssuerSelect dropdown component.
 * Verifies: real issuer names shown (not rune names), fixed-width rune
 * containers, logo imgs present for known issuers, and correct props.
 *
 * @ref #1955
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Mock Radix Select to render inline (no portal) ────────────────────────────

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "select-root" }, children),
  SelectTrigger: ({
    children,
    id,
    "aria-required": ariaRequired,
    className,
  }: {
    children: React.ReactNode;
    id?: string;
    "aria-required"?: string;
    className?: string;
  }) =>
    React.createElement(
      "button",
      { "data-testid": "select-trigger", id, "aria-required": ariaRequired, className },
      children
    ),
  SelectValue: ({ placeholder }: { placeholder?: string }) =>
    React.createElement("span", { "data-testid": "select-value" }, placeholder),
  SelectContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "select-content" }, children),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) =>
    React.createElement(
      "div",
      { "data-testid": `select-item-${value}`, role: "option" },
      children
    ),
}));

import { IssuerSelect } from "@/components/cards/IssuerSelect";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("IssuerSelect — issue #1955", () => {
  const noop = vi.fn();

  describe("rendering", () => {
    it("renders a Select with trigger and content", () => {
      render(<IssuerSelect value="" onChange={noop} />);
      expect(screen.getByTestId("select-root")).toBeDefined();
      expect(screen.getByTestId("select-trigger")).toBeDefined();
      expect(screen.getByTestId("select-content")).toBeDefined();
    });

    it("trigger has id=issuerId for label association", () => {
      render(<IssuerSelect value="" onChange={noop} />);
      const trigger = screen.getByTestId("select-trigger");
      expect(trigger.getAttribute("id")).toBe("issuerId");
    });

    it("trigger has min-h-[44px] class for touch targets", () => {
      render(<IssuerSelect value="" onChange={noop} />);
      const trigger = screen.getByTestId("select-trigger");
      expect(trigger.className).toContain("min-h-[44px]");
    });

    it("shows placeholder text", () => {
      render(<IssuerSelect value="" onChange={noop} />);
      expect(screen.getByTestId("select-value").textContent).toBe("Select issuer");
    });
  });

  describe("aria-required prop", () => {
    it("sets aria-required=true when required=true", () => {
      render(<IssuerSelect value="" onChange={noop} required />);
      const trigger = screen.getByTestId("select-trigger");
      expect(trigger.getAttribute("aria-required")).toBe("true");
    });

    it("omits aria-required when required is not set", () => {
      render(<IssuerSelect value="" onChange={noop} />);
      const trigger = screen.getByTestId("select-trigger");
      expect(trigger.getAttribute("aria-required")).toBeNull();
    });
  });

  describe("dropdown items show real issuer names", () => {
    it("renders a SelectItem for Chase with real name 'Chase'", () => {
      render(<IssuerSelect value="" onChange={noop} />);
      const chaseItem = screen.getByTestId("select-item-chase");
      expect(chaseItem.textContent).toContain("Chase");
    });

    it("does NOT show rune name 'Raidho' as text for Chase", () => {
      render(<IssuerSelect value="" onChange={noop} />);
      const chaseItem = screen.getByTestId("select-item-chase");
      // The rune char ᚱ may appear, but the Norse rune name "Raidho" should NOT
      expect(chaseItem.textContent).not.toContain("Raidho");
    });

    it("renders a SelectItem for American Express with real name", () => {
      render(<IssuerSelect value="" onChange={noop} />);
      const amexItem = screen.getByTestId("select-item-amex");
      expect(amexItem.textContent).toContain("American Express");
      expect(amexItem.textContent).not.toContain("Sowilo");
    });

    it("renders items for all KNOWN_ISSUERS", () => {
      render(<IssuerSelect value="" onChange={noop} />);
      const knownIds = [
        "amex", "bank_of_america", "barclays", "capital_one",
        "chase", "citibank", "discover", "hsbc", "us_bank",
        "wells_fargo", "other",
      ];
      for (const id of knownIds) {
        expect(screen.getByTestId(`select-item-${id}`), `item for ${id}`).toBeDefined();
      }
    });
  });

  describe("fixed-width rune containers", () => {
    it("rune for Chase is inside a w-6 fixed-width span", () => {
      const { container } = render(<IssuerSelect value="" onChange={noop} />);
      const chaseItem = screen.getByTestId("select-item-chase");
      // Find the span with w-6 class inside the chase item
      const runeSpans = chaseItem.querySelectorAll("span.inline-flex.w-6.justify-center");
      expect(runeSpans.length).toBeGreaterThanOrEqual(1);
    });

    it("rune span is aria-hidden", () => {
      render(<IssuerSelect value="" onChange={noop} />);
      const chaseItem = screen.getByTestId("select-item-chase");
      const runeSpans = chaseItem.querySelectorAll("span[aria-hidden='true']");
      expect(runeSpans.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("logo images", () => {
    it("renders a logo img for Chase", () => {
      const { container } = render(<IssuerSelect value="" onChange={noop} />);
      const chaseItem = screen.getByTestId("select-item-chase");
      const img = chaseItem.querySelector("img");
      expect(img).not.toBeNull();
      expect(img?.src).toContain("/issuers/chase.svg");
    });

    it("logo img has aria-hidden=true (decorative)", () => {
      render(<IssuerSelect value="" onChange={noop} />);
      const chaseItem = screen.getByTestId("select-item-chase");
      const img = chaseItem.querySelector("img");
      expect(img?.getAttribute("aria-hidden")).toBe("true");
    });
  });
});
