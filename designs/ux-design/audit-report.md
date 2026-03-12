# UX Audit Report — Ref #584

**Date:** 2026-03-12
**Author:** Freya (Product Owner)
**Branch:** `research/issue-584-ux-audit`

---

## Summary

Audited all files under `ux/**` against the current implementation in
`development/frontend/src/`. Classified each file as **current**, **stale**, or **missing**.
Consolidated all current files to `designs/ux-design/` (canonical location).
Deleted 9 stale files. Identified 7 missing wireframes.

| Category | Count |
|----------|-------|
| Files audited (ux/) | 78 |
| Classified as **current** | 69 |
| Classified as **stale** (deleted) | 9 |
| **Missing** (no wireframe for implemented UI) | 7 |

---

## Audit Methodology

1. Listed all files under `ux/` recursively (78 total).
2. Checked `designs/ux-design/` — did not exist; created as canonical location.
3. For each wireframe, cross-referenced against:
   - Component files in `development/frontend/src/components/`
   - App routes in `development/frontend/src/app/`
   - Inline code comments referencing wireframe paths
4. Classified each file and executed moves/deletions accordingly.

---

## Current Files (Kept — 69 files)

All files listed below were copied from `ux/` to `designs/ux-design/`.
The originals in `ux/` remain as-is (no breaking changes to existing references).

### Top-Level Docs

| File | Classification | Notes |
|------|---------------|-------|
| `ux/README.md` | **current** | Master design index; all referenced components implemented |
| `ux/wireframes.md` | **current** | Updated and superseded by `designs/ux-design/wireframes.md` |
| `ux/theme-system.md` | **current** | Fully implemented in `globals.css` + Tailwind config |
| `ux/interactions.md` | **current** | Animations implemented (saga-enter, status ring, Howl panel) |
| `ux/easter-eggs.md` | **current** | All 11 easter eggs implemented (Sprints 2–5) |
| `ux/easter-egg-modal.md` | **current** | EasterEggModal component implemented |
| `ux/handoff-to-fireman-anon-auth.md` | **current** | Anonymous-first auth model fully implemented |
| `ux/karl-upsell-interaction-spec.md` | **current** | KarlUpsellDialog + entitlement gating implemented |
| `ux/multi-idp-interaction-spec.md` | **current** | Retained — describes planned Clerk integration (not yet implemented, but valid future spec) |
| `ux/ux-assets/mermaid-style-guide.md` | **current** | Project-wide diagram conventions |
| `ux/interactions/import-workflow-v2.md` | **current** | Import wizard (ImportWizard, CsvUpload, etc.) all implemented in `sheets/` |

### App Wireframes

| File | Classification | Matched Component / Route | Notes |
|------|---------------|--------------------------|-------|
| `wireframes/app/dashboard-5-tabs.html` | **current** | `DashboardTabs.tsx` + `LedgerBottomTabs.tsx` | 5-tab expansion target (#352); current implementation is 2-tab (howl/active) in content, 3-tab in bottom nav — wireframe is the design target |
| `wireframes/app/dashboard-tabs.html` | **current** | `DashboardTabs.tsx` | 2-tab layout (#279) — matches current `DashboardTabs` component exactly |
| `wireframes/app/howl-karl-tier.html` | **current** | `HowlPanel.tsx` + `KarlUpsellDialog.tsx` | Karl-tier gating implemented (#398) |
| `wireframes/app/valhalla.html` | **current** | `/ledger/valhalla/page.tsx` | Valhalla route + tombstone cards implemented |
| `wireframes/app/valhalla-karl-gated.html` | **current** | `KarlUpsellDialog.tsx` + `LedgerBottomTabs.tsx` | Valhalla gating (#377) implemented |

### Chrome Wireframes

| File | Classification | Matched Component | Notes |
|------|---------------|------------------|-------|
| `wireframes/chrome/ledger-shell.html` | **current** | `LedgerShell.tsx` + `LedgerTopBar.tsx` + `LedgerBottomTabs.tsx` | Slim 48px top bar + mobile bottom tab bar implemented (#372) |
| `wireframes/chrome/howl-panel.html` | **current** | `HowlPanel.tsx` | Active + empty variants implemented |
| `wireframes/chrome/footer.html` | **current** | `Footer.tsx` | Three-column footer + easter egg triggers implemented |
| `wireframes/chrome/button-feedback-states.html` | **current** | `ui/button.tsx` | All button states implemented (#150) |
| `wireframes/chrome/dashboard-tab-headers.html` | **current** | `DashboardTabs.tsx` | Dismissable tab headers + tooltips + empty states (#589) |
| `wireframes/chrome/dashboard-tab-headers-interaction-spec.md` | **current** | `DashboardTabs.tsx` | Interaction spec for tab headers |
| `wireframes/chrome/profile-dropdown-redesign.html` | **current** | `LedgerTopBar.tsx` → `ProfileDropdown` | Original profile dropdown design |
| `wireframes/chrome/profile-dropdown-avatar-right.html` | **current** | `LedgerTopBar.tsx` → `ProfileDropdown` | Avatar right alignment (#528) |
| `wireframes/chrome/profile-dropdown-interaction-spec.md` | **current** | `LedgerTopBar.tsx` | Interaction spec |
| `wireframes/chrome/profile-dropdown-my-cards.html` | **current** | `LedgerTopBar.tsx` → `ProfileDropdown` "My Cards" entry | My Cards link in dropdown (#441) |
| `wireframes/chrome/sidebar-removal-dropdown-settings.html` | **current** | `LedgerShell.tsx` + `LedgerBottomTabs.tsx` | Sidebar fully removed, Settings in dropdown (#403) |
| `wireframes/chrome/sidebar-removal-interaction-spec.md` | **current** | `LedgerShell.tsx` | Interaction spec |

### Cards Wireframes

| File | Classification | Matched Component |
|------|---------------|------------------|
| `wireframes/cards/add-card.html` | **current** | `CardForm.tsx`, `/ledger/cards/new/page.tsx`, `/ledger/cards/[id]/edit/page.tsx` |
| `wireframes/cards/wolves-hunger-about-modal.html` | **current** | `WolfHungerMeter.tsx`, `AboutModal.tsx`, `ForgeMasterEgg.tsx` |

### Auth Wireframes

| File | Classification | Matched Component | Notes |
|------|---------------|------------------|-------|
| `wireframes/auth/sign-in.html` | **current** | `/ledger/sign-in/page.tsx` | Google PKCE sign-in implemented |
| `wireframes/auth/multi-idp-sign-in.html` | **current** (future) | Not yet implemented | Clerk integration planned; retained as target spec |
| `wireframes/auth/migration-prompt.html` | **current** | Auth callback page | Anonymous → signed-in migration prompt implemented |
| `wireframes/auth/upsell-banner.html` | **current** | `UpsellBanner.tsx` (layout/), `SignInNudge.tsx` | Cloud-sync upsell implemented |

### Notifications Wireframes

| File | Classification | Matched Component |
|------|---------------|------------------|
| `wireframes/notifications/ragnarok-threshold.html` | **current** | `RagnarokContext` + `DashboardTabs.tsx` Ragnarök styling |
| `wireframes/notifications/card-count-milestones.html` | **current** | Card milestone toasts (implemented in dashboard) |

### Modals Wireframes

| File | Classification | Matched Component |
|------|---------------|------------------|
| `wireframes/modals/about-modal.html` | **current** | `AboutModal.tsx` |

### Easter Eggs Wireframes

| File | Classification | Matched Component |
|------|---------------|------------------|
| `wireframes/easter-eggs/easter-egg-modal.html` | **current** | `EasterEggModal.tsx` |
| `wireframes/easter-eggs/konami-howl.html` | **current** | `KonamiHowl.tsx` |
| `wireframes/easter-eggs/loki-mode.html` | **current** | `HeilungModal.tsx` + Loki mode logic |
| `wireframes/easter-eggs/gleipnir-hunt-complete.html` | **current** | Gleipnir Hunt logic in `GleipnirBearSinews.tsx` etc. |

### Accessibility Wireframes

| File | Classification | Notes |
|------|---------------|-------|
| `wireframes/accessibility/accessibility-polish.html` | **current** | ARIA landmarks, skip-nav, focus rings all implemented |
| `wireframes/accessibility/font-size-scale.html` | **current** | Typography scale implemented |

### Stripe Direct Wireframes

| File | Classification | Matched Component |
|------|---------------|------------------|
| `wireframes/stripe-direct/stripe-settings.html` | **current** | `StripeSettings.tsx` |
| `wireframes/stripe-direct/sealed-rune-stripe.html` | **current** | `SealedRuneModal.tsx` |
| `wireframes/stripe-direct/upsell-banner-stripe.html` | **current** | `UpsellBanner.tsx` (entitlement/) |
| `wireframes/stripe-direct/anonymous-checkout.html` | **current** | Anonymous checkout email flow (API routes + modal) |
| `wireframes/stripe-direct/karl-upsell-dialog.html` | **current** | `KarlUpsellDialog.tsx` (base) |
| `wireframes/stripe-direct/karl-upsell-dialog-artwork.html` | **current** | `KarlUpsellDialog.tsx` + `ThemedFeatureImage.tsx` with `featureImage` prop (#560) |

### Marketing Site Wireframes

| File | Classification | Matched Route |
|------|---------------|--------------|
| `wireframes/marketing-site/home-page.html` | **current** | `app/(marketing)/page.tsx` + `app/(marketing)/home/page.tsx` |
| `wireframes/marketing-site/about.html` | **current** | `app/(marketing)/about/page.tsx` |
| `wireframes/marketing-site/about-mobile.html` | **current** | Mobile variant of above |
| `wireframes/marketing-site/features.html` | **current** | `app/(marketing)/features/page.tsx` |
| `wireframes/marketing-site/pricing.html` | **current** | `app/(marketing)/pricing/page.tsx` |
| `wireframes/marketing-site/layout-shell.html` | **current** | `app/(marketing)/layout.tsx` + `MarketingNavbar.tsx` + `MarketingFooter.tsx` |
| `wireframes/marketing-site/theme-variants.html` | **current** | Marketing site theme variants |

### Chronicles Wireframes

| File | Classification | Matched Route |
|------|---------------|--------------|
| `wireframes/chronicles/chronicle-index.html` | **current** | `app/(marketing)/chronicles/page.tsx` |
| `wireframes/chronicles/chronicle-article.html` | **current** | `app/(marketing)/chronicles/[slug]/page.tsx` |
| `wireframes/chronicles/chronicle-field-report.html` | **current** | Chronicle article variant |
| `wireframes/chronicles/theme-variants.html` | **current** | Chronicle theming |

### Import / Wizard Wireframes

| File | Classification | Matched Component |
|------|---------------|------------------|
| `wireframes/import/csv-upload.html` | **current** | `CsvUpload.tsx` |
| `wireframes/import/import-method-selection.html` | **current** | `MethodSelection.tsx` |
| `wireframes/import/safety-banner.html` | **current** | `SafetyBanner.tsx` |
| `wireframes/wizard-animations/step-indicator.html` | **current** | `StepIndicator.tsx` |
| `wireframes/wizard-animations/step-transitions.html` | **current** | Import wizard transitions |
| `wireframes/wizard-animations/mobile-layout.html` | **current** | Import wizard mobile layout |

### Assets

| File | Classification | Notes |
|------|---------------|-------|
| `ux/assets/font.png` | **current** | Design asset reference |
| `ux/assets/icon.png` | **current** | App icon reference |
| `ux/assets/page.png` | **current** | Page layout reference |
| `ux/assets/theme.png` | **current** | Theme reference |

---

## Stale Files (Deleted — 9 files)

| File Deleted | Reason |
|-------------|--------|
| `ux/wireframes/app/dashboard.html` | Described old sidebar+grid layout (Sprint 1–2). Fully superseded by LedgerShell (#372) which removed the sidebar entirely. `LedgerShell.tsx` (Issue #403) confirms sidebar is gone. |
| `ux/wireframes/chrome/topbar.html` | Described old 56px `TopBar` component (AppShell). Superseded by `LedgerTopBar` (48px) as part of LedgerShell (#372). `LedgerTopBar.tsx` references `ledger-shell.html` not `topbar.html`. |
| `ux/wireframes/marketing/marketing-site.html` | Described old static HTML site at `/static/index.html`. App is now a NextJS marketing site (`app/(marketing)/`). Marketing-site wireframes in `wireframes/marketing-site/` are the current spec. |
| `ux/wireframes/marketing/static-site-footer.html` | Same as above — described old static HTML footer. Superseded by `MarketingFooter.tsx` component. |
| `ux/wireframes/light-theme-lightning.html` | "Lightning Norse" full overhaul wireframe — never implemented. Current theme toggle is a standard dark/light switch (`ThemeToggle.tsx`). README states "Dark only" as Wolf's Law #5 — this was an experimental direction that was not pursued. |
| `ux/wireframes/light-theme-stone.html` | "Stone/marble" light redesign wireframe — never implemented. Same reason as above. |
| `ux/light-theme-lightning.md` | Spec document for the lightning-norse theme — never implemented. |
| `ux/light-theme-stone.md` | Spec document for the stone-marble theme — never implemented (Issue #146 noted as "too timid"). |
| `ux/interactions/claude-terminal-skin.md` | Claude Code terminal skin spec — explicitly marked "Not Yet Implemented" in the doc itself. This is for the developer CLI, not the Fenrir Ledger app UI. Out of scope for this design system. |

---

## Missing Wireframes (Implemented UI Without Spec — 7 items)

The following components are live in production but have no corresponding wireframe. Recommended for Luna in a future sprint.

| Component | Location | Description | Priority |
|-----------|----------|-------------|----------|
| `StaleAuthNudge` | `LedgerTopBar.tsx` | Compact inline nudge shown when anon user has a stale entitlement cache | **Medium** |
| `SignInNudge` / `CompactSignInNudge` | `LedgerTopBar.tsx` | Compact sign-in reminder with dismiss button | **Medium** |
| FAQ Page | `app/(marketing)/faq/page.tsx` | FAQ accordion page — no wireframe | Low |
| Privacy Policy Page | `app/(marketing)/privacy/page.tsx` | Privacy policy page — no wireframe | Low |
| Terms of Service Page | `app/(marketing)/terms/page.tsx` | Terms page — no wireframe | Low |
| `/home` standalone route | `app/(marketing)/home/page.tsx` | Separate `/home` route (distinct from `/`) | Low |
| `ConsoleSignature` easter egg | `ConsoleSignature.tsx` | Browser console ASCII easter egg — no wireframe | Low |

---

## Consolidation Result

```
designs/ux-design/           ← canonical location (NEW)
├── README.md
├── audit-report.md          ← this file
├── wireframes.md            ← updated index
├── theme-system.md
├── interactions.md
├── easter-eggs.md
├── easter-egg-modal.md
├── handoff-to-fireman-anon-auth.md
├── karl-upsell-interaction-spec.md
├── multi-idp-interaction-spec.md
├── assets/                  ← design reference assets
├── interactions/
│   └── import-workflow-v2.md
├── ux-assets/
│   └── mermaid-style-guide.md
└── wireframes/
    ├── accessibility/       (2 files)
    ├── app/                 (5 files)
    ├── auth/                (4 files)
    ├── cards/               (2 files)
    ├── chrome/              (11 files)
    ├── chronicles/          (4 files)
    ├── easter-eggs/         (4 files)
    ├── import/              (3 files)
    ├── marketing-site/      (7 files)
    ├── modals/              (1 file)
    ├── notifications/       (2 files)
    ├── stripe-direct/       (6 files)
    └── wizard-animations/   (3 files)

ux/                          ← legacy location (unchanged except stale deletions)
  (same structure, minus 9 deleted stale files)
```

---

## Recommendations

1. **Update agent configs** — Luna's agent config in `.claude/agents/luna.md` should be updated to reference `designs/ux-design/wireframes/` as the canonical wireframe directory.

2. **Update component JSDoc comments** — Components that reference `ux/wireframes/...` paths should be updated to point to `designs/ux-design/wireframes/...` (tracked separately, not in scope for this PR).

3. **Wire up missing specs** — The 7 missing wireframes (especially `StaleAuthNudge` and `SignInNudge`) should be specced by Luna before any redesign work on those components.

4. **Multi-IDP spec** — `multi-idp-interaction-spec.md` describes a planned Clerk integration. If Clerk is not on the roadmap, this spec should be explicitly marked as deferred or removed in a future sprint.

5. **5-tab expansion** — `dashboard-5-tabs.html` shows the target design for 5 content tabs. Current implementation has 2 content tabs (Howl + Active) in `DashboardTabs.tsx` and 3 navigation tabs in `LedgerBottomTabs.tsx`. The 5-tab target (Issue #352) is still pending implementation.
