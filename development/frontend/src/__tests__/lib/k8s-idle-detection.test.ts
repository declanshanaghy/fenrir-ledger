import { describe, it, expect } from "vitest";

/**
 * Utility function to calculate idle status based on last job completion time
 * and current time, with configurable idle timeout.
 *
 * Returns true if the system is idle (timeout exceeded), false otherwise.
 */
function isSystemIdle(
  lastJobCompletionTime: Date | null,
  currentTime: Date,
  idleTimeoutMs: number
): boolean {
  if (!lastJobCompletionTime) {
    // No jobs have ever completed — not idle yet
    return false;
  }

  const timeSinceLastJob = currentTime.getTime() - lastJobCompletionTime.getTime();
  return timeSinceLastJob > idleTimeoutMs;
}

/**
 * Utility function to determine if the warm node pool placeholder should be active.
 */
function shouldPlaceholderBeActive(
  isIdle: boolean,
  hasRunningJobs: boolean
): boolean {
  // Placeholder should be active if there are running jobs OR we haven't timed out yet
  return hasRunningJobs || !isIdle;
}

describe("K8s Idle Detection", () => {
  const idleTimeoutMs = 3 * 60 * 60 * 1000; // 3 hours

  describe("isSystemIdle", () => {
    it("returns false when no jobs have completed", () => {
      const currentTime = new Date("2024-01-15T12:00:00Z");
      const result = isSystemIdle(null, currentTime, idleTimeoutMs);
      expect(result).toBe(false);
    });

    it("returns false when last job is within timeout window", () => {
      const currentTime = new Date("2024-01-15T12:00:00Z");
      const lastJobTime = new Date("2024-01-15T11:00:00Z"); // 1 hour ago
      const result = isSystemIdle(lastJobTime, currentTime, idleTimeoutMs);
      expect(result).toBe(false);
    });

    it("returns true when last job exceeds timeout window", () => {
      const currentTime = new Date("2024-01-15T12:00:00Z");
      const lastJobTime = new Date("2024-01-15T08:00:00Z"); // 4 hours ago
      const result = isSystemIdle(lastJobTime, currentTime, idleTimeoutMs);
      expect(result).toBe(true);
    });

    it("returns false when last job is exactly at timeout boundary", () => {
      const currentTime = new Date("2024-01-15T12:00:00Z");
      const lastJobTime = new Date("2024-01-15T09:00:00Z"); // Exactly 3 hours ago
      const result = isSystemIdle(lastJobTime, currentTime, idleTimeoutMs);
      expect(result).toBe(false); // Boundary condition: equal to timeout is not idle
    });

    it("returns true when last job slightly exceeds timeout boundary", () => {
      const currentTime = new Date("2024-01-15T12:00:01Z");
      const lastJobTime = new Date("2024-01-15T09:00:00Z"); // Slightly over 3 hours ago
      const result = isSystemIdle(lastJobTime, currentTime, idleTimeoutMs);
      expect(result).toBe(true);
    });
  });

  describe("shouldPlaceholderBeActive", () => {
    it("returns true when there are running jobs", () => {
      const result = shouldPlaceholderBeActive(false, true);
      expect(result).toBe(true);
    });

    it("returns true when system is not idle", () => {
      const result = shouldPlaceholderBeActive(false, false);
      expect(result).toBe(true);
    });

    it("returns true when there are running jobs even if idle", () => {
      const result = shouldPlaceholderBeActive(true, true);
      expect(result).toBe(true);
    });

    it("returns false when system is idle and no running jobs", () => {
      const result = shouldPlaceholderBeActive(true, false);
      expect(result).toBe(false);
    });
  });

  describe("Integration scenarios", () => {
    it("keeps placeholder active during active development", () => {
      const currentTime = new Date("2024-01-15T12:00:00Z");
      const lastJobTime = new Date("2024-01-15T11:30:00Z"); // 30 minutes ago
      const isIdle = isSystemIdle(lastJobTime, currentTime, idleTimeoutMs);
      const hasRunningJobs = true;
      const shouldBeActive = shouldPlaceholderBeActive(isIdle, hasRunningJobs);

      expect(isIdle).toBe(false);
      expect(shouldBeActive).toBe(true);
    });

    it("keeps placeholder active after recent job without running jobs", () => {
      const currentTime = new Date("2024-01-15T12:00:00Z");
      const lastJobTime = new Date("2024-01-15T11:30:00Z"); // 30 minutes ago
      const isIdle = isSystemIdle(lastJobTime, currentTime, idleTimeoutMs);
      const hasRunningJobs = false;
      const shouldBeActive = shouldPlaceholderBeActive(isIdle, hasRunningJobs);

      expect(isIdle).toBe(false);
      expect(shouldBeActive).toBe(true);
    });

    it("scales down placeholder after 3-hour idle without running jobs", () => {
      const currentTime = new Date("2024-01-15T12:00:00Z");
      const lastJobTime = new Date("2024-01-15T08:30:00Z"); // 3.5 hours ago
      const isIdle = isSystemIdle(lastJobTime, currentTime, idleTimeoutMs);
      const hasRunningJobs = false;
      const shouldBeActive = shouldPlaceholderBeActive(isIdle, hasRunningJobs);

      expect(isIdle).toBe(true);
      expect(shouldBeActive).toBe(false);
    });

    it("wakes up placeholder when new job starts after idle", () => {
      const currentTime = new Date("2024-01-15T12:30:00Z");
      const lastJobTime = new Date("2024-01-15T08:00:00Z"); // 4.5 hours ago
      const isIdle = isSystemIdle(lastJobTime, currentTime, idleTimeoutMs);
      const hasRunningJobs = true; // New job just started
      const shouldBeActive = shouldPlaceholderBeActive(isIdle, hasRunningJobs);

      expect(isIdle).toBe(true);
      expect(shouldBeActive).toBe(true); // Should wake up despite being idle
    });
  });
});
