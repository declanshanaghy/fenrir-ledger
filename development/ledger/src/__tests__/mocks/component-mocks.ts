/**
 * Shared component stub factories for component tests.
 *
 * All stubs use React.createElement (no JSX) so this file stays as plain .ts
 * without needing JSX transform configuration.
 *
 * Usage inside vi.mock() factories:
 *
 *   vi.mock("next/link", () => require("../mocks/component-mocks").nextLinkMock);
 *   vi.mock("@/components/dashboard/CardTile", () => require("../mocks/component-mocks").cardTileMock);
 *   vi.mock("@/components/entitlement/KarlUpsellDialog", () => require("../mocks/component-mocks").karlUpsellDialogMock);
 */

import React from "react";
import { vi } from "vitest";

// ── next/link ─────────────────────────────────────────────────────────────────

/** next/link — renders a plain <a> element */
export const nextLinkMock = {
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...props } as React.HTMLAttributes<HTMLAnchorElement> & { href: string }, children),
};

// ── Dashboard components ──────────────────────────────────────────────────────

/** @/components/dashboard/CardTile — renders card name with testid */
export const cardTileMock = {
  CardTile: ({ card }: { card: { cardName: string } }) =>
    React.createElement("div", { "data-testid": `card-tile-${card.cardName}` }, card.cardName),
};

/** @/components/dashboard/EmptyState */
export const emptyStateMock = {
  EmptyState: () => React.createElement("div", { "data-testid": "empty-state" }, "No cards yet"),
};

/** @/components/dashboard/AnimatedCardGrid */
export const animatedCardGridMock = {
  AnimatedCardGrid: ({
    cards,
    renderCard,
  }: {
    cards: { id: string; cardName: string }[];
    renderCard: (card: { id: string; cardName: string }) => React.ReactNode;
  }) =>
    React.createElement(
      "div",
      { "data-testid": "card-grid" },
      ...cards.map((card) =>
        React.createElement("div", { key: card.id }, renderCard(card)),
      ),
    ),
};

// ── Layout components ─────────────────────────────────────────────────────────

/** @/components/layout/ThemeToggle */
export const themeToggleMock = {
  ThemeToggle: () => React.createElement("button", { type: "button" }, "T"),
  cycleTheme: (t: string) => (t === "dark" ? "light" : "dark"),
};

/** @/components/layout/TrialBadge */
export const trialBadgeMock = {
  TrialBadge: () => null,
};

// ── Marketing components ──────────────────────────────────────────────────────

/** @/components/marketing/MarketingNavLinks */
export const marketingNavLinksMock = {
  MarketingNavLinks: () => null,
};

// ── Entitlement components ────────────────────────────────────────────────────

/** @/components/entitlement/KarlUpsellDialog — renders when open=true */
export const karlUpsellDialogMock = {
  KarlUpsellDialog: ({
    open,
    onDismiss,
  }: {
    open: boolean;
    onDismiss: () => void;
  }) =>
    open
      ? React.createElement(
          "div",
          { "data-testid": "karl-upsell-dialog" },
          React.createElement("button", { onClick: onDismiss }, "Dismiss"),
        )
      : null,
  KARL_UPSELL_VALHALLA: {},
  KARL_UPSELL_VELOCITY: {},
  KARL_UPSELL_HOWL: {},
  KARL_UPSELL_TRASH: {},
};

// ── Gleipnir components ───────────────────────────────────────────────────────

/** @/components/cards/GleipnirBearSinews (fragment 4) */
export const gleipnirBearSinewsMock = {
  GleipnirBearSinews: () => null,
  useGleipnirFragment4: () => ({ open: false, trigger: vi.fn(), dismiss: vi.fn() }),
};

/** @/components/cards/GleipnirMountainRoots (fragment 3) */
export const gleipnirMountainRootsMock = {
  GleipnirMountainRoots: () => null,
  useGleipnirFragment3: () => ({ open: false, dismiss: vi.fn() }),
};
