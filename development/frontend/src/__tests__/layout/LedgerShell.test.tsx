/**
 * LedgerShell.test.tsx
 *
 * Vitest suite for LedgerShell component.
 * Tests that the Footer component is properly rendered.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { LedgerShell } from "@/components/layout/LedgerShell";

// Mock child components
vi.mock("@/components/layout/LedgerTopBar", () => ({
  LedgerTopBar: () => <div data-testid="ledger-top-bar">Top Bar</div>,
}));

vi.mock("@/components/layout/LedgerBottomTabs", () => ({
  LedgerBottomTabs: () => <div data-testid="ledger-bottom-tabs">Bottom Tabs</div>,
}));

vi.mock("@/components/layout/Footer", () => ({
  Footer: () => <div data-testid="footer">Footer</div>,
}));

vi.mock("@/components/layout/SyncIndicator", () => ({
  SyncIndicator: () => <div data-testid="sync-indicator">Sync</div>,
}));

vi.mock("@/components/layout/KonamiHowl", () => ({
  KonamiHowl: () => <div data-testid="konami-howl">Konami</div>,
}));

vi.mock("@/components/layout/ForgeMasterEgg", () => ({
  ForgeMasterEgg: () => <div data-testid="forge-master-egg">Forge</div>,
}));

vi.mock("@/components/easter-eggs/HeilungModal", () => ({
  HeilungModal: () => <div data-testid="heilung-modal">Heilung</div>,
}));

vi.mock("@/components/trial/TrialDay15Modal", () => ({
  TrialDay15Modal: () => <div data-testid="trial-day15-modal">Trial Day 15</div>,
}));

vi.mock("@/components/trial/TrialExpiryModal", () => ({
  TrialExpiryModal: () => <div data-testid="trial-expiry-modal">Trial Expiry</div>,
}));

vi.mock("@/components/cards/GleipnirMountainRoots", () => ({
  GleipnirMountainRoots: () => <div data-testid="gleipnir-mountain-roots">Gleipnir</div>,
  useGleipnirFragment3: () => ({
    open: false,
    dismiss: vi.fn(),
  }),
}));

vi.mock("@/contexts/RagnarokContext", () => ({
  useRagnarok: () => ({
    ragnarokActive: false,
  }),
}));

vi.mock("sonner", () => ({
  Toaster: () => <div data-testid="toaster">Toaster</div>,
}));

describe("LedgerShell", () => {
  it("renders Footer component", async () => {
    render(
      <LedgerShell>
        <div>Test Content</div>
      </LedgerShell>
    );

    // Wait for mounted state
    await new Promise((resolve) => setTimeout(resolve, 0));

    const footer = screen.getByTestId("footer");
    expect(footer).toBeInTheDocument();
  });

  it("renders all main layout components", async () => {
    render(
      <LedgerShell>
        <div>Test Content</div>
      </LedgerShell>
    );

    // Wait for mounted state
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByTestId("ledger-top-bar")).toBeInTheDocument();
    expect(screen.getByTestId("ledger-bottom-tabs")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("renders children content", async () => {
    render(
      <LedgerShell>
        <div data-testid="test-content">Test Content</div>
      </LedgerShell>
    );

    // Wait for mounted state
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByTestId("test-content")).toBeInTheDocument();
  });
});
