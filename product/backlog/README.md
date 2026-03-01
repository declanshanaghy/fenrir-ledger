# Freya's Backlog

Groomed stories ready for sprint planning. All stories follow the format defined in the Product Owner SKILL.md.

## Stories

| Story | Priority | Status | Sprint Target |
|-------|----------|--------|---------------|
| [Branch-Based CI/CD + Vercel Preview Deployments](story-branch-based-ci-cd.md) | P2-High | Shipped | PR #9 |
| [Optional Login — Google OIDC + Cloud Sync Upsell (Iteration 1)](story-auth-oidc-google.md) | P3-Medium | Shipped | commit 60d8f64, QA 24/24 |
| [4.1 — Ragnarök Threshold Mode](story-4.1-ragnarok-threshold.md) | P1-Critical | Ready | Sprint 4 |
| [4.2 — Card Count Milestone Toasts](story-4.2-card-count-milestones.md) | P2-High | Ready | Sprint 4 |
| [4.3 — Gleipnir Hunt: Wire Fragments 4 and 6 + Unlock](story-4.3-gleipnir-hunt-complete.md) | P2-High | Ready | Sprint 4 |
| [4.4 — Accessibility and UX Polish Pass](story-4.4-accessibility-and-ux-polish.md) | P2-High | Ready | Sprint 4 |
| [4.5 — Wolf's Hunger Meter + About Modal Completeness](story-4.5-wolves-hunger-and-about-modal.md) | P3-Medium | Ready | Sprint 4 |

## Deferred / Future

See [future-deferred.md](future-deferred.md) for items explicitly parked out of Sprint 4 with rationale.

| Item | Why Deferred |
|------|-------------|
| LCARS Mode (Star Trek Easter Egg #6) | Sprint cap reached; pure delight, no user-value dependency |
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

## Sprint Cap

Max 5 stories per sprint (per product brief technical constraints). Sprint 4 is at cap.
