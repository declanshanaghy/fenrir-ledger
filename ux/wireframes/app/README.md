# App Wireframes

Core application views: dashboard, tabs, tier gating, and empty states.

| File | Issue | Description |
|------|-------|-------------|
| [dashboard-tabs.html](dashboard-tabs.html) | #279 | Tabbed dashboard layout replacing grid + Howl side panel: 6 scenarios covering desktop Howl tab active, desktop Active tab active, empty Howl state, empty Howl panel content, mobile Howl tab, mobile Active tab; interaction spec covering tab switching, default tab logic, badge updates, urgency styling |
| [howl-karl-tier.html](howl-karl-tier.html) | #398 | Howl Panel gated behind Karl ($3.99/mo): 5 scenarios — Thrall desktop teaser (blurred fake alerts + upsell overlay), Karl desktop full panel, tab bar anatomy (Thrall lock icon + KARL badge vs Karl urgency badge), mobile 375px Thrall teaser, mobile Karl full panel; Ragnarok gate spec; interaction + accessibility spec |
| [ledger-empty-state-2117.html](ledger-empty-state-2117.html) | #2117 | Ledger empty state redesign for anonymous users: 9 sections — before/after comparison, desktop wireframe with three-tier CTA group (Tier 1: "Start Your Free 30-Day Trial" gold primary button, Tier 2: "Login & Return to Hlidskjalf" secondary outlined button, Tier 3: "Add a card locally" text link); mobile 375px wireframe; interaction spec; WCAG 2.1 AA accessibility; component structure notes |
| [valhalla.html](valhalla.html) | -- | Tombstone cards, filter bar, empty state for the Hall of the Honored Dead |
| [valhalla-karl-gated.html](valhalla-karl-gated.html) | #377 | Valhalla tab gating: Thrall tab bar with lock indicator, dialog trigger, Karl unlocked state, mobile bottom nav + content tabs, behavior table Thrall vs Karl |
