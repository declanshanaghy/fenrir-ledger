# Sprint 3 Gap Audit Report

**Date:** 2026-03-01
**Auditor:** Loki (QA Tester)
**Method:** Read-only codebase validation against acceptance criteria

---

## Summary

| Story | Verdict | Gaps |
|-------|---------|------|
| 3.1: Auth (Google OIDC) | **PASS** | None — fully implemented, ship-ready |
| 3.2: Norse Copy Pass | **PARTIAL** | 2 critical, 1 minor |
| 3.3: Framer Motion + Animations | **PASS** | Minor spec variances (approved) |
| 3.4: Howl Panel + StatusRing | **PARTIAL** | 1 critical (StatusRing missing), 1 high |
| 3.5: Valhalla Archive | **PARTIAL** | 2 critical, 1 major |

**Stories shipping as-is:** 3.1, 3.3
**Stories needing fixes:** 3.2, 3.4, 3.5

---

## Story 3.1: Auth (Google OIDC) — PASS

All 14 acceptance criteria met. Custom PKCE flow is RFC 7636 compliant with server-side token proxy, anonymous-first UX, silent card merge on sign-in, and proper secret handling.

**Recommendation:** Ship as-is. Story was GA-deferred (P3) and the implementation is complete enough to defer confidently.

---

## Story 3.2: Norse Copy Pass + getRealmLabel() — PARTIAL

### What's Working
- `getRealmLabel()` exists in `realm-utils.ts` with full mappings for 4 statuses
- Two-voice model correctly applied (functional labels, atmospheric headings)
- Dashboard heading: "The Ledger of Fates" — correct
- Form heading: "Forge a New Chain" — correct
- Valhalla heading: "Valhalla / Hall of the Honored Dead" — correct
- Empty states use atmospheric Norse copy
- Form labels use functional voice (zero Norse)
- Kenning micro-copy applied throughout

### Gaps

| # | Gap | Severity | Detail |
|---|-----|----------|--------|
| G2.1 | **Missing "Bonus Open" and "Overdue" badge labels** | Critical | Spec requires 6 badge types (Active, Bonus Open, Promo Expiring, Fee Due Soon, Closed, Overdue) but CardStatus enum only has 4 values. Missing `bonus_window_open` and `overdue` statuses. |
| G2.2 | **Missing /settings route ("The Ravens")** | Critical | Navigation spec requires "The Ravens" heading for /settings. No settings page exists. |
| G2.3 | **getRealmLabel() underutilized** | Minor | Function exported but only used in Valhalla TombstoneCard, not in StatusBadge (which uses simpler `getRealmDescription()`). |

### Decision Needed
- **G2.1:** Adding `bonus_window_open` and `overdue` changes the core data model (`CardStatus` type + `computeCardStatus()` logic). This is non-trivial. **Option A:** Implement now. **Option B:** Accept 4-status MVP and defer to future sprint.
- **G2.2:** Settings page is likely its own story. **Defer** unless blocking.

---

## Story 3.3: Framer Motion + Card Animations — PASS

All 7 acceptance criteria functionally met. Two minor spec variances were identified and deemed acceptable:

| Variance | Spec | Implementation | Impact |
|----------|------|----------------|--------|
| Stagger interval | 60ms | 70ms | Negligible visual difference |
| Card entry y-offset | 8px, 350ms | 20px, 400ms | Slightly more dramatic, acceptable |

Card exit animation (descend-to-Valhalla) matches spec exactly. AnimatePresence properly wraps card grid. Gold shimmer skeleton with 1.4s timing is correct. `prefers-reduced-motion` respected.

**Recommendation:** Ship as-is.

---

## Story 3.4: Howl Panel + StatusRing — PARTIAL

### What's Working
- `HowlPanel.tsx` (422 lines) — fully implemented and production-ready
- Header with Kenaz rune + "THE HOWL" + count badge
- Alert rows with urgency dots, card details, "View" link
- Desktop sidebar (280px) + mobile bottom drawer
- Z-index 50 (correct)
- Slide-in animation matches spec (400ms, expo-out)
- Dashboard integration with toggle

### Gaps

| # | Gap | Severity | Detail |
|---|-----|----------|--------|
| G4.1 | **StatusRing.tsx completely missing** | Critical | SVG progress ring around card issuer initials not implemented. No file, no references. Spec requires: circumference calc (2π×18), progress = daysRemaining/totalDays, color-by-realm, pulse when ≤30 days. |
| G4.2 | **Muspel-pulse missing drop-shadow** | High | Animation only pulses opacity (1→0.6). Spec requires drop-shadow modulation (4px→10px) alongside opacity. |
| G4.3 | **Empty state text differs from spec** | Minor | Spec: "No active alerts. All cards are up to date." Actual: "The wolf is not howling. All chains are silent." (Deliberate Norse flavor — approved in prior QA verdict.) |
| G4.4 | **Missing secondary action buttons** | Minor | Wireframe shows "Close card" / "Mark claimed" buttons. Only "View" link implemented. |

### Decision Needed
- **G4.1:** StatusRing is a new component (~100 LOC). Implement now or defer?
- **G4.2:** Quick CSS fix to add `filter: drop-shadow(...)` to muspel-pulse keyframes.

---

## Story 3.5: Valhalla Archive — PARTIAL

### What's Working
- Route at `/valhalla` fully implemented
- Header: "VALHALLA / Hall of the Honored Dead"
- Filter by issuer dropdown
- Tombstone card style with sepia tint and Tiwaz (ᛏ) rune
- Cards show title, closed date, issuer, opened date, held duration
- Plunder section shows rewards earned and fee avoided
- Empty state with Norse copy and ᛏ rune
- Entry animations with framer-motion stagger

### Gaps

| # | Gap | Severity | Detail |
|---|-----|----------|--------|
| G5.1 | **Missing "View full record" button** | Critical | Wireframe spec shows button below plunder section linking to card detail. Not implemented. Users cannot navigate to full card record from Valhalla. |
| G5.2 | **Missing "Net gain" in plunder section** | Critical | Only shows Rewards and Fee Avoided. Missing third row: Net gain = rewards - fees. Core financial metric. |
| G5.3 | **Sort options don't match spec** | Major | Spec: "Closed date / Annual fee avoided / Rewards earned". Actual: "Closed date / A→Z / Z→A". Missing financial sort options. |

---

## Consolidated Fix Items (Requiring Approval)

### Must Fix (Critical)

| ID | Story | Fix | Effort |
|----|-------|-----|--------|
| G4.1 | 3.4 | Implement StatusRing.tsx (SVG progress ring) | M |
| G5.1 | 3.5 | Add "View full record" button to tombstone cards | S |
| G5.2 | 3.5 | Add net gain calculation + display row | S |

### Should Fix (High/Major)

| ID | Story | Fix | Effort |
|----|-------|-----|--------|
| G4.2 | 3.4 | Add drop-shadow to muspel-pulse animation | XS |
| G5.3 | 3.5 | Add "Sort by fee avoided" and "Sort by rewards" options | S |

### Defer (Requires Scope Discussion)

| ID | Story | Fix | Why Defer |
|----|-------|-----|-----------|
| G2.1 | 3.2 | Add `bonus_window_open` and `overdue` to CardStatus | Changes core data model; may be future sprint scope |
| G2.2 | 3.2 | Implement /settings ("The Ravens") | Full story on its own |
| G4.3 | 3.4 | Empty state text variant | Deliberate Norse flavor, previously approved |
| G4.4 | 3.4 | Secondary action buttons in Howl Panel | Nice-to-have, not blocking |

---

## Proposed Fix Batches

### Batch A: Valhalla Completeness (Stories 3.5 gaps)
- G5.1: Add "View full record" button
- G5.2: Add net gain calculation + display
- G5.3: Add financial sort options
- Branch: `feat/s3-fix-valhalla-gaps`

### Batch B: StatusRing + Muspel-pulse (Story 3.4 gaps)
- G4.1: Implement StatusRing.tsx
- G4.2: Fix muspel-pulse drop-shadow
- Branch: `feat/s3-fix-status-ring`

### Batch C: CardStatus Extension (Story 3.2 — if approved)
- G2.1: Add `bonus_window_open` and `overdue` statuses
- Branch: `feat/s3-fix-card-status-extension`
