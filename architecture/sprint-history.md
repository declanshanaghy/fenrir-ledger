# Sprint History — Forged Artifacts

*Detailed per-sprint artifact listings. See the main [README](../README.md) for project overview.*

---

## Sprint 3 — Anonymous-First Auth + Cloud Sync Upsell

- [src/lib/auth/household.ts](../development/frontend/src/lib/auth/household.ts) — Anonymous householdId: `getOrCreateAnonHouseholdId()`, `fenrir:household` localStorage key
- [src/contexts/AuthContext.tsx](../development/frontend/src/contexts/AuthContext.tsx) — `"anonymous"` status; no redirects; `householdId` in context value
- [src/hooks/useAuth.ts](../development/frontend/src/hooks/useAuth.ts) — `householdId` exposed directly; updated AuthStatus type
- [src/components/layout/UpsellBanner.tsx](../development/frontend/src/components/layout/UpsellBanner.tsx) — Dismissible cloud sync upsell banner (dashboard only)
- [src/components/layout/TopBar.tsx](../development/frontend/src/components/layout/TopBar.tsx) — Anonymous ᛟ rune avatar + upsell panel; signed-in dropdown with "The wolf is named."
- [src/components/layout/AppShell.tsx](../development/frontend/src/components/layout/AppShell.tsx) — UpsellBanner injected on `/` route
- [src/app/sign-in/page.tsx](../development/frontend/src/app/sign-in/page.tsx) — Opt-in upgrade surface; "Continue without signing in" full-width CTA; two data variants
- [architecture/adrs/ADR-006-anonymous-first-auth.md](adrs/ADR-006-anonymous-first-auth.md) — Decision record: anonymous-first pivot, migration prompt deferred
- [development/frontend/LOKI-TEST-PLAN-anon-auth.md](../development/frontend/LOKI-TEST-PLAN-anon-auth.md) — QA test plan: 7 suites, 30 test cases
- [quality/story-3.2-anon-auth-verdict.md](../quality/story-3.2-anon-auth-verdict.md) — QA verdict: READY TO SHIP (24/24 tests pass, 0 defects)

### Story 3.1 — Google OIDC Auth (Auth.js v5 + per-household localStorage)

- [src/auth.ts](../development/frontend/src/auth.ts) — Auth.js v5 configuration: Google provider, JWT strategy, householdId from sub claim
- [src/middleware.ts](../development/frontend/src/middleware.ts) — Route protection: /, /cards/*, /valhalla require auth; /api/auth/* is public
- [src/app/api/auth/[...nextauth]/route.ts](../development/frontend/src/app/api/auth/[...nextauth]/route.ts) — Auth.js route handler
- [next-auth.d.ts](../development/frontend/next-auth.d.ts) — TypeScript module augmentations for Session, User, JWT types
- [src/components/layout/AuthProvider.tsx](../development/frontend/src/components/layout/AuthProvider.tsx) — SessionProvider wrapper
- [src/lib/storage.ts](../development/frontend/src/lib/storage.ts) — Refactored to per-household keys: fenrir_ledger:{householdId}:cards
- [src/lib/constants.ts](../development/frontend/src/lib/constants.ts) — DEFAULT_HOUSEHOLD_ID removed/deprecated
- [.env.example](../development/frontend/.env.example) — Google OAuth + Auth.js environment variables
- [architecture/adrs/ADR-004-oidc-auth-localStorage.md](adrs/ADR-004-oidc-auth-localStorage.md) — Decision record: Auth.js v5 choice, JWT strategy, per-household namespacing

### Story 3.5 — Valhalla Archive + Close Card Action

- [app/valhalla/page.tsx](../development/frontend/src/app/valhalla/page.tsx) — Valhalla archive route: tombstone cards, filter bar, empty state, saga-enter stagger
- [types.ts](../development/frontend/src/lib/types.ts) — `closedAt` field added to `Card` interface
- [storage.ts](../development/frontend/src/lib/storage.ts) — `closeCard()`, `getClosedCards()` added; `getCards()` excludes closed cards
- [CardForm.tsx](../development/frontend/src/components/cards/CardForm.tsx) — "Close Card" action + confirmation dialog added (edit mode only)
- [SideNav.tsx](../development/frontend/src/components/layout/SideNav.tsx) — Valhalla nav link with ᛏ RuneIcon added

### Story 3.4 — HowlPanel — Urgent Deadlines Sidebar

- [HowlPanel.tsx](../development/frontend/src/components/layout/HowlPanel.tsx) — Urgent sidebar: filters fee_approaching/promo_expiring, sorts by days remaining, Framer Motion slide-in from right, mobile bottom sheet
- [page.tsx](../development/frontend/src/app/page.tsx) — Dashboard layout updated: flex row with HowlPanel as lg+ right sidebar; mobile bell button opens bottom sheet
- [globals.css](../development/frontend/src/app/globals.css) — `raven-warn` keyframe added for raven icon shake on new urgent card

### Story 3.3 — Framer Motion + Card Animations

- [AnimatedCardGrid.tsx](../development/frontend/src/components/dashboard/AnimatedCardGrid.tsx) — saga-enter stagger + Valhalla exit via Framer Motion variants; `useReducedMotion()` collapses all motion when user prefers reduced motion
- [CardTile.tsx](../development/frontend/src/components/dashboard/CardTile.tsx) — `motion.div` wrapper with `whileHover({ y: -2 })` lift; `useReducedMotion()` disables transform; `.card-chain` CSS class for gold glow
- [CardSkeletonGrid.tsx](../development/frontend/src/components/dashboard/CardSkeletonGrid.tsx) — Norse gold shimmer skeleton loading state
- [globals.css](../development/frontend/src/app/globals.css) — `.card-chain` hover gold glow + `@media prefers-reduced-motion` rules

### Story 3.2 — Norse Copy Pass

- [realm-utils.ts](../development/frontend/src/lib/realm-utils.ts) — `getRealmLabel()` and `getRealmDescription()`: authoritative CardStatus to Norse realm mapping
- [StatusBadge.tsx](../development/frontend/src/components/dashboard/StatusBadge.tsx) — tooltips now use `getRealmDescription()` directly
- [EmptyState.tsx](../development/frontend/src/components/dashboard/EmptyState.tsx) — Gleipnir empty state copy applied
- [SiteHeader.tsx](../development/frontend/src/components/layout/SiteHeader.tsx) — replaced "Credit Card Tracker" tagline with atmospheric "Break free. Harvest every reward."
- [TopBar.tsx](../development/frontend/src/components/layout/TopBar.tsx) — same tagline replacement in top bar logo
- [AboutModal.tsx](../development/frontend/src/components/layout/AboutModal.tsx) — same tagline replacement in About modal logo column
- [layout.tsx (root)](../development/frontend/src/app/layout.tsx) — `title.default` updated to "Ledger of Fates — Fenrir Ledger" per copywriting.md
- Route segment layouts: [cards/new](../development/frontend/src/app/cards/new/layout.tsx), [cards/edit](../development/frontend/src/app/cards/%5Bid%5D/edit/layout.tsx), [valhalla](../development/frontend/src/app/valhalla/layout.tsx), [sign-in](../development/frontend/src/app/sign-in/layout.tsx)

---

## Sprint 2 — Forged Artifacts

**Easter Eggs Implemented**
- Easter Egg #4 (Console ASCII art) — `development/frontend/src/components/layout/ConsoleSignature.tsx`
- Easter Egg #5 (HTML source signature) — JSDoc comment block in `development/frontend/src/app/layout.tsx`
- Easter Egg #7 (Runic meta tag cipher) — `metadata.other["fenrir:runes"]` in `layout.tsx`
- Easter Egg #2 (Konami Code Howl) — `development/frontend/src/components/layout/KonamiHowl.tsx` (up-up-down-down-left-right-left-right-BA)
- Easter Egg #3 (Loki Mode) — Footer "Loki" span: 7 clicks shuffles card grid + random realm badges for 5 s
- Easter Egg #1 Fragment 5 (Breath of a Fish) — Footer copyright hover triggers `GleipnirFishBreath` modal

**Footer Component**
- [Footer.tsx](../development/frontend/src/components/layout/Footer.tsx) — Three-column layout, brand wordmark, About nav, team colophon, both easter eggs wired

---

## Sprint 1 — Forged Artifacts

**The Architecture**
- [Sprint Plan](sprint-plan.md) — 5 stories, acceptance criteria, technical notes
- [System Design](system-design.md) — Component architecture, data model, data flow diagrams
- [ADR-001: Tech Stack](adrs/ADR-001-tech-stack.md) — Why Next.js + TypeScript + Tailwind + shadcn/ui
- [ADR-002: Data Model](adrs/ADR-002-data-model.md) — Household-scoped schema from day one
- [ADR-003: Local Storage](adrs/ADR-003-local-storage.md) — localStorage for Sprint 1 + the migration path

**The Implementation**
- [Implementation Plan](../development/implementation-plan.md) — Ordered task breakdown
- [QA Handoff](../development/qa-handoff.md) — Files created, test focus areas, known limits
- [Setup Script](../development/scripts/setup-local.sh) — Idempotent local dev setup
- [Source Code](../development/frontend/) — Next.js project root
