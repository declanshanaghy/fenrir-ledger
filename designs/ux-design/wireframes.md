# Wireframes: Fenrir Ledger

> **Canonical location:** `designs/ux-design/wireframes/`
> All wireframes have been consolidated here from `ux/wireframes/` — see `audit-report.md` for full history.

Wireframes are standalone HTML5 documents. They use only structural layout — no colors, no custom fonts, no shadows, no decorative borders. Theme styling is defined in `theme-system.md` and applied separately by the engineer. If the theme changes, the wireframes remain valid.

**Convention:**
- All wireframe files live in `designs/ux-design/wireframes/{category}/`
- Link to them from any `.md` file that references a layout
- The HTML files use semantic elements (`<nav>`, `<main>`, `<aside>`, `<section>`, `<form>`, `<fieldset>`) to convey structure
- Permitted CSS: `display: flex/grid`, `border: 1px solid`, `width/height`, `padding/margin`, `font-size`, `font-weight`
- Prohibited CSS: `color`, `background-color`, `font-family` beyond `sans-serif`, `border-radius`, `box-shadow`, `opacity` (except for placeholder items)

---

## Sprint 10 Wireframes

| Story | File | Description |
|-------|------|-------------|
| #560 — Upsell Dialog Artwork Alignment | [wireframes/stripe-direct/karl-upsell-dialog-artwork.html](wireframes/stripe-direct/karl-upsell-dialog-artwork.html) | Align KarlUpsellDialog images with /features page artwork: 7 scenarios — before/after comparison (Valhalla), desktop Howl variant (garmr), desktop Smart Import variant (mimir, Ref #559), mobile 375px bottom-sheet (single column, full-bleed image), complete featureImage prop mapping table for all 9 Karl features, ThemedFeatureImage anatomy + sizing notes, props diff table (featureImage new required prop) |
| #589 — Dashboard Tab Headers | [wireframes/chrome/dashboard-tab-headers.html](wireframes/chrome/dashboard-tab-headers.html) | Dismissable tab headers (purpose/status guide), dismissable summary sub-headers (dynamic card counts), simplified runic empty states, and card status label tooltips; interaction spec: [dashboard-tab-headers-interaction-spec.md](wireframes/chrome/dashboard-tab-headers-interaction-spec.md) |

---

## Sprint 9 Wireframes

| Story | File | Description |
|-------|------|-------------|
| #441 — Profile Dropdown My Cards | [wireframes/chrome/profile-dropdown-my-cards.html](wireframes/chrome/profile-dropdown-my-cards.html) | My Cards navigation entry added to profile dropdown |
| #528 — Profile Dropdown Avatar Right | [wireframes/chrome/profile-dropdown-avatar-right.html](wireframes/chrome/profile-dropdown-avatar-right.html) | Move avatar from left to right inside the profile block: 7 sections — before/after dropdown anatomy side-by-side, desktop/mobile context, profile row anatomy with measurement annotations, implementation reference, interaction spec, accessibility checklist |

---

## Sprint 8 Wireframes

| Story | File | Description |
|-------|------|-------------|
| #403 — Sidebar Removal + Dropdown Settings | [wireframes/chrome/sidebar-removal-dropdown-settings.html](wireframes/chrome/sidebar-removal-dropdown-settings.html) | Remove sidebar entirely, move Settings into profile dropdown, replace 3-button theme picker with rotary single-click toggle; interaction spec: [sidebar-removal-interaction-spec.md](wireframes/chrome/sidebar-removal-interaction-spec.md) |

---

## Sprint 7 Wireframes

| Story | File | Description |
|-------|------|-------------|
| #398 — Howl Panel Karl Tier | [wireframes/app/howl-karl-tier.html](wireframes/app/howl-karl-tier.html) | Howl Panel gated behind Karl ($3.99/mo): Thrall teaser, Karl full panel, tab bar anatomy, mobile 375px, Ragnarök gate, interaction + a11y spec |
| #377 — KarlUpsellDialog | [wireframes/stripe-direct/karl-upsell-dialog.html](wireframes/stripe-direct/karl-upsell-dialog.html) | Common KarlUpsellDialog shared across all Karl-gated features; desktop + mobile bottom-sheet; props table; interaction spec |
| #377 — Valhalla Karl Gated | [wireframes/app/valhalla-karl-gated.html](wireframes/app/valhalla-karl-gated.html) | Valhalla tab gating in the dashboard; desktop + mobile behaviors; Thrall vs Karl behavior table |

---

## Sprint 6 Wireframes

| Story | File | Description |
|-------|------|-------------|
| #372 — LedgerShell Layout | [wireframes/chrome/ledger-shell.html](wireframes/chrome/ledger-shell.html) | Layout shell for `/ledger/*` routes: slim top bar (48px) + desktop sidebar (220px) + mobile bottom tab bar (56px, 4 tabs); 8 scenarios; accessibility requirements; interaction spec |

---

## Sprint 5 Wireframes

| Story | File | Description |
|-------|------|-------------|
| #352 — Dashboard 5-Tab Expansion | [wireframes/app/dashboard-5-tabs.html](wireframes/app/dashboard-5-tabs.html) | Expanded tabbed dashboard: 5 tabs (The Howl, Active, The Hunt, Valhalla, All); 11 scenarios; full tab anatomy |
| #279 — Dashboard Tabs Redesign | [wireframes/app/dashboard-tabs.html](wireframes/app/dashboard-tabs.html) | Initial tabbed dashboard layout (2 tabs): The Howl + Active; 6 scenarios; interaction spec |

---

## Sprint 4 Wireframes

| Story | File | Description |
|-------|------|-------------|
| 4.1 — Ragnarök Threshold Mode | [wireframes/notifications/ragnarok-threshold.html](wireframes/notifications/ragnarok-threshold.html) | 3 dashboard states, red radial overlay spec, RagnarokContext data flow, HowlPanel header override |
| 4.2 — Card Count Milestone Toasts | [wireframes/notifications/card-count-milestones.html](wireframes/notifications/card-count-milestones.html) | All 5 milestone toast designs, desktop + mobile positioning, stacked behavior, localStorage gate flow |
| 4.3 — Full Gleipnir Hunt | [wireframes/easter-eggs/gleipnir-hunt-complete.html](wireframes/easter-eggs/gleipnir-hunt-complete.html) | Fragment 4 (7th card save) + Fragment 6 (15s Valhalla idle) triggers, Gleipnir reward entry, DEF-001 fix |
| 4.4 — Accessibility + UX Polish | [wireframes/accessibility/accessibility-polish.html](wireframes/accessibility/accessibility-polish.html) | Focus ring spec, skip-nav, ARIA landmarks, heading hierarchy, touch target audit, mobile layouts, reduced-motion |
| 4.5 — Wolf's Hunger Meter + About Modal | [wireframes/cards/wolves-hunger-about-modal.html](wireframes/cards/wolves-hunger-about-modal.html) | Hunger meter in About modal + ForgeMasterEgg, 4 display variants, shared WolfHungerMeter component spec |

---

## Sprint 3 Wireframes (Auth, Stripe, Import)

| Story | File | Description |
|-------|------|-------------|
| Anonymous-first Auth | [wireframes/auth/sign-in.html](wireframes/auth/sign-in.html) | Dedicated /ledger/sign-in page — optional upgrade; no-data and has-data variants; "Continue without signing in" as first-class CTA |
| Migration Prompt | [wireframes/auth/migration-prompt.html](wireframes/auth/migration-prompt.html) | Post-OAuth modal dialog: Import N cards vs. Start fresh; no close button; state flow diagram |
| Cloud Sync Upsell Banner | [wireframes/auth/upsell-banner.html](wireframes/auth/upsell-banner.html) | Dismissible banner for anonymous users; dismiss lifecycle; localStorage flag spec |
| Multi-IDP Sign-In (Planned) | [wireframes/auth/multi-idp-sign-in.html](wireframes/auth/multi-idp-sign-in.html) | Planned Clerk integration: modal dialog, 1–4+ providers; **not yet implemented** (current: Google PKCE only) |
| Stripe Settings | [wireframes/stripe-direct/stripe-settings.html](wireframes/stripe-direct/stripe-settings.html) | StripeSettings component: 3 states (Thrall/Karl/Canceled), desktop + mobile, state machine, API flow |
| SealedRuneModal | [wireframes/stripe-direct/sealed-rune-stripe.html](wireframes/stripe-direct/sealed-rune-stripe.html) | Premium feature paywall modal with Stripe Checkout redirect |
| Upsell Banner Stripe | [wireframes/stripe-direct/upsell-banner-stripe.html](wireframes/stripe-direct/upsell-banner-stripe.html) | Dashboard upgrade banner for Thrall users, Stripe Checkout CTA |
| Anonymous Checkout | [wireframes/stripe-direct/anonymous-checkout.html](wireframes/stripe-direct/anonymous-checkout.html) | Email collection modal for anonymous Stripe subscribers |
| Import Method Selection | [wireframes/import/import-method-selection.html](wireframes/import/import-method-selection.html) | Step 1 of import wizard: method selection (CSV, URL, manual) |
| CSV Upload | [wireframes/import/csv-upload.html](wireframes/import/csv-upload.html) | Step 2C of import wizard: CSV file upload |
| Safety Banner | [wireframes/import/safety-banner.html](wireframes/import/safety-banner.html) | Import safety / data loss warning banner |
| Step Indicator | [wireframes/wizard-animations/step-indicator.html](wireframes/wizard-animations/step-indicator.html) | Multi-step wizard step indicator + a11y spec |
| Step Transitions | [wireframes/wizard-animations/step-transitions.html](wireframes/wizard-animations/step-transitions.html) | Wizard step transition animations |
| Mobile Layout (Import) | [wireframes/wizard-animations/mobile-layout.html](wireframes/wizard-animations/mobile-layout.html) | Import wizard mobile layout spec |

---

## Sprint 2 Wireframes (Core UI)

| Story | File | Description |
|-------|------|-------------|
| Add / Edit Card | [wireframes/cards/add-card.html](wireframes/cards/add-card.html) | Multi-section form: identity, fee, welcome bonus, notes; add + edit mode |
| Valhalla | [wireframes/app/valhalla.html](wireframes/app/valhalla.html) | Hall of the Honored Dead: tombstone cards, filter bar, empty state, Gleipnir special entry |
| The Howl Panel | [wireframes/chrome/howl-panel.html](wireframes/chrome/howl-panel.html) | Alert sidebar: active and empty variants; z-index; mobile: bottom drawer |
| App Footer | [wireframes/chrome/footer.html](wireframes/chrome/footer.html) | Three-column footer: brand wordmark + tagline, nav links, team credits; Easter Eggs #3 and #5 |
| Button Feedback States | [wireframes/chrome/button-feedback-states.html](wireframes/chrome/button-feedback-states.html) | All button variants across 5 states: default, hover, active, loading, disabled |
| About Modal | [wireframes/modals/about-modal.html](wireframes/modals/about-modal.html) | Two-column dialog: wolf logo + team pack + seven impossible ingredients |
| Easter Egg Modal | [wireframes/easter-eggs/easter-egg-modal.html](wireframes/easter-eggs/easter-egg-modal.html) | Reusable discovery dialog triggered by any easter egg |
| Konami Code — The Howl | [wireframes/easter-eggs/konami-howl.html](wireframes/easter-eggs/konami-howl.html) | Wolf silhouette overlay, FENRIR AWAKENS band, Ragnarok pulse variant |
| Loki Mode | [wireframes/easter-eggs/loki-mode.html](wireframes/easter-eggs/loki-mode.html) | Scrambled card grid, random realm badges, toast, timer, footer trigger |

---

## Sprint 1 Wireframes (Foundation)

| Story | File | Description |
|-------|------|-------------|
| Accessibility Font Scale | [wireframes/accessibility/font-size-scale.html](wireframes/accessibility/font-size-scale.html) | Before/after typography hierarchy comparison, Tailwind migration map, exceptions list |
| Gleipnir Hunt Complete | [wireframes/easter-eggs/gleipnir-hunt-complete.html](wireframes/easter-eggs/gleipnir-hunt-complete.html) | Fragment triggers, Gleipnir reward entry |

---

## Marketing Wireframes

| File | Description |
|------|-------------|
| [wireframes/marketing-site/home-page.html](wireframes/marketing-site/home-page.html) | Marketing home page — NextJS app route `/` |
| [wireframes/marketing-site/about.html](wireframes/marketing-site/about.html) | About page — `/about` |
| [wireframes/marketing-site/about-mobile.html](wireframes/marketing-site/about-mobile.html) | About page mobile variant |
| [wireframes/marketing-site/features.html](wireframes/marketing-site/features.html) | Features page — `/features` |
| [wireframes/marketing-site/pricing.html](wireframes/marketing-site/pricing.html) | Pricing page — `/pricing` |
| [wireframes/marketing-site/layout-shell.html](wireframes/marketing-site/layout-shell.html) | Marketing layout shell (navbar + footer) |
| [wireframes/marketing-site/theme-variants.html](wireframes/marketing-site/theme-variants.html) | Marketing site theme variants |

---

## Chronicles Wireframes

| File | Description |
|------|-------------|
| [wireframes/chronicles/chronicle-index.html](wireframes/chronicles/chronicle-index.html) | Chronicles index page — `/chronicles` |
| [wireframes/chronicles/chronicle-article.html](wireframes/chronicles/chronicle-article.html) | Individual chronicle article — `/chronicles/[slug]` |
| [wireframes/chronicles/chronicle-field-report.html](wireframes/chronicles/chronicle-field-report.html) | Field report variant |
| [wireframes/chronicles/theme-variants.html](wireframes/chronicles/theme-variants.html) | Chronicles theme variants |

---

## Profile Dropdown Wireframes (Consolidated)

| File | Description |
|------|-------------|
| [wireframes/chrome/profile-dropdown-redesign.html](wireframes/chrome/profile-dropdown-redesign.html) | Profile dropdown redesign (original) |
| [wireframes/chrome/profile-dropdown-avatar-right.html](wireframes/chrome/profile-dropdown-avatar-right.html) | Sprint 9: Avatar moved to right (#528) |
| [wireframes/chrome/profile-dropdown-my-cards.html](wireframes/chrome/profile-dropdown-my-cards.html) | Sprint 9: My Cards nav entry in dropdown (#441) |
| [wireframes/chrome/profile-dropdown-interaction-spec.md](wireframes/chrome/profile-dropdown-interaction-spec.md) | Interaction spec for profile dropdown |

---

## Missing Wireframes (Implemented UI Without Spec)

The following components are implemented but have no dedicated wireframe. Luna should create these:

| Component | Route / Location | Priority |
|-----------|-----------------|----------|
| FAQ Page | `/faq` | Low |
| Privacy Policy Page | `/privacy` | Low |
| Terms of Service Page | `/terms` | Low |
| `/home` standalone route | `/home` | Low |
| `StaleAuthNudge` component | LedgerTopBar — stale auth state | Medium |
| `SignInNudge` component | LedgerTopBar — compact nudge | Medium |
| `ConsoleSignature` easter egg | Browser console | Low |

---

## Stale Wireframes (Deleted)

The following wireframes were deleted during the Sprint 10 audit as they no longer match the implemented UI:

| File (deleted) | Reason |
|----------------|--------|
| `ux/wireframes/app/dashboard.html` | Old sidebar grid layout; superseded by LedgerShell (#372) |
| `ux/wireframes/chrome/topbar.html` | Old 56px TopBar; superseded by LedgerTopBar (48px) in LedgerShell (#372) |
| `ux/wireframes/marketing/marketing-site.html` | Described old static HTML site (`/static/index.html`); app is now NextJS |
| `ux/wireframes/marketing/static-site-footer.html` | Described old static HTML site footer; superseded by MarketingFooter component |
| `ux/wireframes/light-theme-lightning.html` | "Lightning Norse" overhaul never implemented; theme is standard light/dark toggle |
| `ux/wireframes/light-theme-stone.html` | "Stone/marble" redesign never implemented; theme is standard light/dark toggle |
| `ux/light-theme-lightning.md` | Spec for lightning-norse theme that was never implemented |
| `ux/light-theme-stone.md` | Spec for stone-marble theme that was never implemented |
| `ux/interactions/claude-terminal-skin.md` | Claude Code terminal skin spec — not app UX; out of scope |
