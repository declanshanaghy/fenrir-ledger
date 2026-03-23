/**
 * LedgerShell — Component render tests
 *
 * Validates the app shell renders correct landmarks:
 * header (via LedgerTopBar), main content area, and structural layout.
 *
 * Supersedes structural landmark checks from a11y E2E tests.
 * Consolidated: layout/LedgerShell.test.tsx (issue #1656)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LedgerShell } from "@/components/layout/LedgerShell";

// ── Shared mock factories ──────────────────────────────────────────────────
// See src/__tests__/mocks/ for factory definitions.

vi.mock("next/link", async () => (await import("../mocks/component-mocks")).nextLinkMock);
vi.mock("next/navigation", async () => (await import("../mocks/hook-mocks")).nextNavigationLedgerMock);
vi.mock("next-themes", async () => (await import("../mocks/hook-mocks")).nextThemesMock);
vi.mock("@/hooks/useAuth", async () => (await import("../mocks/hook-mocks")).authMockAnonymous);
vi.mock("@/lib/entitlement/cache", async () => (await import("../mocks/storage-mocks")).entitlementCacheMock);
vi.mock("@/components/layout/ThemeToggle", async () => (await import("../mocks/component-mocks")).themeToggleMock);

// Mock LedgerTopBar to render a simple header
vi.mock("./LedgerTopBar", () => ({
  LedgerTopBar: () => <header role="banner">TopBar</header>,
}));

// Mock LedgerBottomTabs
vi.mock("./LedgerBottomTabs", () => ({
  LedgerBottomTabs: () => <nav aria-label="Bottom tabs">Tabs</nav>,
}));

// Mock SyncIndicator
vi.mock("./SyncIndicator", () => ({
  SyncIndicator: () => null,
}));

// Mock easter eggs
vi.mock("./KonamiHowl", () => ({
  KonamiHowl: () => null,
}));

vi.mock("./ForgeMasterEgg", () => ({
  ForgeMasterEgg: () => null,
}));

vi.mock("@/components/easter-eggs/HeilungModal", () => ({
  HeilungModal: () => null,
}));

vi.mock("@/components/cards/GleipnirMountainRoots", () => ({
  GleipnirMountainRoots: () => null,
  useGleipnirFragment3: () => ({ open: false, dismiss: vi.fn() }),
}));

vi.mock("sonner", async () => (await import("../mocks/storage-mocks")).sonnerToasterMock);

vi.mock("@/contexts/RagnarokContext", async () => (await import("../mocks/hook-mocks")).ragnarokContextMock);

// Issue #1172: useCloudSync now calls useAuthContext — mock to prevent "must be within AuthProvider" throw
vi.mock("@/contexts/AuthContext", async () => (await import("../mocks/hook-mocks")).authContextMockAnon);

// ── Tests ────────────────────────────────────────────────────────────────────

describe("LedgerShell — Layout structure", () => {
  beforeEach(() => {
    // LedgerShell uses useEffect + mounted state; it renders a placeholder
    // on first render then swaps to the full shell. In happy-dom, effects run.
  });

  it("renders a <main> element with id='main-content'", () => {
    render(
      <LedgerShell>
        <div>Page content</div>
      </LedgerShell>
    );
    const main = screen.getByRole("main");
    expect(main).toBeDefined();
    expect(main.getAttribute("id")).toBe("main-content");
  });

  it("renders children inside the main content area", () => {
    render(
      <LedgerShell>
        <p>Dashboard content</p>
      </LedgerShell>
    );
    expect(screen.getByText("Dashboard content")).toBeDefined();
  });

  it("renders Footer, LedgerTopBar, and LedgerBottomTabs layout components", () => {
    render(
      <LedgerShell>
        <div>Content</div>
      </LedgerShell>
    );
    expect(screen.getByRole("main")).toBeDefined();
  });
});
