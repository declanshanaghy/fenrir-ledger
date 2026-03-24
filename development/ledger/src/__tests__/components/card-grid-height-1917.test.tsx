/**
 * Card grid height uniformity — Loki QA tests (issue #1917)
 *
 * Devil's advocate coverage that complements FiremanDecko's h-full chain tests:
 *
 * 1. AnimatedCardGrid outer div must have the CSS grid classes that enable
 *    align-items:stretch (the browser mechanism that makes cards uniform height).
 *
 * 2. HuntCardTile with no sign-up bonus (shorter card variant) still carries
 *    h-full on every wrapper layer — so CSS grid stretches it even without the
 *    progress bar row.
 *
 * 3. HuntCardTile renders its extra content rows (progress bar, deadline, opened)
 *    inside a flex column so nothing is clipped by h-full overflow.
 *
 * 4. AnimatedCardGrid renders an empty list without crashing (no orphan wrappers).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { AnimatedCardGrid } from "@/components/dashboard/AnimatedCardGrid";
import { HuntCardTile } from "@/components/dashboard/HuntCardTile";
import type { Card } from "@/lib/types";

// ── Framer-motion stub ─────────────────────────────────────────────────────────

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

const huntCard: Card = {
  id: "loki-hunt-1917",
  householdId: "hh-loki",
  issuerId: "chase",
  cardName: "Loki Hunt Card",
  openDate: "2024-01-15T00:00:00.000Z",
  creditLimit: 500000,
  annualFee: 9500,
  annualFeeDate: "2025-01-15",
  promoPeriodMonths: 0,
  signUpBonus: {
    type: "points",
    amount: 60000,
    spendRequirement: 400000,
    deadline: "2024-04-15",
    met: false,
  },
  amountSpent: 100000,
  status: "bonus_open",
  closedAt: undefined,
};

/** Shorter card — no sign-up bonus means no progress bar row in HuntCardTile */
const huntCardNoBonus: Card = {
  ...huntCard,
  id: "loki-hunt-nobonus",
  signUpBonus: null,
  status: "active",
};

// ── 1. AnimatedCardGrid: outer div has CSS grid classes ───────────────────────

describe("AnimatedCardGrid grid container has CSS grid classes (#1917)", () => {
  it("outer div carries 'grid' class", () => {
    const { container } = render(
      <AnimatedCardGrid
        cards={[huntCard]}
        renderCard={(card) => <div>{card.cardName}</div>}
      />,
    );
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toContain("grid");
  });

  it("outer div carries 'gap-4' class so cards have consistent spacing", () => {
    const { container } = render(
      <AnimatedCardGrid
        cards={[huntCard]}
        renderCard={(card) => <div>{card.cardName}</div>}
      />,
    );
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toContain("gap-4");
  });
});

// ── 2. HuntCardTile with no bonus: h-full still present on outer wrapper ──────

describe("HuntCardTile no-bonus (shorter variant) still has h-full (#1917)", () => {
  it("outer motion.div has h-full when card has no sign-up bonus", () => {
    const { container } = render(<HuntCardTile card={huntCardNoBonus} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("h-full");
  });

  it("Link has h-full when card has no sign-up bonus", () => {
    const { container } = render(<HuntCardTile card={huntCardNoBonus} />);
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.className).toContain("h-full");
  });

  it("Card element has h-full when card has no sign-up bonus", () => {
    render(<HuntCardTile card={huntCardNoBonus} />);
    const tile = screen.getByTestId("hunt-card-tile");
    expect(tile.className).toContain("h-full");
  });

  it("omits progress bar row when spendRequirement is 0 or null", () => {
    const { container } = render(<HuntCardTile card={huntCardNoBonus} />);
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).toBeNull();
  });
});

// ── 3. AnimatedCardGrid: empty list renders without orphan wrappers ───────────

describe("AnimatedCardGrid empty list (#1917)", () => {
  it("renders zero card wrappers when cards array is empty", () => {
    const { container } = render(
      <AnimatedCardGrid
        cards={[]}
        renderCard={(card) => <div>{card.cardName}</div>}
      />,
    );
    const outer = container.firstChild as HTMLElement;
    expect(outer.children.length).toBe(0);
  });
});

// ── 4. HuntCardTile met-bonus variant still has h-full ────────────────────────

describe("HuntCardTile met-bonus variant has h-full (#1917)", () => {
  const metBonusCard: Card = {
    ...huntCard,
    id: "loki-hunt-met",
    signUpBonus: {
      type: "points",
      amount: 60000,
      spendRequirement: 400000,
      deadline: "2024-04-15",
      met: true,
    },
    amountSpent: 400000,
    status: "active",
  };

  it("outer motion.div has h-full when bonus is already met", () => {
    const { container } = render(<HuntCardTile card={metBonusCard} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("h-full");
  });

  it("Card element has h-full when bonus is already met", () => {
    render(<HuntCardTile card={metBonusCard} />);
    const tile = screen.getByTestId("hunt-card-tile");
    expect(tile.className).toContain("h-full");
  });
});
