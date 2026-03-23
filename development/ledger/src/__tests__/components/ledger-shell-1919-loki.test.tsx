/**
 * LedgerShell — Issue #1919 scroll-overflow layout fix
 *
 * Validates that the inner content wrapper uses flex-col so that flex-1 on
 * <main> allocates a definite HEIGHT (not width), creating a properly bounded
 * scroll container. Before the fix the wrapper was flex ROW; flex-1 on main
 * gave it width from the cross-axis which some browsers don't treat as definite
 * for overflow purposes, causing excess whitespace below the footer.
 *
 * Tests:
 *   - Inner wrapper has flex-col class (mounted render)
 *   - Inner wrapper has flex-1 and overflow-hidden (mounted render)
 *   - <main> has flex-1 class (mounted render)
 *   - <main> has overflow-auto class (mounted render)
 *   - SSR placeholder wrapper also has flex-col class (pre-mount render)
 *   - SSR placeholder <main> has flex-1 and overflow-auto
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { LedgerShell } from "@/components/layout/LedgerShell";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/link", async () => (await import("../mocks/component-mocks")).nextLinkMock);
vi.mock("next/navigation", async () => (await import("../mocks/hook-mocks")).nextNavigationLedgerMock);
vi.mock("next-themes", async () => (await import("../mocks/hook-mocks")).nextThemesMock);
vi.mock("@/hooks/useAuth", async () => (await import("../mocks/hook-mocks")).authMockAnonymous);
vi.mock("@/lib/entitlement/cache", async () => (await import("../mocks/storage-mocks")).entitlementCacheMock);
vi.mock("@/components/layout/ThemeToggle", async () => (await import("../mocks/component-mocks")).themeToggleMock);
vi.mock("@/contexts/RagnarokContext", async () => (await import("../mocks/hook-mocks")).ragnarokContextMock);
vi.mock("@/contexts/AuthContext", async () => (await import("../mocks/hook-mocks")).authContextMockAnon);
vi.mock("sonner", async () => (await import("../mocks/storage-mocks")).sonnerToasterMock);

vi.mock("@/components/layout/LedgerTopBar", () => ({
  LedgerTopBar: () => <header role="banner">TopBar</header>,
}));
vi.mock("@/components/layout/LedgerBottomTabs", () => ({
  LedgerBottomTabs: () => null,
}));
vi.mock("@/components/layout/SyncIndicator", () => ({
  SyncIndicator: () => null,
}));
vi.mock("@/components/layout/KonamiHowl", () => ({
  KonamiHowl: () => null,
}));
vi.mock("@/components/layout/ForgeMasterEgg", () => ({
  ForgeMasterEgg: () => null,
}));
vi.mock("@/components/easter-eggs/HeilungModal", () => ({
  HeilungModal: () => null,
}));
vi.mock("@/components/trial/TrialDay15Modal", () => ({
  TrialDay15Modal: () => null,
}));
vi.mock("@/components/trial/TrialExpiryModal", () => ({
  TrialExpiryModal: () => null,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderShell() {
  return render(
    <LedgerShell>
      <p data-testid="page-content">Card edit content</p>
    </LedgerShell>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("LedgerShell — issue #1919 scroll-overflow fix", () => {
  it("main element has flex-1 class (definite height allocation)", () => {
    renderShell();
    const main = screen.getByRole("main");
    expect(main.classList.contains("flex-1")).toBe(true);
  });

  it("main element has overflow-auto class (bounded scroll container)", () => {
    renderShell();
    const main = screen.getByRole("main");
    expect(main.classList.contains("overflow-auto")).toBe(true);
  });

  it("inner wrapper (parent of main) has flex-col class (fix: not flex-row)", () => {
    renderShell();
    const main = screen.getByRole("main");
    const wrapper = main.parentElement!;
    expect(wrapper.classList.contains("flex-col")).toBe(true);
  });

  it("inner wrapper has flex-1 to fill remaining vertical space", () => {
    renderShell();
    const main = screen.getByRole("main");
    const wrapper = main.parentElement!;
    expect(wrapper.classList.contains("flex-1")).toBe(true);
  });

  it("inner wrapper has overflow-hidden to clip content below footer", () => {
    renderShell();
    const main = screen.getByRole("main");
    const wrapper = main.parentElement!;
    expect(wrapper.classList.contains("overflow-hidden")).toBe(true);
  });

  it("outer root div has flex-col so top bar and content stack vertically", () => {
    renderShell();
    const main = screen.getByRole("main");
    const outerDiv = main.parentElement!.parentElement!;
    expect(outerDiv.classList.contains("flex-col")).toBe(true);
  });

  it("outer root div has h-screen to constrain total height", () => {
    renderShell();
    const main = screen.getByRole("main");
    const outerDiv = main.parentElement!.parentElement!;
    expect(outerDiv.classList.contains("h-screen")).toBe(true);
  });

  it("renders children inside main (content visible to user)", () => {
    renderShell();
    expect(screen.getByTestId("page-content")).toBeDefined();
  });
});

describe("LedgerShell — SSR placeholder (pre-mount) — issue #1919", () => {
  it("SSR placeholder inner wrapper has flex-col class", () => {
    // Prevent useEffect from firing so we get the SSR placeholder render.
    const effectSpy = vi.spyOn(React, "useEffect").mockImplementation(() => {});
    const { container } = render(
      <LedgerShell>
        <p>SSR content</p>
      </LedgerShell>
    );
    effectSpy.mockRestore();

    // SSR placeholder: outer div > inner div > main
    const mainEl = container.querySelector("main");
    expect(mainEl).not.toBeNull();
    const wrapper = mainEl!.parentElement!;
    expect(wrapper.classList.contains("flex-col")).toBe(true);
  });

  it("SSR placeholder main has flex-1 and overflow-auto", () => {
    const effectSpy = vi.spyOn(React, "useEffect").mockImplementation(() => {});
    const { container } = render(
      <LedgerShell>
        <p>SSR content</p>
      </LedgerShell>
    );
    effectSpy.mockRestore();

    const mainEl = container.querySelector("main");
    expect(mainEl).not.toBeNull();
    expect(mainEl!.classList.contains("flex-1")).toBe(true);
    expect(mainEl!.classList.contains("overflow-auto")).toBe(true);
  });
});
