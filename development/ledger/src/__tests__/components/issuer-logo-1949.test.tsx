/**
 * IssuerLogo showLabel — Issue #1949
 *
 * Verifies that IssuerLogo renders the rune character and rune name
 * when showLabel=true, and only the logo (or text fallback) when false.
 *
 * @ref #1949
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IssuerLogo } from "@/components/shared/IssuerLogo";

describe("IssuerLogo — showLabel", () => {
  describe("known issuer (chase)", () => {
    it("renders logo img without rune label by default", () => {
      const { container } = render(<IssuerLogo issuerId="chase" />);
      const img = container.querySelector("img");
      expect(img).not.toBeNull();
      expect(img?.src).toContain("/issuers/chase.svg");
      expect(screen.queryByTestId("issuer-rune")).toBeNull();
      expect(screen.queryByTestId("issuer-rune-name")).toBeNull();
    });

    it("renders logo + rune char + rune name when showLabel=true", () => {
      render(<IssuerLogo issuerId="chase" showLabel />);
      const runeEl = screen.getByTestId("issuer-rune");
      const runeNameEl = screen.getByTestId("issuer-rune-name");
      expect(runeEl.textContent).toBe("ᚱ");
      expect(runeNameEl.textContent).toBe("Raidho");
    });

    it("rune char span is aria-hidden", () => {
      render(<IssuerLogo issuerId="chase" showLabel />);
      const runeEl = screen.getByTestId("issuer-rune");
      expect(runeEl.getAttribute("aria-hidden")).toBe("true");
    });

    it("img has alt text = issuer name", () => {
      const { container } = render(<IssuerLogo issuerId="chase" showLabel />);
      const img = container.querySelector("img");
      expect(img?.alt).toBe("Chase");
    });

    it("wrapper uses inline-flex display style", () => {
      const { getByTestId } = render(<IssuerLogo issuerId="chase" showLabel />);
      const wrapper = getByTestId("issuer-logo");
      expect(wrapper.style.display).toBe("inline-flex");
    });
  });

  describe("known issuer (amex)", () => {
    it("shows Sowilo rune and runeName when showLabel=true", () => {
      render(<IssuerLogo issuerId="amex" showLabel />);
      expect(screen.getByTestId("issuer-rune").textContent).toBe("ᛊ");
      expect(screen.getByTestId("issuer-rune-name").textContent).toBe("Sowilo");
    });
  });

  describe("unknown issuer", () => {
    it("falls back to text name without rune elements", () => {
      render(<IssuerLogo issuerId="other" showLabel />);
      // No img, no rune, shows issuer name text
      expect(screen.queryByTestId("issuer-rune")).toBeNull();
      expect(screen.queryByTestId("issuer-rune-name")).toBeNull();
      expect(screen.getByTestId("issuer-logo").textContent).toContain("Other");
    });

    it("showLabel=false also falls back to text name for unknown issuer", () => {
      render(<IssuerLogo issuerId="other" />);
      expect(screen.queryByTestId("issuer-rune")).toBeNull();
      expect(screen.getByTestId("issuer-logo").textContent).toContain("Other");
    });
  });

  describe("custom unknown issuer ID", () => {
    it("shows raw ID as text fallback", () => {
      render(<IssuerLogo issuerId="my_custom_bank" showLabel />);
      expect(screen.getByTestId("issuer-logo").textContent).toContain("my_custom_bank");
    });
  });
});
