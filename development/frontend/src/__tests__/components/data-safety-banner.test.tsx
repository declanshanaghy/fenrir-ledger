/**
 * DataSafetyBanner — Component render tests
 *
 * Validates all 4 variants (full, compact, inline, footer),
 * ARIA attributes, accessibility, and content correctness.
 * Issue: #644
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  DataSafetyBanner,
  type DataSafetyBannerProps,
} from "@/components/marketing/DataSafetyBanner";

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock next/link to render a simple anchor
vi.mock("next/link", () => ({
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderBanner(props: DataSafetyBannerProps = {}) {
  return render(<DataSafetyBanner {...props} />);
}

// ── Variant: Full ────────────────────────────────────────────────────────────

describe("DataSafetyBanner — variant=full", () => {
  it("renders with role=note and default aria-label", () => {
    renderBanner({ variant: "full" });
    const note = screen.getByRole("note");
    expect(note).toBeDefined();
    expect(note.getAttribute("aria-label")).toBe("Data safety guarantee");
  });

  it("renders the heading 'What Fenrir Tracks — and What It Never Touches'", () => {
    renderBanner({ variant: "full" });
    const heading = screen.getByText(
      "What Fenrir Tracks — and What It Never Touches"
    );
    expect(heading).toBeDefined();
    expect(heading.tagName.toLowerCase()).toBe("h3");
  });

  it("renders the lead paragraph mentioning card metadata tracker", () => {
    renderBanner({ variant: "full" });
    const note = screen.getByRole("note");
    expect(note.textContent).toContain("card metadata tracker");
    expect(note.textContent).toContain("never see, store, or transmit");
  });

  it("renders include items (What Fenrir Tracks)", () => {
    renderBanner({ variant: "full" });
    const note = screen.getByRole("note");
    expect(note.textContent).toContain("Card name & product");
    expect(note.textContent).toContain("Annual fee amount & renewal date");
    expect(note.textContent).toContain("Custom alerts and reminders you set");
  });

  it("renders exclude items (What Fenrir Never Touches)", () => {
    renderBanner({ variant: "full" });
    const note = screen.getByRole("note");
    expect(note.textContent).toContain("Credit card numbers (16-digit PAN)");
    expect(note.textContent).toContain("CVV / CVC security codes");
    expect(note.textContent).toContain("Card PINs");
    expect(note.textContent).toContain("Online banking passwords");
    expect(note.textContent).toContain("Social Security numbers");
  });

  it("renders wolf-voice footer line by default", () => {
    renderBanner({ variant: "full" });
    const note = screen.getByRole("note");
    expect(note.textContent).toContain("born to guard, not to harvest");
  });

  it("hides footer line when showFooterLine=false", () => {
    renderBanner({ variant: "full", showFooterLine: false });
    const note = screen.getByRole("note");
    expect(note.textContent).not.toContain("born to guard, not to harvest");
  });

  it("marks rune icon as aria-hidden", () => {
    renderBanner({ variant: "full" });
    const icons = screen.getAllByText("ᛊ");
    // The header icon should be aria-hidden
    const headerIcon = icons[0];
    expect(headerIcon.getAttribute("aria-hidden")).toBe("true");
  });

  it("has column aria-labels for screen readers", () => {
    renderBanner({ variant: "full" });
    const includeCol = screen.getByLabelText("What Fenrir Ledger tracks");
    const excludeCol = screen.getByLabelText(
      "What Fenrir Ledger never collects"
    );
    expect(includeCol).toBeDefined();
    expect(excludeCol).toBeDefined();
  });

  it("accepts custom ariaLabel", () => {
    renderBanner({ variant: "full", ariaLabel: "Custom label" });
    const note = screen.getByRole("note");
    expect(note.getAttribute("aria-label")).toBe("Custom label");
  });

  it("passes className to wrapper", () => {
    renderBanner({ variant: "full", className: "my-custom-class" });
    const note = screen.getByRole("note");
    expect(note.className).toContain("my-custom-class");
  });
});

// ── Variant: Compact ─────────────────────────────────────────────────────────

describe("DataSafetyBanner — variant=compact", () => {
  it("renders with role=note and aria-label", () => {
    renderBanner({ variant: "compact" });
    const note = screen.getByRole("note");
    expect(note).toBeDefined();
    expect(note.getAttribute("aria-label")).toBe("Data safety guarantee");
  });

  it("renders the trust statement text", () => {
    renderBanner({ variant: "compact" });
    const note = screen.getByRole("note");
    expect(note.textContent).toContain("Fenrir never collects credit card numbers");
    expect(note.textContent).toContain("only card metadata");
  });

  it("renders Learn more link with default href", () => {
    renderBanner({ variant: "compact" });
    const link = screen.getByText("Learn more");
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("/about#data-safety");
  });

  it("accepts custom learnMoreText and learnMoreHref", () => {
    renderBanner({
      variant: "compact",
      learnMoreText: "FAQ ↓",
      learnMoreHref: "#faq-card-numbers",
    });
    const link = screen.getByText("FAQ ↓");
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("#faq-card-numbers");
  });

  it("has an accessible aria-label on the learn more link", () => {
    renderBanner({ variant: "compact" });
    const link = screen.getByLabelText("Learn more about data safety");
    expect(link).toBeDefined();
  });

  it("marks the rune icon as aria-hidden", () => {
    renderBanner({ variant: "compact" });
    const icon = screen.getByText("ᛊ");
    expect(icon.getAttribute("aria-hidden")).toBe("true");
  });
});

// ── Variant: Inline ──────────────────────────────────────────────────────────

describe("DataSafetyBanner — variant=inline", () => {
  it("renders with role=note and aria-label", () => {
    renderBanner({ variant: "inline" });
    const note = screen.getByRole("note");
    expect(note).toBeDefined();
  });

  it("renders default heading 'Safe By Design'", () => {
    renderBanner({ variant: "inline" });
    const heading = screen.getByText("Safe By Design");
    expect(heading).toBeDefined();
    expect(heading.tagName.toLowerCase()).toBe("h4");
  });

  it("renders default description about Smart Import", () => {
    renderBanner({ variant: "inline" });
    const note = screen.getByRole("note");
    expect(note.textContent).toContain("Smart Import reads card names");
    expect(note.textContent).toContain("architecturally incapable");
  });

  it("accepts headingOverride", () => {
    renderBanner({
      variant: "inline",
      headingOverride: "What Heimdall Guards",
    });
    const heading = screen.getByText("What Heimdall Guards");
    expect(heading).toBeDefined();
  });

  it("accepts descriptionOverride", () => {
    renderBanner({
      variant: "inline",
      descriptionOverride: "Custom description text here.",
    });
    const note = screen.getByRole("note");
    expect(note.textContent).toContain("Custom description text here.");
  });

  it("renders tracked chips with ✓", () => {
    renderBanner({ variant: "inline" });
    expect(screen.getByLabelText("Tracked: Card name")).toBeDefined();
    expect(screen.getByLabelText("Tracked: Issuer")).toBeDefined();
    expect(screen.getByLabelText("Tracked: Annual fee")).toBeDefined();
    expect(screen.getByLabelText("Tracked: Bonus deadline")).toBeDefined();
  });

  it("renders never-collected chips with ✗", () => {
    renderBanner({ variant: "inline" });
    expect(screen.getByLabelText("Never collected: Card number")).toBeDefined();
    expect(screen.getByLabelText("Never collected: CVV")).toBeDefined();
    expect(screen.getByLabelText("Never collected: PIN")).toBeDefined();
    expect(screen.getByLabelText("Never collected: Password")).toBeDefined();
  });

  it("has aria-label on chips container", () => {
    renderBanner({ variant: "inline" });
    const chipsContainer = screen.getByLabelText(
      "What Fenrir tracks vs. never touches"
    );
    expect(chipsContainer).toBeDefined();
  });

  it("marks the icon as aria-hidden", () => {
    renderBanner({ variant: "inline" });
    const icon = screen.getByText("ᛊ");
    expect(icon.getAttribute("aria-hidden")).toBe("true");
  });
});

// ── Variant: Footer ──────────────────────────────────────────────────────────

describe("DataSafetyBanner — variant=footer", () => {
  it("renders with role=note and aria-label", () => {
    renderBanner({ variant: "footer" });
    const note = screen.getByRole("note");
    expect(note).toBeDefined();
  });

  it("renders the trust statement", () => {
    renderBanner({ variant: "footer" });
    const note = screen.getByRole("note");
    expect(note.textContent).toContain(
      "Fenrir Ledger never collects credit card numbers"
    );
    expect(note.textContent).toContain("Only card metadata is stored");
  });

  it("marks the rune icon as aria-hidden", () => {
    renderBanner({ variant: "footer" });
    const icon = screen.getByText("ᛊ");
    expect(icon.getAttribute("aria-hidden")).toBe("true");
  });

  it("accepts custom ariaLabel", () => {
    renderBanner({ variant: "footer", ariaLabel: "Data safety statement" });
    const note = screen.getByRole("note");
    expect(note.getAttribute("aria-label")).toBe("Data safety statement");
  });
});

// ── Default behavior ─────────────────────────────────────────────────────────

describe("DataSafetyBanner — defaults", () => {
  it("defaults to variant=full when no variant specified", () => {
    renderBanner();
    // Full variant has the two-column heading
    expect(
      screen.getByText("What Fenrir Tracks — and What It Never Touches")
    ).toBeDefined();
  });
});
