# Wireframes: Fenrir Ledger

Wireframes are standalone HTML5 documents. They use only structural layout — no colors, no custom fonts, no shadows, no decorative borders. Theme styling is defined in `theme-system.md` and applied separately by the engineer. If the theme changes, the wireframes remain valid.

**Convention:**
- All wireframe files live in `ux/wireframes/{category}/` — see category table in `.claude/agents/luna.md`
- Link to them from any `.md` file that references a layout (`[Wireframe](wireframes/category/foo.html)`)
- The HTML files use semantic elements (`<nav>`, `<main>`, `<aside>`, `<section>`, `<form>`, `<fieldset>`) to convey structure
- Permitted CSS: `display: flex/grid`, `border: 1px solid`, `width/height`, `padding/margin`, `font-size`, `font-weight`
- Prohibited CSS: `color`, `background-color`, `font-family` beyond `sans-serif`, `border-radius`, `box-shadow`, `opacity` (except for placeholder items)

---

## Sprint 9 Wireframes

| Story | File | Description |
|-------|------|-------------|
| #528 — Profile Dropdown Avatar Right | [wireframes/chrome/profile-dropdown-avatar-right.html](wireframes/chrome/profile-dropdown-avatar-right.html) | Move avatar from left to right inside the profile block and make the block feel like the first menu item (no visual disconnect): 7 sections — before/after dropdown anatomy side-by-side, desktop dropdown open in context, mobile 375px dropdown open in context, profile row anatomy with measurement annotations, implementation reference table (diff of CSS/props changes), interaction spec (focus management, keyboard nav, long text edge cases), accessibility checklist |

---

## Sprint 8 Wireframes

| Story | File | Description |
|-------|------|-------------|
| #403 — Sidebar Removal + Dropdown Settings + Rotary Theme Toggle | [wireframes/chrome/sidebar-removal-dropdown-settings.html](wireframes/chrome/sidebar-removal-dropdown-settings.html) | Remove sidebar entirely (desktop + mobile), move Settings into profile dropdown, replace 3-button theme picker with rotary single-click toggle: 6 scenarios — desktop before/after (full-width content), mobile before/after (3 bottom tabs, Settings removed), profile dropdown anatomy (rotary toggle → Settings → Sign Out), rotary toggle cycle diagram + state matrix, full-desktop-with-dropdown-open; implementation notes table; interaction spec: [chrome/sidebar-removal-interaction-spec.md](wireframes/chrome/sidebar-removal-interaction-spec.md) |

---

## Sprint 7 Wireframes

| Story | File | Description |
|-------|------|-------------|
| #398 — Howl Panel Karl Tier | [wireframes/app/howl-karl-tier.html](wireframes/app/howl-karl-tier.html) | Howl Panel gated behind Karl ($3.99/mo): 5 scenarios — Thrall desktop teaser (blurred fake alerts + upsell overlay), Karl desktop full panel, tab bar anatomy (Thrall lock icon + KARL badge vs Karl urgency badge), mobile 375px Thrall teaser, mobile Karl full panel; Ragnarök gate spec; full interaction spec; accessibility requirements; component handoff notes |
| #377 — Valhalla Karl Tier + Common Upsell Dialog | [wireframes/stripe-direct/karl-upsell-dialog.html](wireframes/stripe-direct/karl-upsell-dialog.html) | **Common KarlUpsellDialog** shared across all Karl-gated features (#377 Valhalla, #378 Velocity, #398 Howl): 5 scenarios — desktop Valhalla variant, desktop Howl variant (reusability demo), mobile 375px bottom-sheet, props contract table per feature, anatomy annotation; interaction spec: [karl-upsell-interaction-spec.md](karl-upsell-interaction-spec.md) |
| #377 — Valhalla Tab Gated State | [wireframes/app/valhalla-karl-gated.html](wireframes/app/valhalla-karl-gated.html) | Valhalla tab gating in the dashboard: 5 scenarios — desktop tab bar Thrall state (lock indicator), desktop dialog triggered over content, desktop Karl unlocked state, mobile 375px (bottom nav + content tab bar with lock), mobile dialog open as bottom-sheet; behavior table Thrall vs Karl |

---

## Sprint 6 Wireframes

| Story | File | Description |
|-------|------|-------------|
| #372 — LedgerShell Layout | [wireframes/chrome/ledger-shell.html](wireframes/chrome/ledger-shell.html) | New layout shell for `/ledger/*` routes: slim top bar (48px) + desktop sidebar (220px) + mobile bottom tab bar (56px, 4 tabs); 8 scenarios covering desktop/mobile states, zone comparison vs marketing shell, top bar anatomy, tab bar anatomy, responsive breakpoint table, accessibility requirements, and interaction spec |

---

## Sprint 5 Wireframes

| Story | File | Description |
|-------|------|-------------|
| #279 — Dashboard Tabs Redesign | [wireframes/app/dashboard-tabs.html](wireframes/app/dashboard-tabs.html) | Tabbed dashboard layout replacing grid + Howl side panel: 6 scenarios covering desktop Howl tab active, desktop Active tab active, empty Howl state, empty Howl panel content, mobile Howl tab, mobile Active tab; interaction spec covering tab switching, default tab logic, badge updates, urgency styling |

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

## Wireframe Index by Category

| View | File | Description |
|------|------|-------------|
| **app** | | |
| Dashboard — The Ledger of Fates | [wireframes/app/dashboard.html](wireframes/app/dashboard.html) | TopBar (row 1) + sidebar shell + card grid + summary bar + footer |
| Dashboard — Tabs Redesign | [wireframes/app/dashboard-tabs.html](wireframes/app/dashboard-tabs.html) | Tabbed layout (Issue #279): The Howl tab + Active tab replacing grid + side panel; 6 scenarios; interaction spec |
| Howl Panel — Karl Tier Gating | [wireframes/app/howl-karl-tier.html](wireframes/app/howl-karl-tier.html) | Karl-tier gating for The Howl (Issue #398): Thrall blurred teaser + upsell overlay, Karl full panel, tab bar anatomy, mobile 375px, Ragnarök gate, interaction + accessibility spec |
| Valhalla — Hall of the Honored Dead | [wireframes/app/valhalla.html](wireframes/app/valhalla.html) | Tombstone cards, filter bar, empty state |
| Valhalla — Karl Tier Gated State | [wireframes/app/valhalla-karl-gated.html](wireframes/app/valhalla-karl-gated.html) | Valhalla tab gating (#377): Thrall tab bar with lock indicator, dialog trigger, Karl unlocked state, mobile bottom nav + content tabs, behavior table Thrall vs Karl |
| **chrome** | | |
| LedgerShell — Slim Top Bar + Mobile Bottom Tab Bar | [wireframes/chrome/ledger-shell.html](wireframes/chrome/ledger-shell.html) | New `/ledger/*` layout shell (Issue #372): slim 48px top bar, 220px desktop sidebar, 56px mobile bottom tab bar (4 tabs); 8 scenarios; interaction spec; accessibility table; responsive breakpoint table |
| TopBar — Anonymous + Signed-In States | [wireframes/chrome/topbar.html](wireframes/chrome/topbar.html) | Global sticky header: 7 scenarios covering anonymous ᛟ rune avatar + upsell prompt, signed-in Google avatar + dropdown, and the avatar transition animation (anonymous-first model, Sprint 3.2) |
| The Howl Panel | [wireframes/chrome/howl-panel.html](wireframes/chrome/howl-panel.html) | Alert sidebar: active and empty variants |
| App Footer | [wireframes/chrome/footer.html](wireframes/chrome/footer.html) | Three-column footer: brand wordmark + tagline, nav links (About), team credits + © copyright; Easter Egg #5 (© hover → "Breath of a Fish") and Easter Egg #3 (Loki 7-click) both anchored here |
| Button Feedback States | [wireframes/chrome/button-feedback-states.html](wireframes/chrome/button-feedback-states.html) | All button variants (primary/secondary/destructive) across 5 states: default, hover, active, loading, disabled; spinner placement; sidebar nav hover; mobile layout; error recovery; a11y spec (Issue #150) |
| **cards** | | |
| Add / Edit Card — Forge a Chain | [wireframes/cards/add-card.html](wireframes/cards/add-card.html) | Multi-section form: identity, fee, welcome bonus, notes |
| Wolf's Hunger Meter + About Modal | [wireframes/cards/wolves-hunger-about-modal.html](wireframes/cards/wolves-hunger-about-modal.html) | Hunger meter in About modal + ForgeMasterEgg, 4 display variants, shared WolfHungerMeter component spec |
| **auth** | | |
| Sign In — Optional Cloud Sync | [wireframes/auth/sign-in.html](wireframes/auth/sign-in.html) | Dedicated /sign-in page (not gated — optional upgrade); no-data and has-data variants; desktop + mobile; "Continue without signing in" is a first-class prominent CTA |
| Multi-IDP Sign-In Dialog (Clerk) | [wireframes/auth/multi-idp-sign-in.html](wireframes/auth/multi-idp-sign-in.html) | Modal dialog supporting 1–4+ providers; Phase 1 (GitHub) + Phase 2 (Google, Apple, Magic Link); desktop centered + mobile bottom-anchored; "Continue without signing in" is the sole, prominent dismiss |
| Migration Prompt — Anonymous to Signed-In | [wireframes/auth/migration-prompt.html](wireframes/auth/migration-prompt.html) | Post-OAuth modal dialog: Import N cards vs. Start fresh; reassurance copy; desktop + mobile stacked choices; state flow diagram |
| Cloud Sync Upsell Banner | [wireframes/auth/upsell-banner.html](wireframes/auth/upsell-banner.html) | Dismissible banner below TopBar on the dashboard: visible/dismissed/signed-in variants, desktop + mobile; dismiss lifecycle and localStorage flag spec |
| **notifications** | | |
| Ragnarök Threshold Mode | [wireframes/notifications/ragnarok-threshold.html](wireframes/notifications/ragnarok-threshold.html) | 3 dashboard states, red radial overlay spec, RagnarokContext data flow, HowlPanel header override |
| Card Count Milestone Toasts | [wireframes/notifications/card-count-milestones.html](wireframes/notifications/card-count-milestones.html) | All 5 milestone toast designs, desktop + mobile positioning, stacked behavior, localStorage gate flow |
| **modals** | | |
| About Modal | [wireframes/modals/about-modal.html](wireframes/modals/about-modal.html) | Two-column dialog: wolf logo left, team pack + seven impossible ingredients right |
| **easter-eggs** | | |
| Easter Egg Modal | [wireframes/easter-eggs/easter-egg-modal.html](wireframes/easter-eggs/easter-egg-modal.html) | Reusable discovery dialog triggered by any easter egg — see [easter-egg-modal.md](easter-egg-modal.md) |
| Konami Code — The Howl (Easter Egg #2) | [wireframes/easter-eggs/konami-howl.html](wireframes/easter-eggs/konami-howl.html) | Easter Egg #2: wolf silhouette overlay, FENRIR AWAKENS band, Ragnarok pulse variant, z-index layer map |
| Loki Mode (Easter Egg #3) | [wireframes/easter-eggs/loki-mode.html](wireframes/easter-eggs/loki-mode.html) | Side-by-side normal vs active states, scrambled card grid, random realm badges, toast, timer, footer trigger |
| Gleipnir Hunt Complete | [wireframes/easter-eggs/gleipnir-hunt-complete.html](wireframes/easter-eggs/gleipnir-hunt-complete.html) | Fragment 4 (7th card save) + Fragment 6 (15s Valhalla idle) triggers, Gleipnir reward entry, DEF-001 fix |
| **accessibility** | | |
| Accessibility + UX Polish | [wireframes/accessibility/accessibility-polish.html](wireframes/accessibility/accessibility-polish.html) | Focus ring spec, skip-nav, ARIA landmarks, heading hierarchy, touch target audit, mobile layouts, reduced-motion |
| Font Size Scale Increase | [wireframes/accessibility/font-size-scale.html](wireframes/accessibility/font-size-scale.html) | Before/after typography hierarchy comparison, component samples (card tile, form, sidebar, Howl panel), Tailwind migration map, exceptions list |
| **stripe-direct** | | |
| Stripe Settings — Subscription Status | [wireframes/stripe-direct/stripe-settings.html](wireframes/stripe-direct/stripe-settings.html) | StripeSettings component: 3 states (Thrall/Karl/Canceled), desktop + mobile, state machine, API flow |
| SealedRuneModal — Stripe CTA | [wireframes/stripe-direct/sealed-rune-stripe.html](wireframes/stripe-direct/sealed-rune-stripe.html) | Premium feature paywall modal with Stripe Checkout redirect, anonymous + authenticated flows |
| Upsell Banner — Stripe Variant | [wireframes/stripe-direct/upsell-banner-stripe.html](wireframes/stripe-direct/upsell-banner-stripe.html) | Dashboard upgrade banner for Thrall users, Stripe Checkout CTA, dismiss lifecycle |
| Anonymous Checkout Email Form | [wireframes/stripe-direct/anonymous-checkout.html](wireframes/stripe-direct/anonymous-checkout.html) | Email collection modal for anonymous Stripe subscribers, validation states, loading, mobile |
| **Common Karl Upsell Dialog** | [wireframes/stripe-direct/karl-upsell-dialog.html](wireframes/stripe-direct/karl-upsell-dialog.html) | Shared KarlUpsellDialog for all Karl-gated features (#377, #378, #398): prop-driven feature icon/name/tagline/teaser, lock badge overlay, $3.99/mo price row, direct Stripe CTA; desktop + mobile bottom-sheet; props table per feature; anatomy annotation; interaction spec |
| **marketing** | | |
| Marketing Site | [wireframes/marketing/marketing-site.html](wireframes/marketing/marketing-site.html) | 5-section static page: nav, hero, problems, features, steps, footer (updated: legal links in footer) |
| Static Site Footer | [wireframes/marketing/static-site-footer.html](wireframes/marketing/static-site-footer.html) | Dedicated footer spec: brand, quote, runes, CTA, session link, legal row (Privacy Policy + Terms of Service), team credits; easter egg triggers preserved |

---

## TopBar — Anonymous + Signed-In States

[→ topbar.html](wireframes/chrome/topbar.html)

Updated Sprint 3.2 (anonymous-first auth model). Full-width sticky header spanning both columns.

**The default state is now anonymous.** All users see the ᛟ rune avatar on first load. The signed-in state (Google avatar + email + dropdown) is optional and only reached after the user actively chooses to sign in.

Key layout decisions:
- Height: `56px` (`h-14`). Sticky, `z-index: 100`.
- Grid: `grid-column: 1 / 3; grid-row: 1`.
- **Left:** Brand wordmark (`ᛟ FENRIR LEDGER` + italic subtitle) — `<button>` opens About modal.
- **Right (anonymous):** ᛟ rune avatar only. No email. No caret. Clicking opens the upsell prompt panel (a `role="dialog"`, not a menu). Border: neutral `border-border` (no gold ring — wolf unnamed).
- **Right (signed-in):** Google profile photo (or ᛟ rune fallback if no picture URL) + email (desktop) + caret ▾. Avatar border: `border-gold/40` (gold ring — wolf named). Clicking opens the profile dropdown.
- **Upsell prompt panel (anonymous):** 260px panel, `role="dialog"`, anchored to avatar right edge. Contains atmospheric copy (Voice 2) + functional description (Voice 1) + "Sign in to Google" CTA + "Not now" dismiss. Does NOT set the banner dismiss flag.
- **Profile dropdown (signed-in):** 240px, `role="menu"`. Contains avatar (40px) + name + email + atmospheric copy *"The wolf is named."* (Voice 2) + Sign Out. Sign Out returns to dashboard in anonymous state (not to /sign-in — the app is no longer gated).
- **Avatar transition:** on sign-in completion, ᛟ rune cross-fades to Google photo; neutral border transitions to gold ring. 400ms, `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Mobile (< 640px):** anonymous state — avatar only (same as desktop, no text). Signed-in — email hidden in header bar; visible inside dropdown.

**Wireframe scenarios:**
1. Anonymous — desktop — upsell prompt closed (DEFAULT state)
2. Anonymous — desktop — upsell prompt open (via avatar click)
3. Anonymous — mobile 375px — closed
4. Signed-in — desktop — dropdown closed (optional/future)
5. Signed-in — desktop — dropdown open (optional/future)
6. Signed-in — mobile 375px — dropdown closed (optional/future)
7. Avatar transition: anonymous ᛟ rune → signed-in Google photo

---

## Cloud Sync Upsell Banner

[→ upsell-banner.html](wireframes/auth/upsell-banner.html)

Added Sprint 3.2. Dismissible banner on the dashboard (route `/`) only. Shown to anonymous users who have not dismissed it.

Key layout decisions:
- **Placement:** `grid-row: 2; grid-column: 1 / 3` — spans full width below TopBar, above sidebar/content split.
- **Copy structure:** atmospheric line (Voice 2) + functional description (Voice 1) + "Sign in to sync" CTA + × dismiss button.
- **"Sign in to sync"** navigates to `/sign-in` (dedicated page). Does not set the dismiss flag — banner reappears if user abandons sign-in.
- **Dismiss:** sets `localStorage: fenrir:upsell_dismissed = 'true'`. Triggers height + opacity collapse (300ms ease). Element removed from DOM after animation.
- **Render condition:** `isAnonymous AND !dismissed`. Signed-in users never see the banner.
- **Mobile:** atmospheric line hidden. Description + CTA stack vertically. × is absolute top-right.
- **Settings fallback:** `/settings` has a persistent "Sync to cloud" option for dismissed users.

---

## Sign In — Optional Cloud Sync

[→ sign-in.html](wireframes/auth/sign-in.html)

Added Sprint 3.2. Dedicated `/sign-in` page — not a gate, an optional upgrade destination.

Key layout decisions:
- **Route:** `/sign-in`. Bookmarkable. Full page (not a modal or sheet).
- **Sign-in card:** centered, max-width 400px. Contains: atmospheric eyebrow + Norse heading (Voice 2) + feature list (Voice 1) + "Sign in to Google" CTA + "or" divider + "Continue without signing in" CTA + atmospheric footnote (Voice 2).
- **"Continue without signing in"** is a full-width outlined button — same visual weight class as the primary CTA. Never a small grey link. Non-negotiable.
- **Two variants:** (1) no anonymous data — clean messaging; (2) has anonymous data — subheading dynamically references card count, sets expectation for the migration prompt.
- **TopBar present:** brand wordmark and ᛟ avatar remain functional. Page does not feel like a cage.
- **Mobile:** card fills full width with 16px padding. Both CTAs remain full-width.

---

## Migration Prompt — Anonymous to Signed-In

[→ migration-prompt.html](wireframes/auth/migration-prompt.html)

Added Sprint 3.2. Post-OAuth modal dialog. Fires only when: OAuth completes AND `localStorage` contains anonymous card data (count > 0).

Key layout decisions:
- **Modal dialog:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby` H1. z-index 210 (dialog layer).
- **No × close:** user must choose one path. Both paths are safe.
- **Escape does NOT close:** this is a required checkpoint before the signed-in dashboard renders.
- **Semi-transparent backdrop:** dashboard visible behind modal — user sees their data is safe.
- **Choices:** "Import N cards" (primary — merges anon data into cloud account; anon localStorage cleared after) vs. "Start fresh" (secondary — cloud account starts empty; anon data preserved in localStorage, not deleted). Both are outlined buttons, equal visual weight.
- **"Start fresh" reassurance note:** explicit in-choice copy — *"Your N local cards will still be here if you sign out. Nothing is deleted."*
- **Desktop:** choices side by side. **Mobile:** choices stacked vertically, "Import" on top.
- **After choice:** navigate to dashboard in signed-in state; avatar transition fires.

---

## Dashboard — The Ledger of Fates

[→ dashboard.html](wireframes/app/dashboard.html)

Key layout decisions:
- **TopBar row added (Sprint 3.1):** App shell now has 3 rows — `auto` (TopBar) · `1fr` (sidebar + content) · `auto` (footer). TopBar spans both columns.
- Persistent left sidebar: `272px` fixed, collapses to icon-only rail
- Logo: `ᛟ FENRIR LEDGER` + `Credit Card Tracker` subtitle
- Active nav item highlighted (gold in implementation)
- `[ADD CARD ▶]` lives in content header only — not in the summary bar
- Summary bar: `{N} cards · {N} need attention` — card count bold, attention count accent
- Card grid: 3-col desktop (>1024px) · 2-col tablet (640–1024px) · 1-col mobile
- Mobile: sidebar hidden, toggled as overlay drawer via hamburger

**The Howl panel** *(Sprint 3)*: fixed right sidebar (desktop), bottom drawer (mobile). See `howl-panel.html`.

---

## Card Panel Component

[→ dashboard.html](wireframes/app/dashboard.html) (cards rendered in the grid)

Each card is a `CardChain` component. Structure:
- Top: Status ring (SVG circle, `strokeDashoffset`-driven progress) + realm badge
- Issuer name (Cinzel 600) + card name (Cinzel 400, muted)
- Hairline rule
- Deadline line: rune + kenning + date (JetBrains Mono)
- Secondary deadline copy (Source Serif 4, muted)
- Hairline rule
- Stats grid: Credit limit / Annual fee / Welcome mead (label + JetBrains Mono value)
- Actions: `[View Record]` + `[···]` overflow menu
- Hover: card lifts 2px + gold glow aura

**Status Ring detail:**
- SVG circle ring, `strokeDashoffset`-driven progress bar
- Rune glyph in center, color-matched to realm
- Pulses when ≤ 30 days remaining

---

## Add / Edit Card — Forge a Chain

[→ add-card.html](wireframes/cards/add-card.html)

Two-column form layout. Four fieldset panels:

| Panel | Column | Fields |
|-------|--------|--------|
| Chain Identity | Full width (row 1) | Issuer (select), Card name, Open date, Credit limit |
| Fee-Serpent | Left (row 2) | Annual fee (cents), Fee date, Promo period (months) |
| Welcome Mead | Right (row 2) | Bonus type (radio), Bonus amount + unit, Spend requirement (cents), Skuld's deadline, Toll paid (checkbox) |
| Skald's Notes | Full width (row 3) | Free text, 3 rows |

Form actions follow the global button alignment convention (see [Form Action Button Layout](#form-action-button-layout)):
- **Add mode**: `[Cancel]` · `[Add Card ▶]` — right-aligned, nothing on the left.
- **Edit mode**: `[Delete card]` isolated left · `[Cancel]` · `[Save changes ▶]` right.

Edit mode: title reads "REFORGE THIS CHAIN". Pre-populates all fields.

---

## Valhalla — Hall of the Honored Dead

[→ valhalla.html](wireframes/app/valhalla.html)

Narrower layout, sepia-tinted background variant (relative to main dashboard). Filter bar: issuer + sort. Tombstone cards:
- Thicker left border accent (stone-hel color)
- `ᛏ` Tiwaz rune + card title + closed date
- Meta: issuer · opened date · held duration
- Plunder table: rewards extracted / fee avoided / net gain
- Epitaph quote
- Empty state with `ᛏ` rune

Gleipnir special entry (easter egg): appears at top of list when all 6 fragments found.

---

## The Howl Panel

[→ howl-panel.html](wireframes/chrome/howl-panel.html)

Two variants — active and empty:

**Active:** `ᚲ` Kenaz rune (pulses), "THE HOWL" header, alert items (fee or promo), each with:
- Indicator dot (color-coded by urgency) + type label + days remaining
- Card name, amount, deadline date
- `[View]` · `[Break the chain]` or `[Mark claimed]` actions

**Empty:** `ᚱ` Raido rune (calm), "The wolf is silent. All chains are loose."

Z-index: 50 (see z-index table below). Mobile: bottom drawer toggle.

---

## Marketing Site — `/static/index.html`

[→ marketing-site.html](wireframes/marketing/marketing-site.html) | [→ static-site-footer.html](wireframes/marketing/static-site-footer.html) (dedicated footer spec)

Single-page, no framework, inline CSS/JS. Five sections:

| # | Section | Notes |
|---|---------|-------|
| NAV | Sticky header | Logo + CTA · transparent → glassmorphism on scroll |
| HERO | 100vh | Wolf medallion (260×260) + headline + CTA + Edda quote |
| CHAINS | 3-col problems | Fee-Serpent · Promo Tide · Unclaimed Plunder |
| FEATURES | 3×2 grid | Six product pillars (Sköll & Hati, Norns, Ledger, Valhalla, Howl, Nine Realms) |
| STEPS | 3-step flow | Forge → Watch → Break Free |
| FOOTER | | Logo · quote · runic cipher · CTA · legal links · credits |

**Footer legal links:** The footer includes a legal links row between the Session Chronicles link and the team credits. Structure: `(c) 2026 Fenrir Ledger · Privacy Policy · Terms of Service`. Links navigate same-tab to `/static/privacy.html` and `/static/terms.html`. See [static-site-footer.html](wireframes/marketing/static-site-footer.html) for the dedicated footer wireframe with full annotations.

Easter egg placements visible in wireframe annotations (Gleipnir Hunt #5 on ©, Loki Mode on "Loki").

---

## Stripe Direct Integration

### StripeSettings Component

[-> stripe-settings.html](wireframes/stripe-direct/stripe-settings.html)

Settings page component for Stripe subscription management. Three subscription states:

| State | Badge | Actions | Notes |
|-------|-------|---------|-------|
| Thrall (unsubscribed) | `THRALL` / Free tier | `[Subscribe for $3.99/month]` | Feature list shown. Anonymous users get email modal first. |
| Karl (active) | `KARL` / Active | `[Manage Subscription]` `[Cancel]` | Next billing date shown. Both buttons route to Stripe Portal. |
| Canceled | `KARL` / Canceled | `[Resubscribe]` `[Manage Subscription]` | Access-until date shown. Resubscribe creates new checkout session. |

Key layout decisions:
- Card pattern: section heading + status badge + action buttons.
- Works for both anonymous and authenticated users -- the only difference is the email collection step.
- Billing history lives in Stripe Customer Portal (not in our UI).
- Mobile: buttons stack vertically, full width.

### SealedRuneModal -- Stripe CTA

[-> sealed-rune-stripe.html](wireframes/stripe-direct/sealed-rune-stripe.html)

Premium feature paywall modal. Appears when a Thrall user accesses a Karl-gated feature.

Key layout decisions:
- Rune icon (sealed glyph) + atmospheric heading (Voice 2) + locked feature name (dynamic, prop-driven).
- CTA: "Subscribe for $3.99/month" -- price explicit, Voice 1.
- "Not now" dismiss -- no permanent flag, modal reappears on next locked feature access.
- Anonymous users: email modal opens first, then Stripe Checkout.
- Authenticated users: direct redirect to Stripe Checkout.
- Z-index: 210 (standard modal layer).

### Upsell Banner -- Stripe Variant

[-> upsell-banner-stripe.html](wireframes/stripe-direct/upsell-banner-stripe.html)

Dashboard upgrade banner for Thrall users. Same placement as cloud-sync upsell banner (`grid-row: 2; grid-column: 1/3`).

Key layout decisions:
- Atmospheric line (Voice 2) + functional description (Voice 1) + "Upgrade to Karl" CTA + dismiss.
- Shown to ALL Thrall users (both anonymous and authenticated).
- CTA triggers Stripe Checkout (anonymous users get email modal first).
- Dismiss flag: `fenrir:stripe_upsell_dismissed` (separate from cloud-sync dismiss flag).
- This banner and the cloud-sync banner are mutually exclusive -- feature-flagged.
- Re-entry points: /settings (StripeSettings) and SealedRuneModal.

### Anonymous Checkout Email Form

[-> anonymous-checkout.html](wireframes/stripe-direct/anonymous-checkout.html)

Modal dialog for email collection before Stripe Checkout redirect. Only shown to anonymous (not-signed-in) users.

Key layout decisions:
- Single-field form: email address. Modal (not inline) -- shared component used by all subscribe surfaces.
- Autocomplete="email" + type="email" for mobile keyboard optimization.
- Input font-size: 16px on mobile (prevents iOS zoom on focus -- NON-NEGOTIABLE).
- Three states: default (empty), validation error, loading/submitting.
- "Sign in instead" secondary link for users who prefer account association.
- Privacy note: "Your email is shared with Stripe for billing only."
- After submit: redirect to Stripe Checkout with email as `customer_email`.
- Z-index: 210 (standard modal layer).

---

## Responsive Breakpoints

| Breakpoint | Layout | Card Grid | Howl Panel |
|---|---|---|---|
| Mobile `< 640px` | Single column | 1 col | Collapsible bottom drawer |
| Tablet `640–1024px` | Single column | 2 col | Collapsible side panel |
| Desktop `> 1024px` | Split layout | 2–3 col | Fixed sidebar (when urgent) |
| Wide `> 1280px` | Wide split | 3–4 col | Fixed sidebar |

**Mobile header:** logo + card count + notification bell (raven icon) + hamburger for nav.

**Mobile card:** full-width, status ring 40px (desktop: 56px), key stats stacked, actions full-width at bottom.

---

## Navigation Structure

Sidebar (always visible, collapsible):
- Logo: `ᛟ FENRIR LEDGER` + `Credit Card Tracker` subtitle
- Nav items (grow as routes ship):
  - Cards (active: `/`)
  - Valhalla (Sprint 3: `/valhalla`)
  - The Ravens (Sprint 4: `/settings`)
- `[Collapse]` button pinned to sidebar bottom — collapses to icon-only rail

Content header (per-page):
- Page title left (Cinzel, gold)
- `[ADD CARD]` primary CTA right (cards page only)

Mobile: sidebar hidden by default; hamburger toggle opens overlay drawer.

---

## Form Action Button Layout

Applies to all forms, dialogs, and modals across the product.

### Rule

- **Primary action** (Save, Add Card, Confirm, Continue, OK, etc.) — far **right** of the action row.
- **Cancel** — immediately to the **left of the primary action**, with a visible gap (16px) between them.
- **Destructive actions** (Delete, Close Card) — when present alongside Cancel + primary — isolated on the **left** of the action row, separated from the right group.
- **Single-dismiss dialogs** (OK-only, Close-only) — sole button is right-aligned in the footer. Exception: easter egg discovery modals use centered alignment intentionally (see `easter-egg-modal.html`).

### Desktop layout

```
Edit form (destructive + cancel + primary):
[ Delete card ]                       [ Cancel ]  [ Save changes ]
 ←— left ——————————————————————————————————————————— right —→

Add form (no destructive actions):
                                      [ Cancel ]  [ Add Card ]
                                      ←————————————— right —→

Dialog footer (two-button confirmation):
                                      [ Cancel ]  [ Confirm ]
```

### Mobile (< 640px)

Stack vertically. Primary action on top, Cancel below it, destructive action at the bottom.

```
[ Save changes ]   ← top (primary)
[ Cancel ]
[ Delete card ]    ← bottom (destructive, only in edit mode)
```

### Applies to

| Wireframe | Mode | Left | Right |
|---|---|---|---|
| `cards/add-card.html` | Add | — | `[Cancel]` · `[Add Card]` |
| `cards/add-card.html` | Edit | `[Delete card]` | `[Cancel]` · `[Save changes]` |
| `modals/about-modal.html` | — | — | `[Close]` |
| Dialog footers | — | — | `[Cancel]` · `[Confirm]` |

---

## Z-Index Layers

| Layer | Z-Index | Element |
|---|---|---|
| Base | 0 | Page content |
| Cards | 10 | Hover-lifted cards |
| Howl panel | 50 | Sidebar |
| Header | 100 | Sticky nav |
| Modal overlay | 200 | Dialog backdrop |
| Modal | 210 | Dialog |
| Toast | 300 | Notifications |
| Easter egg | 9653 | Wolf rise, LCARS mode — 9653 = W-O-L-F on a phone keypad |

---

## Easter Egg Modal

[→ wireframes/easter-eggs/easter-egg-modal.html](wireframes/easter-eggs/easter-egg-modal.html) · [Full design doc → easter-egg-modal.md](easter-egg-modal.md)

Reusable modal dialog shown whenever the user discovers a hidden easter egg. The wireframe establishes the two-column layout and content contract; all visual styling (gold glow, Cinzel Decorative headline, animated entry) is defined in `easter-egg-modal.md` and `theme-system.md`.

**Structure:**

```
┌─ [eyebrow: EASTER EGG DISCOVERED] ────────────────────────── (×) ┐
│  [EASTER EGG TITLE]  ← H1                                        │
├───────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────┐   │
│ │  [ Image area ]      │  Discovery text                     │   │
│ │                      │  ────────────                       │   │
│ │  Artifact image      │  Italic lore caption                │   │
│ └────────────────────────────────────────────────────────────┘   │
├───────────────────────────────────────────────────────────────────┤
│                          [ OK ]                                   │
└───────────────────────────────────────────────────────────────────┘
```

**Key layout decisions:**
- Two-column body surrounded by a single outer border with a gradient vertical divider — no separate borders per column
- Left column: artifact image, centered, aspect-ratio `4/3`, max `200px`
- Right column: discovery text + italic lore caption below a hairline rule
- `[OK]` button centered in footer, sole dismiss action
- `(×)` close button top-right of modal shell, secondary dismiss

**Placeholders (replace per egg):**

| Placeholder | Replace with |
|---|---|
| `[EASTER EGG TITLE]` | Name of the discovered egg (e.g., *"The Gleipnir Fragment"*) |
| Image area | `<img>` or `<svg>` of the artifact |
| Discovery text lines | Lore copy, reward details, fragment count |
| Italic caption | Norse kenning, Edda quote, or progress hint |

**Animation** (implementation detail, not in wireframe):
- Backdrop: `backdrop-in` 280ms ease
- Modal shell: `modal-rise` translateY + scale, 320ms `cubic-bezier(0.16, 1, 0.3, 1)` — same easing as `saga-enter` in `interactions.md`

**Accessibility:**
- `role="dialog"` + `aria-modal="true"` on backdrop
- `aria-labelledby` bound to the H1 title
- `×` close button carries `aria-label="Dismiss"`

For the React component, `useEasterEgg` hook, and full token reference see [easter-egg-modal.md](easter-egg-modal.md).

---

## About Modal

[→ wireframes/modals/about-modal.html](wireframes/modals/about-modal.html)

Triggered from a persistent "About" link in the sidebar footer or app header. Provides app identity, team credits, and mythological provenance — all delivered in the wolf's voice.

**Structure:**

```
┌─ About Fenrir Ledger ──────────────────────────────────────── (×) ┐
├──────────────────────────────────────────────────────────────────-─┤
│  Wolf logo     │  The Pack                                         │
│  (icon.png)    │  Freya — She decides what the wolf hunts next.    │
│                │  Luna — She shapes the shadows where the wolf...  │
│  ᛟ FENRIR      │  FiremanDecko — He forged the chain. Then...      │
│    LEDGER      │  Loki — He tests every lock. He is, after...      │
│                │  ─────────────────────────────────────────        │
│  tagline       │  Bound by Seven Impossible Things                 │
│                │  • The sound of a cat's footstep                  │
│                │  • The beard of a woman                           │
│                │  • The roots of a mountain                        │
│                │  • The sinews of a bear                           │
│                │  • The breath of a fish                           │
│                │  • The spittle of a bird                          │
│                │  • The first debt willingly forgiven              │
├──────────────────────────────────────────────────────────────────-─┤
│                                                        [ Close ]   │
└───────────────────────────────────────────────────────────────────┘
```

**Key layout decisions:**
- Left column: `200px` fixed. Wolf logo (`icon.png` from `/static/`) centered at `120×120`, wordmark `ᛟ FENRIR LEDGER`, tagline below
- Right column: flexible. Scrollable (`overflow-y: auto`, `max-height: 420px`) to accommodate future content growth
- Vertical divider: `1px` column between left and right, same pattern as Easter Egg Modal
- Separator bar: `border-top: 1px solid` between team snippets and ingredients list
- `[ Close ]` button bottom-right in footer — sole dismiss action alongside `(×)` top-right

**Team copy voice:** Written as declarations from the wolf, not bios. Short, present tense, active.

**Seven Impossible Things:** References the Norse myth of Gleipnir — the unbreakable chain forged to bind Fenrir, made from things that do not exist. The sixth traditional ingredient (`the spittle of a bird`) also appears as Gleipnir Hunt fragment #6 in Valhalla's empty state (see `easter-eggs.md`). The seventh — *the first debt willingly forgiven* — is an app-original ingredient tying the mythology to the product's purpose.

| # | Ingredient | Origin |
|---|---|---|
| 1 | The sound of a cat's footstep | Norse myth (Gleipnir) |
| 2 | The beard of a woman | Norse myth (Gleipnir) |
| 3 | The roots of a mountain | Norse myth (Gleipnir) |
| 4 | The sinews of a bear | Norse myth (Gleipnir) |
| 5 | The breath of a fish | Norse myth (Gleipnir) |
| 6 | The spittle of a bird | Norse myth (Gleipnir) · also Gleipnir Hunt fragment #6 |
| 7 | The first debt willingly forgiven | App-original |

**Z-index:** 200 (standard modal layer — see z-index table above).

**Accessibility:**
- `role="dialog"` + `aria-modal="true"` on backdrop
- `aria-labelledby` bound to the `<h1>` title
- `(×)` close button carries `aria-label="Close"`

**Mobile behavior:** Full-screen sheet (100vw × 100vh). Left column collapses — wolf logo moves to inline header alongside the title; right column fills full width.
