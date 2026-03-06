# Quality Assurance — Fenrir Ledger

Loki's domain. The trickster tests. His verdicts are final.

---

## Test Suites (Playwright)

All suites live in `quality/test-suites/`. Total: **577 tests across 26 spec files**.

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

---

## Quality Reports & Verdicts

- [quality-report.md](quality-report.md) — Current quality report: 577 tests, all PASS, Stripe Direct live, Patreon removed. Recommendation: SHIP

### Historical Verdicts (by PR / Story)

| PR / Story | Verdict | Result |
|------------|---------|--------|
| PR #184 — button hover/click/loading feedback | [button-feedback.spec.ts](test-suites/button-feedback/button-feedback.spec.ts) | PASS |
| PR #137 — settings-soft-gate | [settings-soft-gate.spec.ts](test-suites/settings-soft-gate/settings-soft-gate.spec.ts) | PASS |
| PR #138 — auth + card-crud | [sign-in.spec.ts](test-suites/auth/sign-in.spec.ts), [auth-callback.spec.ts](test-suites/auth/auth-callback.spec.ts), [edit-card.spec.ts](test-suites/card-crud/edit-card.spec.ts) | PASS |
| PR #136 — import wireframe fixes | [import-workflow-v2-verdict.md](import-workflow-v2-verdict.md) | PASS |
| PR #128 — Patreon removal | [patreon-removal.spec.ts](test-suites/patreon-removal/patreon-removal.spec.ts) | PASS |
| PR #119+#120 — Stripe Direct | [stripe-direct.spec.ts](test-suites/stripe-direct/stripe-direct.spec.ts) | PASS |
| PR #116 — theme foundation | [quality-report.md](quality-report.md) (historical round 2) | FAIL (infra defect, not code) |
| PR #113 — feature flags | [feature-flags.spec.ts](test-suites/feature-flags/feature-flags.spec.ts) | PASS |
| PR #61 — import workflow v2 | [import-workflow-v2-verdict.md](import-workflow-v2-verdict.md) | FAIL then PASS (3 defects fixed before merge) |
| feat/llm-provider-factory | [llm-provider-factory-verdict.md](llm-provider-factory-verdict.md) | SHIP WITH KNOWN ISSUES |
| Story 3.5 — Valhalla | [story-3.5-verdict.md](story-3.5-verdict.md) | PASS (after DEF-001 fix) |
| Story 3.4 — HowlPanel | [story-3.4-howl-panel-verdict.md](story-3.4-howl-panel-verdict.md) | PASS |
| Story 3.3 — Framer Motion | [story-3.3-verdict.md](story-3.3-verdict.md) | PASS |
| Story 3.2 — Anon Auth | [story-3.2-anon-auth-verdict.md](story-3.2-anon-auth-verdict.md) | PASS |
| Story 3.2 — Norse Copy | [story-3.2-norse-copy-verdict.md](story-3.2-norse-copy-verdict.md) | PASS |
| Story 3.1 — OIDC Auth | [story-3.1-verdict.md](story-3.1-verdict.md) | PASS |
| Story 3.1 — realm-utils | [story-3.1-realm-utils-verdict.md](story-3.1-realm-utils-verdict.md) | PASS |
| PR #41 — Backend pipeline | [backend-pr41-verdict.md](backend-pr41-verdict.md) | PASS (historical — backend removed in PR #60) |
| Sprint 2 — Easter Eggs | [EASTER-EGGS-AUDIT.md](EASTER-EGGS-AUDIT.md) | PASS |

---

## Test Documentation

- [test-plan.md](test-plan.md) — Sprint 2 test strategy (Easter Eggs scope; historical reference)
- [test-cases.md](test-cases.md) — TC-format specifications for Easter Eggs (22 cases; historical reference)
- [EASTER-EGGS-AUDIT.md](EASTER-EGGS-AUDIT.md) — Sprint 2 Easter Eggs comprehensive audit; final verdict PASS
- [easter-eggs-transparency-report.md](easter-eggs-transparency-report.md) — SVG transparency validation report


---

## Infrastructure Notes

- Sprints 1–5 shipped. Patreon fully removed (PR #128). Stripe Direct is the sole subscription platform.
- Backend server removed in PR #60 — import pipeline is fully serverless on Vercel (Next.js API routes).
- `development/src` renamed to `development/frontend` in PR #44.
- `quality/scripts/` directory referenced in older docs no longer exists — test automation lives in `quality/test-suites/`.
- The `specs/` directory has been deleted (stale orchestration plans).

---

## QA Standards

- Every assertion derives from acceptance criteria, not from what the code currently does.
- Each test clears relevant localStorage before running — idempotent by design.
- All defects filed as GitHub Issues immediately upon discovery.
- A PASS verdict requires: code review clean, build clean, tsc clean, GH Actions green, AND new Playwright tests written and passing.
