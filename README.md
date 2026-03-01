# ᛟ Fenrir Ledger

[![Deploy to Vercel](https://github.com/declanshanaghy/fenrir-ledger/actions/workflows/vercel.yml/badge.svg)](https://github.com/declanshanaghy/fenrir-ledger/actions/workflows/vercel.yml)
[![Last Commit](https://img.shields.io/github/last-commit/declanshanaghy/fenrir-ledger?color=c9920a&logo=git&logoColor=white)](https://github.com/declanshanaghy/fenrir-ledger/commits/main)
[![License: ELv2](https://img.shields.io/badge/license-ELv2-brightgreen)](LICENSE.md)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

**Break free from fee traps. Harvest every reward. Let no chain hold.**

> *In Norse mythology, Fenrir is the great wolf who shatters the chains the gods forged to bind him.*
> *Fenrir Ledger breaks the invisible chains of forgotten annual fees, expired promotions,*
> *and wasted sign-up bonuses that silently devour your wallet.*

---

<table><tr>
<td align="center" width="33%">

### ᛟ
**<a href="https://fenrir-ledger.vercel.app" target="_blank" rel="noopener">Enter the Ledger →</a>**

*The wolf does not wait. Step into the forge and name your chains before they name you.*

</td>
<td align="center" width="33%">

### ᚱ
**<a href="https://fenrir-ledger.vercel.app/static" target="_blank" rel="noopener">Visit the Marketing Site →</a>**

*Read the runes. Know what was built, why it was built, and what hunts next.*

</td>
<td align="center" width="33%">

### ᛏ
**<a href="https://fenrir-ledger.vercel.app/sessions" target="_blank" rel="noopener">Session Chronicles →</a>**

*Every session forged in fire, recorded in runes. The wolf remembers what the gods tried to bury.*

</td>
</tr></table>

---

Track every fee-wyrm in your portfolio. Every chain forged, every promo deadline, every fee-serpent's strike date — Fenrir watches and howls before the trap snaps shut. Add your cards, name your thresholds, and the wolf does the rest: reminding you to spend, transfer, downgrade, or close before you lose a single dollar to a fee you didn't choose to pay.

*Sprint 3 complete. Sprint 4 groomed and Ready: Ragnarök threshold mode, card count milestones, Gleipnir Hunt completion (resolves DEF-001), accessibility polish, and the Wolf's Hunger meter. All 5 stories carry code-audit notes from Freya's 2026-02-28 groom.*

---

## The Pack

| Role | Wolf | Model | Scroll |
|------|------|-------|--------|
| Product Owner | Freya | Sonnet | [AGENT](.claude/agents/freya.md) |
| UX Designer | Luna | Sonnet | [AGENT](.claude/agents/luna.md) |
| Principal Engineer | FiremanDecko | Sonnet | [AGENT](.claude/agents/fireman-decko.md) |
| QA Tester | Loki | Haiku | [AGENT](.claude/agents/loki.md) |

## The Pipeline

```mermaid
graph LR
    classDef primary fill:#03A9F4,stroke:#0288D1,color:#FFF
    classDef healthy fill:#4CAF50,stroke:#388E3C,color:#FFF
    classDef warning fill:#FF9800,stroke:#F57C00,color:#FFF
    classDef neutral fill:#F5F5F5,stroke:#E0E0E0,color:#212121

    %% Roles
    po(Freya<br/>Product Owner)
    ux(Luna<br/>UX Designer)
    eng(FiremanDecko<br/>Principal Engineer)
    qa(Loki<br/>QA Tester)

    %% Artifacts
    brief[Design Brief]
    sysdesign[System Design<br/>+ API Contracts]
    impl[Implementation]
    ship([Accepted ✓])

    %% Pipeline
    po -->|collaborates| ux
    ux -->|produces| brief
    brief -->|handed off| eng
    eng -->|produces| sysdesign
    sysdesign -->|guides| impl
    impl -->|tested by| qa
    qa -->|ship / no-ship| ship

    class po primary
    class ux primary
    class eng primary
    class qa warning
    class brief neutral
    class sysdesign neutral
    class impl neutral
    class ship healthy
```

Kanban · Max 5 chains per sprint · The forge-script runs every sprint

---

## The Scrolls

### ᛟ Foundation

- [Product Brief](product-brief.md) — What the wolf hunts, why, and for whom. The prioritized backlog.
- [Patient Zero](patient-zero.md) — Pack composition, pipeline summary, quick-reference setup.

### ᚢ [Freya — Product Owner](product/README.md)

*The voice of the user. Nothing moves downstream without her word.*

- [product/README.md](product/README.md) — Product domain index: mythology map, copywriting guide, backlog
- [product/product-design-brief.md](product/product-design-brief.md) — Design philosophy, anonymous-first identity model, header states
- [product/backlog/README.md](product/backlog/README.md) — Groomed backlog index (Sprint 4 stories: 4.1–4.5)
- [product/backlog/story-4.1-ragnarok-threshold.md](product/backlog/story-4.1-ragnarok-threshold.md) — P1: Ragnarök Threshold Mode (visual alarm ≥3 urgent cards)
- [product/backlog/story-4.2-card-count-milestones.md](product/backlog/story-4.2-card-count-milestones.md) — P2: Card Count Milestone Toasts (5 thresholds, one-time)
- [product/backlog/story-4.3-gleipnir-hunt-complete.md](product/backlog/story-4.3-gleipnir-hunt-complete.md) — P2: Gleipnir Hunt — wire fragments 4 and 6, complete the unlock
- [product/backlog/story-4.4-accessibility-and-ux-polish.md](product/backlog/story-4.4-accessibility-and-ux-polish.md) — P2: Accessibility and UX polish pass (keyboard, mobile, reduced motion)
- [product/backlog/story-4.5-wolves-hunger-and-about-modal.md](product/backlog/story-4.5-wolves-hunger-and-about-modal.md) — P3: Wolf's Hunger Meter in About modal
- [product/backlog/future-deferred.md](product/backlog/future-deferred.md) — Deferred items with rationale (LCARS, migration wizard, reminders)
- [product/backlog/story-auth-oidc-google.md](product/backlog/story-auth-oidc-google.md) — P3 (GA-deferred): Optional Login — Google OIDC + Cloud Sync Upsell
- [product/handoff-to-luna-anon-auth.md](product/handoff-to-luna-anon-auth.md) — Handoff to Luna: anonymous-first auth + cloud sync upsell UX brief

### [ᚱ The Saga Ledger — Design](ux/README.md)

*Luna's domain. The visual soul of the wolf.*

- [ux/README.md](ux/README.md) — The wolf speaks. A guide to the full design system, in the voice of Fenrir.
- [product/product-design-brief.md](product/product-design-brief.md) — Design philosophy, three pillars, aesthetic direction
- [ux/theme-system.md](ux/theme-system.md) — Color palette, typography, CSS tokens, Tailwind extensions
- [product/mythology-map.md](product/mythology-map.md) — Nine Realms → card states, Norns, Huginn & Muninn, Hati & Sköll
- [product/copywriting.md](product/copywriting.md) — Kennings, Edda quotes, empty states, action labels, error voice
- [ux/easter-eggs.md](ux/easter-eggs.md) — Gleipnir Hunt, Konami howl, Loki mode, console ASCII, all hidden lore
- [ux/interactions.md](ux/interactions.md) — Animations, saga-enter stagger, status ring, Howl panel patterns
- [ux/wireframes.md](ux/wireframes.md) — Layout specs, component hierarchy, responsive breakpoints, form action button alignment convention
- [ux/wireframes/topbar.html](ux/wireframes/topbar.html) — TopBar: anonymous ᛟ rune + upsell prompt, signed-in avatar, avatar transition (Sprint 3.2)
- [ux/wireframes/upsell-banner.html](ux/wireframes/upsell-banner.html) — Cloud sync upsell banner: dismissible, dashboard-only (Sprint 3.2)
- [ux/wireframes/sign-in.html](ux/wireframes/sign-in.html) — Sign-in page: optional upgrade, "Continue without signing in" first-class CTA (Sprint 3.2)
- [ux/wireframes/migration-prompt.html](ux/wireframes/migration-prompt.html) — Post-OAuth migration modal: Import vs. Start fresh (Sprint 3.2)
- [ux/handoff-to-fireman-anon-auth.md](ux/handoff-to-fireman-anon-auth.md) — FiremanDecko handoff: anonymous-first model, householdId, what to build
- [architecture/implementation-brief.md](architecture/implementation-brief.md) — FiremanDecko integration plan, wave strategy, open questions
- [ux/easter-egg-modal.md](ux/easter-egg-modal.md) — Shared modal template for all easter egg discovery moments

### ᚲ [The Forge — Architecture + Development](development/README.md)

*FiremanDecko's domain. Where the chains are forged.*

- [development/README.md](development/README.md) — Index of all development artifacts: source code, scripts, implementation plan, QA handoff, and technical specs
- [architecture/system-design.md](architecture/system-design.md) — Component architecture, data model, data flow diagrams (updated through Sprint 2)
- [architecture/sprint-plan.md](architecture/sprint-plan.md) — Rolling multi-sprint plan: Sprint 1 (historical), Sprint 2 (delivered), Sprint 3–4 (upcoming)
- [architecture/adrs/](architecture/adrs/) — Architecture Decision Records (ADR-001 through ADR-006)
- [architecture/adrs/ADR-005-auth-pkce-public-client.md](architecture/adrs/ADR-005-auth-pkce-public-client.md) — ADR-005: PKCE public client auth, localStorage session
- [architecture/adrs/ADR-006-anonymous-first-auth.md](architecture/adrs/ADR-006-anonymous-first-auth.md) — ADR-006: Anonymous-first auth pivot, householdId from localStorage, cloud sync upsell
- [development/spec-auth-oidc-google.md](development/spec-auth-oidc-google.md) — Technical spec: Google OIDC login (Iteration 1)
- `architecture/api-contracts.md` — API surface, data shapes, endpoint specs *(future sprint)*
- [development/src/](development/src/) — The forge itself. Next.js source code lives here.
- [development/implementation-plan.md](development/implementation-plan.md) — Ordered task breakdown, what was built
- [development/qa-handoff.md](development/qa-handoff.md) — Handoff to Loki: deploy steps, test focus, known limits
- [development/scripts/](development/scripts/) — Idempotent build and deploy scripts

### ᛏ [Loki's Domain — Quality](quality/README.md)

*The trickster tests. His verdicts are final.*

- [quality/README.md](quality/README.md) — Index of all QA artifacts and test execution guide
- [quality/story-3.4-howl-panel-verdict.md](quality/story-3.4-howl-panel-verdict.md) — QA verdict: PR #7 (feat/howl-panel) — READY TO SHIP ✓ (0 defects)
- [quality/story-3.2-anon-auth-verdict.md](quality/story-3.2-anon-auth-verdict.md) — QA verdict: Story 3.2 (Anonymous-First Auth + Cloud Sync Upsell) — READY TO SHIP ✓ (0 defects, 24/24 tests pass)
- [quality/story-3.1-verdict.md](quality/story-3.1-verdict.md) — QA verdict: Story 3.1 (Google OIDC Auth + per-household localStorage) — READY TO SHIP ✓ (0 defects)
- [quality/story-3.1-realm-utils-verdict.md](quality/story-3.1-realm-utils-verdict.md) — QA verdict: PR #3 (feat/realm-utils) — SHIP ✓ (0 defects)
- [quality/story-3.5-verdict.md](quality/story-3.5-verdict.md) — QA verdict: Story 3.5 (Valhalla Archive + Close Card) — HOLD (DEF-001: wrong gleipnir fragment)
- [quality/story-3.3-verdict.md](quality/story-3.3-verdict.md) — QA verdict: Story 3.3 (Framer Motion + Card Animations) — SHIP ✓ (0 defects)
- [quality/story-3.2-norse-copy-verdict.md](quality/story-3.2-norse-copy-verdict.md) — QA verdict: PR #6 (feat/norse-copy-pass) — SHIP ✓ (0 defects)
- [quality/test-plan.md](quality/test-plan.md) — Easter eggs test strategy and coverage plan (283 lines)
- [quality/test-cases.md](quality/test-cases.md) — 22 test cases for all implemented eggs (Konami #2, Mountain #3, Fish #5, Forgemaster #9, Loki Mode) (480 lines)
- [quality/EASTER-EGGS-AUDIT.md](quality/EASTER-EGGS-AUDIT.md) — Final verdict report: READY TO SHIP, 0 defects (369 lines)
- [quality/easter-eggs-transparency-report.md](quality/easter-eggs-transparency-report.md) — SVG artifact validation and background transparency audit (236 lines)
- [quality/scripts/test-easter-eggs.spec.ts](quality/scripts/test-easter-eggs.spec.ts) — Playwright automation suite, 22 tests across 8 test suites (596 lines)

### ᚠ Pack Operations

- [Pipeline](architecture/pipeline.md) — Full Kanban workflow orchestration
- [Git Convention](.claude/skills/git-commit/SKILL.md) — Commit format and pre-commit oaths
- [Mermaid Style Guide](ux/ux-assets/mermaid-style-guide.md) — Diagram conventions for all pack members

### ᛁ Templates

- [Create Product Brief](prompts/create-product-brief.md) — Prompt template for generating product briefs (ZeroForge convention)

---

## The Forge — Quick Start

```bash
# Clone the pack's work
git clone https://github.com/declanshanaghy/fenrir-ledger.git
cd fenrir-ledger

# Prepare the forge (idempotent)
./development/scripts/setup-local.sh

# Stoke the fire
cd development/src && npm run dev

# Open http://localhost:9999
```

### Sprint 3 — Anonymous-First Auth + Cloud Sync Upsell

- [src/lib/auth/household.ts](development/src/src/lib/auth/household.ts) — Anonymous householdId: `getOrCreateAnonHouseholdId()`, `fenrir:household` localStorage key
- [src/contexts/AuthContext.tsx](development/src/src/contexts/AuthContext.tsx) — `"anonymous"` status; no redirects; `householdId` in context value
- [src/hooks/useAuth.ts](development/src/src/hooks/useAuth.ts) — `householdId` exposed directly; updated AuthStatus type
- [src/components/layout/UpsellBanner.tsx](development/src/src/components/layout/UpsellBanner.tsx) — Dismissible cloud sync upsell banner (dashboard only)
- [src/components/layout/TopBar.tsx](development/src/src/components/layout/TopBar.tsx) — Anonymous ᛟ rune avatar + upsell panel; signed-in dropdown with "The wolf is named."
- [src/components/layout/AppShell.tsx](development/src/src/components/layout/AppShell.tsx) — UpsellBanner injected on `/` route
- [src/app/sign-in/page.tsx](development/src/src/app/sign-in/page.tsx) — Opt-in upgrade surface; "Continue without signing in" full-width CTA; two data variants
- [architecture/adrs/ADR-006-anonymous-first-auth.md](architecture/adrs/ADR-006-anonymous-first-auth.md) — Decision record: anonymous-first pivot, migration prompt deferred
- [development/src/LOKI-TEST-PLAN-anon-auth.md](development/src/LOKI-TEST-PLAN-anon-auth.md) — QA test plan: 7 suites, 30 test cases
- [quality/story-3.2-anon-auth-verdict.md](quality/story-3.2-anon-auth-verdict.md) — QA verdict: READY TO SHIP ✓ (24/24 tests pass, 0 defects)

### Sprint 3 — Story 3.1 — Google OIDC Auth (Auth.js v5 + per-household localStorage)

- [src/auth.ts](development/src/src/auth.ts) — Auth.js v5 configuration: Google provider, JWT strategy, householdId from sub claim
- [src/middleware.ts](development/src/src/middleware.ts) — Route protection: /, /cards/*, /valhalla require auth; /api/auth/* is public
- [src/app/api/auth/[...nextauth]/route.ts](development/src/src/app/api/auth/[...nextauth]/route.ts) — Auth.js route handler
- [next-auth.d.ts](development/src/next-auth.d.ts) — TypeScript module augmentations for Session, User, JWT types
- [src/components/layout/AuthProvider.tsx](development/src/src/components/layout/AuthProvider.tsx) — SessionProvider wrapper
- [src/lib/storage.ts](development/src/src/lib/storage.ts) — Refactored to per-household keys: fenrir_ledger:{householdId}:cards
- [src/lib/constants.ts](development/src/src/lib/constants.ts) — DEFAULT_HOUSEHOLD_ID removed/deprecated
- [.env.example](development/src/.env.example) — Google OAuth + Auth.js environment variables
- [architecture/adrs/ADR-004-oidc-auth-localStorage.md](architecture/adrs/ADR-004-oidc-auth-localStorage.md) — Decision record: Auth.js v5 choice, JWT strategy, per-household namespacing
- [implementation-plan.md](development/implementation-plan.md) — Story 3.1 tasks documented
- [qa-handoff.md](development/qa-handoff.md) — Story 3.1 QA handoff with full test matrix

### Sprint 3 — Story 3.5 — Valhalla Archive + Close Card Action

- [app/valhalla/page.tsx](development/src/src/app/valhalla/page.tsx) — Valhalla archive route: tombstone cards, filter bar, empty state, saga-enter stagger
- [types.ts](development/src/src/lib/types.ts) — `closedAt` field added to `Card` interface
- [storage.ts](development/src/src/lib/storage.ts) — `closeCard()`, `getClosedCards()` added; `getCards()` excludes closed cards
- [CardForm.tsx](development/src/src/components/cards/CardForm.tsx) — "Close Card" action + confirmation dialog added (edit mode only)
- [SideNav.tsx](development/src/src/components/layout/SideNav.tsx) — Valhalla nav link with ᛏ RuneIcon added
- [implementation-plan.md](development/implementation-plan.md) — Story 3.5 tasks documented
- [qa-handoff.md](development/qa-handoff.md) — Story 3.5 QA handoff with full test matrix

### Sprint 3 — Story 3.4 — HowlPanel — Urgent Deadlines Sidebar

- [HowlPanel.tsx](development/src/src/components/layout/HowlPanel.tsx) — Urgent sidebar: filters fee_approaching/promo_expiring, sorts by days remaining, Framer Motion slide-in from right, mobile bottom sheet
- [page.tsx](development/src/src/app/page.tsx) — Dashboard layout updated: flex row with HowlPanel as lg+ right sidebar; mobile ᚲ bell button opens bottom sheet
- [globals.css](development/src/src/app/globals.css) — `raven-warn` keyframe added for raven icon shake on new urgent card

### Sprint 3 — Story 3.3 — Framer Motion + Card Animations

- [AnimatedCardGrid.tsx](development/src/src/components/dashboard/AnimatedCardGrid.tsx) — saga-enter stagger + Valhalla exit via Framer Motion variants; `useReducedMotion()` collapses all motion when user prefers reduced motion
- [CardTile.tsx](development/src/src/components/dashboard/CardTile.tsx) — `motion.div` wrapper with `whileHover={{ y: -2 }}` lift; `useReducedMotion()` disables transform; `.card-chain` CSS class for gold glow
- [CardSkeletonGrid.tsx](development/src/src/components/dashboard/CardSkeletonGrid.tsx) — Norse gold shimmer skeleton loading state
- [globals.css](development/src/src/app/globals.css) — `.card-chain` hover gold glow + `@media prefers-reduced-motion` rules for both `.card-chain` and `.saga-reveal`
- [implementation-plan.md](development/implementation-plan.md) — Story 3.3 tasks documented
- [qa-handoff.md](development/qa-handoff.md) — Story 3.3 QA handoff with full test matrix

### Sprint 3 — Story 3.2 — Norse Copy Pass

- [realm-utils.ts](development/src/src/lib/realm-utils.ts) — `getRealmLabel()` and `getRealmDescription()`: authoritative CardStatus → Norse realm mapping
- [StatusBadge.tsx](development/src/src/components/dashboard/StatusBadge.tsx) — tooltips now use `getRealmDescription()` directly
- [EmptyState.tsx](development/src/src/components/dashboard/EmptyState.tsx) — Gleipnir empty state copy applied
- [SiteHeader.tsx](development/src/src/components/layout/SiteHeader.tsx) — replaced "Credit Card Tracker" tagline with atmospheric "Break free. Harvest every reward."
- [TopBar.tsx](development/src/src/components/layout/TopBar.tsx) — same tagline replacement in top bar logo
- [AboutModal.tsx](development/src/src/components/layout/AboutModal.tsx) — same tagline replacement in About modal logo column
- [layout.tsx (root)](development/src/src/app/layout.tsx) — `title.default` updated to "Ledger of Fates — Fenrir Ledger" per copywriting.md
- [app/cards/new/layout.tsx](development/src/src/app/cards/new/layout.tsx) — route segment layout sets title: "Add Card"
- [app/cards/\[id\]/edit/layout.tsx](development/src/src/app/cards/%5Bid%5D/edit/layout.tsx) — route segment layout sets title: "Edit Card"
- [app/valhalla/layout.tsx](development/src/src/app/valhalla/layout.tsx) — route segment layout sets title: "Valhalla"
- [app/sign-in/layout.tsx](development/src/src/app/sign-in/layout.tsx) — route segment layout sets title: "Sign In"
- [implementation-plan.md](development/implementation-plan.md) — Story 3.2 tasks documented
- [qa-handoff.md](development/qa-handoff.md) — Story 3.2 QA handoff with full test matrix

---

### Sprint 2 — Forged Artifacts

**Easter Eggs Implemented**
- Easter Egg #4 (Console ASCII art) — `development/src/src/components/layout/ConsoleSignature.tsx`
- Easter Egg #5 (HTML source signature) — JSDoc comment block in `development/src/src/app/layout.tsx`
- Easter Egg #7 (Runic meta tag cipher) — `metadata.other["fenrir:runes"]` in `layout.tsx`
- Easter Egg #2 (Konami Code Howl) — `development/src/src/components/layout/KonamiHowl.tsx` (↑↑↓↓←→←→BA)
- Easter Egg #3 (Loki Mode) — Footer "Loki" span: 7 clicks shuffles card grid + random realm badges for 5 s
- Easter Egg #1 Fragment 5 (Breath of a Fish) — Footer © hover triggers `GleipnirFishBreath` modal

**Footer Component**
- [Footer.tsx](development/src/src/components/layout/Footer.tsx) — Three-column layout, brand wordmark, About nav, team colophon, both easter eggs wired

---

### Sprint 1 — Forged Artifacts

**The Architecture**
- [Sprint Plan](architecture/sprint-plan.md) — 5 stories, acceptance criteria, technical notes
- [System Design](architecture/system-design.md) — Component architecture, data model, data flow diagrams
- [ADR-001: Tech Stack](architecture/adrs/ADR-001-tech-stack.md) — Why Next.js + TypeScript + Tailwind + shadcn/ui
- [ADR-002: Data Model](architecture/adrs/ADR-002-data-model.md) — Household-scoped schema from day one
- [ADR-003: Local Storage](architecture/adrs/ADR-003-local-storage.md) — localStorage for Sprint 1 + the migration path

**The Implementation**
- [Implementation Plan](development/implementation-plan.md) — Ordered task breakdown
- [QA Handoff](development/qa-handoff.md) — Files created, test focus areas, known limits
- [Setup Script](development/scripts/setup-local.sh) — Idempotent local dev setup
- [Source Code](development/src/) — Next.js project root

---

## Lineage

Fenrir Ledger was forged from [ZeroForge](https://github.com/declanshanaghy/zeroforge) — a reusable AI agent team starter kit — with structural improvements carried forward from [Vulcan Brownout](https://github.com/declanshanaghy/vulcan-brownout): explicit input/output file mappings per agent, a flat output directory structure, and the `patient-zero.md` quick-reference pattern.

*"Though it looks like silk ribbon, no chain is stronger."*
— Prose Edda, Gylfaginning

---

## License

Copyright (C) 2026 Declan Shanaghy. Licensed under the [Elastic License 2.0 (ELv2)](LICENSE.md) — free for personal use; no competing hosted/managed service.

---

## The Pack's Oaths

- **Diagrams**: All Mermaid, following the [mermaid-style-guide.md](ux/ux-assets/mermaid-style-guide.md)
- **Commits**: Strict format per [git-commit/SKILL.md](.claude/skills/git-commit/SKILL.md)
- **Secrets**: `.env` file, never committed, `.env.example` as the template
- **Sprints**: Max 5 stories. The forge-script runs every sprint. No exceptions.
- **Output**: Each wolf writes to its top-level folder (`product/`, `ux/`, `architecture/`, `development/`, `quality/`). Git tracks the history — files are overwritten each sprint, no subdirectories.
