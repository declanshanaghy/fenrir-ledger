/**
 * Free Trial Page — Component render tests
 *
 * Validates page structure, wolf-voice copy integrity, section landmarks,
 * aria-labels, feature card count, timeline steps, tier comparison, and
 * mobile-first CSS ordering.
 *
 * Issue: #636
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock framer-motion to render static elements (no animation in test env)
vi.mock("framer-motion", () => {
  const actual = vi.importActual("framer-motion");
  return {
    ...actual,
    motion: new Proxy(
      {},
      {
        get: (_target, prop: string) => {
          // Return a forwardRef component that renders the HTML element
          return ({
            children,
            className,
            style,
            role,
            "aria-label": ariaLabel,
            "aria-labelledby": ariaLabelledby,
            "aria-hidden": ariaHidden,
            id,
            ...rest
          }: Record<string, unknown>) => {
            const Tag = prop as keyof JSX.IntrinsicElements;
            return (
              <Tag
                className={className as string}
                style={style as React.CSSProperties}
                role={role as string}
                aria-label={ariaLabel as string}
                aria-labelledby={ariaLabelledby as string}
                aria-hidden={ariaHidden as string}
                id={id as string}
              >
                {children as React.ReactNode}
              </Tag>
            );
          };
        },
      }
    ),
    useReducedMotion: () => false,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
    role,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
    role?: string;
  }) => (
    <a href={href} className={className} role={role} {...rest}>
      {children}
    </a>
  ),
}));

import { FreeTrialContent } from "@/app/(marketing)/free-trial/FreeTrialContent";

// ── Tests ────────────────────────────────────────────────────────────────────

describe("FreeTrialContent — Page Structure", () => {
  beforeEach(() => {
    render(<FreeTrialContent />);
  });

  it("renders the hero section with aria-label", () => {
    const hero = screen.getByLabelText("Free trial hero");
    expect(hero).toBeDefined();
  });

  it("renders the wolf-voice headline 'I Hunt For 30 Days. Free.'", () => {
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toContain("I Hunt");
    expect(heading.textContent).toContain("For 30 Days.");
    expect(heading.textContent).toContain("Free.");
  });

  it("renders wolf-voice rune line with Unbound text", () => {
    // The rune line is aria-hidden, so we search by text
    const hero = screen.getByLabelText("Free trial hero");
    expect(hero.textContent).toContain("I Am Unbound");
  });

  it("renders trust line 'No credit card. No chains.'", () => {
    const hero = screen.getByLabelText("Free trial hero");
    expect(hero.textContent).toContain("No credit card");
    expect(hero.textContent).toContain("No chains");
  });

  it("renders 'Unleash the Wolf' and 'See What I Can Do' CTAs", () => {
    const unleashLinks = screen.getAllByText("Unleash the Wolf");
    expect(unleashLinks.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("See What I Can Do")).toBeDefined();
  });

  it("CTA links point to /ledger and /features", () => {
    const unleashLinks = screen.getAllByText("Unleash the Wolf");
    const ledgerLink = unleashLinks.find(
      (el) => el.closest("a")?.getAttribute("href") === "/ledger"
    );
    expect(ledgerLink).toBeDefined();

    const seeLink = screen.getByText("See What I Can Do");
    expect(seeLink.closest("a")?.getAttribute("href")).toBe("/features");
  });
});

describe("FreeTrialContent — Feature Showcase", () => {
  beforeEach(() => {
    render(<FreeTrialContent />);
  });

  it("renders the features section heading 'What I Bring to the Hunt'", () => {
    const heading = screen.getByText("What I Bring to the Hunt");
    expect(heading).toBeDefined();
    expect(heading.tagName.toLowerCase()).toBe("h2");
  });

  it("renders exactly 7 feature cards", () => {
    const featureList = screen.getByLabelText("Trial features");
    const items = within(featureList).getAllByRole("listitem");
    expect(items).toHaveLength(7);
  });

  it("all feature card titles start with 'I' (wolf-voice)", () => {
    const expectedTitles = [
      "I Watch Every Card",
      "I Count Down Every Fee",
      "I Guard the Whole Pack",
      "I Devour Your Spreadsheets",
      "I Remember the Fallen",
      "I Am No Ordinary Ledger",
      "I Follow You Everywhere",
    ];
    for (const title of expectedTitles) {
      expect(screen.getByText(title)).toBeDefined();
    }
  });

  it("each feature card has a 'Yours Free' tag", () => {
    const tags = screen.getAllByText("Yours Free");
    expect(tags).toHaveLength(7);
  });
});

describe("FreeTrialContent — Timeline", () => {
  beforeEach(() => {
    render(<FreeTrialContent />);
  });

  it("renders the timeline heading 'How I Hunt for You'", () => {
    const heading = screen.getByText("How I Hunt for You");
    expect(heading).toBeDefined();
    expect(heading.tagName.toLowerCase()).toBe("h2");
  });

  it("renders 3 timeline steps (Day 1, Day 15, Day 30)", () => {
    // Both desktop and mobile timelines render, so we get 2 sets
    const day1s = screen.getAllByText("Day 1");
    const day15s = screen.getAllByText("Day 15");
    const day30s = screen.getAllByText("Day 30");
    // At least one of each
    expect(day1s.length).toBeGreaterThanOrEqual(1);
    expect(day15s.length).toBeGreaterThanOrEqual(1);
    expect(day30s.length).toBeGreaterThanOrEqual(1);
  });

  it("renders wolf-voice timeline titles", () => {
    expect(screen.getAllByText("You Feed Me a Card").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("I Show You the Kill").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("You Decide My Fate").length).toBeGreaterThanOrEqual(1);
  });
});

describe("FreeTrialContent — Tier Comparison", () => {
  beforeEach(() => {
    render(<FreeTrialContent />);
  });

  it("renders 'After 30 Days, You Choose' heading", () => {
    const heading = screen.getByText("After 30 Days, You Choose");
    expect(heading).toBeDefined();
    expect(heading.tagName.toLowerCase()).toBe("h2");
  });

  it("renders Thrall tier card with title", () => {
    const thrall = screen.getByText("Thrall");
    expect(thrall).toBeDefined();
    expect(thrall.tagName.toLowerCase()).toBe("h3");
  });

  it("renders Karl tier card with title", () => {
    const karl = screen.getByText("Karl");
    expect(karl).toBeDefined();
    expect(karl.tagName.toLowerCase()).toBe("h3");
  });

  it("Thrall shows 5-card limit (not 3)", () => {
    expect(screen.getByText("Up to 5 cards in my jaws")).toBeDefined();
  });

  it("Karl card has 'Full Fury' badge", () => {
    expect(screen.getByText("Full Fury")).toBeDefined();
  });

  it("wolf-voice CTAs: 'Let Me Rest' and 'Keep Me Unleashed'", () => {
    expect(screen.getByText("Let Me Rest")).toBeDefined();
    // The em-dash renders as HTML entity
    const karlCta = screen.getByText(/Keep Me Unleashed/);
    expect(karlCta).toBeDefined();
  });

  it("renders 'I Never Forget' data safety block", () => {
    expect(screen.getByText("I Never Forget")).toBeDefined();
    expect(screen.getByLabelText("Data safety guarantee")).toBeDefined();
  });

  it("Karl card shows first on mobile (order-1 class)", () => {
    const karlCard = screen.getByLabelText("Recommended plan").closest("article");
    expect(karlCard?.className).toContain("order-1");
  });

  it("Thrall card shows second on mobile (order-2 class)", () => {
    const thrallTitle = screen.getByText("Thrall");
    const thrallCard = thrallTitle.closest("article");
    expect(thrallCard?.className).toContain("order-2");
  });
});

describe("FreeTrialContent — Final CTA", () => {
  beforeEach(() => {
    render(<FreeTrialContent />);
  });

  it("renders 'Unleash Me' heading", () => {
    const heading = screen.getByText("Unleash Me");
    expect(heading).toBeDefined();
    expect(heading.tagName.toLowerCase()).toBe("h2");
  });

  it("renders 'Unleash the Wolf' button linking to /ledger", () => {
    // There are multiple "Unleash the Wolf" links (hero + final CTA)
    const links = screen.getAllByText("Unleash the Wolf");
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) {
      expect(link.closest("a")?.getAttribute("href")).toBe("/ledger");
    }
  });

  it("renders trust line 'No credit card · No chains · No commitment'", () => {
    expect(screen.getByText(/No credit card.*No chains.*No commitment/)).toBeDefined();
  });
});
