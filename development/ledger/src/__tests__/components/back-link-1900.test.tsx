/**
 * Loki QA — Issue #1900
 *
 * Validates that the "← Back to Fenrir Ledger" link has been removed from
 * the /privacy and /terms marketing pages.
 *
 * AC:
 *   1. No "Back to Fenrir Ledger" link on /privacy
 *   2. No "Back to Fenrir Ledger" link on /terms
 *   3. Both pages still render without errors
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PrivacyPage from "@/app/(marketing)/privacy/page";
import TermsPage from "@/app/(marketing)/terms/page";

// ── Privacy page ──────────────────────────────────────────────────────────────

describe("PrivacyPage — back link removed (Issue #1900)", () => {
  it("renders without throwing", () => {
    expect(() => render(<PrivacyPage />)).not.toThrow();
  });

  it("does not render a 'Back to Fenrir Ledger' link", () => {
    render(<PrivacyPage />);
    const backLinks = screen
      .queryAllByRole("link")
      .filter((el) => el.textContent?.includes("Back to Fenrir Ledger"));
    expect(backLinks).toHaveLength(0);
  });

  it("renders the Privacy Policy heading", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
  });
});

// ── Terms page ────────────────────────────────────────────────────────────────

describe("TermsPage — back link removed (Issue #1900)", () => {
  it("renders without throwing", () => {
    expect(() => render(<TermsPage />)).not.toThrow();
  });

  it("does not render a 'Back to Fenrir Ledger' link", () => {
    render(<TermsPage />);
    const backLinks = screen
      .queryAllByRole("link")
      .filter((el) => el.textContent?.includes("Back to Fenrir Ledger"));
    expect(backLinks).toHaveLength(0);
  });

  it("renders the Terms of Service heading", () => {
    render(<TermsPage />);
    expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
  });
});
