/**
 * LedgerBottomTabs — Loki QA gap tests (Issue #1691)
 *
 * Augments FiremanDecko's 13 tests with behavioural gaps:
 *   - localStorage write on tab activation
 *   - Off-dashboard navigation via window.location.href
 *   - Upsell dialog dismiss
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────────────

let mockPathname = "/ledger";
let mockActiveTab: string | null = null;

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => ({
    get: (key: string) => (key === "tab" ? mockActiveTab : null),
  }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

let mockHasFeature = (_: string) => true;
let mockKarlOrTrial = true;

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => ({ hasFeature: (f: string) => mockHasFeature(f) }),
}));

vi.mock("@/hooks/useIsKarlOrTrial", () => ({
  useIsKarlOrTrial: () => mockKarlOrTrial,
}));

vi.mock("@/components/entitlement/KarlUpsellDialog", () => ({
  KarlUpsellDialog: ({
    open,
    onDismiss,
    title,
  }: {
    open: boolean;
    onDismiss: () => void;
    title?: string;
  }) =>
    open ? (
      <div data-testid="upsell-dialog" role="dialog">
        <span>{title ?? "Upsell"}</span>
        <button onClick={onDismiss} data-testid="upsell-dismiss">
          Dismiss
        </button>
      </div>
    ) : null,
  KARL_UPSELL_VALHALLA: { title: "Valhalla Upsell" },
  KARL_UPSELL_VELOCITY: { title: "Velocity Upsell" },
}));

import { LedgerBottomTabs } from "@/components/layout/LedgerBottomTabs";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderTabs() {
  return render(<LedgerBottomTabs />);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("LedgerBottomTabs — localStorage (Loki #1691)", () => {
  beforeEach(() => {
    mockPathname = "/ledger";
    mockActiveTab = null;
    mockHasFeature = (_: string) => true;
    mockKarlOrTrial = true;
    localStorage.clear();
  });

  it("writes fenrir:dashboard-tab=valhalla to localStorage when Valhalla clicked on dashboard", () => {
    renderTabs();
    fireEvent.click(screen.getByRole("button", { name: "Open Valhalla tab" }));
    expect(localStorage.getItem("fenrir:dashboard-tab")).toBe("valhalla");
  });

  it("writes fenrir:dashboard-tab=hunt to localStorage when Hunt clicked on dashboard", () => {
    renderTabs();
    fireEvent.click(screen.getByRole("button", { name: "Open Hunt tab" }));
    expect(localStorage.getItem("fenrir:dashboard-tab")).toBe("hunt");
  });
});

describe("LedgerBottomTabs — off-dashboard navigation (Loki #1691)", () => {
  let originalHref: string;

  beforeEach(() => {
    mockHasFeature = (_: string) => true;
    mockKarlOrTrial = true;
    mockActiveTab = null;
    originalHref = window.location.href;
    // Patch window.location.href to intercept navigation
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, href: originalHref },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, href: originalHref },
      writable: true,
    });
  });

  it("navigates to /ledger?tab=valhalla when Valhalla clicked off dashboard", () => {
    mockPathname = "/ledger/cards/new";
    renderTabs();
    fireEvent.click(screen.getByRole("button", { name: "Open Valhalla tab" }));
    expect(window.location.href).toBe("/ledger?tab=valhalla");
  });

  it("navigates to /ledger?tab=hunt when Hunt clicked off dashboard", () => {
    mockPathname = "/ledger/cards/new";
    renderTabs();
    fireEvent.click(screen.getByRole("button", { name: "Open Hunt tab" }));
    expect(window.location.href).toBe("/ledger?tab=hunt");
  });
});

describe("LedgerBottomTabs — upsell dialog dismiss (Loki #1691)", () => {
  beforeEach(() => {
    mockPathname = "/ledger";
    mockActiveTab = null;
    mockHasFeature = (_: string) => false;
    mockKarlOrTrial = false;
  });

  it("dismissing Valhalla upsell dialog closes it", () => {
    renderTabs();
    const buttons = screen.getAllByRole("button");
    const valhallaBtn = buttons.find((b) =>
      b.getAttribute("aria-label")?.includes("Valhalla")
    );
    fireEvent.click(valhallaBtn!);
    expect(screen.getByTestId("upsell-dialog")).toBeDefined();
    fireEvent.click(screen.getByTestId("upsell-dismiss"));
    expect(screen.queryByTestId("upsell-dialog")).toBeNull();
  });

  it("dismissing Hunt upsell dialog closes it", () => {
    renderTabs();
    const buttons = screen.getAllByRole("button");
    const huntBtn = buttons.find((b) =>
      b.getAttribute("aria-label")?.includes("Hunt")
    );
    fireEvent.click(huntBtn!);
    expect(screen.getByTestId("upsell-dialog")).toBeDefined();
    fireEvent.click(screen.getByTestId("upsell-dismiss"));
    expect(screen.queryByTestId("upsell-dialog")).toBeNull();
  });
});
