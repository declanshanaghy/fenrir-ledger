/**
 * Loki gap-filling tests for useCloudSync helpers — Issue #1693
 *
 * Supplements the 15 tests in cloud-sync-helpers.test.ts with edge cases
 * not covered by FiremanDecko's initial suite.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toast } from "sonner";
import {
  parseApiError,
  maybeShowFirstSyncToast,
  showMigrationToast,
  LS_FIRST_SYNC_SHOWN,
} from "@/hooks/useCloudSync.helpers";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ── parseApiError edge cases ────────────────────────────────────────────────

describe("parseApiError — additional edge cases", () => {
  it("uses parsed error code when only error is present (no error_description)", async () => {
    const response = {
      json: async () => ({ error: "rate-limited" }),
    } as Response;

    const result = await parseApiError(response);
    expect(result.code).toBe("rate-limited");
    // error_description absent → falls back to default message
    expect(result.message).toBe("Cloud sync failed.");
  });

  it("treats null error and null error_description as absent (falls back to defaults)", async () => {
    const response = {
      json: async () => ({ error: null, error_description: null }),
    } as Response;

    const result = await parseApiError(response);
    // null ?? default → default
    expect(result.code).toBe("sync_error");
    expect(result.message).toBe("Cloud sync failed.");
  });

  it("returns a plain object (not an Error instance)", async () => {
    const response = {
      json: async () => ({}),
    } as Response;

    const result = await parseApiError(response);
    expect(result).toHaveProperty("code");
    expect(result).toHaveProperty("message");
    expect(result).not.toBeInstanceOf(Error);
  });
});

// ── maybeShowFirstSyncToast edge cases ─────────────────────────────────────

describe("maybeShowFirstSyncToast — additional edge cases", () => {
  beforeEach(() => {
    localStorage.removeItem(LS_FIRST_SYNC_SHOWN);
  });

  afterEach(() => {
    localStorage.removeItem(LS_FIRST_SYNC_SHOWN);
  });

  it("shows backup toast when syncedCount is 0 and localActiveCount is 0 (no cards either side)", () => {
    // isRestoring requires syncedCount > 0, so 0/0 falls into the else branch
    maybeShowFirstSyncToast(0, 0);
    expect(toast.success).toHaveBeenCalledOnce();
    const msg = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("backed up");
  });

  it("uses plural grammar for 0 cards (zero is not 1)", () => {
    maybeShowFirstSyncToast(0, 0);
    const msg = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("cards have");
  });

  it("toast includes Yggdrasil description", () => {
    maybeShowFirstSyncToast(2, 0);
    const call = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = call[1] as { description?: string; duration?: number };
    expect(options.description).toContain("Yggdrasil");
  });

  it("toast duration is 5000ms", () => {
    maybeShowFirstSyncToast(1, 0);
    const options = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0][1] as {
      duration?: number;
    };
    expect(options.duration).toBe(5000);
  });
});

// ── showMigrationToast edge cases ──────────────────────────────────────────

describe("showMigrationToast — additional edge cases", () => {
  it("shows backup toast for direction=empty (no cards migrated)", () => {
    showMigrationToast(0, "empty");
    expect(toast.success).toHaveBeenCalledOnce();
    const msg = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("backed up to the cloud");
  });

  it("toast includes Yggdrasil description", () => {
    showMigrationToast(3, "upload");
    const options = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0][1] as {
      description?: string;
      duration?: number;
    };
    expect(options.description).toContain("Yggdrasil");
  });

  it("toast duration is 5000ms", () => {
    showMigrationToast(3, "download");
    const options = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0][1] as {
      duration?: number;
    };
    expect(options.duration).toBe(5000);
  });

  it("uses plural grammar for 0 cards (empty migration)", () => {
    showMigrationToast(0, "empty");
    const msg = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).toContain("cards have");
  });
});
