/**
 * Marketing Nav & Footer — Free Trial link integration tests
 *
 * Validates that "Free Trial" link was added between Features and Pricing
 * in both the MarketingNavbar and MarketingFooter.
 *
 * Issue: #636
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  ),
}));

// Mock ThemeToggle (used in MarketingNavbar)
vi.mock("@/components/layout/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

import { MarketingNavbar } from "@/components/marketing/MarketingNavbar";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

// ── MarketingNavbar Tests ─────────────────────────────────────────────────────

describe("MarketingNavbar — Free Trial link", () => {
  beforeEach(() => {
    render(<MarketingNavbar />);
  });

  it("contains a 'Free Trial' link in navigation", () => {
    const nav = screen.getByLabelText("Marketing site navigation");
    const freeTrialLink = within(nav).getByText("Free Trial");
    expect(freeTrialLink).toBeDefined();
    expect(freeTrialLink.closest("a")?.getAttribute("href")).toBe("/free-trial");
  });

  it("Free Trial link appears between Features and Pricing in the nav order", () => {
    const nav = screen.getByLabelText("Marketing site navigation");
    const links = within(nav).getAllByRole("link");
    const labels = links.map((l) => l.textContent?.trim());

    const featuresIdx = labels.indexOf("Features");
    const freeTrialIdx = labels.indexOf("Free Trial");
    const pricingIdx = labels.indexOf("Pricing");

    // All three must exist
    expect(featuresIdx).toBeGreaterThanOrEqual(0);
    expect(freeTrialIdx).toBeGreaterThanOrEqual(0);
    expect(pricingIdx).toBeGreaterThanOrEqual(0);

    // Free Trial between Features and Pricing
    expect(freeTrialIdx).toBeGreaterThan(featuresIdx);
    expect(freeTrialIdx).toBeLessThan(pricingIdx);
  });
});

// ── MarketingFooter Tests ─────────────────────────────────────────────────────

describe("MarketingFooter — Free Trial link", () => {
  beforeEach(() => {
    render(<MarketingFooter />);
  });

  it("contains a 'Free Trial' link in the footer Product column", () => {
    const footer = screen.getByRole("contentinfo");
    const freeTrialLink = within(footer).getByText("Free Trial");
    expect(freeTrialLink).toBeDefined();
    expect(freeTrialLink.closest("a")?.getAttribute("href")).toBe("/free-trial");
  });

  it("Free Trial link appears between Features and Pricing in footer", () => {
    const footer = screen.getByRole("contentinfo");
    const links = within(footer).getAllByRole("link");
    const labels = links.map((l) => l.textContent?.trim());

    const featuresIdx = labels.indexOf("Features");
    const freeTrialIdx = labels.indexOf("Free Trial");
    const pricingIdx = labels.indexOf("Pricing");

    expect(featuresIdx).toBeGreaterThanOrEqual(0);
    expect(freeTrialIdx).toBeGreaterThanOrEqual(0);
    expect(pricingIdx).toBeGreaterThanOrEqual(0);

    expect(freeTrialIdx).toBeGreaterThan(featuresIdx);
    expect(freeTrialIdx).toBeLessThan(pricingIdx);
  });
});
