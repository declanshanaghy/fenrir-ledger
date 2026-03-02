# Freya's Backlog

Groomed stories ready for sprint planning. All stories follow the format defined in the Product Owner SKILL.md.

## Stories

| Story | Priority | Status | Sprint Target |
|-------|----------|--------|---------------|
| [Branch-Based CI/CD + Vercel Preview Deployments](story-branch-based-ci-cd.md) | P2-High | Shipped | PR #9 |
| [Optional Login — Google OIDC + Cloud Sync Upsell (Iteration 1)](story-auth-oidc-google.md) | P3-Medium | Shipped | commit 60d8f64, QA 24/24 |
| [4.1 — Ragnarök Threshold Mode](story-4.1-ragnarok-threshold.md) | P1-Critical | Done | Sprint 4, PR #38 |
| [4.2 — Card Count Milestone Toasts](story-4.2-card-count-milestones.md) | P2-High | Done | Sprint 4, PR #36 |
| [4.3 — Gleipnir Hunt: Wire Fragments 4 and 6 + Unlock](story-4.3-gleipnir-hunt-complete.md) | P2-High | Done | Sprint 4, PR #39 |
| [4.4 — Accessibility and UX Polish Pass](story-4.4-accessibility-and-ux-polish.md) | P2-High | Done | Sprint 4, PR #40 |
| [4.5 — Wolf's Hunger Meter + About Modal Completeness](story-4.5-wolves-hunger-and-about-modal.md) | P3-Medium | Done | Sprint 4, PR #37 |
| [5.1 — Silent Auto-Merge on Google Sign-In](story-5.1-silent-auto-merge.md) | P1-Critical | Done | Sprint 5, PR #20 |
| [5.2 — Google Sheets Import: Anthropic Conversion API Route](story-5.2-sheets-import-api-route.md) | P1-Critical | Done | Sprint 5, PR #19 |
| [5.3 — Google Sheets Import: Import Wizard UI](story-5.3-sheets-import-wizard.md) | P1-Critical | Done | Sprint 5, PR #21 |
| [5.4 — Google Sheets Import: Deduplication and Persistence](story-5.4-sheets-import-confirm.md) | P2-High | Done | Sprint 5, PR #22 |
| [5.5 — LCARS Mode: Star Trek Easter Egg](story-5.5-lcars-mode.md) | P3-Medium | Ready | Sprint 5 (not yet merged) |

## Deferred / Future

See [future-deferred.md](future-deferred.md) for items explicitly parked out of Sprint 4 with rationale.

| Item | Why Deferred |
|------|-------------|
| localStorage Migration Wizard | Product brief constraint — deferred to GA, no exceptions |
| Smart Reminders / Notification Engine | Requires backend; out of MVP scope |
| Reward Value Tracking + Net ROI | Significant feature, needs its own design brief |
| Timeline View | No UX wireframe; needs Luna's design sprint first |
| Action Recommendations (Valkyrie Engine) | Complex business logic; needs dedicated design brief |
| Wolf Paw Cursor | Browser support inconsistency; Luna must champion |
| Data Export CSV/JSON | Pre-GA only; localStorage DevTools access sufficient |

## Sprint 4 Priority Rationale

**Why this order:**

1. **4.1 Ragnarök (P1)**: Core product promise — "never be surprised by a fee." Ragnarök is the app's most dramatic alarm surface. Ships first because it is the only P1 item and has no dependencies on other Sprint 4 stories.

2. **4.2 Milestones (P2)**: Low complexity, high emotional payoff. Hooks into the card-add flow that FiremanDecko already knows cold. Ships second because it is a quick win that builds momentum.

3. **4.3 Gleipnir Hunt (P2)**: Completes the signature easter egg system. Fragments 4 and 6 are the only missing pieces in an otherwise complete set. The unlock mechanic (shimmer + Valhalla entry) is what makes the whole system pay off. Also resolves Loki's Sprint 3 QA hold (DEF-001: wrong `aria-description` on `ValhallaEmptyState`). Ships third.

4. **4.4 Accessibility Polish (P2)**: Required before real users see this. The team has shipped fast; technical debt in focus management and mobile layout must be addressed before the product enters any broader user testing. Ships fourth — it touches many components, so better to land after other Sprint 4 changes are merged.

5. **4.5 Wolf's Hunger Meter (P3)**: Purely additive to the About modal and ForgeMasterEgg overlay. No risk to core flows. Ships last because if the sprint runs short, this is the safest story to defer to Sprint 5.

## Sprint 4 Groom Notes (2026-02-28)

These observations were made during the Sprint 4 groom. They refine the stories but do not change their scope or priority.

**4.1 Ragnarök**: `KonamiHowl.tsx` already performs a card-data read to check for urgent cards (for the existing pulse flash). The new `RagnarokContext` must be the single source of truth — `KonamiHowl` should consume the context rather than doing its own card read. The audio volume escalation note has been updated: as of Sprint 3, the wolf animation is visual-only (no audio node). The Konami volume criterion may be marked N/A in the QA handoff if no audio is wired.

**4.3 Gleipnir Hunt**: Both fragment components (`GleipnirBearSinews`, `GleipnirBirdSpittle`) and their hooks are fully built — only the trigger wiring is missing. The Sprint 3 DEF-001 bug (wrong `aria-description` on `ValhallaEmptyState`) is explicitly in scope for this story's delivery.

**4.5 Wolf's Hunger Meter**: The `SignUpBonus` interface uses `met: boolean` — not `bonusMet`. All acceptance criteria and technical notes have been corrected. This was a grooming error in the original story; it would have caused a type error on first compile.

## Sprint 5 Priority Rationale

**Why this order:**

1. **5.1 Silent Auto-Merge (P1)**: Corrects a product decision flaw in the existing auth flow. The current migration dialog introduces a "Start fresh" footgun — a user who taps it accidentally loses the connection between their local data and their cloud account. Removing the choice and always merging is the unambiguously correct behavior. Ships first because it is a behavioral correction with no new dependencies.

2. **5.2 Sheets Import API Route (P1)**: The server-side Anthropic conversion route is the technical foundation for the entire Google Sheets import feature. FiremanDecko can build and test it in isolation (Stories 5.3 and 5.4 depend on it). Ships second so the API exists before the wizard UI is integrated.

3. **5.3 Sheets Import Wizard (P1)**: The user-facing entry point for the import feature. Depends on 5.2 for integration testing. Ships third because Luna needs Story 5.2's response schema to design the preview step accurately.

4. **5.4 Sheets Import Deduplication (P2)**: Completes the import feature by adding safe merge behavior against the existing portfolio. Ships fourth because it is the last leg of the import pipeline — Stories 5.2 and 5.3 must be done first.

5. **5.5 LCARS Mode (P3)**: The highest-value deferred delight item from Sprint 4. The spec is fully written. No new design work required. Ships last — it is the one story that can be safely deferred to Sprint 6 if the sprint runs short.

## Sprint 5 Groom Notes (2026-02-28)

**5.1 Auto-Merge**: The existing migration prompt dialog (`ux/wireframes/auth/migration-prompt.html`) is now superseded. Luna must produce an updated wireframe for the auto-merge toast surface. The "Start fresh" path is eliminated by product decision — if any code implements this path, it must be removed. Key risk: the tombstone strategy for `fenrir:household` must be carefully implemented to prevent re-merge on subsequent sign-ins. FiremanDecko to confirm the OAuth callback hook location before starting.

**5.2 Sheets Import API Route**: `ANTHROPIC_API_KEY` is a new server-side dependency. It must be provisioned in Vercel before the route can be tested in preview deployments. The model ID is `claude-haiku-4-5-20251001` (confirmed in the story spec). CSV truncation at 100k characters is a product-specified limit; do not change without Freya's approval.

**5.3 Sheets Import Wizard**: Story 5.3 and 5.4 are split at the "Import N cards" confirm button. Story 5.3 owns the wizard UI up to and including that button. Story 5.4 owns the callback that fires when the button is pressed. The interface between them is `onConfirmImport(cards: Card[])` — a callback prop. This boundary must be respected to keep both stories independently reviewable by Loki.

**5.4 Sheets Import Deduplication**: The issuer alias normalization question (e.g. `"american_express"` vs `"amex"`) must be resolved before FiremanDecko begins the deduplication function. Product preference: normalize using a lookup table; FiremanDecko proposes the table for Freya's approval.

**5.5 LCARS Mode**: `Ctrl+Shift+W` browser conflict is a known risk. If `e.preventDefault()` cannot reliably suppress the browser's "close all tabs" behavior in all target browsers, the fallback is `Ctrl+Shift+L`. FiremanDecko must test this before committing to the key combo. The stardate formula is intentionally simplified — canonical accuracy is not required.

## Sprint Cap

Max 5 stories per sprint (per product brief technical constraints). Sprint 5 is at cap.
