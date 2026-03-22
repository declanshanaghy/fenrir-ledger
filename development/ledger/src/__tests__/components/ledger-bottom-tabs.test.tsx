/**
 * LedgerBottomTabs — unit tests (Issue #1691)
 *
 * Validates refactored bottom tab bar:
 * - Dashboard, Add Card, Valhalla, Hunt tabs render
 * - Active state applied correctly per pathname/searchParams
 * - Gated tabs show lock rune for Thrall users
 * - Gated tabs trigger upsell dialog for Thrall users
 * - Gated tabs dispatch tab events / navigate for entitled users
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
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

let mockHasFeature = (_: string) => false;
let mockKarlOrTrial = false;

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => ({ hasFeature: (f: string) => mockHasFeature(f) }),
}));

vi.mock("@/hooks/useIsKarlOrTrial", () => ({
  useIsKarlOrTrial: () => mockKarlOrTrial,
}));

vi.mock("@/components/entitlement/KarlUpsellDialog", () => ({
  KarlUpsellDialog: ({ open, onDismiss, title }: { open: boolean; onDismiss: () => void; title?: string }) =>
    open ? (
      <div data-testid="upsell-dialog" onClick={onDismiss}>
        {title ?? "Upsell"}
      </div>
    ) : null,
  KARL_UPSELL_VALHALLA: { title: "Valhalla Upsell" },
  KARL_UPSELL_VELOCITY: { title: "Velocity Upsell" },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { LedgerBottomTabs } from "@/components/layout/LedgerBottomTabs";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderTabs() {
  return render(<LedgerBottomTabs />);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("LedgerBottomTabs — structure", () => {
  beforeEach(() => {
    mockPathname = "/ledger";
    mockActiveTab = null;
    mockHasFeature = (_: string) => false;
    mockKarlOrTrial = false;
  });

  it("renders a nav with App tabs label", () => {
    renderTabs();
    expect(screen.getByRole("navigation", { name: "App tabs" })).toBeDefined();
  });

  it("renders Dashboard, Add, Valhalla, Hunt tabs", () => {
    renderTabs();
    expect(screen.getByText("Dashboard")).toBeDefined();
    expect(screen.getByText("Add")).toBeDefined();
    expect(screen.getByText("Valhalla")).toBeDefined();
    expect(screen.getByText("Hunt")).toBeDefined();
  });
});

describe("LedgerBottomTabs — active state", () => {
  beforeEach(() => {
    mockHasFeature = (_: string) => true;
    mockKarlOrTrial = true;
  });

  it("Dashboard link has aria-current=page on /ledger with no tab", () => {
    mockPathname = "/ledger";
    mockActiveTab = null;
    renderTabs();
    const link = screen.getByRole("link", { name: /Dashboard/i });
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  it("Dashboard link does not have aria-current when valhalla tab active", () => {
    mockPathname = "/ledger";
    mockActiveTab = "valhalla";
    renderTabs();
    const link = screen.getByRole("link", { name: /Dashboard/i });
    expect(link.getAttribute("aria-current")).toBeNull();
  });

  it("Add link has aria-current=page on /ledger/cards/new", () => {
    mockPathname = "/ledger/cards/new";
    mockActiveTab = null;
    renderTabs();
    const link = screen.getByRole("link", { name: /Add/i });
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  it("Valhalla button has aria-current=page when valhalla tab active and entitled", () => {
    mockPathname = "/ledger";
    mockActiveTab = "valhalla";
    renderTabs();
    const btn = screen.getByRole("button", { name: "Open Valhalla tab" });
    expect(btn.getAttribute("aria-current")).toBe("page");
  });

  it("Hunt button has aria-current=page when hunt tab active and entitled", () => {
    mockPathname = "/ledger";
    mockActiveTab = "hunt";
    renderTabs();
    const btn = screen.getByRole("button", { name: "Open Hunt tab" });
    expect(btn.getAttribute("aria-current")).toBe("page");
  });
});

describe("LedgerBottomTabs — Thrall gating (no entitlement)", () => {
  beforeEach(() => {
    mockPathname = "/ledger";
    mockActiveTab = null;
    mockHasFeature = (_: string) => false;
    mockKarlOrTrial = false;
  });

  it("shows lock rune (ᚠ) on Valhalla tab for Thrall users", () => {
    renderTabs();
    const runeMarkers = document.querySelectorAll(".karl-gate-marker");
    expect(runeMarkers.length).toBeGreaterThanOrEqual(1);
  });

  it("Valhalla button has locked aria-label for Thrall users", () => {
    renderTabs();
    const btns = screen.getAllByRole("button", { name: /Karl tier required/ });
    // Both Valhalla and Hunt have locked labels when Thrall
    expect(btns.length).toBe(2);
    const valhallaBtn = btns.find((b) => b.getAttribute("aria-label")?.includes("Valhalla"));
    expect(valhallaBtn).toBeDefined();
  });

  it("clicking Valhalla opens upsell dialog for Thrall users", () => {
    renderTabs();
    // Find button by partial locked label match
    const buttons = screen.getAllByRole("button");
    const valhallaBtn = buttons.find((b) =>
      b.getAttribute("aria-label")?.includes("Valhalla")
    );
    expect(valhallaBtn).toBeDefined();
    fireEvent.click(valhallaBtn!);
    expect(screen.getByTestId("upsell-dialog")).toBeDefined();
  });

  it("clicking Hunt opens velocity upsell dialog for Thrall users", () => {
    renderTabs();
    const buttons = screen.getAllByRole("button");
    const huntBtn = buttons.find((b) =>
      b.getAttribute("aria-label")?.includes("Hunt")
    );
    expect(huntBtn).toBeDefined();
    fireEvent.click(huntBtn!);
    expect(screen.getByTestId("upsell-dialog")).toBeDefined();
  });
});

describe("LedgerBottomTabs — entitled user tab dispatch", () => {
  beforeEach(() => {
    mockHasFeature = (_: string) => true;
    mockKarlOrTrial = true;
    mockPathname = "/ledger";
    mockActiveTab = null;
  });

  it("dispatches fenrir:activate-tab event when clicking Valhalla on dashboard", () => {
    const dispatched: CustomEvent[] = [];
    const handler = (e: Event) => dispatched.push(e as CustomEvent);
    window.addEventListener("fenrir:activate-tab", handler);

    renderTabs();
    fireEvent.click(screen.getByRole("button", { name: "Open Valhalla tab" }));

    expect(dispatched.length).toBe(1);
    expect(dispatched[0].detail.tab).toBe("valhalla");

    window.removeEventListener("fenrir:activate-tab", handler);
  });

  it("dispatches fenrir:activate-tab event when clicking Hunt on dashboard", () => {
    const dispatched: CustomEvent[] = [];
    const handler = (e: Event) => dispatched.push(e as CustomEvent);
    window.addEventListener("fenrir:activate-tab", handler);

    renderTabs();
    fireEvent.click(screen.getByRole("button", { name: "Open Hunt tab" }));

    expect(dispatched.length).toBe(1);
    expect(dispatched[0].detail.tab).toBe("hunt");

    window.removeEventListener("fenrir:activate-tab", handler);
  });
});
