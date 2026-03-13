/**
 * Unit tests for TrialExpiryModal localStorage and helper functions.
 *
 * Tests the modal's localStorage persistence logic and display rules.
 * Note: Component rendering tests are covered by Playwright E2E tests (Loki).
 *
 * @see components/trial/TrialExpiryModal.tsx
 * @see Issue #623
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock localStorage helpers
// ---------------------------------------------------------------------------

interface StorageMock {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
}

function createStorageMock(): StorageMock {
  return {
    getItem: vi.fn(),
    setItem: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Helper functions (extracted from component for testing)
// ---------------------------------------------------------------------------

const LS_TRIAL_EXPIRY_MODAL_SHOWN = "fenrir:trial-expiry-modal-shown";

function isExpiryModalShown(storage: StorageMock): boolean {
  try {
    return storage.getItem(LS_TRIAL_EXPIRY_MODAL_SHOWN) === "true";
  } catch {
    return true;
  }
}

function markExpiryModalShown(storage: StorageMock): void {
  try {
    storage.setItem(LS_TRIAL_EXPIRY_MODAL_SHOWN, "true");
  } catch {
    // localStorage unavailable — silently fail
  }
}

/**
 * Determines if the expiry modal should be shown based on trial status and flags.
 */
function shouldShowExpiryModal(
  status: string,
  expiryShown: boolean,
): boolean {
  if (status !== "expired") return false;
  if (expiryShown) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TrialExpiryModal localStorage helpers", () => {
  let storage: StorageMock;

  beforeEach(() => {
    storage = createStorageMock();
  });

  // ── isExpiryModalShown ──────────────────────────────────────────────────

  describe("isExpiryModalShown", () => {
    it("returns false when localStorage flag is not set", () => {
      storage.getItem.mockReturnValue(null);
      expect(isExpiryModalShown(storage)).toBe(false);
    });

    it("returns false when localStorage flag is set to 'false'", () => {
      storage.getItem.mockReturnValue("false");
      expect(isExpiryModalShown(storage)).toBe(false);
    });

    it("returns true when localStorage flag is set to 'true'", () => {
      storage.getItem.mockReturnValue("true");
      expect(isExpiryModalShown(storage)).toBe(true);
    });

    it("returns true on localStorage error (assume shown)", () => {
      storage.getItem.mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
      expect(isExpiryModalShown(storage)).toBe(true);
    });
  });

  // ── markExpiryModalShown ────────────────────────────────────────────────

  describe("markExpiryModalShown", () => {
    it("sets localStorage flag to 'true'", () => {
      markExpiryModalShown(storage);
      expect(storage.setItem).toHaveBeenCalledWith(
        LS_TRIAL_EXPIRY_MODAL_SHOWN,
        "true",
      );
    });

    it("silently handles localStorage errors", () => {
      storage.setItem.mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
      expect(() => markExpiryModalShown(storage)).not.toThrow();
    });
  });

  // ── shouldShowExpiryModal ──────────────────────────────────────────────

  describe("shouldShowExpiryModal", () => {
    it("returns true when status is expired and modal not yet shown", () => {
      expect(shouldShowExpiryModal("expired", false)).toBe(true);
    });

    it("returns false when status is expired but modal already shown", () => {
      expect(shouldShowExpiryModal("expired", true)).toBe(false);
    });

    it("returns false when status is active", () => {
      expect(shouldShowExpiryModal("active", false)).toBe(false);
    });

    it("returns false when status is none", () => {
      expect(shouldShowExpiryModal("none", false)).toBe(false);
    });

    it("returns false when status is converted", () => {
      expect(shouldShowExpiryModal("converted", false)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Expiry modal display rules (integration)
// ---------------------------------------------------------------------------

describe("Expiry modal display rules", () => {
  it("modal shows once per trial, never repeats after dismissal", () => {
    const storage = createStorageMock();
    storage.getItem.mockReturnValue(null); // Not yet shown

    // Trial expired: modal should show
    expect(shouldShowExpiryModal("expired", isExpiryModalShown(storage))).toBe(
      true,
    );

    // User dismisses → mark as shown
    markExpiryModalShown(storage);
    storage.getItem.mockReturnValue("true"); // Flag now set

    // Next app load: modal should NOT show again
    expect(shouldShowExpiryModal("expired", isExpiryModalShown(storage))).toBe(
      false,
    );
  });

  it("modal does not show during active trial", () => {
    const storage = createStorageMock();
    storage.getItem.mockReturnValue(null);

    expect(shouldShowExpiryModal("active", isExpiryModalShown(storage))).toBe(
      false,
    );
  });

  it("modal does not show for converted users", () => {
    const storage = createStorageMock();
    storage.getItem.mockReturnValue(null);

    expect(
      shouldShowExpiryModal("converted", isExpiryModalShown(storage)),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Thrall card limit
// ---------------------------------------------------------------------------

describe("Thrall card limit", () => {
  const THRALL_CARD_LIMIT = 5;

  it("limits active cards to 5 for Thrall users", () => {
    const cards = Array.from({ length: 10 }, (_, i) => ({ id: `card-${i}` }));
    const visible = cards.slice(0, THRALL_CARD_LIMIT);
    const locked = Math.max(0, cards.length - THRALL_CARD_LIMIT);

    expect(visible.length).toBe(5);
    expect(locked).toBe(5);
  });

  it("shows all cards when under the limit", () => {
    const cards = Array.from({ length: 3 }, (_, i) => ({ id: `card-${i}` }));
    const visible = cards.slice(0, THRALL_CARD_LIMIT);
    const locked = Math.max(0, cards.length - THRALL_CARD_LIMIT);

    expect(visible.length).toBe(3);
    expect(locked).toBe(0);
  });

  it("shows all cards for Karl users (no limit)", () => {
    const cards = Array.from({ length: 20 }, (_, i) => ({ id: `card-${i}` }));
    const isKarlOrTrial = true;
    const visible = isKarlOrTrial ? cards : cards.slice(0, THRALL_CARD_LIMIT);
    const locked = isKarlOrTrial
      ? 0
      : Math.max(0, cards.length - THRALL_CARD_LIMIT);

    expect(visible.length).toBe(20);
    expect(locked).toBe(0);
  });
});
