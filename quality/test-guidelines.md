# Fenrir Ledger — Test Guidelines

What belongs where. Loki must follow this when writing or reviewing tests.

## Test Pyramid

```
        / E2E (Playwright) \       <- Fewest: real browser, real pages
       /  Integration (Vitest) \    <- Middle: component + API route tests
      /   Unit (Vitest)          \  <- Most: pure logic, no DOM
```

### Current test counts

| Layer | Runner | Tests | Runtime |
|-------|--------|-------|---------|
| Unit | Vitest | ~136 | ~2s |
| Integration | Vitest + happy-dom | ~93 | ~3s |
| E2E | Playwright | ~228 | ~6min |

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

- `stripe/helpers.test.ts` — pure Stripe webhook status mapping
- `stripe/membership.test.ts` — membership state logic
- `sheets/url-validation.test.ts` — URL pattern matching
- `stripe/url-construction.test.ts` — Stripe redirect URL building
- `auth/require-auth.test.ts` — auth guard logic

---

## Integration Tests (Vitest + happy-dom)

**Location:** `development/frontend/src/__tests__/`
**Runner:** `npm run test:unit` (same runner, happy-dom environment)
**Environment:** happy-dom (configured in `vitest.config.ts`)

### What belongs here

- API route handlers: mock request -> call handler -> assert response
- Webhook processing: mock Stripe event -> assert side effects
- Auth middleware: mock session -> assert access control
- Component render tests: mount component -> assert output (no navigation)
- Feature flag / entitlement gate logic
- CSP header generation and nonce injection
- Session token refresh logic
- Hook state machines: import flow, picker config, entitlement gating

### What does NOT belong here

- Multi-page navigation flows
- Visual layout assertions (use E2E)
- Anything requiring a real HTTP server
- CSS pixel measurements or bounding box checks

### Examples of good integration tests

**Component render tests** (landmarks, aria-labels, structural output):
- `components/footer.test.tsx` — footer landmark, aria-labels, brand text, team colophon
- `components/ledger-topbar.test.tsx` — header banner, skip-nav, anonymous vs authenticated states
- `components/site-header.test.tsx` — marketing header, back link, action slot
- `components/app-shell.test.tsx` — main + footer landmarks, children rendering
- `components/ledger-shell.test.tsx` — main landmark with id="main-content"

**Hook tests** (state machines, fetch logic):
- `hooks/use-sheet-import.test.ts` — import state machine (method -> loading -> preview/error)
- `hooks/use-picker-config.test.ts` — Picker API key fetch, auth-gated, error handling
- `hooks/use-entitlement.test.ts` — tier gating, hasFeature(), Thrall vs Karl

**API route handler tests** (mock request -> assert response):
- `integration/auth-token-route.test.ts` — input validation, rate limiting, Google proxy
- `integration/sheets-import-route.test.ts` — auth gating, Karl tier, pipeline dispatch
- `integration/csp-headers.test.ts` — CSP nonce generation, directive building, security headers

### Pattern: mocking Next.js in component tests

```tsx
// Mock next/link
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/ledger",
}));

// Mock next-themes
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}));
```

### Pattern: mocking API route dependencies

```typescript
// Mock auth guard
const mockRequireAuth = vi.fn();
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args) => mockRequireAuth(...args),
}));

// In test: configure mock per scenario
mockRequireAuth.mockResolvedValueOnce({ ok: true, user: MOCK_USER });
// or
mockRequireAuth.mockResolvedValueOnce({
  ok: false,
  response: NextResponse.json({ error: "missing_token" }, { status: 401 }),
});
```

### Tests migrated from E2E (already implemented)

| Old E2E suite | Integration replacement | Tests |
|---------------|------------------------|-------|
| `csp-nonce/` (deleted Sprint 5) | `integration/csp-headers.test.ts` | 21 |
| `csp-youtube/` (deleted Sprint 5) | `integration/csp-headers.test.ts` | (included above) |
| `accessibility/` TC-A01..A04 | `components/app-shell.test.tsx`, `components/ledger-shell.test.tsx` | 5 |
| `accessibility/` TC-A14 | `components/ledger-topbar.test.tsx` | 1 |

---

## E2E Tests (Playwright)

**Location:** `quality/test-suites/<feature>/`
**Runner:** `npx playwright test`
**Config:** `development/frontend/playwright.config.ts`

### What belongs here

- **User journeys:** Add card -> edit -> close -> delete -> Valhalla
- **Navigation flows:** Sign in -> redirect -> dashboard
- **Multi-page interactions:** Import wizard URL -> CSV -> save
- **Visual regression:** Page loads, key elements visible, layout correct
- **Auth flows:** Sign in, sign out, callback handling, return-to
- **Responsive layout:** Mobile 375px breakpoints (real viewport)
- **Accessibility smoke:** Focus order, ARIA roles on interactive elements

### What does NOT belong here

- **Landmark presence checks** -> integration test (component render test)
- **HTTP header checks** -> integration test (no browser needed)
- **Pure logic validation** -> unit test
- **CSS animation timing** -> not testable reliably in E2E
- **One-time migration/upgrade checks** -> delete after migration lands
- **Issue-specific regression tests** -> merge into the feature suite once verified
- **Token/session logic** -> integration test (mock the token, test the flow)
- **aria-label presence** -> integration test (component render test)

### Rules for E2E test suites

1. **One suite per feature area**, not per issue. `card-lifecycle/` not `issue-333/`.
2. **No duplicate coverage.** If `card-lifecycle/edit-card.spec.ts` exists, don't create `card-crud/edit-card.spec.ts`.
3. **Max ~10 tests per file.** If a suite grows past 15, split by sub-feature.
4. **Delete upgrade/migration suites** once the migration is confirmed stable.
5. **Issue-specific regression tests** get merged into the parent feature suite after the fix lands.
6. **No animation timing assertions.** Test that elements appear/disappear, not how fast.
7. **Touch target / a11y checks** belong in `accessibility/a11y.spec.ts`, not scattered across suites.
8. **No structural DOM assertions.** Landmark presence, aria-label existence, and tag structure belong in integration tests. E2E tests should focus on user interactions and navigation.

### Current E2E suites (27 files, ~219 tests)

| Category | Suites | Tests |
|----------|--------|-------|
| Auth | auth/, auth-returnto/, stale-auth-nudge/ | ~31 |
| Dashboard | dashboard/, dashboard-tabs/ | ~24 |
| Cards | card-lifecycle/ (add, edit, close, delete) | ~21 |
| Wizard | wizard-step2/, wizard-back-button/, select-reset/ | ~23 |
| Layout | layout/ (topbar, howl-panel) | ~10 |
| Settings | settings-gate/ | ~9 |
| Theme | theme-toggle/ | ~5 |
| Profile | profile-dropdown/ | ~20 |
| A11y | accessibility/ (TC-A05..A13), dialog-a11y/ | ~14 |
| Other | chronicles/, empty-state-cta/, howl-count/, credit-limit-step2/, fee-bonus-step2/, csv-format-help/, reverse-tab-order/ | ~62 |

**Note (Issue #589):** sidebar.spec.ts and footer.spec.ts were deleted because the
sidebar was removed in Issue #403 and the Ledger Footer with About modal is no longer
rendered in any active layout. All E2E routes updated from `/` to `/ledger` to match
the current route structure (marketing pages own `/`, app pages own `/ledger`).

---

## Anti-Patterns (DO NOT)

- **Do not create a new spec file per GitHub issue.** Find the existing suite and add tests there.
- **Do not test the same page/feature in two E2E suites.** Consolidate.
- **Do not use E2E to test things that don't need a browser.** If you can test it with `expect(fn(input)).toBe(output)`, it's a unit test.
- **Do not keep one-time validation suites** (e.g., "nextjs-upgrade") after the change is stable.
- **Do not test CSS animation durations.** They're flaky and provide no value.
- **Do not exceed 15 tests per spec file.** Split or you're probably testing too granularly.
- **Do not test landmark presence in E2E.** Use component render tests with `@testing-library/react`.
- **Do not test aria-label presence in E2E.** Render the component in happy-dom and assert directly.

---

## Bloat Detection Rules (Loki Critique Checklist)

These rules are evaluated by `quality/scripts/loki-critique.sh` on every coverage run and
by Loki manually on every PR review. A suite that violates any of these rules is flagged as bloat.

### Consolidation Candidates

A suite is a consolidation candidate when any of the following is true:

1. **Issue-scoped directory name** — directory contains an issue number (e.g. `issue-333/`),
   a step number (e.g. `credit-limit-step2/`, `fee-bonus-step2/`, `wizard-step2/`), or a
   PR-specific scope (e.g. `wizard-back-button/`). These should be merged into the parent
   feature suite (`card-lifecycle/`, `wizard/`, etc.) once the fix is confirmed stable.

2. **Sub-feature tested in isolation** — a tiny suite (1-3 tests) for a single field or
   badge that belongs inside a larger feature suite. Examples: `howl-count/` (3 tests),
   `csv-format-help/` (3 tests), `credit-limit-step2/` (3 tests). These belong inside
   `dashboard-tabs/` or `card-lifecycle/` or the import wizard suite respectively.

3. **Duplicate page coverage** — two suites navigate to the same route and test overlapping
   behavior. Run `quality/scripts/loki-critique.sh --pattern-check` to surface these.

4. **Static content assertions** — tests that assert on exact copy text (e.g. h1, h2 text
   content, paragraph copy, button labels other than aria-label). These belong in a
   snapshot test or are not worth testing at all. They break on every copy edit.

5. **Layout/positioning measurements** — tests that check pixel widths, bounding box
   dimensions, or CSS properties (padding, borderRadius) to validate visual hierarchy.
   These are CSS tests in disguise and belong in visual regression tooling, not Playwright.
   Example: profile-dropdown TC-PD09 (`widthPx > 200`, `height >= 44` loop).

6. **Keyboard navigation over-specification** — testing every arrow key + wrap-around in
   a single suite is over-specified when the underlying tablist is a standard WAI-ARIA
   widget. Test: first tab activates, keyboard moves focus. Do not test every intermediate
   step. Example: `reverse-tab-order/` tests 7 keyboard navigation assertions that overlap
   with `dashboard-tabs/`.

7. **Guard-clause tests** — testing that a field is NOT visible on step 1 (i.e., a negative
   visibility assertion on state that is never supposed to show) adds minimal value because
   it tests the absence of an unrelated feature. These inflate count without covering risk.

### Per-File Hard Limits (Enforced by loki-critique.sh)

| Limit | Threshold | Action |
|-------|-----------|--------|
| Tests per spec file | >10 = WARNING, >15 = BLOAT | Split or cull |
| Navigation steps per test | >2 = WARNING | Refactor with seedCards() |
| Duplicated beforeEach setup | Same 4+ line block in 3+ tests | Extract helper |
| Static text assertions | ≥3 per file | Convert to integration test |
| BoundingBox/computedStyle calls | ≥1 per file | Remove (CSS test) |

### Coverage Layer Assignment (Authoritative Reference)

Before writing any test, consult this table:

| What you want to verify | Layer | Runner |
|-------------------------|-------|--------|
| Pure function output | Unit | Vitest |
| Component renders correct HTML | Integration | Vitest + happy-dom |
| API route returns correct status | Integration | Vitest mock |
| HTTP security headers | Integration | Vitest mock |
| ARIA role/label presence on component | Integration | Vitest + testing-library |
| User clicks button, sees result | E2E | Playwright |
| Multi-page navigation flow | E2E | Playwright |
| Auth redirect with real session mock | E2E | Playwright |
| Responsive layout at 375px viewport | E2E | Playwright (1 test per layout) |
| Form validation (field-level) | Integration | Vitest + testing-library |
| Form validation (submit flow) | E2E | Playwright |
| localStorage persistence across reload | E2E | Playwright |
| Static page copy / MDX content | None | Skip entirely |
| CSS animation timing | None | Skip entirely |
| CSS pixel dimensions | None | Skip entirely |
