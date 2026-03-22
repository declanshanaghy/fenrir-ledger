/**
 * Unit tests for useCloudSync helpers — Issue #1693
 *
 * Tests the extracted pure helpers: parseApiError, maybeShowFirstSyncToast,
 * showMigrationToast. These functions were extracted from useCloudSync to
 * reduce per-function cyclomatic complexity to ≤ 15.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toast } from "sonner";
import {
  parseApiError,
  maybeShowFirstSyncToast,
  showMigrationToast,
  LS_FIRST_SYNC_SHOWN,
} from "@/hooks/useCloudSync.helpers";

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ── parseApiError ──────────────────────────────────────────────────────────────

describe("parseApiError", () => {
  it("returns parsed code and message from a JSON error body", async () => {
    const response = {
      json: async () => ({
        error: "permission-denied",
        error_description: "You do not have permission.",
      }),
    } as Response;

    const result = await parseApiError(response);
    expect(result.code).toBe("permission-denied");
    expect(result.message).toBe("You do not have permission.");
  });

  it("falls back to defaults when error fields are absent", async () => {
    const response = {
      json: async () => ({}),
    } as Response;

    const result = await parseApiError(response);
    expect(result.code).toBe("sync_error");
    expect(result.message).toBe("Cloud sync failed.");
  });

  it("falls back to defaults when JSON parse throws", async () => {
    const response = {
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    } as Response;

    const result = await parseApiError(response);
    expect(result.code).toBe("sync_error");
    expect(result.message).toBe("Cloud sync failed.");
  });

  it("uses default code when only error_description is present", async () => {
    const response = {
      json: async () => ({ error_description: "Server exploded." }),
    } as Response;

    const result = await parseApiError(response);
    expect(result.code).toBe("sync_error");
    expect(result.message).toBe("Server exploded.");
  });
});

// ── maybeShowFirstSyncToast ────────────────────────────────────────────────────

describe("maybeShowFirstSyncToast", () => {
  beforeEach(() => {
    localStorage.removeItem(LS_FIRST_SYNC_SHOWN);
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.removeItem(LS_FIRST_SYNC_SHOWN);
  });

  it("shows a restore toast when local was empty and cloud had cards", () => {
    maybeShowFirstSyncToast(3, 0);
    expect(toast.success).toHaveBeenCalledOnce();
    expect((toast.success as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(
      "restored from cloud"
    );
  });

  it("shows a backup toast when local already had cards", () => {
    maybeShowFirstSyncToast(5, 5);
    expect(toast.success).toHaveBeenCalledOnce();
    expect((toast.success as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(
      "backed up"
    );
  });

  it("is a no-op when LS_FIRST_SYNC_SHOWN is already set", () => {
    localStorage.setItem(LS_FIRST_SYNC_SHOWN, "true");
    maybeShowFirstSyncToast(3, 0);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("sets LS_FIRST_SYNC_SHOWN so a second call is a no-op", () => {
    maybeShowFirstSyncToast(2, 0);
    maybeShowFirstSyncToast(2, 0);
    expect(toast.success).toHaveBeenCalledOnce();
  });

  it("uses singular grammar for 1 card", () => {
    maybeShowFirstSyncToast(1, 0);
    const message = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(message).toContain("1 card has");
  });

  it("uses plural grammar for 2+ cards", () => {
    maybeShowFirstSyncToast(4, 0);
    const message = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(message).toContain("4 cards have");
  });
});

// ── showMigrationToast ─────────────────────────────────────────────────────────

describe("showMigrationToast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a restore toast for direction=download", () => {
    showMigrationToast(3, "download");
    expect(toast.success).toHaveBeenCalledOnce();
    expect((toast.success as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(
      "restored from cloud"
    );
  });

  it("shows a backup toast for direction=upload", () => {
    showMigrationToast(2, "upload");
    expect(toast.success).toHaveBeenCalledOnce();
    expect((toast.success as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(
      "backed up to the cloud"
    );
  });

  it("shows a backup toast for direction=merge", () => {
    showMigrationToast(5, "merge");
    expect(toast.success).toHaveBeenCalledOnce();
    expect((toast.success as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(
      "backed up to the cloud"
    );
  });

  it("uses singular grammar for 1 card", () => {
    showMigrationToast(1, "upload");
    const message = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(message).toContain("1 card has");
  });

  it("uses plural grammar for 2+ cards", () => {
    showMigrationToast(7, "download");
    const message = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(message).toContain("7 cards have");
  });
});
