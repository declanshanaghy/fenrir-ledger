# Test Plan — Easter Eggs (Sprint 2)

## Overview

This test plan validates all implemented easter eggs in Fenrir Ledger. Easter eggs are hidden discoveries that should not obstruct primary task flow but reward players for exploration.

**Implemented Eggs (Sprint 2):**
- Egg #2: Konami Howl (Konami Code sequence)
- Egg #3: The Roots of a Mountain (sidebar collapse trigger)
- Egg #5: The Breath of a Fish (footer © hover)
- Egg #9: The Forgemaster's Signature (? key press)
- Egg #3 Variant: Loki Mode (click "Loki" 7 times)

**Out of Scope (future sprints):**
- Egg #1: Full Gleipnir Hunt (complex state machine)
- Egg #4: Console ASCII art
- Egg #6: LCARS mode
- Other TBD eggs

---

## Scope

### In Scope
- All trigger mechanisms work correctly
- Easter egg modals open with correct content
- One-time localStorage gates prevent re-triggering
- Fragment counter displays accurate counts
- Dismiss buttons work
- Modal styling matches design spec
- Responsive design on mobile
- Accessibility attributes (role, aria-live, aria-label)

### Out of Scope
- Audio playback quality (only verify the Audio API is called)
- Animation frame-perfect timing
- Cross-browser animation differences
- Server-side easter egg logic (client-side only)

---

## Test Environment

### Server Configuration
All tests run against a predefined test server:
- URL: Loaded from `SERVER_URL` environment variable (defaults to `http://localhost:3000`)
- No special configuration required — uses default test data

### Browser & Device Coverage
- Desktop: Chrome/Chromium (latest)
- Mobile simulation: 375×667px (iPhone SE)
- Touch events tested via Playwright touch API
- Keyboard events tested via Playwright keyboard API

### Test Data Setup
- Fresh localStorage state (cleared before each test)
- No pre-existing cards required (eggs work on empty dashboard)
- Optional: populate cards with fee_approaching status to test Ragnarök pulse in Konami egg

### Dependencies
- Playwright v1.40+
- Node.js 18+
- TypeScript (for .spec.ts files)

---

## Test Categories

### 1. Trigger Behaviour (Functional)
**Validates that user actions correctly activate each egg.**

| Egg | Trigger | Expected Behaviour |
|-----|---------|------------------|
| #2 Konami | Type ↑ ↑ ↓ ↓ ← → ← → B A | FENRIR AWAKENS overlay appears |
| #3 Mountain | Click sidebar collapse button | EasterEggModal opens with "The Roots of a Mountain" |
| #5 Fish | Hover © symbol in footer | EasterEggModal opens with "The Breath of a Fish" |
| #9 Forgemaster | Press ? | EasterEggModal opens with "The Forgemaster's Signature" |
| #3 Loki Mode | Click "Loki" 7 times | Toast "Loki was here..." appears |

### 2. Content Validation (Functional)
**Validates that egg modals display correct content.**

For each EasterEggModal egg (#3, #5, #9):
- Title matches exactly (Cinzel Decorative font, gold #f0b429)
- Image src contains expected SVG filename
- Image alt text describes the artifact
- Body text includes Gleipnir lore
- Fragment counter displays "N of 6"
- Dismiss button text is "So it is written"

### 3. One-Time Gate (Functional)
**Validates that each egg triggers only once.**

For eggs #3, #5, #9:
1. Clear localStorage gate
2. Trigger egg → modal opens
3. Dismiss modal
4. Trigger same egg again → modal does NOT open
5. Verify localStorage key is set

### 4. Edge Cases
**Validates robustness against unusual user actions.**

| Case | Scenario | Expected |
|------|----------|----------|
| Partial sequence | Type Konami halfway, then press wrong key | Sequence resets; no overlay |
| Form field focus | Press ?, type Konami while input focused | Egg does NOT trigger (don't interfere with typing) |
| Touch instead of hover | onTouchStart on © symbol | Modal opens (touch is valid trigger) |
| Rapid clicks | Click "Loki" 7+ times in quick succession | Toast appears once per 7-click threshold |

### 5. UI & Accessibility
**Validates modal design and a11y compliance.**

- Modal uses correct color scheme (dark bg, gold accents)
- Title/button fonts are correct
- Modal is responsive on mobile (92vw, max-width 680px)
- Modal dialog has role="dialog"
- Toast has role="status" aria-live="polite"
- Konami overlay has role="status" aria-live="assertive"
- Image elements have alt text
- Focus management works (focus returns to trigger on close)

### 6. Fragment Tracking (Integration)
**Validates that fragment count persists across eggs.**

- After triggering multiple eggs, count increments correctly
- localStorage persists fragment discovery across page reloads
- When all 6 fragments are found, special message appears

---

## Deployment & Setup

### Deploy Script
```bash
# See: quality/scripts/deploy.sh (not yet created — reference only)
# Deploys the test app to the predefined server
./quality/scripts/deploy.sh
```

### Setup Test Environment
```bash
# Clear any stale test data
./quality/scripts/setup-test-env.sh

# Creates fresh localStorage state
# Loads test server URL from .env
```

### Run Easter Egg Tests
```bash
# Run all easter egg tests
npx playwright test quality/scripts/test-easter-eggs.spec.ts

# Run specific test suite
npx playwright test quality/scripts/test-easter-eggs.spec.ts -g "Konami Howl"

# Run in debug mode
npx playwright test quality/scripts/test-easter-eggs.spec.ts --debug

# Generate HTML report
npx playwright test quality/scripts/test-easter-eggs.spec.ts --reporter=html
```

---

## Test Execution Timeline

| Phase | Duration | Activities |
|-------|----------|-----------|
| Setup | 5 min | Deploy app, clear test state, verify server |
| Trigger Tests | 10 min | Validate all 5 egg triggers |
| Content Tests | 10 min | Validate modal content, images, text |
| Gate Tests | 10 min | Validate one-time localStorage gates |
| Edge Cases | 10 min | Partial sequences, form field focus, etc. |
| UI/Mobile | 5 min | Responsive design, accessibility checks |
| Report | 5 min | Compile results, document any failures |
| **Total** | **~55 min** | |

---

## Risks & Assumptions

### Assumptions
1. **localStorage API works** — browser environment supports localStorage (not in private mode)
2. **Audio playback is available** — Audio() API exists; actual sound output is not verified (only API calls)
3. **Keyboard/mouse events fire** — Playwright can simulate all key presses and mouse events
4. **SVG files are deployed** — `/easter-eggs/*.svg` files exist at test server

### Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| localStorage disabled in test browser | Low | Test would fail to verify gate | Run tests in standard (non-private) mode |
| SVG 404s on test server | Low | Image src assertion fails | Verify `/public/easter-eggs/` files before running tests |
| Keyboard event timing | Low | Konami sequence fires early/late | Add waits between key presses if needed |
| Audio not loaded | Medium | Audio API fails, but non-fatal | Verify console warnings only, don't assert audio playback |
| Different viewport sizes fail | Low | Mobile tests may not match assertions | Use standard test viewport sizes (desktop, mobile) |

---

## Acceptance Criteria

### Test Pass Criteria (ALL must pass)
- [ ] All trigger mechanisms fire correctly
- [ ] All modal titles match exactly (case-sensitive)
- [ ] All modal images load and display
- [ ] All one-time gates prevent re-triggering
- [ ] Fragment count increments correctly across multiple eggs
- [ ] Dismiss buttons close modals
- [ ] Modal is responsive on mobile (92vw width)
- [ ] No JavaScript errors in console during egg triggers
- [ ] Accessibility attributes are present and correct

### Quality Metrics
- **Test Coverage:** 22 test cases across 5 implemented eggs
- **Pass Rate:** ≥ 95% (no more than 1 failure per 20 tests)
- **Execution Time:** < 5 minutes per full suite run

### Sign-Off
- [ ] Loki (QA Tester) approves test plan
- [ ] FiremanDecko (Principal Engineer) verifies implementation matches test expectations
- [ ] All 22 test cases pass on main branch

---

## Known Limitations

### Not Tested (by design, for future sprints)
- Eggs #1, #4, #6, #7, #10, #11 (not yet implemented)
- Ragnarök Threshold (#8) — requires special card state setup
- Loki Mode card grid shuffle animation (visual effect, hard to assert in headless mode)
- Audio playback quality or timing
- prefers-reduced-motion media query edge cases

### Browser Limitations
- Tests run in Chromium only (no Safari/Firefox in CI)
- Touch events simulated via Playwright (not real touch hardware)
- Keyboard layout may differ (e.g., ? key on non-US keyboards)

---

## Maintenance & Future

### When Adding New Eggs
1. Add trigger test case (TC-E{N}-001)
2. Add content validation test (TC-E{N}-002)
3. Add one-time gate test if applicable (TC-E{N}-003)
4. Update this test plan with new egg in scope
5. Add test to quality/scripts/test-easter-eggs.spec.ts

### Regression Prevention
- Keep localStorage gates strict (fail open, not closed)
- Verify SVG filenames in source before renaming
- Test on actual target viewport sizes
- Run full suite before each release

---

## Appendix: Test Data

### Sample localStorage State (Complete Collection)
```javascript
localStorage.setItem('egg:gleipnir-1', '1')
localStorage.setItem('egg:gleipnir-2', '1')
localStorage.setItem('egg:gleipnir-3', '1')
localStorage.setItem('egg:gleipnir-4', '1')
localStorage.setItem('egg:gleipnir-5', '1')
localStorage.setItem('egg:gleipnir-6', '1')
localStorage.setItem('egg:forgemaster', '1')
```

### Sample Card State (Trigger Ragnarök Pulse)
```javascript
// Create 3+ cards with fee_approaching status
// See development/frontend/src/lib/storage.ts for storage.addCard()
```

### Environment Variables
```bash
SERVER_URL=http://localhost:3000
SERVER_PORT=3000
```

