# UX Design — Fenrir Ledger

Luna's design territory. Every surface, state, animation, and interaction lives here — from the void-black theme tokens to the wolf that rises on Konami.

---

## Files

- [theme-system.md](theme-system.md) — Color palette, typography, CSS custom properties, and Tailwind config extensions for the Saga Ledger design system.
- [wireframes.md](wireframes.md) — Index of all wireframe documents, layout decisions, responsive breakpoints, z-index layer table, and navigation structure.
- [interactions.md](interactions.md) — Animation keyframes, timing functions, hover states, loading skeletons, and easter egg animation specs.
- [easter-eggs.md](easter-eggs.md) — Full catalog of all eleven easter eggs: triggers, effects, implementation priority, and sprint status.
- [easter-egg-modal.md](easter-egg-modal.md) — Reusable discovery dialog template: structure, React integration guide, token reference, and accessibility notes.

---

## Directories

### `wireframes/`

Standalone HTML5 wireframe documents — structural layout only, no theme styling. Each file is a single view or component variant.

| File | View |
|------|------|
| [dashboard.html](wireframes/dashboard.html) | Dashboard — The Ledger of Fates |
| [add-card.html](wireframes/add-card.html) | Add / Edit Card — Forge a Chain |
| [valhalla.html](wireframes/valhalla.html) | Valhalla — Hall of the Honored Dead |
| [howl-panel.html](wireframes/howl-panel.html) | The Howl Panel (alert sidebar) |
| [marketing-site.html](wireframes/marketing-site.html) | Marketing Site — 5-section static page |
| [easter-egg-modal.html](wireframes/easter-egg-modal.html) | Easter Egg Modal — reusable discovery dialog |
| [about-modal.html](wireframes/about-modal.html) | About Modal — team credits and Gleipnir ingredients |
| [loki-mode.html](wireframes/loki-mode.html) | Loki Mode — Easter Egg #3 |
| [lcars-mode.html](wireframes/lcars-mode.html) | LCARS Mode — Easter Egg #6 |
| [konami-howl.html](wireframes/konami-howl.html) | Konami Code — The Howl, Easter Egg #2 |
| [ragnarok-threshold.html](wireframes/ragnarok-threshold.html) | Ragnarok Threshold — Easter Egg #8 |
| [footer.html](wireframes/footer.html) | App Footer |

### `assets/`

Reference screenshots captured from the running application.

| File | Contents |
|------|----------|
| [font.png](assets/font.png) | Typography reference — Cinzel, Source Serif 4, JetBrains Mono in context |
| [icon.png](assets/icon.png) | Wolf medallion app icon |
| [page.png](assets/page.png) | Full dashboard page screenshot |
| [theme.png](assets/theme.png) | Color palette and token swatch reference |

### `ux-assets/`

Reusable design reference materials shared across the team.

- [ux-assets/mermaid-style-guide.md](ux-assets/mermaid-style-guide.md) — Diagram conventions, color palette, node shapes, and edge style rules for all Mermaid diagrams across the project.

---

## Cross-References

- Mythology and realm mappings: [`designs/product/mythology-map.md`](../product/mythology-map.md)
- Norse copy, kennings, and Edda quotes: [`designs/product/copywriting.md`](../product/copywriting.md)
- Engineering implementation plan: [`designs/architecture/implementation-brief.md`](../architecture/implementation-brief.md)
