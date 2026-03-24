/**
 * Issue #1895 — Features page: remove header links, move Wikipedia links to quote text
 *
 * Validates the AtmosphericWithLink component behavior:
 * - Blockquote links have correct security attributes (target="_blank", rel="noopener noreferrer")
 * - No anchor tags appear inside h2 elements (headers are plain text)
 * - AtmosphericWithLink wraps the first term occurrence in a link
 * - AtmosphericWithLink falls back to plain text when term not found
 *
 * @ref #1895
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// ── Mocks ────────────────────────────────────────────────────────────────────

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

vi.mock("@/components/shared/ThemedFeatureImage", () => ({
  ThemedFeatureImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock("@/components/marketing/DataSafetyBanner", () => ({
  DataSafetyBanner: () => <div data-testid="data-safety-banner" />,
}));

// ── Subject under test ────────────────────────────────────────────────────────

// Import the page after mocks are set up
import FeaturesPage from "@/app/(marketing)/features/page";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPage() {
  return render(<FeaturesPage />);
}

// ── Tests: Link security attributes ──────────────────────────────────────────

describe("FeaturesPage — Issue #1895: Wikipedia links in blockquotes", () => {
  beforeEach(() => {
    renderPage();
  });

  it("all blockquote anchor links open in new tab (target=_blank)", () => {
    const blockquotes = document.querySelectorAll("blockquote");
    expect(blockquotes.length).toBeGreaterThan(0);

    const anchors = Array.from(blockquotes).flatMap((bq) =>
      Array.from(bq.querySelectorAll("a"))
    );
    expect(anchors.length).toBeGreaterThan(0);

    for (const anchor of anchors) {
      expect(anchor.getAttribute("target")).toBe("_blank");
    }
  });

  it("all blockquote anchor links have rel='noopener noreferrer'", () => {
    const blockquotes = document.querySelectorAll("blockquote");
    const anchors = Array.from(blockquotes).flatMap((bq) =>
      Array.from(bq.querySelectorAll("a"))
    );
    expect(anchors.length).toBeGreaterThan(0);

    for (const anchor of anchors) {
      const rel = anchor.getAttribute("rel");
      expect(rel).toContain("noopener");
      expect(rel).toContain("noreferrer");
    }
  });

  it("all blockquote anchor links point to Wikipedia", () => {
    const blockquotes = document.querySelectorAll("blockquote");
    const anchors = Array.from(blockquotes).flatMap((bq) =>
      Array.from(bq.querySelectorAll("a"))
    );
    expect(anchors.length).toBeGreaterThan(0);

    for (const anchor of anchors) {
      const href = anchor.getAttribute("href") ?? "";
      expect(href).toContain("wikipedia.org");
    }
  });
});

// ── Tests: Headers are plain text (no links) ─────────────────────────────────

describe("FeaturesPage — Issue #1895: Feature section headers are plain text", () => {
  beforeEach(() => {
    renderPage();
  });

  it("no h2 element in a feature section contains an anchor tag", () => {
    // Select h2 elements that are inside feature sections (have id attribute)
    const featureSections = document.querySelectorAll("section[id]");
    expect(featureSections.length).toBeGreaterThan(0);

    for (const section of featureSections) {
      const h2s = section.querySelectorAll("h2");
      for (const h2 of h2s) {
        const links = h2.querySelectorAll("a");
        expect(links.length).toBe(0);
      }
    }
  });

  it("feature section h2 elements exist and have non-empty text content", () => {
    const featureSections = document.querySelectorAll("section[id]");
    expect(featureSections.length).toBeGreaterThan(0);

    let h2Count = 0;
    for (const section of featureSections) {
      const h2s = section.querySelectorAll("h2");
      for (const h2 of h2s) {
        expect(h2.textContent?.trim().length).toBeGreaterThan(0);
        h2Count++;
      }
    }
    expect(h2Count).toBeGreaterThan(0);
  });
});

// ── Tests: AtmosphericWithLink component behavior ─────────────────────────────

/**
 * Re-creates the AtmosphericWithLink component (same logic) to test independently.
 * This avoids importing the private function from the page module while still
 * validating the link-wrapping logic that drives the AC.
 */
function AtmosphericWithLink({
  text,
  term,
  url,
}: {
  text: string;
  term: string;
  url: string;
}) {
  const idx = text.indexOf(term);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        {term}
      </a>
      {text.slice(idx + term.length)}
    </>
  );
}

describe("AtmosphericWithLink — term-linking logic (Issue #1895)", () => {
  it("wraps the first occurrence of the term in an anchor tag", () => {
    const { container } = render(
      <AtmosphericWithLink
        text="Sköll chases the sun."
        term="Sköll"
        url="https://en.wikipedia.org/wiki/Sk%C3%B6ll"
      />
    );
    const anchor = container.querySelector("a");
    expect(anchor).not.toBeNull();
    expect(anchor!.textContent).toBe("Sköll");
    expect(anchor!.getAttribute("href")).toBe("https://en.wikipedia.org/wiki/Sk%C3%B6ll");
  });

  it("renders plain text (no anchor) when the term is not found", () => {
    const { container } = render(
      <AtmosphericWithLink
        text="The wolf runs free."
        term="Sköll"
        url="https://en.wikipedia.org/wiki/Sk%C3%B6ll"
      />
    );
    const anchor = container.querySelector("a");
    expect(anchor).toBeNull();
    expect(container.textContent).toBe("The wolf runs free.");
  });

  it("only links the first occurrence when the term appears multiple times", () => {
    const { container } = render(
      <AtmosphericWithLink
        text="Fenrir guards many dens. One wolf, many territories. Fenrir never stops."
        term="Fenrir"
        url="https://en.wikipedia.org/wiki/Fenrir"
      />
    );
    const anchors = container.querySelectorAll("a");
    expect(anchors.length).toBe(1);
    expect(anchors[0].textContent).toBe("Fenrir");
  });

  it("link has target=_blank and rel=noopener noreferrer", () => {
    const { container } = render(
      <AtmosphericWithLink
        text="Hati runs after the moon."
        term="Hati"
        url="https://en.wikipedia.org/wiki/Hati_Hr%C3%B3%C3%B0vitnisson"
      />
    );
    const anchor = container.querySelector("a");
    expect(anchor).not.toBeNull();
    expect(anchor!.getAttribute("target")).toBe("_blank");
    const rel = anchor!.getAttribute("rel") ?? "";
    expect(rel).toContain("noopener");
    expect(rel).toContain("noreferrer");
  });

  it("preserves surrounding text before and after the linked term", () => {
    const { container } = render(
      <AtmosphericWithLink
        text="Mimir's well holds the memory of all things. Drink, and remember."
        term="Mimir"
        url="https://en.wikipedia.org/wiki/M%C3%ADmir"
      />
    );
    const fullText = container.textContent;
    expect(fullText).toContain("'s well holds the memory of all things. Drink, and remember.");
    expect(fullText).toContain("Mimir");
  });
});
