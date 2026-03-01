/**
 * Gleipnir utility functions — fragment tracking and completion detection.
 */

const TOTAL_FRAGMENTS = 6;

/** Fragment metadata for display purposes. */
export const GLEIPNIR_FRAGMENTS = [
  { key: "egg:gleipnir-1", name: "The Sound of a Cat's Footfall" },
  { key: "egg:gleipnir-2", name: "The Beard of a Woman" },
  { key: "egg:gleipnir-3", name: "The Roots of a Mountain" },
  { key: "egg:gleipnir-4", name: "The Sinews of a Bear" },
  { key: "egg:gleipnir-5", name: "The Breath of a Fish" },
  { key: "egg:gleipnir-6", name: "The Spittle of a Bird" },
] as const;

/**
 * Returns the number of Gleipnir fragments found (0–6).
 */
export function getFoundFragmentCount(): number {
  if (typeof window === "undefined") return 0;
  return GLEIPNIR_FRAGMENTS.filter(
    (f) => localStorage.getItem(f.key) !== null
  ).length;
}

/**
 * Returns true when all 6 fragments have been discovered.
 */
export function isGleipnirComplete(): boolean {
  return getFoundFragmentCount() === TOTAL_FRAGMENTS;
}
