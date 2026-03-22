/**
 * SiteHeader — Component render tests
 *
 * Validates the marketing site header renders correct landmarks,
 * logo link, back link, and action slots.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteHeader } from "@/components/layout/SiteHeader";

// Mock next/link — renders as a plain <a> tag
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("SiteHeader — Landmarks & Structure", () => {
  it("renders a <header> element", () => {
    render(<SiteHeader />);
    const header = screen.getByRole("banner");
    expect(header).toBeDefined();
    expect(header.tagName.toLowerCase()).toBe("header");
  });

  it("renders the Fenrir Ledger logo link pointing to '/'", () => {
    render(<SiteHeader />);
    const logoLink = screen.getByRole("link");
    expect(logoLink.getAttribute("href")).toBe("/");
  });

  it("renders the brand text 'Fenrir Ledger'", () => {
    render(<SiteHeader />);
    const header = screen.getByRole("banner");
    expect(header.textContent).toContain("Fenrir Ledger");
  });

  it("renders the tagline text", () => {
    render(<SiteHeader />);
    const header = screen.getByRole("banner");
    expect(header.textContent).toContain("Break free. Harvest every reward.");
  });

  it("renders a back link when backHref is provided", () => {
    render(<SiteHeader backHref="/features" />);
    const links = screen.getAllByRole("link");
    const backLink = links.find((l) => l.textContent?.includes("Back"));
    expect(backLink).toBeDefined();
    expect(backLink!.getAttribute("href")).toBe("/features");
  });

  it("does not render a back link when backHref is not provided", () => {
    render(<SiteHeader />);
    const links = screen.getAllByRole("link");
    const backLink = links.find((l) => l.textContent?.includes("Back"));
    expect(backLink).toBeUndefined();
  });

  it("renders children in the action slot", () => {
    render(
      <SiteHeader>
        <button type="button">Action</button>
      </SiteHeader>
    );
    const actionButton = screen.getByRole("button", { name: "Action" });
    expect(actionButton).toBeDefined();
  });
});
