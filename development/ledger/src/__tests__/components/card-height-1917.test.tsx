/**
 * Card height uniformity — issue #1917
 *
 * Verifies the h-full chain that ensures all card tiles in the All tab grid
 * stretch to consistent row height:
 *   AnimatedCardGrid motion.div → card-chain motion.div → Link → Card (h-full)
 *
 * Each card tile's outer wrapper and Link must carry h-full so the Card's
 * own h-full class has a stretched parent to fill.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { HuntCardTile } from "@/components/dashboard/HuntCardTile";
import { ValhallaCardTile } from "@/components/dashboard/ValhallaCardTile";
import { HowlCardTile } from "@/components/dashboard/HowlCardTile";
import { CardTile } from "@/components/dashboard/CardTile";
import { AnimatedCardGrid } from "@/components/dashboard/AnimatedCardGrid";
import type { Card } from "@/lib/types";

// ── Framer-motion stub ────────────────────────────────────────────────────────

vi.mock("framer-motion", () => {
  const React = require("react");
  const motion = {
    div: React.forwardRef(
      (
        {
          children,
          className,
          "data-testid": testId,
          ...rest
        }: React.HTMLAttributes<HTMLDivElement> & {
          variants?: unknown;
          initial?: unknown;
          animate?: unknown;
          exit?: unknown;
          layout?: unknown;
          whileHover?: unknown;
        },
        ref: React.Ref<HTMLDivElement>,
      ) =>
        React.createElement(
          "div",
          { ref, className, "data-testid": testId, ...rest },
          children,
        ),
    ),
  };
  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useReducedMotion: () => false,
  };
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseCard: Card = {
  id: "card-1917",
  householdId: "hh-test",
  issuerId: "amex",
  cardName: "Height Test Card",
  openDate: "2024-01-01T00:00:00.000Z",
  creditLimit: 500000,
  annualFee: 9500,
  annualFeeDate: "2025-01-01",
  promoPeriodMonths: 0,
  signUpBonus: {
    type: "points",
    amount: 60000,
    spendRequirement: 400000,
    deadline: "2024-04-01",
    met: false,
  },
  amountSpent: 100000,
  status: "bonus_open",
  closedAt: undefined,
};

const closedCard: Card = {
  ...baseCard,
  id: "card-1917-closed",
  status: "closed",
  closedAt: "2025-06-01T00:00:00.000Z",
  signUpBonus: { ...baseCard.signUpBonus!, met: true },
};

const howlCard: Card = {
  ...baseCard,
  id: "card-1917-howl",
  status: "fee_approaching",
  annualFeeDate: "2024-04-10",
};

const activeCard: Card = {
  ...baseCard,
  id: "card-1917-active",
  status: "active",
};

// ── Helper: get the outer motion.div (card-chain wrapper) ─────────────────────

function getCardChain(container: HTMLElement): HTMLElement {
  // The outermost div rendered by the card tile is the card-chain wrapper.
  return container.firstChild as HTMLElement;
}

// ── Tests: outer motion.div has h-full ────────────────────────────────────────

describe("Card tile outer wrapper has h-full (#1917)", () => {
  it("HuntCardTile outer motion.div has h-full", () => {
    const { container } = render(<HuntCardTile card={baseCard} />);
    const wrapper = getCardChain(container);
    expect(wrapper.className).toContain("h-full");
  });

  it("ValhallaCardTile outer motion.div has h-full", () => {
    const { container } = render(<ValhallaCardTile card={closedCard} />);
    const wrapper = getCardChain(container);
    expect(wrapper.className).toContain("h-full");
  });

  it("HowlCardTile outer motion.div has h-full", () => {
    const { container } = render(<HowlCardTile card={howlCard} />);
    const wrapper = getCardChain(container);
    expect(wrapper.className).toContain("h-full");
  });

  it("CardTile outer motion.div has h-full", () => {
    const { container } = render(<CardTile card={activeCard} />);
    const wrapper = getCardChain(container);
    expect(wrapper.className).toContain("h-full");
  });
});

// ── Tests: Link has h-full ────────────────────────────────────────────────────

describe("Card tile Link has h-full (#1917)", () => {
  it("HuntCardTile Link has h-full", () => {
    const { container } = render(<HuntCardTile card={baseCard} />);
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.className).toContain("h-full");
  });

  it("ValhallaCardTile Link has h-full", () => {
    const { container } = render(<ValhallaCardTile card={closedCard} />);
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.className).toContain("h-full");
  });

  it("HowlCardTile Link has h-full", () => {
    const { container } = render(<HowlCardTile card={howlCard} />);
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.className).toContain("h-full");
  });

  it("CardTile Link has h-full", () => {
    const { container } = render(<CardTile card={activeCard} />);
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.className).toContain("h-full");
  });
});

// ── Tests: Card element has h-full ────────────────────────────────────────────

describe("Card element has h-full (#1917)", () => {
  it("HuntCardTile Card has h-full", () => {
    render(<HuntCardTile card={baseCard} />);
    const tile = screen.getByTestId("hunt-card-tile");
    expect(tile.className).toContain("h-full");
  });

  it("ValhallaCardTile Card has h-full", () => {
    render(<ValhallaCardTile card={closedCard} />);
    const tile = screen.getByTestId("valhalla-card-tile");
    expect(tile.className).toContain("h-full");
  });

  it("HowlCardTile Card has h-full", () => {
    render(<HowlCardTile card={howlCard} />);
    const tile = screen.getByTestId("howl-card-tile");
    expect(tile.className).toContain("h-full");
  });

  it("CardTile Card has h-full", () => {
    render(<CardTile card={activeCard} />);
    const tile = screen.getByTestId("card-tile");
    expect(tile.className).toContain("h-full");
  });
});

// ── Tests: AnimatedCardGrid wrapper has h-full ────────────────────────────────

describe("AnimatedCardGrid motion.div wrapper has h-full (#1917)", () => {
  it("renders each card wrapped in a div with h-full", () => {
    const cards = [baseCard, activeCard];
    const { container } = render(
      <AnimatedCardGrid
        cards={cards}
        renderCard={(card) => (
          <div data-testid={`inner-${card.id}`}>{card.cardName}</div>
        )}
      />,
    );
    // Each card item is a direct child of the grid wrapper
    const grid = container.firstChild as HTMLElement;
    const items = Array.from(grid.children) as HTMLElement[];
    expect(items.length).toBe(2);
    for (const item of items) {
      expect(item.className).toContain("h-full");
    }
  });
});

// ── Tests: HuntCardTile progress bar accessibility (#1917) ────────────────────

describe("HuntCardTile progress bar accessibility (#1917)", () => {
  it("renders progressbar role when spendRequired > 0", () => {
    const { container } = render(<HuntCardTile card={baseCard} />);
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).not.toBeNull();
  });

  it("progressbar aria-valuemin is 0", () => {
    const { container } = render(<HuntCardTile card={baseCard} />);
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar!.getAttribute("aria-valuemin")).toBe("0");
  });

  it("progressbar aria-valuemax equals spendRequirement", () => {
    const { container } = render(<HuntCardTile card={baseCard} />);
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar!.getAttribute("aria-valuemax")).toBe(
      String(baseCard.signUpBonus!.spendRequirement),
    );
  });

  it("omits progressbar when spendRequired is 0", () => {
    const noSpendCard: Card = {
      ...baseCard,
      id: "card-1917-nospend",
      signUpBonus: { ...baseCard.signUpBonus!, spendRequirement: 0 },
    };
    const { container } = render(<HuntCardTile card={noSpendCard} />);
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).toBeNull();
  });
});
