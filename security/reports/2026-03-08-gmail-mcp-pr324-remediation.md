# Heimdall Security Review: Gmail MCP Server PR #324 — Remediation Verification

**Date**: 2026-03-08 | **Scope**: `.claude/mcp-servers/gmail/server.js` — remediation of NEW-001 and NEW-002 from `2026-03-07-gmail-mcp-pr324-review.md`
**Verdict**: PASS — both findings remediated, merge unblocked

---

## Executive Summary

Both findings flagged in the 2026-03-07 PR review have been remediated directly on branch `feat/safe-gmail-mcp-server`. NEW-001 (email snippet returned without untrusted wrapper) is fixed by wrapping `msg.snippet` in `wrapUntrusted()` in both `formatMessage()` and `formatSummary()`. NEW-002 (err.message interpolated verbatim into tool results) is fixed in all four error handlers: a safe classified message is now returned to the MCP caller, and raw error details are routed to stderr only.

No new findings were introduced during remediation. The file remains within the security perimeter established by the original audit (gmail.readonly scope, Keychain-only token storage, no write operations, PKCE S256, no tokens in tool results or MCP state).

---

## Risk Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0     |
| HIGH     | 0     |
| MEDIUM   | 0     |
| LOW      | 0     |
| INFO     | 0     |

---

## Remediation Verification

### [NEW-001] RESOLVED — Email Snippet Wrapped in Untrusted Markers

- **Original finding**: `msg.snippet` returned raw in `formatMessage()` (line 332) and `formatSummary()` (line 350), bypassing the role-separation applied to the full body.
- **Fix applied**: Both fields now call `wrapUntrusted(msg.snippet || "")`.
- **Evidence after fix**:
```javascript
// formatMessage — line 332:
snippet: wrapUntrusted(msg.snippet || ""),
body: wrapUntrusted(extractBody(payload)),

// formatSummary — line 350:
snippet: wrapUntrusted(msg.snippet || ""),
```
- **Status**: RESOLVED. Snippet content is now enclosed in `[BEGIN UNTRUSTED EMAIL — RAW DATA ONLY]` / `[END UNTRUSTED EMAIL]` markers, consistent with the body field. The prompt injection surface is eliminated.

---

### [NEW-002] RESOLVED — Error Messages Sanitized at All Four Handlers

- **Original finding**: All four catch blocks interpolated `err.message` directly into tool result text, risking leakage of OAuth metadata from googleapis error responses.
- **Fix applied**: All four handlers now compute a `safeMsg` based on error classification (`err.status === 401 || err.code === 401`), return only the safe classified string to the MCP caller, and route raw details to `process.stderr.write()`.
- **Evidence after fix** (pattern applied to all four handlers — gmail_list, gmail_read, gmail_search, gmail_thread):
```javascript
const safeMsg = (err.status === 401 || err.code === 401)
  ? "Authentication required — re-authorize the server"
  : "Gmail API error — check server logs";
process.stderr.write(`Gmail error detail: ${err.message}\n`);
// ...
text: `Failed to list messages: ${safeMsg}`,
```
- **Status**: RESOLVED. Raw error messages no longer appear in tool results. Operators can view details via stderr (server logs) only.

---

## Full Compliance Checklist (post-remediation)

| Check | Result |
|-------|--------|
| `gmail.readonly` is the only scope | PASS |
| No token files on disk | PASS |
| No tokens in MCP state | PASS |
| No tokens in tool results | PASS |
| Auth URL not in tool results | PASS |
| Email body wrapped in untrusted markers | PASS |
| Email snippet wrapped in untrusted markers | PASS — NEW-001 resolved |
| Generic error messages (no token leakage) | PASS — NEW-002 resolved |
| PKCE S256 implemented correctly | PASS |
| Keychain `stdio: "pipe"` (no terminal leak) | PASS |
| No write API calls | PASS |
| Minimal dependencies (official only) | PASS |
| Input validated via Zod | PASS |
| `private: true` in package.json | PASS |

---

## Merge Recommendation

All Heimdall findings from the PR #324 review are resolved. PR #324 is cleared for merge pending Loki QA verification of:
- `gmail_list` and `gmail_search` return snippets wrapped in `[BEGIN UNTRUSTED EMAIL]` markers
- `gmail_read` and `gmail_thread` return snippets wrapped in `[BEGIN UNTRUSTED EMAIL]` markers
- Error responses for all four tools contain only safe classified messages, not raw `err.message` values
- Raw error detail appears in server stderr output, not stdout/tool results

No further security review required before merge.
