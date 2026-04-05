# Wireframes: Fenrir Ledger

Wireframes are standalone HTML5 documents. They use only structural layout -- no colors, no custom fonts, no shadows, no decorative borders. Theme styling is defined in `theme-system.md` and applied separately by the engineer. If the theme changes, the wireframes remain valid.

## Convention

- All wireframe files live in `ux/wireframes/{category}/` -- see category table below
- Link to them from any `.md` file that references a layout (`[Wireframe](wireframes/category/foo.html)`)
- The HTML files use semantic elements (`<nav>`, `<main>`, `<aside>`, `<section>`, `<form>`, `<fieldset>`) to convey structure
- Permitted CSS: `display: flex/grid`, `border: 1px solid`, `width/height`, `padding/margin`, `font-size`, `font-weight`
- Prohibited CSS: `color`, `background-color`, `font-family` beyond `sans-serif`, `border-radius`, `box-shadow`, `opacity` (except for placeholder items)

---

## Wireframe Index by Category

| Category | Description | Index |
|----------|-------------|-------|
| [accessibility](wireframes/accessibility/README.md) | WCAG 2.1 AA compliance, focus management, touch targets, typography scaling | 2 wireframes |
| [app](wireframes/app/README.md) | Core application views: dashboard, tabs, tier gating, empty states | 5 wireframes |
| [auth](wireframes/auth/README.md) | Authentication flows: sign-in, migration, upsell, multi-IdP | 4 wireframes |
| [cards](wireframes/cards/README.md) | Card views, interactions, tier bling, empty states, tab-specific layouts | 11 wireframes |
| [chrome](wireframes/chrome/README.md) | Application shell: top bar, footer, sidebar, dropdowns, tabs, buttons | 14 wireframes |
| [chronicles](wireframes/chronicles/README.md) | Prose Edda chronicle pages: index, articles, agent report shells, Norse MDX components | 7 wireframes |
| [easter-eggs](wireframes/easter-eggs/README.md) | Hidden discovery mechanics: Gleipnir Hunt, Konami code, Loki Mode | 4 wireframes |
| [heilung](wireframes/heilung/README.md) | Heilung easter egg modal: Norse-styled music discovery | 3 wireframes |
| [household](wireframes/household/README.md) | Household management: invite codes, join flow, merge confirmation | 4 wireframes |
| [import](wireframes/import/README.md) | Card import flow: method selection, CSV upload, safety messaging | 3 wireframes |
| [marketing-site](wireframes/marketing-site/README.md) | Public marketing pages: home, features, pricing, about, free trial, trust | 12 wireframes |
| [modals](wireframes/modals/README.md) | Modal dialogs: About modal and v2 redesign with easter egg integration | 3 wireframes |
| [notifications](wireframes/notifications/README.md) | Ragnarok threshold alerts and card count milestone toasts | 2 wireframes |
| [odins-throne-ui](wireframes/odins-throne-ui/README.md) | Monitor UI: agent profiles, decree inscriptions, error boundaries, tool blocks, verdicts | 18 wireframes |
| [settings-tabs](wireframes/settings-tabs/README.md) | Settings page tab redesign: Account, Household, Settings tabs | 2 wireframes |
| [spear](wireframes/spear/README.md) | Odin's Spear monitor UI: cancel button affordances | 2 wireframes |
| [stripe-direct](wireframes/stripe-direct/README.md) | Stripe payment integration: settings, paywall, upsell, checkout | 6 wireframes |
| [sync](wireframes/sync/README.md) | Cloud sync: indicator states, settings section | 3 wireframes |
| [theme](wireframes/theme/README.md) | Theme system: dark void palette, vellum light mode, toggle controls | 6 wireframes |
| [trial](wireframes/trial/README.md) | 30-day free trial flow: start, status, expiry, feature gates | 4 wireframes |
| [wizard-animations](wireframes/wizard-animations/README.md) | Multi-step wizard: progress indicator, step transitions, mobile layout | 3 wireframes |

---

## Shared Layout Conventions

### Form Action Button Layout

Applies to all forms, dialogs, and modals across the product.

- **Primary action** (Save, Add Card, Confirm, Continue, OK, etc.) -- far **right** of the action row.
- **Cancel** -- immediately to the **left of the primary action**, with a visible gap (16px) between them.
- **Destructive actions** (Delete, Close Card) -- when present alongside Cancel + primary -- isolated on the **left** of the action row.
- **Single-dismiss dialogs** (OK-only, Close-only) -- sole button is right-aligned in the footer. Exception: easter egg discovery modals use centered alignment.

Desktop layout:
```
Edit form:    [ Delete card ]                       [ Cancel ]  [ Save changes ]
Add form:                                           [ Cancel ]  [ Add Card ]
Dialog:                                             [ Cancel ]  [ Confirm ]
```

Mobile (< 640px): Stack vertically. Primary action on top, Cancel below, destructive at bottom.

### Responsive Breakpoints

| Breakpoint | Layout | Card Grid | Howl Panel |
|---|---|---|---|
| Mobile `< 640px` | Single column | 1 col | Collapsible bottom drawer |
| Tablet `640-1024px` | Single column | 2 col | Collapsible side panel |
| Desktop `> 1024px` | Split layout | 2-3 col | Fixed sidebar (when urgent) |
| Wide `> 1280px` | Wide split | 3-4 col | Fixed sidebar |

### Z-Index Layers

| Layer | Z-Index | Element |
|---|---|---|
| Base | 0 | Page content |
| Cards | 10 | Hover-lifted cards |
| Howl panel | 50 | Sidebar |
| Header | 100 | Sticky nav |
| Modal overlay | 200 | Dialog backdrop |
| Modal | 210 | Dialog |
| Toast | 300 | Notifications |
| Easter egg | 9653 | Wolf rise, LCARS mode -- 9653 = W-O-L-F on a phone keypad |
