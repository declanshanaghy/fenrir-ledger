# Fenrir Ledger — Test Guidelines

What belongs where. Loki must follow this when writing or reviewing tests.

## Test Pyramid

```
        ╱ E2E (Playwright) ╲       ← Fewest: real browser, real pages
       ╱  Integration (Vitest) ╲    ← Middle: component + API route tests
      ╱   Unit (Vitest)          ╲  ← Most: pure logic, no DOM
```

## Unit Tests (Vitest)

**Location:** `development/frontend/src/__tests__/`
**Runner:** `npm run test:unit`

### What belongs here

- Pure functions: utils, helpers, formatters, validators
- Business logic: `computeCardStatus()`, `milestone-utils`, `gleipnir-utils`
- Data transformations: CSV parsing, LLM response extraction
- Type guards and schema validation
- Storage serialization/deserialization
- URL construction and validation
- Math: fee calculations, bonus aggregation

### What does NOT belong here

- Anything requiring a browser or DOM rendering
- API route handlers (use integration tests)
- Component rendering or interaction

### Examples of good unit tests

- `stripe/helpers.test.ts` — pure Stripe URL construction
- `stripe/membership.test.ts` — membership state logic
- `sheets/url-validation.test.ts` — URL pattern matching

---

## Integration Tests (Vitest + happy-dom)

**Location:** `development/frontend/src/__tests__/`
**Runner:** `npm run test:unit` (same runner, happy-dom environment)

### What belongs here

- API route handlers: mock request → call handler → assert response
- Webhook processing: mock Stripe event → assert side effects
- Auth middleware: mock session → assert access control
- Component render tests: mount component → assert output (no navigation)
- Feature flag / entitlement gate logic
- CSP header generation and nonce injection
- Session token refresh logic
- LLM prompt construction and response parsing

### What does NOT belong here

- Multi-page navigation flows
- Visual layout assertions (use E2E)
- Anything requiring a real HTTP server

### Tests that were removed from E2E and SHOULD become integration tests

| Old E2E suite | Why it's integration | What to test |
|---------------|---------------------|--------------|
| `csp-nonce/` (17 tests) | HTTP header assertions | CSP header contains nonce, frame-ancestors set |
| `csp-youtube/` (11 tests) | CSP policy checks | YouTube iframe allowed in CSP |
| `google-session-refresh/` (24 tests) | Token refresh logic | Token expiry detection, refresh flow, error handling |
| `wizard-animations/` (32 tests) | CSS class assertions | *Only* the ARIA label + reduced-motion tests are worth keeping; animation timing tests are not |

---

## E2E Tests (Playwright)

**Location:** `quality/test-suites/<feature>/`
**Runner:** `npx playwright test`
**Config:** `development/frontend/playwright.config.ts`

### What belongs here

- **User journeys:** Add card → edit → close → delete → Valhalla
- **Navigation flows:** Sign in → redirect → dashboard
- **Multi-page interactions:** Import wizard URL → CSV → save
- **Visual regression:** Page loads, key elements visible, layout correct
- **Auth flows:** Sign in, sign out, callback handling, return-to
- **Responsive layout:** Mobile 375px breakpoints (real viewport)
- **Accessibility smoke:** Focus order, ARIA roles on interactive elements

### What does NOT belong here

- **HTTP header checks** → integration test (no browser needed)
- **Pure logic validation** → unit test
- **CSS animation timing** → not testable reliably in E2E
- **One-time migration/upgrade checks** → delete after migration lands
- **Issue-specific regression tests** → merge into the feature suite once verified
- **Token/session logic** → integration test (mock the token, test the flow)

### Rules for E2E test suites

1. **One suite per feature area**, not per issue. `card-lifecycle/` not `issue-333/`.
2. **No duplicate coverage.** If `card-lifecycle/edit-card.spec.ts` exists, don't create `card-crud/edit-card.spec.ts`.
3. **Max ~10 tests per file.** If a suite grows past 15, split by sub-feature.
4. **Delete upgrade/migration suites** once the migration is confirmed stable.
5. **Issue-specific regression tests** get merged into the parent feature suite after the fix lands.
6. **No animation timing assertions.** Test that elements appear/disappear, not how fast.
7. **Touch target / a11y checks** belong in `accessibility/a11y.spec.ts`, not scattered across suites.

### Current E2E suites (post-cull, 336 tests / 40 files)

| Category | Suites | Tests |
|----------|--------|-------|
| Auth | auth/, auth-returnto/, stale-auth-nudge/ | ~37 |
| Dashboard | dashboard/, dashboard-tabs/ | ~24 |
| Cards | card-lifecycle/ (add, edit, close, delete) | ~21 |
| Wizard | wizard-step2/, wizard-back-button/ | ~15 |
| Import | import/ (wizard, norse-copy) | ~34 |
| Layout | layout/ (sidebar, topbar, footer, howl-panel) | ~19 |
| Settings | settings-soft-gate/, feature-flags/ | ~23 |
| Valhalla | valhalla/, valhalla-financial-sort/ | ~24 |
| Theme | theme-toggle/ | ~10 |
| Profile | profile-dropdown/ | ~20 |
| A11y | accessibility/, dialog-a11y/ | ~20 |
| Other | chronicles/, empty-state-cta/, select-reset/, status-badges/, sync-indicator/, homepage-logo/, howl-count/, credit-limit-step2/, fee-bonus-step2/, reverse-tab-order/ | ~89 |

---

## Anti-Patterns (DO NOT)

- **Do not create a new spec file per GitHub issue.** Find the existing suite and add tests there.
- **Do not test the same page/feature in two E2E suites.** Consolidate.
- **Do not use E2E to test things that don't need a browser.** If you can test it with `expect(fn(input)).toBe(output)`, it's a unit test.
- **Do not keep one-time validation suites** (e.g., "nextjs-upgrade") after the change is stable.
- **Do not test CSS animation durations.** They're flaky and provide no value.
- **Do not exceed 15 tests per spec file.** Split or you're probably testing too granularly.
