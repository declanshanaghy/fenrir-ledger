# QA Validation Report: Clerk Auth Architecture (ADR-007 + Implementation Plan)

**Tester:** Loki (QA)
**Date:** 2026-03-01
**Branch:** `docs/adr-clerk-auth` (PR #27)
**Verdict:** **APPROVED WITH NOTES**

---

## Executive Summary

FiremanDecko's Clerk auth investigation is architecturally sound and production-ready at the design level. The ADR properly documents the decision with clear alternatives considered, and the implementation plan is detailed and idempotent-safe. However, there are **3 notes** that require clarification before code review and **1 minor documentation gap** that should be addressed. None are blocking.

**Overall Recommendation:** APPROVED — Ready for sprint planning and implementation. All notes can be resolved asynchronously.

---

## Detailed Findings

### 1. Anonymous-First Compliance

**Status:** ✓ PASS

**Finding:** The implementation plan explicitly preserves the anonymous-first model across all five phases. The critical requirement from the product brief is met:

- **Phase 1** (Task 1.3): "ClerkProvider must be the outermost provider — it wraps all existing providers" — no routes are protected in middleware (Task 1.4).
- **Phase 2** (Task 2.1): AuthContext refactor maintains `status === "anonymous"` as a first-class state when `isSignedIn === false`.
- **Phase 3** (Task 3.1): "Continue without signing in" button is preserved; anonymous-to-clerk sign-in is always optional.
- **Task 2.1 edge cases:** SSR guard prevents hydration mismatch — `status === "loading"` prevents storage reads until client hydrates.

**Verification points:**
```typescript
// From Task 2.1 (AuthContext.tsx line 196-212):
if (isLoaded) {
  if (isSignedIn && user) {
    status = "authenticated";
    householdId = user.id;
  } else {
    status = "anonymous";
    // householdId remains anonHouseholdId
  }
}
```

No sign-in gates, no redirects for anonymous users. The product brief constraint is preserved throughout.

---

### 2. householdId Contract Consistency

**Status:** ✓ PASS (with 1 clarification note)

**Finding:** The `householdId` contract is preserved end-to-end across all phases. The data model (Card, Household, CardStatus types) remains untouched.

**Verification:**
- **Phase 2, Task 2.1:** Clerk's `user.id` (format: `user_2abc...`) becomes `householdId` for signed-in users. This is a string — compatible with existing localStorage key patterns.
- **Phase 4, Task 4.1:** The merge-anonymous function receives both `clerkUserId` and `anonHouseholdId`, both strings, and is fully agnostic. From `merge-anonymous.ts` line 22-25: the signature accepts generic strings, not type-locked to Google `sub`.
- **storage.ts:** All functions (`saveCard()`, `getCards()`, `setAllCards()`) accept `householdId: string` and remain unchanged.

**However, note the comment discrepancies:**

| File | Line | Current | Issue |
|------|------|---------|-------|
| `storage.ts` | 52 | `@param householdId - The authenticated user's household ID (Google sub claim)` | Outdated — must be updated to "Clerk user.id or anonymous UUID" |
| `storage.ts` | 62 | Same issue | JSDoc comment references "Google sub claim" |
| `merge-anonymous.ts` | 18 | `@param googleHouseholdId - The authenticated user's household ID (Google sub)` | Misleading name (`googleHouseholdId`) when it will receive Clerk's `user.id` |

**Note:** These are comment-only issues, not functional bugs. The code is correct; the documentation is stale. **Task 4.2 in the implementation plan addresses this** — but I recommend expanding it to also update `merge-anonymous.ts` parameter name from `googleHouseholdId` to `clerkHouseholdId` or generic `householdId` for clarity.

**Recommendation:** Expand Task 4.2 scope to update both `storage.ts` and `merge-anonymous.ts` JSDoc comments and parameter names.

---

### 3. Backlog Acceptance Criteria Coverage

**Status:** ✓ PASS

**Finding:** All acceptance criteria from `idp-testing-alternative.md` are covered by the implementation plan.

| Criterion | Coverage | Reference |
|-----------|----------|-----------|
| Clerk dev instance integration with Next.js App Router | ✓ Phase 1 Tasks 1.1–1.4 | Tasks 1.3–1.4: ClerkProvider wrapping, clerkMiddleware |
| Test-mode flow for local dev and CI (Playwright) | ✓ Implementation Plan section "Playwright Testing Strategy" | Lines 432–514: `clerkSetup()`, `setupClerkTestingToken()`, CI env vars |
| GitHub as initial identity provider | ✓ Phase 1 prerequisite | Line 14: "GitHub OAuth configured in Clerk Dashboard" |
| Confirm adding providers later is dashboard-only | ✓ Phase 5 + ADR Decision | ADR lines 98–102, Implementation Plan lines 415–428 |
| Migration path from anonymous localStorage to Clerk-authenticated flow | ✓ Phase 4 Tasks 4.1–4.2 | Lines 369–406: merge-anonymous verification and comments |
| Product brief auth section update noted | ⚠ PARTIAL | Deferred until GA planning sprint — not in scope of current ADR |

**Note on product brief update:** The ADR states (line 38) "This ADR is written now so the team has a clear technical path when that sprint is declared." The product brief update is implicitly deferred until that GA sprint. This is acceptable — auth implementation is a GA prerequisite, not an MVP task. No action required.

---

### 4. Secrets Hygiene

**Status:** ✓ PASS

**Finding:** No real secrets, tokens, or keys appear in any document. All environment variables are correctly templated.

**Verification:**
- `.env.example` (Implementation Plan, lines 49–66): Placeholder values only (`pk_test_your_publishable_key_here`, `sk_test_your_secret_key_here`).
- ADR Security Notes (ADR lines 207–213): Correct constraints documented — `CLERK_SECRET_KEY` is server-only, Testing Tokens travel via GitHub Actions secrets only.
- Playwright config (Implementation Plan, lines 478–492): `CLERK_SECRET_KEY` passed via `${{ secrets.CLERK_SECRET_KEY }}` in CI — GitHub automatically masks it in logs.

No secrets in PR comments, commit messages, or artifacts expected. Compliance verified.

---

### 5. Playwright Testing Strategy Safety

**Status:** ✓ PASS (with 1 technical clarification)

**Finding:** The Clerk Testing Tokens approach is correctly designed to NOT expose `CLERK_SECRET_KEY` publicly.

**Verification:**
- **Setup flow (lines 442–454):** `clerkSetup()` from `@clerk/testing` fetches a Testing Token at runtime using `CLERK_SECRET_KEY` from environment — the secret is never transmitted to the test.
- **Per-test flow (lines 456–475):** `setupClerkTestingToken({ page })` injects the token as a query parameter (a disposable, short-lived token), not the raw secret key.
- **CI integration (lines 505–512):** Secret is read only by `clerkSetup()` during global setup; no token or key is logged.

**Technical note:** The implementation plan does not explicitly state the token's lifetime or scope. Clerk's Testing Tokens are typically valid for 1 hour and scoped to the Clerk instance. For E2E robustness in slow CI runs, verify that token expiry is handled (e.g., automatic re-generation if a test takes >50 mins). This is a minor operational concern, not a security issue.

**Recommendation:** Document expected token lifetime in the CI section, and add a comment about token refresh behavior if needed. Not blocking.

---

### 6. Product Brief Compliance

**Status:** ✓ PASS

**Finding:** The Clerk integration fully respects product brief constraints:

- **No remote storage before GA:** Verified — localStorage remains primary. Phase 1–4 explicitly maintain `getAllCardsGlobal()`, `getCards()`, `saveCard()` as browser-only operations. No backend involved.
- **No data model changes:** Card, Household, CardStatus types are explicitly left unchanged (ADR line 53, Implementation Plan line 554–555).
- **householdId remains valid:** The UUID contract is preserved — Clerk's `user.id` is a valid string replacement.
- **Anonymous-first design preserved:** Verified in section 1 above.

All constraints from product brief lines 64–78 are met.

---

### 7. Mermaid Diagram Syntax

**Status:** ✓ PASS

**Finding:** The architecture diagram (ADR lines 154–203) is syntactically valid and follows the Fenrir style guide.

**Verification against mermaid-style-guide.md:**
- **Graph type:** Flowchart (`graph TD`) — appropriate for architecture (style guide line 48).
- **Color classes:** Uses `classDef` with Fenrir colors:
  - `primary` = #03A9F4 (correct from style guide)
  - `healthy` = #4CAF50 (correct)
  - `warning` = #FF9800 (correct)
  - `background` = #2C2C2C (correct)
  - `neutral` = #F5F5F5 (correct)
- **Node IDs:** Meaningful (`clerk`, `github`, `clerkMiddleware`, `storage`, `mergeModule`) — not A/B/C (style guide line 11).
- **Edge labels:** All arrows labeled with descriptive actions: `|OAuth|`, `|identity|`, `|session|` (style guide line 12).
- **Node shapes:** Correct usage:
  - Hexagons for external systems: `clerk{{Clerk Platform}}`, `github{{GitHub OAuth}}` (style guide line 153)
  - Brackets for processes: `[clerkMiddleware]`, `[AuthContext]` (style guide line 148)
  - Parentheses for user action: `([Anonymous User])`, `([Authenticated User])` (style guide line 149)
  - Cylinder for data store: `[(localStorage)]` (style guide line 151)

Diagram is valid and compliant.

---

### 8. ADR Quality (Decision Documentation)

**Status:** ✓ PASS

**Finding:** ADR-007 meets all required sections for a high-quality architecture decision record:

| Section | Present? | Quality | Notes |
|---------|----------|---------|-------|
| **Context** | ✓ Lines 11–30 | Excellent | Problem clearly framed: Google OAuth is hard to test; Clerk solves this. |
| **Decision** | ✓ Lines 34–77 | Excellent | Decision is unambiguous: "Use Clerk, GitHub as initial provider." Middleware strategy documented. householdId contract preserved. |
| **Options Considered** | ✓ Lines 105–118 | Excellent | 5 alternatives evaluated (Auth.js, Supabase, Clerk, Firebase, Magic.link). Each has Pros/Cons. Clerk chosen with fallback path documented (migrate to Auth.js if pricing becomes untenable). |
| **Consequences** | ✓ Lines 121–150 | Excellent | Positive consequences (trivial testing, free provider expansion) and trade-offs (vendor lock-in, FenrirSession removal) are candid. Migration path is documented. |
| **References** | ✓ Lines 216–223 | Good | Links to backlog item, related ADRs, Clerk docs, and implementation plan. |

The ADR is production-grade documentation.

---

### 9. Internal Consistency (ADR ↔ Implementation Plan)

**Status:** ✓ PASS

**Finding:** The implementation plan faithfully executes the ADR's design decisions. No contradictions detected.

**Cross-check examples:**

| ADR Decision | Implementation Plan Alignment |
|---|---|
| **All routes public by default (ADR line 77)** | Task 1.4 (middleware): `clerkMiddleware()` with no `auth.protect()` calls |
| **`ClerkProvider` wraps app (ADR line 142)** | Task 1.3: ClerkProvider wrapping in `app/layout.tsx` |
| **`merge-anonymous.ts` is unchanged (ADR line 56)** | Task 4.1: "Implementation in `merge-anonymous.ts` is fully agnostic... No changes required." |
| **FenrirSession removed (ADR line 90)** | Task 2.3: "Remove the `FenrirSession` interface from `types.ts`" |
| **GitHub is initial provider (ADR line 36)** | Phase 1 prerequisite (line 14): "GitHub OAuth configured" |

No gaps or misalignments. The plan cleanly implements the ADR.

---

### 10. Edge Cases & Robustness

**Status:** ✓ PASS (with 1 operational note)

**Finding:** Implementation plan documents edge cases and error handling thoughtfully.

**Examples:**
- **SSR hydration (Task 2.1, lines 229–232):** `useState` initializer guards against SSR. `status === "loading"` prevents storage reads until client hydrates. Correct.
- **Keyless mode (Task 1.3, lines 99–100):** If `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is absent, Clerk enters keyless mode auto-generating dev credentials. Acceptable behavior documented.
- **Merge idempotency (Task 4.1 checklist, line 383):** Tombstone prevents double-merge on re-signin. Verified in `merge-anonymous.ts` line 62.
- **Already signed in redirects (Task 3.1, line 339):** If user is already signed in when visiting `/sign-in`, page redirects to `/`. Correct pattern.

**One operational consideration:** The definition of done (line 580–589) requires "Playwright tests pass in CI without any real OAuth browser flow." However, no Playwright test files are included in the branch. The implementation plan documents the setup (`e2e/global-setup.ts`, `e2e/auth.spec.ts` outline provided) but doesn't include the actual `.spec.ts` files. This is expected (implementation deferred to GA sprint), but testers should validate the test strategy in a future sprint.

---

## Minor Issues & Recommendations

### Issue 1: JSDoc Comments Need Updates (Non-blocking)

**Files affected:**
- `storage.ts` lines 52, 62: References "Google sub claim" — update to "Clerk user.id or anonymous UUID"
- `merge-anonymous.ts` line 18: Parameter named `googleHouseholdId` — rename to `clerkHouseholdId` or generic `householdId`

**Severity:** Low — documentation/clarity only, no functional impact
**When to fix:** Task 4.2 expansion (before phase starts)

---

### Issue 2: Playwright Token Lifetime Not Documented (Non-blocking)

**Section affected:** Implementation Plan, lines 432–514 (Playwright Testing Strategy)

**Detail:** The plan does not specify the expected lifetime of Clerk Testing Tokens. For CI robustness (slow test suites), understand whether tokens expire mid-test and require refresh.

**Severity:** Low — operational documentation
**Recommendation:** Add note to CI workflow section: "Clerk Testing Tokens are valid for [X hours]. For test suites running longer than [Y minutes], verify token refresh behavior in `@clerk/testing` docs."

---

### Issue 3: Product Brief Auth Section Update Deferred (Non-blocking)

**Reference:** Backlog item line 67 — "Update product brief auth section to reflect chosen IDP"

**Status:** This update is explicitly deferred until GA planning is triggered (ADR line 38). Correct decision — auth is a GA prerequisite, not MVP. No action needed now.

---

## Test Plan for Future Implementation

When this ADR moves to implementation sprint, QA will validate:

1. **Anonymous flow:** Open app → add card → sign out → data persists under UUID
2. **Sign-in flow:** GitHub OAuth → Clerk session → householdId from `user.id` → anonymous cards merged silently
3. **Sign-out flow:** Clear Clerk session → return to anonymous state with fresh UUID
4. **Playwright tests:** `@clerk/testing` fixtures work in local dev and CI without real OAuth
5. **No leaked secrets:** CLERK_SECRET_KEY never in logs, PR comments, or artifacts
6. **Backward compat:** Existing anonymous users (no production users yet) can upgrade without friction

---

## Acceptance Checklist

- [x] Anonymous-first constraint preserved (routes are public, auth never gates)
- [x] householdId contract stable across migrations
- [x] All backlog acceptance criteria addressed
- [x] No secrets in documentation
- [x] Playwright strategy is safe (CLERK_SECRET_KEY not exposed)
- [x] Product brief compliance verified
- [x] Mermaid diagrams valid per style guide
- [x] ADR documents Context, Decision, Options, Consequences properly
- [x] Implementation plan steps align with ADR
- [x] Edge cases documented (SSR, keyless mode, merging, re-signin)

---

## Issues Found: Summary

| ID | Severity | Category | Resolution |
|---|---|---|---|
| 1 | Low | Documentation | Update JSDoc in storage.ts and merge-anonymous.ts for clarity |
| 2 | Low | Documentation | Document Clerk Testing Token lifetime expectations in Playwright section |
| 3 | Info | Deferred Scope | Product brief auth section update deferred until GA sprint (correct) |

**No blocking issues.** All noted items are enhancements or documentation updates that can be resolved asynchronously or during implementation.

---

## Final Verdict

**Status: APPROVED WITH NOTES**

### Rationale

1. **Architecture is sound:** Clerk is the right choice for the anonymous-first model, testability, and multi-provider roadmap.
2. **Implementation plan is detailed:** 5 phases, 18 tasks, clear dependencies, and acceptance criteria.
3. **Design respects product constraints:** No remote storage, no data model changes, anonymous-first preserved.
4. **Security hygiene is correct:** Secrets are templated, Testing Tokens are safe, Clerk session isolation is maintained.
5. **Documentation is high-quality:** ADR is complete and options are thoughtfully considered.

### Recommendations for Code Review

- Expand **Task 4.2** to include `merge-anonymous.ts` parameter renames and JSDoc updates
- Add token lifetime note to Playwright Testing Strategy section
- During implementation sprint, create Playwright test files (`e2e/global-setup.ts`, `e2e/auth.spec.ts`) and verify fixtures work in CI

### Next Steps

This design is ready for GA sprint planning. QA will validate implementation when code lands.

---

## Sign-Off

- **QA Tester:** Loki
- **Date:** 2026-03-01
- **Approval:** APPROVED WITH NOTES — Ready for code review and sprint planning.

---

**Related Documents:**
- [ADR-007: Clerk as Auth Platform](adr-clerk-auth.md)
- [Implementation Plan: Clerk Auth Integration](clerk-implementation-plan.md)
- [Backlog Item: idp-testing-alternative.md](../product/backlog/idp-testing-alternative.md)
- [Product Brief: Authentication section](../product-design-brief.md#constraints-until-ga)
