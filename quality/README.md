# Quality Assurance — Fenrir Ledger

- [README.md](README.md) — This index. Overview of QA artifacts, test execution guide, and quality metrics.

---

This directory contains all QA artifacts: test plans, test cases, test scripts, and quality reports.

---

## Infrastructure Sync Notes

As of 2026-03-01, the project has completed two infrastructure renames:
- `development/src` → `development/frontend` (PR #44)
- `dev-server.sh` → `frontend-server.sh`, new `services.sh` created (PR #45)

All QA documents in this directory use `development/frontend` throughout.

---

## feat/llm-provider-factory — LLM Provider Abstraction Layer

**Status:** SHIP WITH KNOWN ISSUES | 1 Medium Defect, 1 Low Defect, 2 Observations

- **[llm-provider-factory-verdict.md](llm-provider-factory-verdict.md)** — Full QA verdict: 44 assertions across config, URL parsing, factory singleton, Anthropic extraction, Zod validation, WS pipeline, HTTP error paths

---

## Backend PR #41 — Backend WebSocket Import Pipeline (Stories 1-3)

**Status:** PASS — READY TO SHIP | 0 Blocking Defects | 3 Low-Severity Observations

- **[backend-pr41-verdict.md](backend-pr41-verdict.md)** — Full QA verdict: code review, build validation, health endpoint, HTTP error-path tests, security review

---

## Sprint 3 Deliverables

### Story 3.1 — Google OIDC Auth (Auth.js v5 + per-household localStorage)

**Status:** READY TO SHIP | 0 Defects Found

- **[story-3.1-verdict.md](story-3.1-verdict.md)** — 436-line comprehensive code review
  - Auth.js v5 configuration, JWT strategy, `householdId` derivation from Google `sub` claim
  - Per-household localStorage key namespacing (e.g., `fenrir_ledger:{householdId}:cards`)
  - Route protection middleware, session threading through all pages
  - Security analysis, TypeScript type augmentations, .env.example safety
  - Build verification (PASS), regression check (no issues)
  - 18 review sections covering every critical component
  - Final verdict: READY TO SHIP with 0 defects

- **[story-3.1-realm-utils-verdict.md](story-3.1-realm-utils-verdict.md)** — QA verdict for feat/realm-utils (PR #3)
  - `RealmLabel` interface refactor: `getRealmLabel()` returns object with `label`, `sublabel`, `rune`, `colorClass`
  - All 4 `CardStatus` return values verified correct
  - Single call site in `valhalla/page.tsx` correctly updated
  - Final verdict: SHIP with 0 defects

---

### Story 3.2 — Norse Copy Pass + Anonymous-First Auth

**Status:** READY TO SHIP | 0 Defects Found (after fixes)

- **[story-3.2-anon-auth-verdict.md](story-3.2-anon-auth-verdict.md)** — 400-line comprehensive QA verdict
  - 24 test cases across 7 suites (Anonymous First Load, Household ID, Upsell Banner, Sign-In Page, Mobile)
  - 100% pass rate: all anonymous state, banner behavior, navigation, mobile responsiveness working
  - Code review: AppShell, UpsellBanner, AuthContext, TopBar, Sign-In page all verified
  - Build clean: 0 TypeScript errors, 0 console errors, stable dev server
  - Final verdict: READY TO SHIP with 0 defects

- **[story-3.2-verdict.md](story-3.2-verdict.md)** — Re-validation after defect fixes
  - Three tooltip copy divergences corrected in `realm-utils.ts`
  - All strings verified against `product/copywriting.md`
  - Final verdict: SHIP (all defects resolved)

- **[story-3.2-norse-copy-verdict.md](story-3.2-norse-copy-verdict.md)** — QA verdict for feat/norse-copy-pass (PR #6)
  - Tagline replacement verified across SiteHeader, TopBar, AboutModal
  - Page title metadata verified for 5 routes
  - Two-Voice Rule compliance: functional copy plain English, atmospheric copy Norse
  - Final verdict: SHIP with 0 defects

---

### Story 3.3 — Framer Motion Card Animations

**Status:** READY TO SHIP | 0 Defects Found

- **[story-3.3-verdict.md](story-3.3-verdict.md)** — Static code review and build verification
  - `AnimatedCardGrid.tsx`: stagger spec verified (opacity, y-offset, easing, delay formula)
  - `CardSkeletonGrid.tsx`: layout mirror and saga-shimmer keyframe verified
  - `globals.css`: `@keyframes saga-shimmer` confirmed against ux/interactions.md spec
  - Loki Mode regression check: Fisher-Yates shuffle, random realm labels, event listener all intact
  - Build: PASS (framer-motion bundle impact acceptable)
  - Final verdict: SHIP with 0 defects

---

### Story 3.4 — HowlPanel (Urgent Deadlines Sidebar)

**Status:** READY TO SHIP | 0 Defects Found

- **[story-3.4-howl-panel-verdict.md](story-3.4-howl-panel-verdict.md)** — QA verdict for feat/howl-panel (PR #7)
  - All 13 acceptance criteria validated
  - Filtering, sorting, animations (desktop slide-in, mobile bottom-sheet) verified
  - `raven-warn` CSS keyframe correct; conditional shake on count increase only
  - Strong TypeScript, defensive null-handling, accessibility attributes verified
  - Final verdict: READY TO SHIP with 0 defects

---

### Story 3.5 — Valhalla Archive + Close Card Action

**Status:** READY TO SHIP | 0 Defects (after DEF-001 fix)

- **[story-3.5-verdict.md](story-3.5-verdict.md)** — Comprehensive code review and test execution
  - Data integrity: `closeCard()`, `getCards()`, `getClosedCards()` all verified
  - Tombstone card rendering, filter/sort controls, Framer Motion stagger verified
  - DEF-001 (wrong Gleipnir fragment in Valhalla empty state) fixed and re-verified
  - Final verdict: READY TO SHIP after fix

- **[story-3.5-valhalla-verdict.md](story-3.5-valhalla-verdict.md)** — QA verdict for feat/valhalla-route (PR #4)
  - All UI acceptance criteria verified in isolation
  - HOLD issued: merge conflict with feat/realm-utils (getRealmLabel return type)
  - DEF-001: Missing `.sublabel` accessor — documented with resolution strategy
  - Final verdict: SHIP after realm-utils merges and branch is rebased

---

## Sprint 2 Deliverables

### Easter Eggs Test Suite

**Status:** READY TO SHIP | 0 Defects Found

#### Test Automation
- **[scripts/test-easter-eggs.spec.ts](scripts/test-easter-eggs.spec.ts)** — 596-line Playwright test suite
  - 22 test cases across 8 test suites
  - Tests: trigger mechanics, modal content, one-time gates, edge cases, UI/UX, accessibility, fragment tracking
  - Eggs covered: Konami Howl (#2), Mountain Roots (#3), Fish Breath (#5), Forgemaster (#9), Loki Mode (variant)

- **[scripts/test-navigation.spec.ts](scripts/test-navigation.spec.ts)** — Navigation and link integrity test suite
  - Marketing site browsability: `/static/` loads, "Open the Ledger" CTA resolves to app root
  - Session archive navigation: `/sessions/` → chronicle entries → back navigation flow
  - Tests derived from design spec link requirements, not implemented behaviour

#### Test Documentation
- **[test-plan.md](test-plan.md)** — 283-line test strategy
  - Scope, test environment, test categories, deployment steps, risks, acceptance criteria, known limitations
  - One-stop reference for QA approach and test execution

- **[test-cases.md](test-cases.md)** — 480-line TC-format specifications
  - 22 detailed test cases (TC-E2-001 through TC-FRAG-002)
  - Each includes: category, priority, type, preconditions, steps, expected result, idempotency

#### Quality Reports
- **[EASTER-EGGS-AUDIT.md](EASTER-EGGS-AUDIT.md)** — 369-line comprehensive audit
  - Executive summary and egg-by-egg verdict
  - Edge case testing, SVG validation, accessibility audit
  - Test execution guide with commands
  - Final sign-off: READY TO SHIP with 0 defects

- **[easter-eggs-transparency-report.md](easter-eggs-transparency-report.md)** — 236-line SVG validation report
  - Programmatic SVG transparency inspection
  - Background rect removal verification
  - Rendering quality assessment
  - Approved for Sprint 2 deployment

---

## Running the Tests

### Prerequisites
```bash
# Install Playwright
npm install -D @playwright/test
```

### All Easter Egg Tests
```bash
npx playwright test quality/scripts/test-easter-eggs.spec.ts
```

### Navigation & Link Integrity Tests
```bash
npx playwright test quality/scripts/test-navigation.spec.ts
```

### Specific Test Suite
```bash
# Konami Howl tests only
npx playwright test quality/scripts/test-easter-eggs.spec.ts -g "Konami Howl"

# Modal UI tests only
npx playwright test quality/scripts/test-easter-eggs.spec.ts -g "Modal UI"

# Fragment tracking tests only
npx playwright test quality/scripts/test-easter-eggs.spec.ts -g "Fragment Count"
```

### Debug Mode
```bash
# Step through tests with inspector
npx playwright test quality/scripts/test-easter-eggs.spec.ts --debug
```

### HTML Report
```bash
# Generate interactive HTML report
npx playwright test quality/scripts/test-easter-eggs.spec.ts --reporter=html

# Open report
open playwright-report/index.html
```

### Custom Server
```bash
# Run tests against a specific test server
SERVER_URL=http://test.example.com npx playwright test quality/scripts/test-easter-eggs.spec.ts
```

---

## Test Structure

### Test Hierarchy
```
Easter Eggs — Fenrir Ledger
├── Egg #2: Konami Howl
│   ├── Full sequence trigger
│   ├── Reset on wrong key
│   └── Input field guard
├── Egg #3: The Roots of a Mountain (Sidebar Collapse)
│   ├── Modal opens on first collapse
│   ├── One-time gate blocks second trigger
│   └── Dismiss button closes modal
├── Egg #5: The Breath of a Fish (Footer © Hover)
│   ├── Modal opens on hover
│   ├── One-time gate blocks second hover
│   └── Touch trigger works on mobile
├── Egg #9: The Forgemaster's Signature (? Key)
│   ├── Modal opens on ? press
│   ├── One-time gate blocks second press
│   └── Input field guard prevents trigger
├── Egg #3 Variant: Loki Mode (7 Clicks)
│   ├── Toast appears after 7 clicks
│   └── Toast doesn't appear with fewer clicks
├── Modal UI & Interactions
│   ├── X button closes modal
│   ├── Dark theme styling is correct
│   └── Mobile responsive design
└── Fragment Count Tracking
    ├── Counter increments across multiple eggs
    └── Special message when all 6 found
```

### Test Case Format
Each test follows this structure:
```typescript
test("should [expected behavior]", async ({ page }) => {
  // Clear any stale state (localStorage)
  await clearEggStorage(page, keys);

  // Setup: navigate, wait for app
  await page.goto(BASE_URL);

  // Execute: trigger the egg (keyboard, click, hover, etc.)
  await triggerMechanism(page);

  // Assert: verify correct modal/overlay appears
  await expect(modalTitle).toContainText("Expected Title");
  await expect(modalImage).toHaveAttribute("src", /expected-file.svg/);
  await expect(modalContent).toContainText("Expected text");
});
```

---

## Test Coverage

| Egg | Trigger | Modal | Tests |
|-----|---------|-------|-------|
| #2 (Konami) | ↑ ↑ ↓ ↓ ← → ← → B A | FENRIR AWAKENS overlay | 3 |
| #3 (Mountain) | Sidebar collapse (1st) | "The Roots of a Mountain" | 3 |
| #5 (Fish) | Footer © hover/touch | "The Breath of a Fish" | 3 |
| #9 (Forgemaster) | Press ? | "The Forgemaster's Signature" | 3 |
| #3v (Loki) | Click "Loki" 7x | Gold toast | 2 |
| Modal & UI | Various | Modal interactions | 3 |
| Fragment Tracking | Multiple eggs | Counter state | 2 |
| **Total** | | | **22** |

---

## Quality Metrics

- **Total Test Cases:** 22
- **Test Suites:** 8 (Konami, Mountain, Fish, Forgemaster, Loki, Modal, Fragment)
- **Defects Found:** 0
- **Pass Rate:** 100%
- **Coverage:** 5/5 implemented eggs
- **Execution Time:** ~2-3 minutes (full suite)

---

## Eggs Tested

### Egg #2: Konami Howl
Listening for the classic Konami Code sequence (↑ ↑ ↓ ↓ ← → ← → B A). When triggered, displays a wolf silhouette rising from the bottom of the viewport with "FENRIR AWAKENS" status band at the top.

**Test Status:** PASS

### Egg #3: The Roots of a Mountain
Opening a modal when the user collapses the sidebar for the first time. Shows the first Gleipnir fragment ("The Roots of a Mountain").

**Test Status:** PASS

### Egg #5: The Breath of a Fish
Opening a modal when the user hovers (or touches on mobile) the © symbol in the footer. Shows the fifth Gleipnir fragment ("The Breath of a Fish").

**Test Status:** PASS

### Egg #9: The Forgemaster's Signature
Opening a modal when the user presses the ? key. Shows all team members (Freya, Luna, FiremanDecko, Loki) and the current Gleipnir fragment collection progress.

**Test Status:** PASS

### Egg #3 Variant: Loki Mode
After clicking "Loki" in the footer 7 times, a gold toast appears: "Loki was here. Your data is fine. Probably." The 7-click threshold references Loki's 7 known children in Norse mythology.

**Test Status:** PASS

---

## Future QA Deliverables

Out of scope for current sprints, planned for future:

- [ ] **quality/test-results.json** — Machine-readable test results
- [ ] **quality/quality-report.md** — Ship/No-Ship verdict report
- [ ] **quality/scripts/deploy.sh** — Idempotent deployment script
- [ ] **quality/scripts/setup-test-env.sh** — Test environment provisioning
- [ ] **quality/scripts/run-api-tests.sh** — Backend API test suite
- [ ] **quality/scripts/run-ui-tests.sh** — Full UI test pipeline

---

## Debugging Test Failures

### If a Test Fails

1. **Check the error message** — Playwright provides detailed failure info
   ```
   Error: expect(received).toContainText(expected)
   Expected substring: "The Roots of a Mountain"
   Received: "Modal did not appear"
   ```

2. **Run in debug mode** to step through:
   ```bash
   npx playwright test quality/scripts/test-easter-eggs.spec.ts --debug
   ```

3. **Check localStorage** — Some eggs won't trigger twice
   ```bash
   # Clear all egg keys before re-running
   npx playwright test quality/scripts/test-easter-eggs.spec.ts -g "one-time gate"
   ```

4. **Check SVG files** — If image assertions fail, verify files exist:
   ```bash
   ls -la /Users/declanshanaghy/src/github.com/declanshanaghy/fenrir-ledger/development/frontend/public/easter-eggs/
   ```

5. **Check server** — Tests expect `SERVER_URL` to be accessible
   ```bash
   curl $SERVER_URL  # Should return HTML (not 404/500)
   ```

---

## QA Standards

### Test Design Principles
- **Isolation:** Each test clears relevant localStorage before running
- **Idempotency:** Tests can run multiple times without cleanup
- **Devil's Advocate:** We test to prove things DON'T work, then verify they DO
- **Coverage:** Every trigger path, every modal, every edge case
- **Documentation:** Every test case has clear preconditions and expected results

### Assertion Strictness
- **Exact match:** Modal titles, button text ("So it is written")
- **Partial match:** Image alt text, body content (first 30 chars enough)
- **Regex:** Fragment count text, elapsed time values
- **Skip:** Audio playback quality, CSS animation frame timing

---

## Related Documentation

- **Design Brief:** [ux/easter-eggs.md](../ux/easter-eggs.md) — The source of truth for all eggs
- **Implementation:** [development/frontend/src/components/](../development/frontend/src/components/) — Source code for each egg
- **Git Convention:** [.claude/skills/git-commit/SKILL.md](../.claude/skills/git-commit/SKILL.md) — Commit format
- **Mermaid Guide:** [ux/ux-assets/mermaid-style-guide.md](../ux/ux-assets/mermaid-style-guide.md) — Diagram conventions

---

## Contact

**QA Tester:** Loki (@.claude/agents/loki.md)

Questions? Check [test-plan.md](test-plan.md) first — it covers most edge cases and FAQs.
