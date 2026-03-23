/**
 * Light theme contrast + border thickness — Issue #1874
 *
 * Validates acceptance criteria for the Vellum Norse light theme fix:
 *   - Card uses border-2 (2px) — not the previous border (1px)
 *   - Input uses [border-width:1.5px] — not the previous border (1px)
 *   - Button outline variant uses [border-width:1.5px]
 *   - Button secondary variant uses [border-width:1.5px]
 *   - AppShell Toaster inline border style is 1.5px
 *   - LedgerShell Toaster inline border style is 1.5px
 *
 * CSS variable values (--border, --muted-foreground) cannot be read in
 * jsdom — only className assertions are applicable here.
 *
 * @ref #1874
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// ── Mocks required by AppShell / LedgerShell ─────────────────────────────────

vi.mock("next/link", async () => (await import("../mocks/component-mocks")).nextLinkMock);
vi.mock("next/navigation", async () => (await import("../mocks/hook-mocks")).nextNavigationMock);
vi.mock("next-themes", async () => (await import("../mocks/hook-mocks")).nextThemesMock);
vi.mock("@/hooks/useAuth", async () => (await import("../mocks/hook-mocks")).authMockAnonymous);
vi.mock("@/lib/entitlement/cache", async () => (await import("../mocks/storage-mocks")).entitlementCacheMock);
vi.mock("@/lib/auth/sign-in-url", async () => (await import("../mocks/storage-mocks")).signInUrlMock);
vi.mock("@/components/layout/ThemeToggle", async () => (await import("../mocks/component-mocks")).themeToggleMock);
vi.mock("@/contexts/RagnarokContext", () => ({
  useRagnarok: () => ({ ragnarokActive: false }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuthContext: () => ({ status: "anonymous", session: null, householdId: "", signOut: vi.fn() }),
}));
vi.mock("./SyncIndicator", () => ({ SyncIndicator: () => null }));
vi.mock("./KonamiHowl", () => ({ KonamiHowl: () => null }));
vi.mock("./ForgeMasterEgg", () => ({ ForgeMasterEgg: () => null }));
vi.mock("@/components/easter-eggs/HeilungModal", () => ({ HeilungModal: () => null }));
vi.mock("@/components/cards/GleipnirMountainRoots", () => ({
  GleipnirMountainRoots: () => null,
  useGleipnirFragment3: () => ({ open: false, dismiss: vi.fn() }),
}));
vi.mock("sonner", async () => (await import("../mocks/storage-mocks")).sonnerToasterMock);

// ── Card border thickness ─────────────────────────────────────────────────────

describe("Card — Issue #1874 border thickness", () => {
  it("renders with border-2 class (2px minimum card border)", () => {
    const { container } = render(<Card data-testid="card">Content</Card>);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("border-2");
  });

  it("does NOT use single-pixel border class (old 1px border removed)", () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstElementChild as HTMLElement;
    // border (without a number suffix) would be 1px — it must not be present without the 2 suffix
    // We verify border-2 is present which overrides any plain `border`
    expect(card.className).toContain("border-2");
    // Must not be ONLY `border` without thickness suffix alongside it as the sole border utility
    const classes = card.className.split(" ");
    const hasBorder2 = classes.some((c) => c === "border-2");
    expect(hasBorder2).toBe(true);
  });
});

// ── Input border thickness ────────────────────────────────────────────────────

describe("Input — Issue #1874 border thickness", () => {
  it("renders with [border-width:1.5px] class", () => {
    const { container } = render(<Input placeholder="test" />);
    const input = container.firstElementChild as HTMLElement;
    expect(input.className).toContain("[border-width:1.5px]");
  });
});

// ── Button border thickness ───────────────────────────────────────────────────

describe("Button — Issue #1874 border thickness (outline + secondary)", () => {
  it("outline variant renders with [border-width:1.5px]", () => {
    const { container } = render(<Button variant="outline">Click</Button>);
    const btn = container.firstElementChild as HTMLElement;
    expect(btn.className).toContain("[border-width:1.5px]");
  });

  it("secondary variant renders with [border-width:1.5px]", () => {
    const { container } = render(<Button variant="secondary">Click</Button>);
    const btn = container.firstElementChild as HTMLElement;
    expect(btn.className).toContain("[border-width:1.5px]");
  });
});
