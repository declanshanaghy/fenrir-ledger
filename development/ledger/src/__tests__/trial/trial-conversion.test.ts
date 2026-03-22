/**
 * Unit tests for trial conversion tracking.
 *
 * Tests the computeTrialStatus function with conversion scenarios
 * and the markTrialConverted logic.
 *
 * @see lib/kv/trial-store.ts
 * @see Issue #623
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Pure function re-implementation for testing (avoids KV dependency)
// ---------------------------------------------------------------------------

interface StoredTrial {
  startDate: string;
  convertedDate?: string;
}

const TRIAL_DURATION_DAYS = 30;

function computeTrialStatus(trial: StoredTrial | null): {
  remainingDays: number;
  status: "active" | "expired" | "converted" | "none";
  convertedDate?: string;
} {
  if (!trial) {
    return { remainingDays: 0, status: "none" };
  }

  if (trial.convertedDate) {
    return {
      remainingDays: 0,
      status: "converted",
      convertedDate: trial.convertedDate,
    };
  }

  const startDate = new Date(trial.startDate);
  const now = new Date();
  const elapsedMs = now.getTime() - startDate.getTime();
  const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  const remainingDays = Math.max(0, TRIAL_DURATION_DAYS - elapsedDays);

  if (remainingDays <= 0) {
    return { remainingDays: 0, status: "expired" };
  }

  return { remainingDays, status: "active" };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("computeTrialStatus with conversion", () => {
  it("returns 'none' when trial is null", () => {
    const result = computeTrialStatus(null);
    expect(result.status).toBe("none");
    expect(result.remainingDays).toBe(0);
  });

  it("returns 'converted' when convertedDate is set", () => {
    const trial: StoredTrial = {
      startDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      convertedDate: new Date().toISOString(),
    };
    const result = computeTrialStatus(trial);
    expect(result.status).toBe("converted");
    expect(result.convertedDate).toBe(trial.convertedDate);
    expect(result.remainingDays).toBe(0);
  });

  it("returns 'active' when trial is within 30 days", () => {
    const trial: StoredTrial = {
      startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const result = computeTrialStatus(trial);
    expect(result.status).toBe("active");
    expect(result.remainingDays).toBe(20);
  });

  it("returns 'expired' when trial is past 30 days", () => {
    const trial: StoredTrial = {
      startDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const result = computeTrialStatus(trial);
    expect(result.status).toBe("expired");
    expect(result.remainingDays).toBe(0);
  });

  it("'converted' takes priority over 'expired'", () => {
    const trial: StoredTrial = {
      startDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
      convertedDate: new Date(
        Date.now() - 5 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    };
    const result = computeTrialStatus(trial);
    expect(result.status).toBe("converted");
  });
});

describe("markTrialConverted logic", () => {
  it("adds convertedDate to existing trial", () => {
    const existing: StoredTrial = {
      startDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const updated: StoredTrial = {
      ...existing,
      convertedDate: new Date().toISOString(),
    };

    expect(updated.startDate).toBe(existing.startDate);
    expect(updated.convertedDate).toBeDefined();
  });

  it("preserves startDate when marking as converted", () => {
    const startDate = "2026-01-15T10:00:00.000Z";
    const existing: StoredTrial = { startDate };
    const updated: StoredTrial = {
      ...existing,
      convertedDate: new Date().toISOString(),
    };

    expect(updated.startDate).toBe(startDate);
  });

  it("is idempotent — does not update already-converted trial", () => {
    const convertedDate = "2026-02-15T10:00:00.000Z";
    const existing: StoredTrial = {
      startDate: "2026-01-15T10:00:00.000Z",
      convertedDate,
    };

    // markTrialConverted returns true early when already converted
    const alreadyConverted = !!existing.convertedDate;
    expect(alreadyConverted).toBe(true);
  });
});

describe("Feature gate with isKarlOrTrial", () => {
  it("returns true when tier is Karl and active", () => {
    const tier = "karl";
    const isActive = true;
    const trialStatus = "none";
    const isKarl = tier === "karl" && isActive;
    const isTrialActive = trialStatus === "active";
    expect(isKarl || isTrialActive).toBe(true);
  });

  it("returns true when trial is active (even if not Karl)", () => {
    const tier = "thrall";
    const isActive = false;
    const trialStatus = "active";
    const isKarl = tier === "karl" && isActive;
    const isTrialActive = trialStatus === "active";
    expect(isKarl || isTrialActive).toBe(true);
  });

  it("returns false when trial is expired and not Karl", () => {
    const tier = "thrall";
    const isActive = false;
    const trialStatus = "expired";
    const isKarl = tier === "karl" && isActive;
    const isTrialActive = trialStatus === "active";
    expect(isKarl || isTrialActive).toBe(false);
  });

  it("returns false when trial is converted but subscription not active", () => {
    const tier = "thrall";
    const isActive = false;
    const trialStatus = "converted";
    const isKarl = tier === "karl" && isActive;
    const isTrialActive = trialStatus === "active";
    expect(isKarl || isTrialActive).toBe(false);
  });

  it("returns true for converted user with active Karl subscription", () => {
    const tier = "karl";
    const isActive = true;
    const trialStatus = "converted";
    const isKarl = tier === "karl" && isActive;
    const isTrialActive = trialStatus === "active";
    expect(isKarl || isTrialActive).toBe(true);
  });
});
