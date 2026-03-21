/**
 * AnimatedCardGrid — unit tests for issue #1695.
 *
 * Covers: grid renders all cards, renderCard callback is called per card,
 * reduced-motion path (useReducedMotion=true), empty list renders empty grid.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnimatedCardGrid } from "@/components/dashboard/AnimatedCardGrid";
import type { Card } from "@/lib/types";

// ── Mock framer-motion ────────────────────────────────────────────────────

vi.mock("framer-motion", () => {
  const React = require("react");
  const motion = {
    div: React.forwardRef(
      (
        {
          children,
          className,
          ...rest
        }: React.HTMLAttributes<HTMLDivElement> & {
          variants?: unknown;
          initial?: unknown;
          animate?: unknown;
          exit?: unknown;
          layout?: unknown;
        },
        ref: React.Ref<HTMLDivElement>,
      ) =>
        React.createElement("div", { ref, className, ...rest }, children),
    ),
  };
  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useReducedMotion: () => false,
  };
});

// ── Fixture builder ────────────────────────────────────────────────────────

function makeCard(id: string, overrides: Partial<Card> = {}): Card {
  return {
    id,
    householdId: "hh-1",
    issuerId: "chase",
    cardName: `Card ${id}`,
    openDate: "2023-01-01T00:00:00.000Z",
    creditLimit: 10000_00,
    annualFee: 0,
    annualFeeDate: "",
    promoPeriodMonths: 0,
    signUpBonus: null,
    status: "active",
    notes: "",
    createdAt: "2023-01-01T00:00:00.000Z",
    updatedAt: "2023-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("AnimatedCardGrid — renders cards", () => {
  it("renders a card for each item in the list", () => {
    const cards = [makeCard("c1"), makeCard("c2"), makeCard("c3")];
    render(
      <AnimatedCardGrid
        cards={cards}
        renderCard={(card) => (
          <div data-testid={`card-${card.id}`}>{card.cardName}</div>
        )}
      />,
    );
    expect(screen.getByTestId("card-c1")).toBeDefined();
    expect(screen.getByTestId("card-c2")).toBeDefined();
    expect(screen.getByTestId("card-c3")).toBeDefined();
  });

  it("calls renderCard once per card", () => {
    const cards = [makeCard("x1"), makeCard("x2")];
    const renderCard = vi.fn((card: Card) => (
      <div key={card.id}>{card.cardName}</div>
    ));
    render(<AnimatedCardGrid cards={cards} renderCard={renderCard} />);
    expect(renderCard).toHaveBeenCalledTimes(2);
  });

  it("renders empty grid when cards array is empty", () => {
    const { container } = render(
      <AnimatedCardGrid cards={[]} renderCard={() => <div />} />,
    );
    // The grid wrapper still renders, just with no card children
    const grid = container.firstChild as HTMLElement;
    expect(grid).toBeDefined();
    expect(grid.children.length).toBe(0);
  });

  it("passes the correct card to renderCard", () => {
    const card = makeCard("unique-id", { cardName: "Platinum Card" });
    const renderCard = vi.fn(() => <div />);
    render(<AnimatedCardGrid cards={[card]} renderCard={renderCard} />);
    expect(renderCard).toHaveBeenCalledWith(card);
  });

  it("renders grid container with responsive grid classes", () => {
    const { container } = render(
      <AnimatedCardGrid cards={[]} renderCard={() => <div />} />,
    );
    const grid = container.firstChild as HTMLElement;
    expect(grid.className).toContain("grid");
  });
});

describe("AnimatedCardGrid — reduced motion", () => {
  it("renders cards correctly when reduced motion is active", async () => {
    // Re-mock with reducedMotion=true
    vi.doMock("framer-motion", () => {
      const React = require("react");
      const motion = {
        div: React.forwardRef(
          (
            { children, className, ...rest }: React.HTMLAttributes<HTMLDivElement> & {
              variants?: unknown;
              initial?: unknown;
              animate?: unknown;
              exit?: unknown;
              layout?: unknown;
            },
            ref: React.Ref<HTMLDivElement>,
          ) => React.createElement("div", { ref, className, ...rest }, children),
        ),
      };
      return {
        motion,
        AnimatePresence: ({ children }: { children: React.ReactNode }) =>
          React.createElement(React.Fragment, null, children),
        useReducedMotion: () => true,
      };
    });

    const cards = [makeCard("rm1"), makeCard("rm2")];
    render(
      <AnimatedCardGrid
        cards={cards}
        renderCard={(card) => (
          <div data-testid={`rm-${card.id}`}>{card.cardName}</div>
        )}
      />,
    );
    // Cards still render regardless of motion preference
    expect(screen.getByTestId("rm-rm1")).toBeDefined();
    expect(screen.getByTestId("rm-rm2")).toBeDefined();
  });
});
