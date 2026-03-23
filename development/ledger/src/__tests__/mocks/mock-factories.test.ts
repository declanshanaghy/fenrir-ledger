/**
 * Validates the shared mock factory files introduced in issue #1855.
 *
 * These tests verify that each factory module exports the expected shape and
 * that variant factories (authenticated vs. anonymous, karl vs. thrall, etc.)
 * produce the correct discriminated values.  They also cover the
 * makeRadixDialogMock() factory which wraps real Radix components.
 *
 * NOTE: This file imports the mock modules directly — it does NOT exercise
 * them via vi.mock(), which is the consumer's job.  The tests here guard
 * against regressions in the factory values themselves.
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

// ─── hook-mocks ───────────────────────────────────────────────────────────────

import {
  authMockAuthenticated,
  authMockAuthenticatedHh1,
  authMockAnonymous,
  entitlementMockKarl,
  entitlementMockThrall,
  cloudSyncMockIdle,
  ragnarokContextMock,
  nextNavigationMock,
  nextNavigationLedgerMock,
  nextThemesMock,
  trialStatusMockNone,
  authContextMockAnon,
} from "./hook-mocks";

// ─── storage-mocks ────────────────────────────────────────────────────────────

import {
  storageMockBasic,
  storageMockTrash,
  analyticsMock,
  refreshSessionMock,
  signInUrlMock,
  milestoneMock,
  issuerUtilsMock,
  cardLimitMockAllowed,
  entitlementCacheMock,
  trialUtilsMockLimit,
  trialUtilsMockToastKey,
  sonnerMock,
  sonnerToasterMock,
} from "./storage-mocks";

// ─── component-mocks ──────────────────────────────────────────────────────────

import {
  nextLinkMock,
  cardTileMock,
  emptyStateMock,
  animatedCardGridMock,
  themeToggleMock,
  trialBadgeMock,
  marketingNavLinksMock,
  karlUpsellDialogMock,
  gleipnirBearSinewsMock,
  gleipnirMountainRootsMock,
} from "./component-mocks";

// ─── dialog-mocks ─────────────────────────────────────────────────────────────

import { framerMotionMock, makeRadixDialogMock } from "./dialog-mocks";

// ══════════════════════════════════════════════════════════════════════════════
// hook-mocks
// ══════════════════════════════════════════════════════════════════════════════

describe("hook-mocks — useAuth variants", () => {
  it("authMockAuthenticated returns authenticated status with hh-test", () => {
    const result = authMockAuthenticated.useAuth();
    expect(result.status).toBe("authenticated");
    expect(result.householdId).toBe("hh-test");
    expect(result.ensureHouseholdId?.()).toBe("hh-test");
  });

  it("authMockAuthenticatedHh1 returns authenticated status with hh-1", () => {
    const result = authMockAuthenticatedHh1.useAuth();
    expect(result.status).toBe("authenticated");
    expect(result.householdId).toBe("hh-1");
  });

  it("authMockAnonymous returns anonymous status", () => {
    const result = authMockAnonymous.useAuth();
    expect(result.status).toBe("anonymous");
  });

  it("authenticated and anonymous variants are distinguishable by status", () => {
    expect(authMockAuthenticated.useAuth().status).not.toBe(
      authMockAnonymous.useAuth().status,
    );
  });
});

describe("hook-mocks — useEntitlement variants", () => {
  it("entitlementMockKarl returns karl tier", () => {
    expect(entitlementMockKarl.useEntitlement().tier).toBe("karl");
  });

  it("entitlementMockThrall returns thrall tier", () => {
    expect(entitlementMockThrall.useEntitlement().tier).toBe("thrall");
  });

  it("karl and thrall tiers are distinct", () => {
    expect(entitlementMockKarl.useEntitlement().tier).not.toBe(
      entitlementMockThrall.useEntitlement().tier,
    );
  });
});

describe("hook-mocks — useCloudSync / navigation / themes", () => {
  it("cloudSyncMockIdle returns idle syncState and isSyncing=false", () => {
    const sync = cloudSyncMockIdle.useCloudSync();
    expect(sync.syncState).toBe("idle");
    expect(sync.isSyncing).toBe(false);
  });

  it("nextNavigationMock returns / pathname", () => {
    expect(nextNavigationMock.usePathname()).toBe("/");
  });

  it("nextNavigationLedgerMock returns /ledger pathname", () => {
    expect(nextNavigationLedgerMock.usePathname()).toBe("/ledger");
  });

  it("nextThemesMock returns dark theme", () => {
    expect(nextThemesMock.useTheme().theme).toBe("dark");
  });

  it("ragnarokContextMock ragnarokActive is false", () => {
    expect(ragnarokContextMock.useRagnarok().ragnarokActive).toBe(false);
  });

  it("trialStatusMockNone returns none status", () => {
    expect(trialStatusMockNone.useTrialStatus().status).toBe("none");
  });

  it("authContextMockAnon returns anonymous session", () => {
    const ctx = authContextMockAnon.useAuthContext();
    expect(ctx.status).toBe("anonymous");
    expect(ctx.session).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// storage-mocks
// ══════════════════════════════════════════════════════════════════════════════

describe("storage-mocks — storageMock variants", () => {
  it("storageMockBasic exposes saveCard/deleteCard/closeCard/getCards as vi.fn()", () => {
    expect(vi.isMockFunction(storageMockBasic.saveCard)).toBe(true);
    expect(vi.isMockFunction(storageMockBasic.deleteCard)).toBe(true);
    expect(vi.isMockFunction(storageMockBasic.closeCard)).toBe(true);
    expect(vi.isMockFunction(storageMockBasic.getCards)).toBe(true);
  });

  it("storageMockTrash exposes restoreCard/expungeCard/expungeAllCards as vi.fn()", () => {
    expect(vi.isMockFunction(storageMockTrash.restoreCard)).toBe(true);
    expect(vi.isMockFunction(storageMockTrash.expungeCard)).toBe(true);
    expect(vi.isMockFunction(storageMockTrash.expungeAllCards)).toBe(true);
  });

  it("storageMockBasic.getCards resolves to an empty array", async () => {
    const result = await storageMockBasic.getCards();
    expect(result).toEqual([]);
  });
});

describe("storage-mocks — utility mocks", () => {
  it("analyticsMock.track is a vi.fn()", () => {
    expect(vi.isMockFunction(analyticsMock.track)).toBe(true);
  });

  it("refreshSessionMock.ensureFreshToken resolves without error", async () => {
    await expect(refreshSessionMock.ensureFreshToken()).resolves.toBeUndefined();
  });

  it("signInUrlMock.buildSignInUrl appends returnTo query param", () => {
    const url = signInUrlMock.buildSignInUrl("/dashboard");
    expect(url).toContain("returnTo=/dashboard");
  });

  it("issuerUtilsMock.getIssuerRune returns a rune string", () => {
    expect(typeof issuerUtilsMock.getIssuerRune()).toBe("string");
    expect(issuerUtilsMock.getIssuerRune().length).toBeGreaterThan(0);
  });

  it("cardLimitMockAllowed.canAddCard returns allowed: true", () => {
    expect(cardLimitMockAllowed.canAddCard().allowed).toBe(true);
  });

  it("entitlementCacheMock.getEntitlementCache returns null", () => {
    expect(entitlementCacheMock.getEntitlementCache()).toBeNull();
  });

  it("trialUtilsMockLimit.THRALL_CARD_LIMIT is a positive number", () => {
    expect(trialUtilsMockLimit.THRALL_CARD_LIMIT).toBeGreaterThan(0);
  });

  it("trialUtilsMockToastKey.LS_TRIAL_START_TOAST_SHOWN is a non-empty string", () => {
    expect(typeof trialUtilsMockToastKey.LS_TRIAL_START_TOAST_SHOWN).toBe("string");
    expect(trialUtilsMockToastKey.LS_TRIAL_START_TOAST_SHOWN.length).toBeGreaterThan(0);
  });

  it("sonnerMock.toast is a vi.fn() with error and success sub-methods", () => {
    expect(vi.isMockFunction(sonnerMock.toast)).toBe(true);
    expect(vi.isMockFunction(sonnerMock.toast.error)).toBe(true);
    expect(vi.isMockFunction(sonnerMock.toast.success)).toBe(true);
  });

  it("sonnerToasterMock.Toaster renders null", () => {
    const { container } = render(React.createElement(sonnerToasterMock.Toaster));
    expect(container.firstChild).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// component-mocks
// ══════════════════════════════════════════════════════════════════════════════

describe("component-mocks — stub rendering", () => {
  it("cardTileMock renders the card name with testid", () => {
    const { CardTile } = cardTileMock;
    render(React.createElement(CardTile, { card: { cardName: "Visa Gold" } }));
    expect(screen.getByTestId("card-tile-Visa Gold")).toBeInTheDocument();
    expect(screen.getByText("Visa Gold")).toBeInTheDocument();
  });

  it("emptyStateMock renders empty-state testid", () => {
    const { EmptyState } = emptyStateMock;
    render(React.createElement(EmptyState));
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("karlUpsellDialogMock shows dialog and dismiss button when open=true", () => {
    const { KarlUpsellDialog } = karlUpsellDialogMock;
    const onDismiss = vi.fn();
    render(
      React.createElement(KarlUpsellDialog, { open: true, onDismiss }),
    );
    expect(screen.getByTestId("karl-upsell-dialog")).toBeInTheDocument();
    screen.getByRole("button", { name: "Dismiss" }).click();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("karlUpsellDialogMock renders nothing when open=false", () => {
    const { KarlUpsellDialog } = karlUpsellDialogMock;
    const { container } = render(
      React.createElement(KarlUpsellDialog, {
        open: false,
        onDismiss: vi.fn(),
      }),
    );
    expect(container.firstChild).toBeNull();
  });

  it("nextLinkMock renders an anchor element with href", () => {
    const { default: Link } = nextLinkMock;
    render(React.createElement(Link, { href: "/test" }, "Click"));
    const anchor = screen.getByRole("link", { name: "Click" });
    expect(anchor).toHaveAttribute("href", "/test");
  });

  it("themeToggleMock.cycleTheme toggles between dark and light", () => {
    expect(themeToggleMock.cycleTheme("dark")).toBe("light");
    expect(themeToggleMock.cycleTheme("light")).toBe("dark");
  });

  it("gleipnirBearSinewsMock fragment hook returns open=false", () => {
    expect(gleipnirBearSinewsMock.useGleipnirFragment4().open).toBe(false);
  });

  it("gleipnirMountainRootsMock fragment hook returns open=false", () => {
    expect(gleipnirMountainRootsMock.useGleipnirFragment3().open).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// dialog-mocks
// ══════════════════════════════════════════════════════════════════════════════

describe("dialog-mocks — framerMotionMock", () => {
  it("motion.div renders children", () => {
    const { motion } = framerMotionMock;
    render(React.createElement(motion.div, {}, "inner text"));
    expect(screen.getByText("inner text")).toBeInTheDocument();
  });

  it("AnimatePresence renders its children", () => {
    const { AnimatePresence } = framerMotionMock;
    render(
      React.createElement(
        AnimatePresence,
        {},
        React.createElement("span", {}, "animated"),
      ),
    );
    expect(screen.getByText("animated")).toBeInTheDocument();
  });

  it("useReducedMotion returns true", () => {
    expect(framerMotionMock.useReducedMotion()).toBe(true);
  });
});

describe("dialog-mocks — makeRadixDialogMock", () => {
  it("produces Root, Portal, Overlay, Content, Close, Title, Description", () => {
    const mock = makeRadixDialogMock({});
    expect(mock.Root).toBeDefined();
    expect(mock.Portal).toBeDefined();
    expect(mock.Overlay).toBeDefined();
    expect(mock.Content).toBeDefined();
    expect(mock.Close).toBeDefined();
    expect(mock.Title).toBeDefined();
    expect(mock.Description).toBeDefined();
  });

  it("Content renders with role=dialog", () => {
    const { Content } = makeRadixDialogMock({});
    render(React.createElement(Content, {}, "dialog body"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("dialog body")).toBeInTheDocument();
  });

  it("Close renders a button with aria-label=Close", () => {
    const { Close } = makeRadixDialogMock({});
    render(React.createElement(Close, {}, "×"));
    const btn = screen.getByRole("button", { name: "Close" });
    expect(btn).toBeInTheDocument();
  });

  it("Root renders children when open is undefined (truthy)", () => {
    const { Root, Content } = makeRadixDialogMock({});
    render(
      React.createElement(Root, {}, React.createElement(Content, {}, "visible")),
    );
    expect(screen.getByText("visible")).toBeInTheDocument();
  });

  it("Root renders nothing when open=false", () => {
    const { Root } = makeRadixDialogMock({});
    const { container } = render(
      React.createElement(Root, { open: false }, React.createElement("span", {}, "hidden")),
    );
    expect(container.firstChild).toBeNull();
  });

  it("spreads actual module exports so real sub-components are preserved", () => {
    const fakeActual = { Trigger: () => null, Foo: "bar" };
    const mock = makeRadixDialogMock(fakeActual as Record<string, unknown>);
    expect(mock.Foo).toBe("bar");
  });

  it("animatedCardGridMock renders cards via renderCard callback", () => {
    const { AnimatedCardGrid } = animatedCardGridMock;
    const cards = [
      { id: "1", cardName: "Alpha" },
      { id: "2", cardName: "Beta" },
    ];
    render(
      React.createElement(AnimatedCardGrid, {
        cards,
        renderCard: (card) =>
          React.createElement("span", { key: card.id }, card.cardName),
      }),
    );
    expect(screen.getByTestId("card-grid")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });
});

// ── Cross-factory: trialBadgeMock / marketingNavLinksMock render null ─────────

describe("component-mocks — null stubs", () => {
  it("trialBadgeMock.TrialBadge renders null", () => {
    const { container } = render(React.createElement(trialBadgeMock.TrialBadge));
    expect(container.firstChild).toBeNull();
  });

  it("marketingNavLinksMock.MarketingNavLinks renders null", () => {
    const { container } = render(
      React.createElement(marketingNavLinksMock.MarketingNavLinks),
    );
    expect(container.firstChild).toBeNull();
  });
});
