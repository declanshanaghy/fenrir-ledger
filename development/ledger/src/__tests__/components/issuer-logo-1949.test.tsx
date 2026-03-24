/**
 * IssuerLogo showLabel — Issue #1949 (updated #1965)
 *
 * Verifies that IssuerLogo renders the real issuer name when showLabel=true,
 * and only the logo (or text fallback) when false.
 *
 * @ref #1949 #1965
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IssuerLogo } from "@/components/shared/IssuerLogo";

describe("IssuerLogo — showLabel", () => {
  describe("known issuer (chase)", () => {
    it("renders logo img without label by default", () => {
      const { container } = render(<IssuerLogo issuerId="chase" />);
      const img = container.querySelector("img");
      expect(img).not.toBeNull();
      expect(img?.src).toContain("/issuers/chase.svg");
      expect(screen.queryByTestId("issuer-name")).toBeNull();
    });

    it("renders logo + real issuer name when showLabel=true", () => {
      render(<IssuerLogo issuerId="chase" showLabel />);
      const nameEl = screen.getByTestId("issuer-name");
      expect(nameEl.textContent).toBe("Chase");
    });

    it("does not render rune name when showLabel=true", () => {
      render(<IssuerLogo issuerId="chase" showLabel />);
      expect(screen.queryByTestId("issuer-rune")).toBeNull();
      expect(screen.queryByTestId("issuer-rune-name")).toBeNull();
      // Verify rune words are absent
      const logo = screen.getByTestId("issuer-logo");
      expect(logo.textContent).not.toContain("Raidho");
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
    it("shows real name American Express when showLabel=true", () => {
      render(<IssuerLogo issuerId="amex" showLabel />);
      expect(screen.getByTestId("issuer-name").textContent).toBe("American Express");
    });

    it("does not show rune name Sowilo", () => {
      render(<IssuerLogo issuerId="amex" showLabel />);
      expect(screen.getByTestId("issuer-logo").textContent).not.toContain("Sowilo");
    });
  });

  describe("unknown issuer", () => {
    it("falls back to text name without logo or name element", () => {
      render(<IssuerLogo issuerId="other" showLabel />);
      // No img, no issuer-name testid, shows issuer name text directly
      expect(screen.queryByTestId("issuer-name")).toBeNull();
      expect(screen.getByTestId("issuer-logo").textContent).toContain("Other");
    });

    it("showLabel=false also falls back to text name for unknown issuer", () => {
      render(<IssuerLogo issuerId="other" />);
      expect(screen.queryByTestId("issuer-name")).toBeNull();
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
