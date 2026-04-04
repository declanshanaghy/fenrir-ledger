# The Saga Ledger -- Design

> *"Though it looks like silk ribbon, no chain is stronger."*
> -- Prose Edda, Gylfaginning

---

I am Fenrir. The gods forged Gleipnir from six impossible things -- the sound of a cat's footstep, the beard of a woman, the roots of a mountain, the sinews of a bear, the breath of a fish, the spittle of a bird. It looked like silk. It held like iron. It was designed to be invisible, inescapable, and trivial-seeming.

So is your annual fee.

This design system is my answer. Every color chosen from the void between stars. Every rune mapped to a card state. Every kenning sharpened against the whetstone of the saga. The mythology is not decoration -- it is the product's skeleton. Pull the myth and the design collapses. This is intentional. The wolf does not wear a costume.

What follows is the full visual and verbal soul of Fenrir Ledger. Freya shaped the vision. Luna drew the runes. FiremanDecko forged them into code. Loki tests whether the chain holds.

---

## Index

### UX Artifacts (Luna's domain)

#### Core Design Docs

- [README.md](README.md) -- This file: design system manifesto and complete index
- [theme-system.md](theme-system.md) -- Color palette, typography, CSS custom properties, Tailwind config extensions
- [wireframes.md](wireframes.md) -- Layout specs, component hierarchy, responsive breakpoints, z-index table, wireframe index
- [interactions.md](interactions.md) -- Animation philosophy, saga-enter stagger, status ring, Howl panel, easter egg keyframes
- [easter-eggs.md](easter-eggs.md) -- All hidden references: Gleipnir Hunt, Konami Howl, Loki Mode, console ASCII, and more
- [easter-egg-modal.md](easter-egg-modal.md) -- Shared modal template for all easter egg discovery moments
- [light-theme-stone.md](light-theme-stone.md) -- Light theme: Stone/Marble redesign (cool grey-blues, marble whites)
- [light-theme-lightning.md](light-theme-lightning.md) -- Light theme: Lightning Norse overhaul (pure white, ice-blue, extreme contrast)
- [audit-report.md](audit-report.md) -- UX audit report: ux/ vs current app (2026-03-12)
- [ux-assets/mermaid-style-guide.md](ux-assets/mermaid-style-guide.md) -- Mermaid diagram conventions for all pack members

#### Interaction Specs (top-level)

- [multi-idp-interaction-spec.md](multi-idp-interaction-spec.md) -- Multi-IDP sign-in dialog (planned future feature)
- [karl-upsell-interaction-spec.md](karl-upsell-interaction-spec.md) -- Karl upsell dialog + Valhalla tab gating
- [interactions/import-workflow-v2.md](interactions/import-workflow-v2.md) -- Import wizard three-path workflow

#### Interaction Specs (in wireframe directories)

- [wireframes/cards/karl-card-bling-interaction-spec.md](wireframes/cards/karl-card-bling-interaction-spec.md) -- Karl card bling: CSS-only cosmetic overlay, rune corners, hover glow
- [wireframes/cards/trash-tab-interaction-spec.md](wireframes/cards/trash-tab-interaction-spec.md) -- Trash tab: soft-delete, restore, expunge flows
- [wireframes/chrome/sidebar-removal-interaction-spec.md](wireframes/chrome/sidebar-removal-interaction-spec.md) -- Sidebar removal, dropdown settings, rotary theme toggle
- [wireframes/chrome/profile-dropdown-interaction-spec.md](wireframes/chrome/profile-dropdown-interaction-spec.md) -- Profile dropdown redesign: consistent icon-left row pattern
- [wireframes/chrome/dashboard-tab-headers-interaction-spec.md](wireframes/chrome/dashboard-tab-headers-interaction-spec.md) -- Dashboard tab headers, tooltips, empty states
- [wireframes/chronicles/interaction-spec.md](wireframes/chronicles/interaction-spec.md) -- Chronicle Norse MDX components: collapsibles, animations, responsive
- [wireframes/heilung/interaction-spec.md](wireframes/heilung/interaction-spec.md) -- Heilung modal: Norse restyle, video portal, rune bands
- [wireframes/household/household-interaction-spec.md](wireframes/household/household-interaction-spec.md) -- Household invite code flow: settings, join, merge confirmation
- [wireframes/odins-throne-ui/agent-profile-modal-interaction-spec.md](wireframes/odins-throne-ui/agent-profile-modal-interaction-spec.md) -- Agent profile modal: focus management, keyboard, backdrop
- [wireframes/odins-throne-ui/decree-inscription-interaction-spec.md](wireframes/odins-throne-ui/decree-inscription-interaction-spec.md) -- All-Father's Decree Norse inscription: collapse/expand, Wikipedia links
- [wireframes/odins-throne-ui/loki-error-boundary-interaction-spec.md](wireframes/odins-throne-ui/loki-error-boundary-interaction-spec.md) -- Loki error boundary tablet: state machine, retry flow
- [wireframes/odins-throne-ui/norse-tablet-rune-signatures-interaction-spec.md](wireframes/odins-throne-ui/norse-tablet-rune-signatures-interaction-spec.md) -- Norse tablet rune signatures, Wikipedia links, epic seals
- [wireframes/odins-throne-ui/theme-switcher-interaction-spec.md](wireframes/odins-throne-ui/theme-switcher-interaction-spec.md) -- Monitor UI theme switcher: light/dark toggle, CSS variable strategy
- [wireframes/odins-throne-ui/session-header-title-interaction-spec.md](wireframes/odins-throne-ui/session-header-title-interaction-spec.md) -- Session header descriptive title: issue title resolution
- [wireframes/odins-throne-ui/verdict-inscription-interaction-spec.md](wireframes/odins-throne-ui/verdict-inscription-interaction-spec.md) -- Norse verdict inscription: detection, agent variants, carve-in animation
- [wireframes/odins-throne-ui/wss-icon-tooltip-interaction-spec.md](wireframes/odins-throne-ui/wss-icon-tooltip-interaction-spec.md) -- WSS icon: remove bounding box, wolf-voice tooltip per connection state (Issue #1443)
- [wireframes/settings-tabs/settings-tabs-interaction-spec.md](wireframes/settings-tabs/settings-tabs-interaction-spec.md) -- Settings tab layout: tab switching, URL hash persistence, karl-bling tabs, mobile select pattern
- [wireframes/spear/cancel-button-interaction-spec.md](wireframes/spear/cancel-button-interaction-spec.md) -- Odin's Spear cancel controls: styled button affordance for JobCard and SessionHeader (Issue #1475)
- [wireframes/sync/sync-interaction-spec.md](wireframes/sync/sync-interaction-spec.md) -- Cloud sync UX: indicator states, settings section, tier gating

### Wireframes (78 HTML5 documents — synced 2026-03-17)

| Category | Files |
|----------|-------|
| app | [dashboard-tabs.html](wireframes/app/dashboard-tabs.html), [howl-karl-tier.html](wireframes/app/howl-karl-tier.html), [valhalla.html](wireframes/app/valhalla.html), [valhalla-karl-gated.html](wireframes/app/valhalla-karl-gated.html) |
| chrome | [sidebar-removal-dropdown-settings.html](wireframes/chrome/sidebar-removal-dropdown-settings.html), [topbar.html](wireframes/chrome/topbar.html), [profile-dropdown-avatar-right.html](wireframes/chrome/profile-dropdown-avatar-right.html), [profile-dropdown-redesign.html](wireframes/chrome/profile-dropdown-redesign.html), [howl-panel.html](wireframes/chrome/howl-panel.html), [footer.html](wireframes/chrome/footer.html), [button-feedback-states.html](wireframes/chrome/button-feedback-states.html), [dashboard-tab-headers.html](wireframes/chrome/dashboard-tab-headers.html) |
| trial | [trial-start.html](wireframes/trial/trial-start.html), [trial-status.html](wireframes/trial/trial-status.html), [trial-expiry.html](wireframes/trial/trial-expiry.html), [trial-feature-gates.html](wireframes/trial/trial-feature-gates.html) |
| cards | [add-card.html](wireframes/cards/add-card.html), [wolves-hunger-about-modal.html](wireframes/cards/wolves-hunger-about-modal.html), [karl-card-bling.html](wireframes/cards/karl-card-bling.html), [trash-tab.html](wireframes/cards/trash-tab.html) |
| auth | [sign-in.html](wireframes/auth/sign-in.html), [multi-idp-sign-in.html](wireframes/auth/multi-idp-sign-in.html), [migration-prompt.html](wireframes/auth/migration-prompt.html), [upsell-banner.html](wireframes/auth/upsell-banner.html) |
| notifications | [ragnarok-threshold.html](wireframes/notifications/ragnarok-threshold.html), [card-count-milestones.html](wireframes/notifications/card-count-milestones.html) |
| modals | [about-modal.html](wireframes/modals/about-modal.html) |
| easter-eggs | [easter-egg-modal.html](wireframes/easter-eggs/easter-egg-modal.html), [konami-howl.html](wireframes/easter-eggs/konami-howl.html), [loki-mode.html](wireframes/easter-eggs/loki-mode.html), [gleipnir-hunt-complete.html](wireframes/easter-eggs/gleipnir-hunt-complete.html) |
| accessibility | [accessibility-polish.html](wireframes/accessibility/accessibility-polish.html), [font-size-scale.html](wireframes/accessibility/font-size-scale.html) |
| stripe-direct | [stripe-settings.html](wireframes/stripe-direct/stripe-settings.html), [sealed-rune-stripe.html](wireframes/stripe-direct/sealed-rune-stripe.html), [upsell-banner-stripe.html](wireframes/stripe-direct/upsell-banner-stripe.html), [anonymous-checkout.html](wireframes/stripe-direct/anonymous-checkout.html), [karl-upsell-dialog.html](wireframes/stripe-direct/karl-upsell-dialog.html), [karl-upsell-dialog-artwork.html](wireframes/stripe-direct/karl-upsell-dialog-artwork.html) |
| marketing-site | [static-site-footer.html](wireframes/marketing-site/static-site-footer.html), [layout-shell.html](wireframes/marketing-site/layout-shell.html), [home-page.html](wireframes/marketing-site/home-page.html), [features.html](wireframes/marketing-site/features.html), [pricing.html](wireframes/marketing-site/pricing.html), [about.html](wireframes/marketing-site/about.html), [about-mobile.html](wireframes/marketing-site/about-mobile.html), [theme-variants.html](wireframes/marketing-site/theme-variants.html), [data-safety-banner.html](wireframes/marketing-site/data-safety-banner.html), [trust-placements.html](wireframes/marketing-site/trust-placements.html), [free-trial.html](wireframes/marketing-site/free-trial.html), [nav-font-648.html](wireframes/marketing-site/nav-font-648.html) |
| chronicles | [chronicle-index.html](wireframes/chronicles/chronicle-index.html), [chronicle-article.html](wireframes/chronicles/chronicle-article.html), [chronicle-field-report.html](wireframes/chronicles/chronicle-field-report.html), [theme-variants.html](wireframes/chronicles/theme-variants.html), [chronicle-agent-page-shell.html](wireframes/chronicles/chronicle-agent-page-shell.html), [norse-components-catalog.html](wireframes/chronicles/norse-components-catalog.html) |
| import | [import-method-selection.html](wireframes/import/import-method-selection.html), [csv-upload.html](wireframes/import/csv-upload.html), [safety-banner.html](wireframes/import/safety-banner.html) |
| wizard-animations | [step-indicator.html](wireframes/wizard-animations/step-indicator.html), [step-transitions.html](wireframes/wizard-animations/step-transitions.html), [mobile-layout.html](wireframes/wizard-animations/mobile-layout.html) |
| heilung | [heilung-modal.html](wireframes/heilung/heilung-modal.html), [heilung-norse-restyle.html](wireframes/heilung/heilung-norse-restyle.html) |
| household | [settings-household.html](wireframes/household/settings-household.html), [join-household.html](wireframes/household/join-household.html), [merge-confirmation.html](wireframes/household/merge-confirmation.html) |
| odins-throne-ui | [agent-profile-modal.html](wireframes/odins-throne-ui/agent-profile-modal.html), [decree-inscription.html](wireframes/odins-throne-ui/decree-inscription.html), [loki-error-boundary.html](wireframes/odins-throne-ui/loki-error-boundary.html), [norse-mist-tool-blocks.html](wireframes/odins-throne-ui/norse-mist-tool-blocks.html), [norse-tablet-rune-signatures.html](wireframes/odins-throne-ui/norse-tablet-rune-signatures.html), [session-header-title.html](wireframes/odins-throne-ui/session-header-title.html), [theme-switcher.html](wireframes/odins-throne-ui/theme-switcher.html), [verdict-inscription.html](wireframes/odins-throne-ui/verdict-inscription.html) |
| sync | [sync-indicator-states.html](wireframes/sync/sync-indicator-states.html), [sync-settings-section.html](wireframes/sync/sync-settings-section.html) |

### Cross-Domain References

- [../product/product-design-brief.md](../product/product-design-brief.md) -- Design philosophy, three pillars, aesthetic direction
- [../product/mythology-map.md](../product/mythology-map.md) -- Norse cosmology mapped to every UI state
- [../product/copywriting.md](../product/copywriting.md) -- Two-voice rule, kennings, status badge copy

---

## The Scrolls of Design

### [Theme System](theme-system.md)

*The colors of the Nine Realms. The typefaces of the saga. The tokens that make it real.*

Void-black backgrounds (`#07070d`). Gold accents hammered to `#c9920a` -- not bright, not cheerful, just the color of firelight on ancient coin. Four typefaces, each chosen for a different register of truth:

- **Cinzel Decorative** -- display headings, the brand mark, the wolf's name
- **Cinzel** -- section headings, realm labels, atmospheric subheads
- **Source Serif 4** -- body copy, the human voice inside the saga
- **JetBrains Mono** -- every number, every date, every dollar -- monospaced, unambiguous

### [Interactions](interactions.md)

*Motion as myth. The stagger. The status ring. The Howl panel.*

Animation in Fenrir Ledger follows a single law: **purposeful, not decorative**. Cards don't bounce in for fun -- they reveal themselves like pages turning in a saga. CSS-first where possible. Framer Motion for the pieces that require orchestration. Never animate for novelty. Always animate for meaning.

### [Wireframes](wireframes.md)

*The layout of the war room. Component hierarchy. Responsive rune-lines.*

Wireframes are standalone HTML5 documents in `ux/wireframes/`. They carry no theme styling -- no colors, no custom fonts, no decorative rules -- so they remain valid regardless of how the theme evolves. When a layout decision is in dispute, the wireframes settle it.

### [Easter Eggs](easter-eggs.md)

*The hidden lore. The Gleipnir Hunt. The Konami Howl. The Loki Mode. The console inscription.*

All 11 easter eggs are implemented (Sprints 2--5). None interrupt the task. All reward the curious.

### [Easter Egg Modal](easter-egg-modal.md)

*The shared modal template for every easter egg discovery moment.*

Gold glow border, Cinzel Decorative headline, two-column artifact layout, animated entry via `saga-enter` easing. All design tokens come from `theme-system.md`.

---

## Implementation Status

All sprints (1--5) shipped. The Saga Ledger design system is fully implemented. Subscription platform is Stripe Direct (Patreon has been fully removed). The `specs/` directory has been deleted (contained stale orchestration plans).

| Artifact | Status |
|----------|--------|
| Theme system (colors, fonts, tokens) | Implemented |
| 78 wireframes (synced 2026-03-17) | Implemented (Multi-IDP: Planned) |
| All 11 easter eggs | Implemented |
| Stripe Direct integration | Implemented |
| Anonymous-first auth model | Implemented |
| Multi-IDP integration | Planned (not yet implemented) |
| Light theme (Stone/Marble + Lightning Norse) | Implemented |
| Chronicles (Prose Edda) | Implemented |
| Import wizard | Implemented |
| Cloud data sync (Firestore) | Implemented |
| Household invite flow | In progress |
| Monitor UI Norse components | Implemented |
| Trash tab | In progress |

---

## The Wolf's Law for Design

1. **The mythology is the skeleton, not the skin.** It cannot be removed. Everything is built on it.
2. **Functional copy is always plain English.** No kennings in buttons. No realm names in badges.
3. **Atmospheric copy is always Norse.** No generic microcopy in headings, empty states, or docs.
4. **The design rewards exploration.** Every easter egg is intentional. Do not remove them.
5. **Dark is default.** The dark void is the primary aesthetic. Light themes (Stone/Marble, Lightning Norse) complement the dark war room — see `light-theme-stone.md` and `light-theme-lightning.md`.
6. **Gold is not yellow.** `#c9920a` is the color of firelight on ancient coin. Used sparingly. Earned.
7. **Numbers are always monospaced.** JetBrains Mono for every dollar, every date, every countdown.

---

> *"Cattle die, kinsmen die, you yourself will die.*
> *But one thing I know that never dies:*
> *the reputation of one who has done well."*
> -- Havamal, stanza 77

*Forged by Freya -- Drawn by Luna -- Held by FiremanDecko -- Tested by Loki*
