# UX Audit Report — ux/ vs Current App

**Date:** 2026-03-12
**Auditor:** Freya (Product Owner)
**Issue:** #584 — Audit ux/ docs against current app and consolidate wireframes
**Branch:** `research/issue-584-ux-audit`

---

## Summary

Full inventory of all files under `ux/` compared against the current implementation in `development/ledger/src/`. 9 files deleted, 2 files updated (wireframes.md index + README.md), 1 new file (this report).

| Metric | Count |
|--------|-------|
| Files audited (before) | 78 |
| Files classified as current | 65 |
| Files classified as stale — deleted | 9 |
| Files classified as stale — superseded notes added | 2 |
| Missing wireframes (implemented UI with no design doc) | 0 |
| Files remaining | 69 |

---

## Files Kept (Current)

All files in this list match the implemented UI or document planned features that are in-scope.

### Markdown Docs

| File | Status | Notes |
|------|--------|-------|
| `ux/README.md` | current | Updated index, wireframe count, implemented artifacts |
| `ux/wireframes.md` | current | Updated index — stale refs removed, missing categories added |
| `ux/interactions.md` | current | All animation specs implemented |
| `ux/theme-system.md` | current | Implemented in globals.css |
| `ux/easter-eggs.md` | current | All 11 easter eggs implemented |
| `ux/easter-egg-modal.md` | current | EasterEggModal.tsx implemented |
| `ux/light-theme-stone.md` | current | Stone/marble theme implemented in globals.css |
| `ux/light-theme-lightning.md` | current | Lightning Norse light theme implemented in globals.css |
| `ux/karl-upsell-interaction-spec.md` | current | KarlUpsellDialog.tsx implemented |
| `ux/multi-idp-interaction-spec.md` | current (planned) | Multi-IDP planned — spec describes future multi-provider flow; current prod uses Google PKCE |
| `ux/ux-assets/mermaid-style-guide.md` | current | Active diagram conventions |
| `ux/interactions/import-workflow-v2.md` | current | ImportWizard.tsx implemented |

### Assets

| File | Status | Notes |
|------|--------|-------|
| `ux/assets/font.png` | current | Referenced in design system |
| `ux/assets/icon.png` | current | App icon reference |
| `ux/assets/page.png` | current | Page screenshot reference |
| `ux/assets/theme.png` | current | Theme preview reference |

### Wireframes — app/

| File | Status | Notes |
|------|--------|-------|
| `wireframes/app/dashboard-tabs.html` | current | DashboardTabs.tsx implemented (#279) |
| `wireframes/app/howl-karl-tier.html` | current | HowlTeaserState.tsx + HowlEmptyState.tsx implemented (#398) |
| `wireframes/app/valhalla.html` | current | valhalla/page.tsx implemented |
| `wireframes/app/valhalla-karl-gated.html` | current | Valhalla tab gating via KarlUpsellDialog implemented (#377) |

### Wireframes — chrome/

| File | Status | Notes |
|------|--------|-------|
| `wireframes/chrome/sidebar-removal-dropdown-settings.html` | current | LedgerShell (no sidebar), profile dropdown settings, ThemeToggle — implemented (#403) |
| `wireframes/chrome/sidebar-removal-interaction-spec.md` | current | Interaction spec for sidebar removal |
| `wireframes/chrome/topbar.html` | current | TopBar.tsx (marketing) + LedgerTopBar.tsx implemented |
| `wireframes/chrome/profile-dropdown-avatar-right.html` | current | Avatar-right profile block implemented (#528) |
| `wireframes/chrome/profile-dropdown-redesign.html` | current | Profile dropdown redesign implemented |
| `wireframes/chrome/profile-dropdown-interaction-spec.md` | current | Profile dropdown interaction spec |
| `wireframes/chrome/howl-panel.html` | current | HowlPanel.tsx implemented (now inside tab, not sidebar) |
| `wireframes/chrome/footer.html` | current | Footer.tsx implemented |
| `wireframes/chrome/dashboard-tab-headers.html` | current | DashboardTabs tab header + summary sub-headers implemented |
| `wireframes/chrome/dashboard-tab-headers-interaction-spec.md` | current | Tab header interaction spec |
| `wireframes/chrome/button-feedback-states.html` | current | Button feedback states implemented (#150) |

### Wireframes — cards/

| File | Status | Notes |
|------|--------|-------|
| `wireframes/cards/add-card.html` | current | CardForm.tsx implemented |
| `wireframes/cards/wolves-hunger-about-modal.html` | current | WolfHungerMeter.tsx + AboutModal.tsx + ForgeMasterEgg.tsx implemented (#4.5) |

### Wireframes — auth/

| File | Status | Notes |
|------|--------|-------|
| `wireframes/auth/sign-in.html` | current | sign-in/page.tsx implemented |
| `wireframes/auth/multi-idp-sign-in.html` | current (planned) | Planned multi-IDP integration; production uses Google PKCE |
| `wireframes/auth/migration-prompt.html` | current | Migration prompt implemented |
| `wireframes/auth/upsell-banner.html` | current | UpsellBanner.tsx implemented |

### Wireframes — notifications/

| File | Status | Notes |
|------|--------|-------|
| `wireframes/notifications/ragnarok-threshold.html` | current | RagnarokContext.tsx implemented (#4.1) |
| `wireframes/notifications/card-count-milestones.html` | current | milestone-utils.ts toasts implemented (#4.2) |

### Wireframes — modals/

| File | Status | Notes |
|------|--------|-------|
| `wireframes/modals/about-modal.html` | current | AboutModal.tsx implemented |

### Wireframes — easter-eggs/

| File | Status | Notes |
|------|--------|-------|
| `wireframes/easter-eggs/easter-egg-modal.html` | current | EasterEggModal.tsx implemented |
| `wireframes/easter-eggs/konami-howl.html` | current | KonamiHowl.tsx implemented |
| `wireframes/easter-eggs/loki-mode.html` | current | Footer 7-click Loki shuffle implemented |
| `wireframes/easter-eggs/gleipnir-hunt-complete.html` | current | Gleipnir Hunt fragments 4+6 implemented (#4.3) |

### Wireframes — accessibility/

| File | Status | Notes |
|------|--------|-------|
| `wireframes/accessibility/accessibility-polish.html` | current | Accessibility polish implemented (#4.4) |
| `wireframes/accessibility/font-size-scale.html` | current | Font size scale implemented (#149) |

### Wireframes — stripe-direct/

| File | Status | Notes |
|------|--------|-------|
| `wireframes/stripe-direct/stripe-settings.html` | current | StripeSettings.tsx implemented |
| `wireframes/stripe-direct/sealed-rune-stripe.html` | current | SealedRuneModal.tsx implemented |
| `wireframes/stripe-direct/upsell-banner-stripe.html` | current | UpsellBanner.tsx (Stripe variant) implemented |
| `wireframes/stripe-direct/anonymous-checkout.html` | current | Anonymous Stripe checkout email modal implemented |
| `wireframes/stripe-direct/karl-upsell-dialog.html` | current | KarlUpsellDialog.tsx implemented (#377) |
| `wireframes/stripe-direct/karl-upsell-dialog-artwork.html` | current | KarlUpsellDialog featureImage prop + ThemedFeatureImage.tsx implemented (#560) |

### Wireframes — marketing-site/

| File | Status | Notes |
|------|--------|-------|
| `wireframes/marketing-site/layout-shell.html` | current | (marketing)/layout.tsx implemented |
| `wireframes/marketing-site/home-page.html` | current | (marketing)/home/page.tsx implemented |
| `wireframes/marketing-site/features.html` | current | (marketing)/features/page.tsx implemented |
| `wireframes/marketing-site/pricing.html` | current | (marketing)/pricing/page.tsx implemented |
| `wireframes/marketing-site/about.html` | current | (marketing)/about/page.tsx implemented |
| `wireframes/marketing-site/about-mobile.html` | current | Mobile variant of About page |
| `wireframes/marketing-site/theme-variants.html` | current | Dark/light theme rendering spec |

### Wireframes — chronicles/

| File | Status | Notes |
|------|--------|-------|
| `wireframes/chronicles/chronicle-index.html` | current | (marketing)/chronicles/page.tsx implemented |
| `wireframes/chronicles/chronicle-article.html` | current | (marketing)/chronicles/[slug]/page.tsx implemented |
| `wireframes/chronicles/chronicle-field-report.html` | current | Chronicle field report variant |
| `wireframes/chronicles/theme-variants.html` | current | Chronicle dark/light theme |

### Wireframes — import/

| File | Status | Notes |
|------|--------|-------|
| `wireframes/import/import-method-selection.html` | current | MethodSelection.tsx implemented |
| `wireframes/import/csv-upload.html` | current | CsvUpload.tsx implemented |
| `wireframes/import/safety-banner.html` | current | SafetyBanner.tsx implemented |

### Wireframes — wizard-animations/

| File | Status | Notes |
|------|--------|-------|
| `wireframes/wizard-animations/step-indicator.html` | current | StepIndicator.tsx implemented |
| `wireframes/wizard-animations/step-transitions.html` | current | Step transition animations implemented |
| `wireframes/wizard-animations/mobile-layout.html` | current | Mobile wizard layout implemented |

---

## Files Deleted (Stale)

| File | Reason |
|------|--------|
| `ux/wireframes/app/dashboard.html` | Describes old sidebar layout (272px persistent left sidebar). Sidebar removed entirely in Issue #403. Current layout is LedgerShell (no sidebar) + DashboardTabs. Superseded by `dashboard-tabs.html` + `sidebar-removal-dropdown-settings.html`. |
| `ux/wireframes/chrome/ledger-shell.html` | Sprint 6 spec describing slim TopBar (48px) + 220px desktop sidebar + 56px mobile bottom tabs. The sidebar was removed in Sprint 8 (#403). The canonical current shell spec is `sidebar-removal-dropdown-settings.html`. |
| `ux/wireframes/app/dashboard-5-tabs.html` | Issue #352 intermediate 5-tab expansion wireframe. The final tab implementation uses `dashboard-tabs.html` (Sprint 5, #279) and `dashboard-tab-headers.html` (Sprint 10). This intermediate spec is not referenced by any current component and was never the final design. |
| `ux/wireframes/light-theme-lightning.html` | Duplicate HTML visual spec. The canonical specification is `ux/light-theme-lightning.md`. The `.html` file contained the same color palette as the `.md` but in HTML format — a redundant artifact. The `.md` is the definitive spec. |
| `ux/wireframes/light-theme-stone.html` | Same issue as above. The canonical specification is `ux/light-theme-stone.md`. The `.html` duplicate was stale (predates the Lightning Norse overhaul notes in `.md`). |
| `ux/wireframes/marketing/marketing-site.html` | Old single-page marketing site wireframe (5-section static page). Superseded by the full `ux/wireframes/marketing-site/` directory which has page-specific wireframes for each route (home, features, pricing, about, layout-shell, theme-variants). |
| `ux/wireframes/profile-dropdown-my-cards.html` | Misplaced file at root of `wireframes/` (not in any category folder, violating ux/ conventions). Described adding a "My Cards" nav entry to the profile dropdown. The feature was implemented differently — as a direct link in `LedgerTopBar.tsx` (line 201–216), not in the profile dropdown. This provisional wireframe was superseded by the sidebar-removal and TopBar redesigns. |
| `ux/handoff-to-fireman-anon-auth.md` | Ephemeral process handoff document from Luna to FiremanDecko. Explicitly marked "Implementation status: implemented" as of 2026-03-01. The UX decisions it described are fully captured in the wireframes it references (topbar.html, upsell-banner.html, sign-in.html, migration-prompt.html). The technical questions it raised are resolved in ADR-005 and ADR-008. Keeping this doc adds confusion, not value. |
| `ux/interactions/claude-terminal-skin.md` | CLI terminal skin spec for Claude Code customization. Status explicitly marked "Not Yet Implemented." More critically, this describes Claude Code CLI aesthetics — not app UI. It belongs in `.claude/` tooling documentation, not in `ux/` which is exclusively app wireframes and interaction specs for `development/ledger/src/`. |

---

## Missing Wireframes (Implemented UI with No Design Doc)

No missing wireframes were identified. All major implemented UI surfaces have corresponding wireframes or specs in `ux/`.

### Notes on Unlisted UI

The following implemented components do not have dedicated wireframes, which is appropriate — they are straightforward ShadCN UI components or utility elements not requiring separate wireframe specs:

| Component | Reason no wireframe needed |
|-----------|---------------------------|
| `HeilungModal.tsx` | Easter egg variant, covered by `easter-egg-modal.html` pattern |
| `SyncIndicator.tsx` | Small utility indicator, no wireframe needed |
| `ThemeToggle.tsx` | Covered within sidebar-removal spec (rotary toggle) |
| `SignInNudge.tsx` | Minor nudge component, pattern covered by upsell-banner.html |
| `StaleAuthNudge.tsx` | Minor nudge component, no dedicated wireframe needed |
| `AuthGate.tsx` | Utility wrapper, no visual wireframe needed |
| `SubscriptionGate.tsx` | Utility wrapper, no visual wireframe needed |
| `UnlinkConfirmDialog.tsx` | Standard confirmation dialog, covered by form button layout spec |
| FAQAccordion components | Standard pattern, no wireframe needed |
| UI primitives (button.tsx, dialog.tsx, etc.) | ShadCN base components |

---

## Decisions Made

1. **`multi-idp-sign-in.html` kept.** The spec describes the planned multi-IDP target design. The wireframe index entry is labelled as "Planned (not yet implemented)." Luna should update or supersede this when multi-IDP implementation is scheduled.

2. **`light-theme-stone.md` and `light-theme-lightning.md` both kept.** `light-theme-stone.md` documents the initial Stone/Marble design (#146). `light-theme-lightning.md` documents the subsequent Lightning Norse overhaul (v2.0). Both are current: stone is the base, lightning is the overhaul. The `globals.css` `:root` block uses the lightning theme values.

3. **Chronicles wireframes kept.** The Chronicles (Prose Edda) route `/(marketing)/chronicles/` is fully implemented. The wireframes accurately describe the current UI.

4. **Wizard-animations wireframes kept.** The import wizard in `development/ledger/src/components/sheets/` includes `StepIndicator.tsx` and animated step transitions, matching the wireframe specs.

---

## Files to Watch

These files describe planned features. They remain in `ux/` as forward-looking specs but should be updated or superseded when implementation begins:

| File | Planned Feature |
|------|----------------|
| `ux/wireframes/auth/multi-idp-sign-in.html` | Multi-IDP sign-in dialog (planned) |
| `ux/multi-idp-interaction-spec.md` | Multi-IDP interaction spec (planned) |

---

*Audit completed by Freya — Product Owner · Fenrir Ledger · 2026-03-12*
