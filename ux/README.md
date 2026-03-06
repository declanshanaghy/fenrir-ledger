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

- [theme-system.md](theme-system.md) -- Color palette, typography, CSS custom properties, Tailwind config extensions
- [wireframes.md](wireframes.md) -- Layout specs, component hierarchy, responsive breakpoints, z-index table, wireframe index
- [interactions.md](interactions.md) -- Animation philosophy, saga-enter stagger, status ring, Howl panel, easter egg keyframes
- [easter-eggs.md](easter-eggs.md) -- All hidden references: Gleipnir Hunt, Konami Howl, Loki Mode, console ASCII, and more
- [easter-egg-modal.md](easter-egg-modal.md) -- Shared modal template for all easter egg discovery moments
- [handoff-to-fireman-anon-auth.md](handoff-to-fireman-anon-auth.md) -- FiremanDecko handoff: anonymous-first auth model, householdId, new UI states
- [multi-idp-interaction-spec.md](multi-idp-interaction-spec.md) -- Interaction spec: multi-IDP sign-in dialog (planned Clerk integration)
- [ux-assets/mermaid-style-guide.md](ux-assets/mermaid-style-guide.md) -- Mermaid diagram conventions for all pack members

### Wireframes (26 HTML5 documents)

| Category | Files |
|----------|-------|
| app | [dashboard.html](wireframes/app/dashboard.html), [valhalla.html](wireframes/app/valhalla.html) |
| chrome | [topbar.html](wireframes/chrome/topbar.html), [howl-panel.html](wireframes/chrome/howl-panel.html), [footer.html](wireframes/chrome/footer.html) |
| cards | [add-card.html](wireframes/cards/add-card.html), [wolves-hunger-about-modal.html](wireframes/cards/wolves-hunger-about-modal.html) |
| auth | [sign-in.html](wireframes/auth/sign-in.html), [multi-idp-sign-in.html](wireframes/auth/multi-idp-sign-in.html), [migration-prompt.html](wireframes/auth/migration-prompt.html), [upsell-banner.html](wireframes/auth/upsell-banner.html) |
| notifications | [ragnarok-threshold.html](wireframes/notifications/ragnarok-threshold.html), [card-count-milestones.html](wireframes/notifications/card-count-milestones.html) |
| modals | [about-modal.html](wireframes/modals/about-modal.html) |
| easter-eggs | [easter-egg-modal.html](wireframes/easter-eggs/easter-egg-modal.html), [konami-howl.html](wireframes/easter-eggs/konami-howl.html), [loki-mode.html](wireframes/easter-eggs/loki-mode.html), [lcars-mode.html](wireframes/easter-eggs/lcars-mode.html), [gleipnir-hunt-complete.html](wireframes/easter-eggs/gleipnir-hunt-complete.html) |
| accessibility | [accessibility-polish.html](wireframes/accessibility/accessibility-polish.html) |
| stripe-direct | [stripe-settings.html](wireframes/stripe-direct/stripe-settings.html), [sealed-rune-stripe.html](wireframes/stripe-direct/sealed-rune-stripe.html), [upsell-banner-stripe.html](wireframes/stripe-direct/upsell-banner-stripe.html), [anonymous-checkout.html](wireframes/stripe-direct/anonymous-checkout.html) |
| marketing | [marketing-site.html](wireframes/marketing/marketing-site.html), [static-site-footer.html](wireframes/marketing/static-site-footer.html) |

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
| All 26 wireframes | Implemented |
| All 11 easter eggs | Implemented |
| Stripe Direct integration (4 wireframes) | Implemented |
| Anonymous-first auth model | Implemented |
| Multi-IDP Clerk integration | Planned (not yet implemented) |

---

## The Wolf's Law for Design

1. **The mythology is the skeleton, not the skin.** It cannot be removed. Everything is built on it.
2. **Functional copy is always plain English.** No kennings in buttons. No realm names in badges.
3. **Atmospheric copy is always Norse.** No generic microcopy in headings, empty states, or docs.
4. **The design rewards exploration.** Every easter egg is intentional. Do not remove them.
5. **Dark only.** There is no light mode. The Saga Ledger is a war room, not a spreadsheet.
6. **Gold is not yellow.** `#c9920a` is the color of firelight on ancient coin. Used sparingly. Earned.
7. **Numbers are always monospaced.** JetBrains Mono for every dollar, every date, every countdown.

---

> *"Cattle die, kinsmen die, you yourself will die.*
> *But one thing I know that never dies:*
> *the reputation of one who has done well."*
> -- Havamal, stanza 77

*Forged by Freya -- Drawn by Luna -- Held by FiremanDecko -- Tested by Loki*
