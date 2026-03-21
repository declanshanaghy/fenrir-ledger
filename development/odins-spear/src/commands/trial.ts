import { registerCommand } from "./registry.js";
import { firestoreClient } from "../lib/firestore.js";
import { log } from "@fenrir/logger";
import {
  TRIAL_DURATION_DAYS,
  TRIAL_NUDGE_DAY,
  computeTrialState,
  computeTrialProgressTarget,
  startDateForRemaining,
  describeTrialState,
} from "./trial-helpers.js";

/** Read a trial document from /households/{userId}/trial. */
async function readTrialDoc(
  userId: string
): Promise<{ startDate: string; convertedDate?: string } | null> {
  if (!firestoreClient) return null;
  const snap = await firestoreClient
    .collection("households")
    .doc(userId)
    .collection("trial")
    .doc("trial")
    .get();
  if (!snap.exists) return null;
  return snap.data() as { startDate: string; convertedDate?: string };
}

/** Write a startDate update to /households/{userId}/trial. Creates the doc if absent. */
async function writeTrialStartDate(userId: string, startDate: string): Promise<void> {
  if (!firestoreClient) throw new Error("Firestore client not connected");
  const ref = firestoreClient
    .collection("households")
    .doc(userId)
    .collection("trial")
    .doc("trial");
  const snap = await ref.get();
  if (snap.exists) {
    await ref.update({ startDate });
  } else {
    await ref.set({ startDate });
  }
}

export function registerTrialCommands(): void {
  log.debug("registerTrialCommands called");

  // ── trial-adjust ────────────────────────────────────────────────────────────

  registerCommand({
    name: "trial-adjust",
    desc: "Shift trial start date by +N / -N days (+N ages, -N restores)",
    subsystem: "trial",
    tab: "users",
    requiresContext: "trial",
    needsInput: true,
    execute: async (ctx) => {
      log.debug("trial-adjust execute called", { hasUserId: Boolean(ctx.selectedUserId), hasInput: Boolean(ctx.input) });

      if (!firestoreClient) {
        log.debug("trial-adjust execute: no Firestore client");
        return ["ERROR: Firestore client not connected"];
      }
      if (!ctx.selectedUserId) {
        log.debug("trial-adjust execute: no user selected");
        return ["ERROR: No user selected — select a user first"];
      }
      if (!ctx.input) {
        log.debug("trial-adjust execute: no day input");
        return ["ERROR: No day offset provided"];
      }

      const days = parseInt(ctx.input, 10);
      if (isNaN(days) || days === 0) {
        log.debug("trial-adjust execute: invalid day input", { input: ctx.input });
        return [`ERROR: Invalid day offset "${ctx.input}" — enter a non-zero integer (e.g. +5 or -3)`];
      }

      const current = await readTrialDoc(ctx.selectedUserId);
      const oldState = computeTrialState(current);
      const oldDesc = describeTrialState(oldState);

      // +N ages trial by N days (subtract from startDate → older start → fewer remaining)
      // -N restores N days (add to startDate → newer start → more remaining)
      const baseStart = current?.startDate ?? new Date().toISOString();
      const newStart = new Date(
        new Date(baseStart).getTime() - days * 86400000
      ).toISOString();

      await writeTrialStartDate(ctx.selectedUserId, newStart);

      const newState = computeTrialState({ startDate: newStart });
      const newDesc = describeTrialState(newState);
      const sign = days > 0 ? "+" : "";

      log.debug("trial-adjust execute returning", { oldDesc, newDesc });
      return [
        `trial-adjust ${sign}${days} applied`,
        `Was: ${oldDesc}`,
        `Now: ${newDesc}`,
      ];
    },
  });

  // ── trial-complete ──────────────────────────────────────────────────────────

  registerCommand({
    name: "trial-complete",
    desc: `Expire trial immediately (>${TRIAL_DURATION_DAYS} days ago)`,
    subsystem: "trial",
    tab: "users",
    requiresContext: "trial",
    execute: async (ctx) => {
      log.debug("trial-complete execute called", { hasUserId: Boolean(ctx.selectedUserId) });

      if (!firestoreClient) {
        log.debug("trial-complete execute: no Firestore client");
        return ["ERROR: Firestore client not connected"];
      }
      if (!ctx.selectedUserId) {
        log.debug("trial-complete execute: no user selected");
        return ["ERROR: No user selected — select a user first"];
      }

      const current = await readTrialDoc(ctx.selectedUserId);
      const oldState = computeTrialState(current);
      const oldDesc = describeTrialState(oldState);

      // Set startDate to TRIAL_DURATION_DAYS + 1 days ago — guarantees expired
      const newStart = new Date(
        Date.now() - (TRIAL_DURATION_DAYS + 1) * 86400000
      ).toISOString();

      await writeTrialStartDate(ctx.selectedUserId, newStart);

      log.debug("trial-complete execute returning", { oldDesc });
      return [
        "trial-complete applied",
        `Was: ${oldDesc}`,
        "Now: expired — 0 days remaining",
      ];
    },
  });

  // ── trial-progress ──────────────────────────────────────────────────────────

  registerCommand({
    name: "trial-progress",
    desc: `Advance to next phase boundary (day ${TRIAL_NUDGE_DAY} or expiry)`,
    subsystem: "trial",
    tab: "users",
    requiresContext: "trial",
    execute: async (ctx) => {
      log.debug("trial-progress execute called", { hasUserId: Boolean(ctx.selectedUserId) });

      if (!firestoreClient) {
        log.debug("trial-progress execute: no Firestore client");
        return ["ERROR: Firestore client not connected"];
      }
      if (!ctx.selectedUserId) {
        log.debug("trial-progress execute: no user selected");
        return ["ERROR: No user selected — select a user first"];
      }

      const current = await readTrialDoc(ctx.selectedUserId);
      const oldState = computeTrialState(current);
      const oldDesc = describeTrialState(oldState);

      const target = computeTrialProgressTarget(oldState.remainingDays);
      if (!target) {
        log.debug("trial-progress execute: already expired", { remainingDays: oldState.remainingDays });
        return [
          "Trial already expired — nothing to progress",
          `Was: ${oldDesc}`,
        ];
      }

      const newStart = startDateForRemaining(target.targetRemaining);
      await writeTrialStartDate(ctx.selectedUserId, newStart);

      const newState = computeTrialState({ startDate: newStart });
      const newDesc = describeTrialState(newState);

      log.debug("trial-progress execute returning", { label: target.label, oldDesc, newDesc });
      return [
        `trial-progress applied (${target.label})`,
        `Was: ${oldDesc}`,
        `Now: ${newDesc}`,
      ];
    },
  });

  log.debug("registerTrialCommands returning");
}
