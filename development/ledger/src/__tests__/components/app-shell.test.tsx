/**
 * AppShell — Component render tests
 *
 * Validates the marketing-site app shell renders correct landmarks:
 * header (via TopBar), main content area, and footer.
 *
 * Supersedes structural landmark checks from a11y E2E tests (TC-A01..A04).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "@/components/layout/AppShell";

// ── Shared mock factories ──────────────────────────────────────────────────
// See src/__tests__/mocks/ for factory definitions.

vi.mock("next/link", async () => (await import("../mocks/component-mocks")).nextLinkMock);
vi.mock("next/navigation", async () => (await import("../mocks/hook-mocks")).nextNavigationMock);
vi.mock("next-themes", async () => (await import("../mocks/hook-mocks")).nextThemesMock);
vi.mock("@/hooks/useAuth", async () => (await import("../mocks/hook-mocks")).authMockAnonymous);
vi.mock("@/lib/entitlement/cache", async () => (await import("../mocks/storage-mocks")).entitlementCacheMock);
vi.mock("@/lib/auth/sign-in-url", async () => (await import("../mocks/storage-mocks")).signInUrlMock);
vi.mock("@/components/layout/ThemeToggle", async () => (await import("../mocks/component-mocks")).themeToggleMock);

// Mock Footer to render a simple footer
vi.mock("./Footer", () => ({
  Footer: () => (
    <footer role="contentinfo" aria-label="App footer">
      Footer
    </footer>
  ),
}));

vi.mock("./SyncIndicator", () => ({ SyncIndicator: () => null }));
vi.mock("./KonamiHowl", () => ({ KonamiHowl: () => null }));
vi.mock("./ForgeMasterEgg", () => ({ ForgeMasterEgg: () => null }));
vi.mock("@/components/easter-eggs/HeilungModal", () => ({
  HeilungModal: () => null,
}));
vi.mock("@/components/cards/GleipnirMountainRoots", () => ({
  GleipnirMountainRoots: () => null,
  useGleipnirFragment3: () => ({ open: false, dismiss: vi.fn() }),
}));
vi.mock("sonner", () => ({ Toaster: () => null }));
vi.mock("@/contexts/RagnarokContext", () => ({
  useRagnarok: () => ({ ragnarokActive: false }),
}));

// Issue #1172: useCloudSync now calls useAuthContext — mock to prevent "must be within AuthProvider" throw
vi.mock("@/contexts/AuthContext", () => ({
  useAuthContext: () => ({ status: "anonymous", session: null, householdId: "", signOut: vi.fn() }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe("AppShell — Layout landmarks", () => {
  it("renders a <main> element", () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );
    const main = screen.getByRole("main");
    expect(main).toBeDefined();
  });

  it("renders a <footer> landmark", () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );
    const footer = screen.getByRole("contentinfo");
    expect(footer).toBeDefined();
  });

  it("renders children inside the main content area", () => {
    render(
      <AppShell>
        <p>Marketing page content</p>
      </AppShell>
    );
    expect(screen.getByText("Marketing page content")).toBeDefined();
  });
});
