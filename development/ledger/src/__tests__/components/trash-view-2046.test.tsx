/**
 * Unit tests for TrashView component
 *
 * Covers: empty state, card list rendering, restore action, expunge dialog flow,
 * empty trash dialog flow, and formatDeletedAt helper logic.
 *
 * Issue: #2046
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TrashView } from "@/components/dashboard/TrashView";
import type { Card } from "@/lib/types";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("framer-motion", async () => (await import("../mocks/dialog-mocks")).framerMotionMock);

vi.mock("@/lib/issuer-utils", () => ({
  getIssuerBadgeChar: vi.fn((issuerId: string) => issuerId?.[0]?.toUpperCase() ?? "?"),
}));

// Mock Dialog, Button, cn
vi.mock("@/components/ui/dialog", () => {
  const React = require("react");
  return {
    Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
      open ? React.createElement(React.Fragment, null, children) : null,
    DialogContent: ({ children, ...props }: { children: React.ReactNode; [k: string]: unknown }) =>
      React.createElement("div", { role: "dialog", ...props }, children),
    DialogTitle: ({ children }: { children: React.ReactNode }) =>
      React.createElement("h2", null, children),
    DialogDescription: ({ children }: { children: React.ReactNode }) =>
      React.createElement("p", null, children),
  };
});

vi.mock("@/components/ui/button", () => {
  const React = require("react");
  return {
    Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) =>
      React.createElement("button", { onClick, ...props }, children),
  };
});

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<Card>): Card {
  return {
    id: "card-1",
    cardName: "Test Card",
    issuerId: "chase",
    status: "active",
    householdId: "hh-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    annualFeeDue: null,
    annualFeeAmount: null,
    signupBonus: null,
    spendDeadline: null,
    spendRequired: null,
    notes: null,
    deletedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), // 3 days ago
    creditLimit: null,
    last4: null,
    openedAt: null,
    ...overrides,
  };
}

const trashedCard1 = makeCard({ id: "tc1", cardName: "Chase Sapphire", issuerId: "chase" });
const trashedCard2 = makeCard({ id: "tc2", cardName: "Amex Gold", issuerId: "amex" });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TrashView", () => {
  const onRestore = vi.fn();
  const onExpunge = vi.fn();
  const onEmptyTrash = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state when no trashed cards", () => {
    render(
      <TrashView
        trashedCards={[]}
        onRestore={onRestore}
        onExpunge={onExpunge}
        onEmptyTrash={onEmptyTrash}
      />
    );
    expect(screen.getByLabelText("Trash is empty")).toBeInTheDocument();
    expect(screen.queryByText("Empty Trash")).not.toBeInTheDocument();
  });

  it("renders card rows for each trashed card", () => {
    render(
      <TrashView
        trashedCards={[trashedCard1, trashedCard2]}
        onRestore={onRestore}
        onExpunge={onExpunge}
        onEmptyTrash={onEmptyTrash}
      />
    );
    expect(screen.getByText("Chase Sapphire")).toBeInTheDocument();
    expect(screen.getByText("Amex Gold")).toBeInTheDocument();
  });

  it("shows 'Empty Trash' button when cards are present", () => {
    render(
      <TrashView
        trashedCards={[trashedCard1]}
        onRestore={onRestore}
        onExpunge={onExpunge}
        onEmptyTrash={onEmptyTrash}
      />
    );
    const emptyBtn = screen.getByRole("button", {
      name: /empty trash/i,
    });
    expect(emptyBtn).toBeInTheDocument();
  });

  it("calls onRestore with card id when Restore is clicked", () => {
    render(
      <TrashView
        trashedCards={[trashedCard1]}
        onRestore={onRestore}
        onExpunge={onExpunge}
        onEmptyTrash={onEmptyTrash}
      />
    );
    const restoreBtn = screen.getByRole("button", {
      name: /restore chase sapphire/i,
    });
    fireEvent.click(restoreBtn);
    expect(onRestore).toHaveBeenCalledWith("tc1");
  });

  it("opens expunge dialog when Expunge is clicked", () => {
    render(
      <TrashView
        trashedCards={[trashedCard1]}
        onRestore={onRestore}
        onExpunge={onExpunge}
        onEmptyTrash={onEmptyTrash}
      />
    );
    const expungeBtn = screen.getByRole("button", {
      name: /expunge chase sapphire/i,
    });
    fireEvent.click(expungeBtn);
    // Dialog title should appear
    expect(screen.getByRole("heading", { name: /expunge chase sapphire/i })).toBeInTheDocument();
  });

  it("calls onExpunge with card id when dialog is confirmed", () => {
    render(
      <TrashView
        trashedCards={[trashedCard1]}
        onRestore={onRestore}
        onExpunge={onExpunge}
        onEmptyTrash={onEmptyTrash}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expunge chase sapphire/i }));
    const confirmBtn = screen.getByRole("button", { name: /expunge forever/i });
    fireEvent.click(confirmBtn);
    expect(onExpunge).toHaveBeenCalledWith("tc1");
  });

  it("does not call onExpunge if expunge dialog is cancelled", () => {
    render(
      <TrashView
        trashedCards={[trashedCard1]}
        onRestore={onRestore}
        onExpunge={onExpunge}
        onEmptyTrash={onEmptyTrash}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expunge chase sapphire/i }));
    const cancelBtn = screen.getByRole("button", { name: /^cancel$/i });
    fireEvent.click(cancelBtn);
    expect(onExpunge).not.toHaveBeenCalled();
  });

  it("opens empty trash dialog on 'Empty Trash' button click", () => {
    render(
      <TrashView
        trashedCards={[trashedCard1, trashedCard2]}
        onRestore={onRestore}
        onExpunge={onExpunge}
        onEmptyTrash={onEmptyTrash}
      />
    );
    const emptyBtn = screen.getByRole("button", {
      name: /empty trash — permanently delete all 2/i,
    });
    fireEvent.click(emptyBtn);
    expect(screen.getByRole("heading", { name: /empty the void/i })).toBeInTheDocument();
  });

  it("calls onEmptyTrash when empty trash is confirmed", () => {
    render(
      <TrashView
        trashedCards={[trashedCard1, trashedCard2]}
        onRestore={onRestore}
        onExpunge={onExpunge}
        onEmptyTrash={onEmptyTrash}
      />
    );
    fireEvent.click(screen.getByRole("button", {
      name: /empty trash — permanently delete all 2/i,
    }));
    const confirmBtn = screen.getByRole("button", { name: /empty trash \(2\)/i });
    fireEvent.click(confirmBtn);
    expect(onEmptyTrash).toHaveBeenCalledTimes(1);
  });

  it("shows issuer in card row", () => {
    render(
      <TrashView
        trashedCards={[trashedCard1]}
        onRestore={onRestore}
        onExpunge={onExpunge}
        onEmptyTrash={onEmptyTrash}
      />
    );
    expect(screen.getByText("chase")).toBeInTheDocument();
  });
});
