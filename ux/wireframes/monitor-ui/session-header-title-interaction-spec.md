# Interaction Spec — Session Header: Descriptive Title
**Issue #989 · Monitor UI · Luna UX Design · 2026-03-15**

---

## Overview

Replaces the raw `agentName — #issue Step N (sessionId)` string in the monitor
log viewer header with a human-readable issue title as the primary display.
The session ID moves to a secondary position (truncated with tooltip).

---

## User Flows

### Flow 1 — Select a session from the sidebar

```
User clicks a job card in sidebar
  → LogViewer receives activeJob
  → content-header renders:
      Line 1: resolveSessionTitle(job)        ← primary, font-weight 700
      Line 2: [AgentBadge] [StepTag] [SessionId…]  ← secondary meta row
  → Sidebar card shows:
      Line 1: #N – <issueTitle truncated>     ← primary
      Line 2: [AgentBadge] Step N  Status     ← secondary
```

### Flow 2 — Title resolution (client-side)

```
resolveSessionTitle(job):
  1. if job.issueTitle → return `Issue #${job.issue} – ${job.issueTitle} – Step ${job.step}`
  2. else if job.branchName → return parseBranchTitle(job.branchName, job.step)
  3. else → return job.sessionId   (raw fallback, existing behavior)

parseBranchTitle(branch, step):
  // "fix/issue-987-picker-gate" → "Issue #987 – picker gate – Step 1"
  1. strip type prefix (fix/, feat/, ux/, etc.)
  2. extract issue number via /issue-(\d+)/
  3. strip "issue-NNN-" prefix from remaining slug
  4. convert remaining hyphens to spaces
  5. return `Issue #${N} – ${slug} – Step ${step}`
```

### Flow 3 — Session ID tooltip

```
User hovers over the truncated session ID chip (desktop)
  → Native browser tooltip (title attr) shows full session ID
  → No interaction needed — tooltip is purely informational

User focuses session ID chip via keyboard (Tab)
  → aria-label contains full session ID, read by screen reader
  → role="text" (not a button — no click action)
```

### Flow 4 — Long issue title (overflow)

```
Issue title > available width:
  → CSS overflow: hidden; text-overflow: ellipsis; white-space: nowrap
  → Ellipsis visible at truncation point
  → Full title available in title tooltip on the primary title element
  → aria-label on content-header contains full un-truncated title
```

---

## Component: `SessionHeader`

Extract a shared `SessionHeader` sub-component from `LogViewer.tsx` to avoid
duplicating the header markup across the three render paths (normal, TTL-expired,
node-unreachable).

```tsx
interface SessionHeaderProps {
  job: DisplayJob;
  wsState: "connecting" | "open" | "closed" | "error";
  onDownload?: () => void;
  children?: React.ReactNode; // right-side badge slot
}
```

Used in all three `<main className="content">` render branches.

---

## State: No `issueTitle` available

When `job.issueTitle` is null and `job.branchName` is null, the header
degrades gracefully to the raw `sessionId` as primary text — identical to
the current behavior. No error state, no spinner.

---

## Accessibility

| Element | Requirement |
|---|---|
| `.content-header` | `aria-label={`Active session: ${resolveSessionTitle(job)}`}` — full title, not truncated |
| Agent badge | `aria-label={`Agent: ${job.agentName}`}` |
| Session ID chip | `role="text"` + `aria-label={`Session ID: ${job.sessionId}`}` (full ID) |
| Job card | `aria-label={`Job: Issue ${job.issue} – ${displayTitle} – Step ${job.step} – ${job.agentName} – ${job.status}`}` |
| Download button | `aria-label="Download session log"` + min 44×44px touch target |

---

## Responsive Behavior

| Viewport | Header layout |
|---|---|
| > 1024px | Two-row title block left + badge row right (flex, single line) |
| 600–1024px | Two-row title block left + badge row right (wraps if needed) |
| < 600px | Title block full-width, badges row below; WS status badge hidden; session ID label omitted |

---

## Files Changed

| File | Change |
|---|---|
| `development/monitor/src/k8s.ts` | Read `fenrir/issue-title`, `fenrir/pr-title`, `fenrir/branch` annotations from K8s Job object |
| `development/monitor/src/ws.ts` | Add `issueTitle`, `branchName` to `Job` wire type |
| `development/monitor-ui/src/lib/types.ts` | Add `issueTitle: string \| null`, `branchName: string \| null` to `DisplayJob` |
| `development/monitor-ui/src/lib/` | New `resolveSessionTitle.ts` utility |
| `development/monitor-ui/src/components/LogViewer.tsx` | Extract `SessionHeader`, replace `.session-title` span |
| `development/monitor-ui/src/components/JobCard.tsx` | Replace agent-primary layout with issue-title-primary layout |
| `dispatch/dispatch-job.sh` (or equivalent) | Fetch issue/PR title at job-creation time, set K8s annotations |
