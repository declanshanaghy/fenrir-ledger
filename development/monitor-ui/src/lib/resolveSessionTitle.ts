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
 * Resolve the display title for a session using priority order:
 *   1. issueTitle (from K8s annotation fenrir/pr-title or fenrir/issue-title)
 *   2. branchName parse fallback
 *   3. Raw sessionId (existing behavior, graceful degradation)
 */
export function resolveSessionTitle(job: DisplayJob): string {
  if (job.issueTitle) {
    return `Issue #${job.issue} – ${job.issueTitle} – Step ${job.step}`;
  }
  if (job.branchName) {
    return parseBranchTitle(job.branchName, job.step);
  }
  return job.sessionId;
}
