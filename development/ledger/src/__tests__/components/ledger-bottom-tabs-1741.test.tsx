/**
 * LedgerBottomTabs — QA tests for issue #1741.
 *
 * Validates:
 * - Hunt tab appears before Valhalla tab in the mobile bottom nav (spec: Hunt before Valhalla)
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

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

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => ({ hasFeature: () => true }),
}));

vi.mock("@/hooks/useIsKarlOrTrial", () => ({
  useIsKarlOrTrial: () => true,
}));

vi.mock("@/components/entitlement/KarlUpsellDialog", () => ({
  KarlUpsellDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="upsell-dialog" /> : null,
  KARL_UPSELL_VALHALLA: {},
  KARL_UPSELL_VELOCITY: {},
}));

import { LedgerBottomTabs } from "@/components/layout/LedgerBottomTabs";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("LedgerBottomTabs #1741 — Hunt before Valhalla", () => {
  beforeEach(() => {
    mockPathname = "/ledger";
    mockActiveTab = null;
  });

  it("Hunt tab appears before Valhalla tab in DOM order", () => {
    render(<LedgerBottomTabs />);
    const huntBtn = screen.getByRole("button", { name: "Open Hunt tab" });
    const valhallaBtn = screen.getByRole("button", { name: "Open Valhalla tab" });

    const allButtons = Array.from(document.querySelectorAll("button"));
    const huntIndex = allButtons.indexOf(huntBtn);
    const valhallaIndex = allButtons.indexOf(valhallaBtn);

    expect(huntIndex).toBeLessThan(valhallaIndex);
  });

  it("both Hunt and Valhalla tabs are present in mobile nav", () => {
    render(<LedgerBottomTabs />);
    expect(screen.getByRole("button", { name: "Open Hunt tab" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Open Valhalla tab" })).toBeDefined();
  });
});
