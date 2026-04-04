/**
 * Unit tests for SubscriptionGate component
 *
 * Covers: loading skeleton, children rendered when feature unlocked,
 * upsell section when feature locked, and SealedRuneModal opens on CTA click.
 *
 * Issue: #2046
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SubscriptionGate } from "@/components/entitlement/SubscriptionGate";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockHasFeature = vi.hoisted(() => vi.fn());
const mockIsLoading = vi.hoisted(() => ({ value: false }));

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => ({
    hasFeature: mockHasFeature,
    isLoading: mockIsLoading.value,
  }),
}));

const mockSealedRuneModal = vi.hoisted(() => vi.fn());

vi.mock("@/components/entitlement/SealedRuneModal", () => ({
  SealedRuneModal: (props: { open: boolean; feature: string }) => {
    mockSealedRuneModal(props);
    return props.open
      ? <div data-testid="sealed-rune-modal" aria-label="Sealed Rune Modal" />
      : null;
  },
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SubscriptionGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoading.value = false;
    mockHasFeature.mockReturnValue(false);
  });

  it("renders GateSkeleton while loading", () => {
    mockIsLoading.value = true;
    const { container } = render(
      <SubscriptionGate feature="cloud-sync">
        <div data-testid="premium-content">Premium</div>
      </SubscriptionGate>
    );
    // Skeleton has aria-busy="true"
    expect(container.querySelector("[aria-busy='true']")).toBeInTheDocument();
    expect(screen.queryByTestId("premium-content")).not.toBeInTheDocument();
  });

  it("renders children when feature is unlocked", () => {
    mockHasFeature.mockReturnValue(true);
    render(
      <SubscriptionGate feature="cloud-sync">
        <div data-testid="premium-content">Premium Content</div>
      </SubscriptionGate>
    );
    expect(screen.getByTestId("premium-content")).toBeInTheDocument();
    expect(screen.queryByText(/unlock with karl/i)).not.toBeInTheDocument();
  });

  it("renders upsell section when feature is locked", () => {
    mockHasFeature.mockReturnValue(false);
    render(
      <SubscriptionGate feature="cloud-sync">
        <div data-testid="premium-content">Premium</div>
      </SubscriptionGate>
    );
    expect(screen.getByRole("button", { name: /unlock with karl/i })).toBeInTheDocument();
    // Feature name shown in locked section
    expect(screen.getByText(/cloud sync/i)).toBeInTheDocument();
  });

  it("shows KARL badge in upsell section", () => {
    mockHasFeature.mockReturnValue(false);
    render(
      <SubscriptionGate feature="cloud-sync">
        <div>content</div>
      </SubscriptionGate>
    );
    expect(screen.getByText("KARL")).toBeInTheDocument();
  });

  it("opens SealedRuneModal when 'Unlock with Karl' is clicked", () => {
    mockHasFeature.mockReturnValue(false);
    render(
      <SubscriptionGate feature="cloud-sync">
        <div>content</div>
      </SubscriptionGate>
    );
    fireEvent.click(screen.getByRole("button", { name: /unlock with karl/i }));
    expect(screen.getByTestId("sealed-rune-modal")).toBeInTheDocument();
  });

  it("still renders children in locked state (alongside upsell)", () => {
    mockHasFeature.mockReturnValue(false);
    render(
      <SubscriptionGate feature="cloud-sync">
        <div data-testid="premium-content">Premium</div>
      </SubscriptionGate>
    );
    // children are rendered below the upsell section even when locked
    expect(screen.getByTestId("premium-content")).toBeInTheDocument();
  });

  it("passes the correct feature to SealedRuneModal", () => {
    mockHasFeature.mockReturnValue(false);
    render(
      <SubscriptionGate feature="cloud-sync">
        <div>content</div>
      </SubscriptionGate>
    );
    fireEvent.click(screen.getByRole("button", { name: /unlock with karl/i }));
    expect(mockSealedRuneModal).toHaveBeenCalledWith(
      expect.objectContaining({ feature: "cloud-sync", open: true })
    );
  });
});
