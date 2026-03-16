/**
 * Features Page — Section Order (Loki QA, Issue #1091)
 *
 * Validates that "Safe By Design" (SmartImportSafetyCallout) renders
 * above "The Lone Wolf" (ThrallSectionHeading) on the /features page.
 *
 * Acceptance criteria:
 *  1. Safe By Design section renders before The Lone Wolf section in DOM order
 *  2. Both sections are present with expected content
 *  3. No content regression — section text unchanged
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// ── Mocks ─────────────────────────────────────────────────────────────────────

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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/features",
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}));

// Stub ThemedFeatureImage — just renders a labelled div (no image loading)
vi.mock("@/components/shared/ThemedFeatureImage", () => ({
  ThemedFeatureImage: ({ alt }: { alt?: string }) => (
    <div data-testid="themed-feature-image" aria-label={alt} />
  ),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("FeaturesPage — section order (Issue #1091)", () => {
  it("Safe By Design section exists with expected heading text", async () => {
    const { default: FeaturesPage } = await import(
      "@/app/(marketing)/features/page"
    );
    render(<FeaturesPage />);

    // DataSafetyBanner renders the headingOverride as a heading element
    const safeByDesignHeading = screen.getByText(
      /Safe By Design/i
    );
    expect(safeByDesignHeading).toBeTruthy();
  });

  it("The Lone Wolf section exists with expected heading text", async () => {
    const { default: FeaturesPage } = await import(
      "@/app/(marketing)/features/page"
    );
    render(<FeaturesPage />);

    const loneWolfText = screen.getByText(/The Lone Wolf/i);
    expect(loneWolfText).toBeTruthy();
  });

  it("Safe By Design renders BEFORE The Lone Wolf in DOM order", async () => {
    const { default: FeaturesPage } = await import(
      "@/app/(marketing)/features/page"
    );
    const { container } = render(<FeaturesPage />);

    // Find the Safe By Design section — DataSafetyBanner inline variant uses aria-label
    const safeByDesignEl = container.querySelector(
      '[aria-label="Smart Import data safety"]'
    );
    // Find The Lone Wolf section heading
    const loneWolfEl = container.querySelector(
      '[aria-label="Thrall features heading"]'
    );

    expect(safeByDesignEl).toBeTruthy();
    expect(loneWolfEl).toBeTruthy();

    // Node.DOCUMENT_POSITION_FOLLOWING = 4 means safeByDesignEl comes BEFORE loneWolfEl
    const position = safeByDesignEl!.compareDocumentPosition(loneWolfEl!);
    const safeByDesignIsFirst =
      position & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(safeByDesignIsFirst).toBeTruthy();
  });

  it("Safe By Design description text is present (no content regression)", async () => {
    const { default: FeaturesPage } = await import(
      "@/app/(marketing)/features/page"
    );
    render(<FeaturesPage />);

    // The description override text from SmartImportSafetyCallout
    const descriptionText = screen.getByText(
      /Smart Import extracts card names, issuers, fees/i
    );
    expect(descriptionText).toBeTruthy();
  });

  it("The Lone Wolf 'One Device, One Wolf' subheading is present (no content regression)", async () => {
    const { default: FeaturesPage } = await import(
      "@/app/(marketing)/features/page"
    );
    render(<FeaturesPage />);

    const subheadings = screen.getAllByText(/One Device, One Wolf/i);
    // Should appear at least once — h2 heading
    expect(subheadings.length).toBeGreaterThanOrEqual(1);
    // The h2 specifically should be present
    const h2 = subheadings.find((el) => el.tagName === "H2");
    expect(h2).toBeTruthy();
  });
});
