import type { DisplayJob } from "./types";

/**
 * Parse a branch name into a human-readable title.
 *
 * Examples:
 *   "fix/issue-987-picker-gate"    → "Issue #987 – picker gate – Step 1"
 *   "feat/issue-681-gke-sandboxes" → "Issue #681 – gke sandboxes – Step 2"
 *   "issue-999-some-feature"       → "Issue #999 – some feature – Step 1"
 */
export function parseBranchTitle(branch: string, step: string): string {
  // Strip type prefix (fix/, feat/, ux/, chore/, etc.)
  const stripped = branch.replace(/^[a-z-]+\//, "");

  // Extract issue number
  const issueMatch = /issue-(\d+)-?/i.exec(stripped);
  if (!issueMatch) return branch;

  const issueNumber = issueMatch[1]!;
  // Strip "issue-NNN" or "issue-NNN-" prefix from remaining slug
  const slug = stripped.replace(/^issue-\d+-?/, "").replace(/-/g, " ").trim();

  if (!slug) return `Issue #${issueNumber} – Step ${step}`;
  return `Issue #${issueNumber} – ${slug} – Step ${step}`;
}

/**
 * Parse a session ID into a human-readable title.
 * Session IDs follow the pattern: issue-<N>-step<S>-<agent>-<uuid>
 *
 * Examples:
 *   "issue-1200-step1-firemandecko-fe9c6b6d" → "Issue #1200 – Step 1"
 *   "issue-987-step2-luna-abc12345"           → "Issue #987 – Step 2"
 *
 * Returns null if the session ID does not match the expected pattern.
 */
export function parseSessionIdTitle(sessionId: string): string | null {
  const match = /^issue-(\d+)-step(\d+)-/i.exec(sessionId);
  if (!match) return null;
  return `Issue #${match[1]} – Step ${match[2]}`;
}

/**
 * Resolve the display title for a session using priority order:
 *   1. issueTitle (from K8s annotation fenrir/pr-title or fenrir/issue-title)
 *   2. branchName parse (only if branch contains an issue pattern)
 *   3. sessionId parse (issue-<N>-step<S>-<agent>-<uuid> pattern)
 *   4. Raw branchName or sessionId (graceful degradation)
 *
 * When issueTitle is available it is returned as-is (no prefix).
 * The caller (JobCard) is responsible for rendering "Issue #N · Agent · Step N"
 * as the secondary line below the title.
 */
export function resolveSessionTitle(job: DisplayJob): string {
  if (job.issueTitle) {
    return job.issueTitle;
  }
  if (job.branchName) {
    const fromBranch = parseBranchTitle(job.branchName, job.step);
    // parseBranchTitle returns the raw branch name when no issue pattern found
    if (fromBranch !== job.branchName) {
      return fromBranch;
    }
  }
  // Branch had no issue pattern — try to extract from session ID
  const fromSessionId = parseSessionIdTitle(job.sessionId);
  if (fromSessionId) {
    return fromSessionId;
  }
  return job.branchName ?? job.sessionId;
}
