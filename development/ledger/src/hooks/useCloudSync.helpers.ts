"use client";

/**
 * useCloudSync helpers — Fenrir Ledger
 *
 * Pure / side-effect-isolated helpers extracted from useCloudSync to keep
 * per-function cyclomatic complexity ≤ 15.
 *
 * Issue #1693 — refactor: extract helpers to reduce complexity
 */

import { toast } from "sonner";
import type { MigrationDirection } from "@/lib/sync/migration";

// ---------------------------------------------------------------------------
// Constants (re-exported so tests and the hook share one source of truth)
// ---------------------------------------------------------------------------

/** localStorage key to prevent repeat first-sync confirmation toast */
export const LS_FIRST_SYNC_SHOWN = "fenrir:first-sync-shown";

// ---------------------------------------------------------------------------
// parseApiError
// ---------------------------------------------------------------------------

/**
 * Attempts to parse a JSON error body from a failed fetch response.
 * Returns `{ code, message }` defaults on any parse failure.
 */
export async function parseApiError(
  response: Response
): Promise<{ code: string; message: string }> {
  let code = "sync_error";
  let message = "Cloud sync failed.";
  try {
    const body = (await response.json()) as {
      error?: string;
      error_description?: string;
    };
    code = body.error ?? code;
    message = body.error_description ?? message;
  } catch {
    // ignore JSON parse failure
  }
  return { code, message };
}

// ---------------------------------------------------------------------------
// maybeShowFirstSyncToast
// ---------------------------------------------------------------------------

/**
 * Shows a one-time toast celebrating the user's first cloud sync.
 * No-op if the toast has already been shown (LS_FIRST_SYNC_SHOWN is set).
 *
 * Side-effects: writes LS_FIRST_SYNC_SHOWN to localStorage and calls toast.success.
 *
 * @param syncedCount     Number of cards in the merged result
 * @param localActiveCount Number of local active (non-deleted) cards BEFORE sync
 */
export function maybeShowFirstSyncToast(
  syncedCount: number,
  localActiveCount: number
): void {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(LS_FIRST_SYNC_SHOWN) === "true") return;

  try {
    localStorage.setItem(LS_FIRST_SYNC_SHOWN, "true");
  } catch {
    // localStorage full — skip
  }

  const isRestoring = localActiveCount === 0 && syncedCount > 0;
  const plural = syncedCount !== 1;
  const verb = plural ? "have" : "has";
  const cardWord = plural ? "cards" : "card";

  if (isRestoring) {
    toast.success(
      `Your ${syncedCount} ${cardWord} ${verb} been restored from cloud`,
      { description: "Yggdrasil guards your ledger.", duration: 5000 }
    );
  } else {
    toast.success(
      `Your ${syncedCount} ${cardWord} ${verb} been backed up`,
      { description: "Yggdrasil guards your ledger.", duration: 5000 }
    );
  }
}

// ---------------------------------------------------------------------------
// showMigrationToast
// ---------------------------------------------------------------------------

/**
 * Shows the migration toast on first Karl sign-in.
 * Direction "download" → "restored from cloud"; anything else → "backed up".
 *
 * @param count     Number of cards involved in migration
 * @param direction Data-flow direction returned by runMigration()
 */
export function showMigrationToast(
  count: number,
  direction: MigrationDirection
): void {
  const plural = count !== 1;
  const verb = plural ? "have" : "has";
  const cardWord = plural ? "cards" : "card";

  if (direction === "download") {
    toast.success(
      `Your ${count} ${cardWord} ${verb} been restored from cloud`,
      { description: "Yggdrasil guards your ledger.", duration: 5000 }
    );
  } else {
    toast.success(
      `Your ${count} ${cardWord} ${verb} been backed up to the cloud`,
      { description: "Yggdrasil guards your ledger.", duration: 5000 }
    );
  }
}
