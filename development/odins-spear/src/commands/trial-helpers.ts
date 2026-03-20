/**
 * Pure helpers for trial manipulation commands (issue #1472).
 *
 * These are exported so both commands/trial.ts and tests can import them.
 * No side-effects, no I/O — safe to unit-test in isolation.
 */

// ── Constants ──────────────────────────────────────────────────────────────────

/** Total trial duration in days. */
export const TRIAL_DURATION_DAYS = 30;

/** Day boundary for the mid-trial nudge modal (TrialDay15Modal). */
export const TRIAL_NUDGE_DAY = 15;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TrialState {
  status: "active" | "expired" | "converted" | "none";
  remainingDays: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Compute the current trial state from a raw Firestore trial document.
 */
export function computeTrialState(
  trial: { startDate: string; convertedDate?: string } | null
): TrialState {
  if (!trial) return { remainingDays: 0, status: "none" };
  if (trial.convertedDate) return { remainingDays: 0, status: "converted" };
  const elapsed = Math.floor(
    (Date.now() - new Date(trial.startDate).getTime()) / 86400000
  );
  const remaining = Math.max(0, TRIAL_DURATION_DAYS - elapsed);
  return {
    remainingDays: remaining,
    status: remaining <= 0 ? "expired" : "active",
  };
}

/**
 * Returns the next phase target for trial-progress, or null if already expired.
 *
 * If remaining > TRIAL_NUDGE_DAY → advance to nudge boundary.
 * If 0 < remaining ≤ TRIAL_NUDGE_DAY → advance to expiry (0 remaining).
 * If remaining ≤ 0 → null (already expired, no-op).
 */
export function computeTrialProgressTarget(
  remainingDays: number
): { targetRemaining: number; label: string } | null {
  if (remainingDays > TRIAL_NUDGE_DAY) {
    return {
      targetRemaining: TRIAL_NUDGE_DAY,
      label: `Day-${TRIAL_NUDGE_DAY} nudge boundary`,
    };
  }
  if (remainingDays > 0) {
    return { targetRemaining: 0, label: "Expiry boundary (day 30)" };
  }
  return null;
}

/**
 * Compute the ISO startDate that results in `targetRemaining` days remaining.
 */
export function startDateForRemaining(targetRemaining: number): string {
  const daysAgo = TRIAL_DURATION_DAYS - targetRemaining;
  return new Date(Date.now() - daysAgo * 86400000).toISOString();
}

/**
 * Format a TrialState as a compact human-readable string for use in
 * confirmation dialogs and result overlays.
 */
export function describeTrialState(state: TrialState): string {
  if (state.status === "none") return "no trial";
  if (state.status === "converted") return "converted (Karl)";
  if (state.status === "expired") return "expired — 0 days remaining";
  return `${state.status} — ${state.remainingDays}d remaining`;
}
