/**
 * Milestone toast utility — fires Norse-themed celebrations
 * when the user crosses card count thresholds.
 *
 * Each milestone fires once only (gated by localStorage).
 * Storage keys: "egg:milestone-1", "egg:milestone-5", etc.
 */

const MILESTONES = [
  { threshold: 1, message: "ᚠ First card forged — the wolf begins to hunt." },
  { threshold: 5, message: "ᚢ Five chains tracked — Fenrir grows restless." },
  { threshold: 9, message: "ᚦ Nine realms, nine cards — the Allfather watches." },
  { threshold: 13, message: "ᚱ Thirteen bonds — even Gleipnir strains." },
  { threshold: 20, message: "ᛊ Twenty chains mastered — you rival the dwarves of Svartálfaheimr." },
] as const;

/**
 * Checks if the given active card count crosses a milestone threshold
 * that hasn't been shown yet.
 *
 * @param activeCardCount - Current number of non-closed, non-deleted cards
 * @returns The milestone to show, or null if no new milestone was crossed
 */
export function checkMilestone(activeCardCount: number): { message: string; threshold: number } | null {
  if (typeof window === "undefined") return null;

  // Check thresholds in descending order so highest unclaimed milestone fires
  for (let i = MILESTONES.length - 1; i >= 0; i--) {
    const m = MILESTONES[i]!;
    if (activeCardCount >= m.threshold) {
      const key = `egg:milestone-${m.threshold}`;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, "1");
        return { message: m.message, threshold: m.threshold };
      }
    }
  }
  return null;
}
