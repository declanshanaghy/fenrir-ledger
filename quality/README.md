# Quality Assurance — Fenrir Ledger

Loki's domain. The trickster tests. His verdicts are final.

---

## Test Suites (Playwright)

All suites live in `quality/test-suites/`. Total: **607 tests across 27 spec files**.

Run the full suite:
```bash
cd development/frontend
SERVER_URL=http://localhost:9653 npx playwright test ../../quality/test-suites/ --reporter=list
```

Run a single suite:
```bash
SERVER_URL=http://localhost:9653 npx playwright test ../../quality/test-suites/stripe-direct/ --reporter=list
```

| Suite | Spec File | Tests | PR |
|-------|-----------|-------|----|
| accessibility | [accessibility/a11y.spec.ts](test-suites/accessibility/a11y.spec.ts) | 22 | — |
| auth — sign-in | [auth/sign-in.spec.ts](test-suites/auth/sign-in.spec.ts) | 25 | #138 |
| auth — callback | [auth/auth-callback.spec.ts](test-suites/auth/auth-callback.spec.ts) | 21 | #138 |
| card-crud — edit | [card-crud/edit-card.spec.ts](test-suites/card-crud/edit-card.spec.ts) | 22 | #138 |
| card-lifecycle — add | [card-lifecycle/add-card.spec.ts](test-suites/card-lifecycle/add-card.spec.ts) | 26 | — |
| card-lifecycle — close | [card-lifecycle/close-card.spec.ts](test-suites/card-lifecycle/close-card.spec.ts) | 15 | — |
| card-lifecycle — delete | [card-lifecycle/delete-card.spec.ts](test-suites/card-lifecycle/delete-card.spec.ts) | 18 | — |
| card-lifecycle — edit | [card-lifecycle/edit-card.spec.ts](test-suites/card-lifecycle/edit-card.spec.ts) | 16 | — |
| dashboard | [dashboard/dashboard.spec.ts](test-suites/dashboard/dashboard.spec.ts) | 23 | — |
| easter-eggs | [easter-eggs/easter-eggs.spec.ts](test-suites/easter-eggs/easter-eggs.spec.ts) | 10 | — |
| feature-flags | [feature-flags/feature-flags.spec.ts](test-suites/feature-flags/feature-flags.spec.ts) | 18 | #113 |
| import | [import/import-wizard.spec.ts](test-suites/import/import-wizard.spec.ts) | 41 | — |
| import-wireframe-fixes | [import-wireframe-fixes/import-wireframe-fixes.spec.ts](test-suites/import-wireframe-fixes/import-wireframe-fixes.spec.ts) | 26 | #136 |
| layout — footer | [layout/footer.spec.ts](test-suites/layout/footer.spec.ts) | 18 | — |
| layout — howl-panel | [layout/howl-panel.spec.ts](test-suites/layout/howl-panel.spec.ts) | 27 | — |
| layout — sidebar | [layout/sidebar.spec.ts](test-suites/layout/sidebar.spec.ts) | 15 | — |
| layout — topbar | [layout/topbar.spec.ts](test-suites/layout/topbar.spec.ts) | 16 | — |
| navigation | [navigation/navigation.spec.ts](test-suites/navigation/navigation.spec.ts) | 8 | — |
| patreon-removal | [patreon-removal/patreon-removal.spec.ts](test-suites/patreon-removal/patreon-removal.spec.ts) | 29 | #128 |
| responsive | [responsive/mobile.spec.ts](test-suites/responsive/mobile.spec.ts) | 20 | — |
| settings-soft-gate | [settings-soft-gate/settings-soft-gate.spec.ts](test-suites/settings-soft-gate/settings-soft-gate.spec.ts) | 38 | #137 |
| stripe-direct | [stripe-direct/stripe-direct.spec.ts](test-suites/stripe-direct/stripe-direct.spec.ts) | 43 | #119+#120 |
| theme-toggle — foundation | [theme-toggle/theme-foundation.spec.ts](test-suites/theme-toggle/theme-foundation.spec.ts) | 20 | #116 |
| theme-toggle — ui | [theme-toggle/theme-toggle-ui.spec.ts](test-suites/theme-toggle/theme-toggle-ui.spec.ts) | 13 | — |
| valhalla | [valhalla/valhalla.spec.ts](test-suites/valhalla/valhalla.spec.ts) | 19 | — |
| button-feedback | [button-feedback/button-feedback.spec.ts](test-suites/button-feedback/button-feedback.spec.ts) | 29 | #184 |
| font-size-readability | [font-size-readability/font-size-readability.spec.ts](test-suites/font-size-readability/font-size-readability.spec.ts) | 30 | #183 |

---

## Quality Reports & Verdicts

- [quality-report.md](quality-report.md) — Current quality snapshot: 607 tests, all PASS, Stripe Direct live, Patreon fully removed, font sizes optimized. Last update: 2026-03-05 post-PR #170.

### Shipped Feature Verdicts (Story & PR Archive)

| Feature | Verdict Doc | Status | Notes |
|---------|-------------|--------|-------|
| Sprint 2 — Easter Eggs | [EASTER-EGGS-AUDIT.md](EASTER-EGGS-AUDIT.md) | PASS | 22 test cases, all eggs production-ready |
| Story 3.5 — Valhalla | [story-3.5-verdict.md](story-3.5-verdict.md) | PASS | Landing page copy & empty state |
| Story 3.5 — Alternate version | [story-3.5-valhalla-verdict.md](story-3.5-valhalla-verdict.md) | HOLD | Merge conflict note (historical) |
| Story 3.4 — HowlPanel | [story-3.4-howl-panel-verdict.md](story-3.4-howl-panel-verdict.md) | PASS | Howl chat UI & interactions |
| Story 3.3 — Framer Motion | [story-3.3-verdict.md](story-3.3-verdict.md) | PASS | Animation framework integration |
| Story 3.2 — Anon Auth | [story-3.2-anon-auth-verdict.md](story-3.2-anon-auth-verdict.md) | PASS | Anonymous household ID localStorage |
| Story 3.2 — Norse Copy | [story-3.2-norse-copy-verdict.md](story-3.2-norse-copy-verdict.md) | PASS | UI copy & Norse naming |
| Story 3.1 — OIDC Auth | [story-3.1-verdict.md](story-3.1-verdict.md) | PASS | Google OIDC integration |
| Story 3.1 — realm-utils | [story-3.1-realm-utils-verdict.md](story-3.1-realm-utils-verdict.md) | PASS | Realm label & utility layer |
| PR #136 — Import wireframe fixes | [import-workflow-v2-verdict.md](import-workflow-v2-verdict.md) | PASS | Google Sheets import UX |
| PR #61 — Import workflow v2 | [import-workflow-v2-verdict.md](import-workflow-v2-verdict.md) | PASS | 3-path CSV/URL/Picker import |

---

## Test Documentation

- [test-plan.md](test-plan.md) — Sprint 2 test strategy (Easter Eggs scope; historical reference)
- [test-cases.md](test-cases.md) — TC-format specifications for Easter Eggs (22 cases; historical reference)
- [EASTER-EGGS-AUDIT.md](EASTER-EGGS-AUDIT.md) — Sprint 2 Easter Eggs comprehensive audit; final verdict PASS
- [easter-eggs-transparency-report.md](easter-eggs-transparency-report.md) — SVG transparency validation report


---

## Infrastructure Notes

- **Sprints 1–5 shipped.** Patreon fully removed (PR #128). Stripe Direct is the sole subscription platform.
- **Serverless architecture:** Backend server removed in PR #60 — import pipeline is fully serverless on Vercel (Next.js API routes).
- **Directory structure:** `development/src` renamed to `development/frontend` in PR #44.
- **Test automation:** Test suites live in `quality/test-suites/` (27 spec files, 607+ tests).
- **Removed:** `quality/scripts/` (stale), `specs/` directory (stale orchestration plans), `backend-pr41-verdict.md` (historical backend removed), `llm-provider-factory-verdict.md` (feature not shipped).

---

## QA Standards

- Every assertion derives from acceptance criteria, not from what the code currently does.
- Each test clears relevant localStorage before running — idempotent by design.
- All defects filed as GitHub Issues immediately upon discovery.
- A PASS verdict requires: code review clean, build clean, tsc clean, GH Actions green, AND new Playwright tests written and passing.
