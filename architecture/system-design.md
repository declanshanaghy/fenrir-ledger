# System Design: Fenrir Ledger (Post-Sprint 5 — Current)

## Overview

Fenrir Ledger is a client-side Next.js 15 application deployed on Vercel at https://fenrir-ledger.vercel.app. All user data is persisted in localStorage behind a typed abstraction layer, namespaced per household. Authentication is anonymous-first (ADR-006): users can use the app immediately without signing in. Optional Google OIDC sign-in (Authorization Code + PKCE, ADR-005) enables future cloud sync. The app includes a three-path import workflow (Google Sheets URL, CSV upload, manual entry), Framer Motion animations, and a deep Norse mythology easter egg layer.

---

## Architecture

### Component Architecture

```mermaid
graph TD
    classDef primary fill:#03A9F4,stroke:#0288D1,color:#FFF
    classDef neutral fill:#F5F5F5,stroke:#E0E0E0,color:#212121
    classDef healthy fill:#4CAF50,stroke:#388E3C,color:#FFF
    classDef warning fill:#FF9800,stroke:#F57C00,color:#FFF
    classDef background fill:#2C2C2C,stroke:#444,color:#FFF

    %% Entry points
    browser([User Browser]) -->|HTTP GET /| dashpage[Dashboard Page\n/app/page.tsx]
    browser -->|HTTP GET /cards/new| newpage[Add Card Page\n/app/cards/new/page.tsx]
    browser -->|HTTP GET /cards/id/edit| editpage[Edit Card Page\n/app/cards/id/edit/page.tsx]
    browser -->|HTTP GET /valhalla| valpage[Valhalla Page\n/app/valhalla/page.tsx]
    browser -->|HTTP GET /sign-in| signinpage[Sign-In Page\n/app/sign-in/page.tsx]
    browser -->|HTTP GET /auth/callback| callbackpage[Auth Callback\n/app/auth/callback/page.tsx]

    %% Auth context
    authctx[AuthContext\nanonymous or authenticated] --> dashpage
    authctx --> newpage
    authctx --> editpage
    authctx --> valpage

    %% App shell
    dashpage --> appshell[AppShell\nlayout wrapper]
    appshell --> topbar[TopBar]
    appshell --> sidenav[SideNav]
    appshell --> footer[Footer]
    appshell --> upsell[UpsellBanner]
    appshell --> howlpanel[HowlPanel\nurgent cards sidebar]

    %% Dashboard page components
    dashpage --> dashboard[Dashboard Component]
    dashboard --> animgrid[AnimatedCardGrid]
    dashboard --> skeleton[CardSkeletonGrid]
    animgrid --> cardtile[CardTile Component]
    cardtile --> statusbadge[StatusBadge Component]
    cardtile --> statusring[StatusRing\nSVG deadline ring]
    dashboard --> emptyst[EmptyState Component]

    %% Form pages
    newpage --> cardform[CardForm Component]
    editpage --> cardform
    cardform --> gleipnir[Gleipnir Fragment\nComponents]

    %% Import flow
    dashpage --> importwiz[ImportWizard]
    importwiz --> shareurl[ShareUrlEntry]
    importwiz --> csvupload[CsvUpload]
    importwiz --> dedupstep[ImportDedupStep]
    importwiz --> authgate[AuthGate]

    %% Easter eggs
    appshell --> konami[KonamiHowl]
    appshell --> ragnarok[RagnarokContext\nthreshold overlay]
    footer --> lokimode[Loki Mode trigger]
    footer --> fishbreath[GleipnirFishBreath modal]
    appshell --> consolesig[ConsoleSignature\nclient-only, console art]
    appshell --> forgemaster[ForgeMasterEgg]

    %% Shared
    dashboard --> wolfhunger[WolfHungerMeter]

    %% Shared lib
    dashboard -->|reads| storage[storage.ts\nLocalStorage Abstraction]
    cardform -->|reads/writes| storage
    importwiz -->|writes| storage
    storage -->|JSON serialize/deserialize| ls[(localStorage\nbrowser storage)]

    %% Auth lib
    signinpage -->|PKCE flow| authlib[auth/pkce.ts\nauth/session.ts]
    callbackpage -->|token exchange| tokenapi[/api/auth/token\nserver proxy]
    authlib --> ls

    %% API routes
    importwiz -->|POST| sheetsapi[/api/sheets/import]

    %% Utilities
    storage --> types[types.ts\nTypeScript Interfaces]
    cardform --> cardutils[card-utils.ts\ncomputeCardStatus]
    statusbadge --> realmutils[realm-utils.ts\ngetRealmLabel]
    dashboard --> milestoneutils[milestone-utils.ts]
    dashboard --> gleipnirutils[gleipnir-utils.ts]

    class dashpage primary
    class newpage primary
    class editpage primary
    class valpage primary
    class signinpage primary
    class callbackpage primary
    class dashboard primary
    class cardform primary
    class appshell primary
    class topbar primary
    class sidenav primary
    class footer primary
    class importwiz primary
    class storage healthy
    class ls background
    class types neutral
    class cardutils neutral
    class realmutils neutral
    class milestoneutils neutral
    class gleipnirutils neutral
    class konami warning
    class lokimode warning
    class fishbreath warning
    class consolesig neutral
    class gleipnir neutral
    class ragnarok warning
    class forgemaster warning
    class authlib healthy
    class authctx healthy
    class tokenapi healthy
    class sheetsapi healthy
    class howlpanel primary
    class statusring neutral
    class animgrid primary
    class wolfhunger neutral
```

### Data Flow: Load Dashboard

```mermaid
sequenceDiagram
    participant U as User
    participant D as Dashboard Page
    participant S as storage.ts
    participant L as localStorage

    U->>D: Navigate to /
    D->>S: initializeDefaultHousehold()
    S->>L: GET fenrir_ledger:households
    L-->>S: null or JSON string
    S->>L: SET fenrir_ledger:households (if not exists)
    D->>S: getCards("default-household")
    S->>L: GET fenrir_ledger:cards
    L-->>S: JSON string of Card[]
    S-->>D: Card[] (filtered by householdId)
    D->>D: computeCardStatus() for each card
    D-->>U: Render dashboard with card tiles
```

### Data Flow: Add Card

```mermaid
sequenceDiagram
    participant U as User
    participant F as CardForm
    participant V as Zod Validator
    participant CU as card-utils.ts
    participant S as storage.ts
    participant L as localStorage

    U->>F: Fill form and submit
    F->>V: validate(formData)
    V-->>F: ValidationResult
    alt validation fails
        F-->>U: Show field errors (scroll to first)
    else validation passes
        F->>CU: computeCardStatus(newCard)
        CU-->>F: CardStatus
        F->>S: saveCard(newCard with status)
        S->>L: GET fenrir_ledger:cards
        L-->>S: existing Card[]
        S->>L: SET fenrir_ledger:cards (appended)
        F-->>U: Navigate to dashboard
    end
```

---

## Data Model

### Entity Relationship

```mermaid
classDiagram
    class Household {
        +String id
        +String name
        +String createdAt
    }

    class Card {
        +String id
        +String householdId
        +String issuerId
        +String cardName
        +String openDate
        +Number creditLimit
        +Number annualFee
        +String annualFeeDate
        +Number promoPeriodMonths
        +SignUpBonus signUpBonus
        +CardStatus status
        +String notes
        +String createdAt
        +String updatedAt
    }

    class SignUpBonus {
        +String type
        +Number amount
        +Number spendRequirement
        +String deadline
        +Boolean met
    }

    Household "1" --> "0..*" Card : contains
    Card "1" --> "0..1" SignUpBonus : has
```

### Card Status State Machine

```mermaid
stateDiagram-v2
    [*] --> active: Card added
    active --> fee_approaching: Annual fee date within 60 days
    active --> promo_expiring: Sign-up bonus deadline within 30 days
    fee_approaching --> active: Annual fee date updated / renewed
    promo_expiring --> active: Bonus deadline updated / met
    fee_approaching --> closed: User marks card closed
    promo_expiring --> closed: User marks card closed
    active --> closed: User marks card closed
    closed --> [*]
```

### localStorage Key Schema

| Key | Type | Description |
|-----|------|-------------|
| `fenrir_ledger:schema_version` | string (integer) | Schema version number. Sprint 2 = `"1"` (unchanged from Sprint 1) |
| `fenrir_ledger:households` | JSON string (Household[]) | All households. Single default household in Sprint 2. |
| `fenrir_ledger:cards` | JSON string (Card[]) | All cards across all households. |

---

## File Structure

```
development/frontend/
├── .env.example                     # Committed placeholder env template
├── .env.local                       # Local secrets (gitignored)
├── next.config.ts                   # Next.js configuration
├── tailwind.config.ts               # Tailwind configuration (Saga Ledger theme extensions)
├── components.json                  # shadcn/ui configuration
├── src/
│   ├── app/
│   │   ├── layout.tsx               # Root layout (fonts, global styles, metadata)
│   │   ├── page.tsx                 # Dashboard (/) — "use client"
│   │   ├── globals.css              # Saga Ledger theme: void-black bg, gold accents, Norse fonts
│   │   ├── sign-in/
│   │   │   └── page.tsx             # Sign-in page (opt-in upgrade, not a gate)
│   │   ├── auth/
│   │   │   └── callback/
│   │   │       └── page.tsx         # OAuth callback — PKCE code exchange
│   │   ├── valhalla/
│   │   │   ├── layout.tsx           # Valhalla layout
│   │   │   └── page.tsx             # Closed cards archive
│   │   ├── cards/
│   │   │   ├── new/
│   │   │   │   └── page.tsx         # Add card page — "use client"
│   │   │   └── [id]/
│   │   │       └── edit/
│   │   │           └── page.tsx     # Edit card page — "use client"
│   │   └── api/
│   │       ├── auth/
│   │       │   └── token/
│   │       │       └── route.ts     # Server proxy — adds client_secret for Google token exchange
│   │       └── sheets/
│   │           └── import/
│   │               └── route.ts     # Google Sheets import API (server-side)
│   ├── contexts/
│   │   ├── AuthContext.tsx           # Auth state: "loading" | "authenticated" | "anonymous"
│   │   └── RagnarokContext.tsx       # Ragnarok threshold provider (>= 5 urgent cards)
│   ├── hooks/
│   │   ├── useAuth.ts               # Auth hook exposing householdId, status, session
│   │   └── useSheetImport.ts        # Google Sheets import state management
│   ├── components/
│   │   ├── ui/                      # shadcn/ui generated components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── select.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── checkbox.tsx
│   │   │   └── textarea.tsx
│   │   ├── layout/
│   │   │   ├── AppShell.tsx         # Root layout wrapper: TopBar + SideNav + main content + Footer
│   │   │   ├── TopBar.tsx           # Top bar with auth state (anonymous ᛟ / signed-in avatar)
│   │   │   ├── SiteHeader.tsx       # Desktop site header (logo, actions)
│   │   │   ├── SideNav.tsx          # Collapsible sidebar navigation
│   │   │   ├── Footer.tsx           # Footer with Loki easter egg + GleipnirFishBreath trigger
│   │   │   ├── HowlPanel.tsx        # Urgent cards sidebar (Framer Motion slide-in)
│   │   │   ├── UpsellBanner.tsx     # Dismissible cloud sync upsell for anonymous users
│   │   │   ├── SyncIndicator.tsx    # Sync status indicator (Gleipnir fragment 1 trigger)
│   │   │   ├── ConsoleSignature.tsx # Console ASCII art (client-only, runs once per session)
│   │   │   ├── KonamiHowl.tsx       # Konami code easter egg
│   │   │   ├── AboutModal.tsx       # About/credits modal (includes WolfHungerMeter)
│   │   │   └── ForgeMasterEgg.tsx   # Forge Master easter egg component
│   │   ├── dashboard/
│   │   │   ├── Dashboard.tsx        # "use client" — reads cards from storage
│   │   │   ├── AnimatedCardGrid.tsx # Framer Motion stagger animation grid
│   │   │   ├── CardSkeletonGrid.tsx # Gold palette shimmer loading state
│   │   │   ├── CardTile.tsx         # Card display tile with status badge + StatusRing
│   │   │   ├── StatusBadge.tsx      # Realm-mapped status badge (uses getRealmLabel)
│   │   │   ├── StatusRing.tsx       # SVG deadline progress ring
│   │   │   └── EmptyState.tsx       # Saga Ledger empty state with Gleipnir copy
│   │   ├── shared/
│   │   │   ├── WolfHungerMeter.tsx  # Aggregate bonus summary meter
│   │   │   └── AuthGate.tsx         # Hides children for anonymous users
│   │   ├── cards/
│   │   │   ├── CardForm.tsx         # "use client" — shared add/edit form
│   │   │   ├── GleipnirFishBreath.tsx
│   │   │   ├── GleipnirBearSinews.tsx
│   │   │   ├── GleipnirBirdSpittle.tsx
│   │   │   ├── GleipnirCatFootfall.tsx
│   │   │   ├── GleipnirMountainRoots.tsx
│   │   │   └── GleipnirWomansBeard.tsx
│   │   ├── sheets/
│   │   │   ├── ImportWizard.tsx     # Three-path import wizard
│   │   │   ├── MethodSelection.tsx  # Import method picker
│   │   │   ├── ShareUrlEntry.tsx    # Google Sheets URL entry
│   │   │   ├── CsvUpload.tsx        # CSV file upload
│   │   │   ├── ImportDedupStep.tsx  # Deduplication step
│   │   │   ├── StepIndicator.tsx    # Wizard step indicator
│   │   │   └── SafetyBanner.tsx     # Safety/privacy banner
│   │   └── easter-eggs/
│   │       ├── EasterEggModal.tsx   # Shared modal shell for Gleipnir fragments
│   │       └── LcarsOverlay.tsx     # Star Trek LCARS mode overlay
│   └── lib/
│       ├── types.ts                 # TypeScript interfaces: Household, Card, FenrirSession, etc.
│       ├── storage.ts               # localStorage abstraction layer (per-household namespaced)
│       ├── card-utils.ts            # Pure functions: computeCardStatus, etc.
│       ├── realm-utils.ts           # getRealmLabel() — Norse realm display helpers
│       ├── milestone-utils.ts       # Card count milestone toast thresholds
│       ├── gleipnir-utils.ts        # Fragment count + isGleipnirComplete()
│       ├── merge-anonymous.ts       # Anonymous → authenticated data migration
│       ├── constants.ts             # STORAGE_KEY_PREFIX, status threshold days, etc.
│       ├── utils.ts                 # General utility helpers (shadcn cn())
│       └── auth/
│           ├── pkce.ts              # PKCE utilities (verifier, challenge, state)
│           ├── session.ts           # localStorage session read/write
│           ├── household.ts         # Anonymous householdId generation
│           ├── require-auth.ts      # API route auth guard (requireAuth)
│           └── verify-id-token.ts   # Google ID token verification
```

---

## Component Responsibilities

### `src/lib/types.ts`
Defines all shared TypeScript interfaces including `Household`, `Card`, `SignUpBonus`, `CardStatus`, and `FenrirSession`. No logic — types only.

### `src/lib/constants.ts`
Defines all magic values: storage key prefixes, status threshold days (60 for fee approaching, 30 for promo expiring).

### `src/lib/storage.ts`
The localStorage abstraction. All reads/writes to `window.localStorage` go through here. Keys are namespaced per `householdId` (per-household keys, see ADR-004). Wraps operations in try/catch. Calls `migrateIfNeeded()` on module load.

### `src/lib/card-utils.ts`
Pure utility functions. `computeCardStatus(card, today)` is deterministic and takes an optional `today` parameter for testability.

### `src/lib/realm-utils.ts`
`getRealmLabel(status, daysRemaining)` maps `CardStatus` values to Norse realm vocabulary for display: Asgard-bound (active), Muspelheim (fee approaching), Hati approaches (promo expiring), In Valhalla (closed).

### `src/lib/milestone-utils.ts`
Card count milestone toast thresholds (1/5/9/13/20). Returns Norse-flavored toast messages for the sonner toast library.

### `src/lib/gleipnir-utils.ts`
Tracks Gleipnir fragment collection progress. `isGleipnirComplete()` checks all 6 fragments. Fragment keys stored in localStorage as `egg:gleipnir-{N}`.

### `src/lib/merge-anonymous.ts`
Handles merging anonymous localStorage data into an authenticated user's namespace when a user signs in after accumulating anonymous data.

### `src/lib/auth/pkce.ts`
PKCE utilities for the Google OAuth flow: generates `code_verifier`, `code_challenge` (S256), and state parameter using Web Crypto API.

### `src/lib/auth/session.ts`
localStorage session read/write for `FenrirSession`. Stored at `fenrir:auth`.

### `src/lib/auth/household.ts`
`getOrCreateAnonHouseholdId()` — generates or retrieves a UUID for anonymous users from `fenrir:household` in localStorage.

### `src/lib/auth/require-auth.ts`
API route auth guard. Every API route handler (except `/api/auth/token`) must call `requireAuth(request)` and return early if `!auth.ok`.

### `src/contexts/AuthContext.tsx`
React context providing auth state: `"loading" | "authenticated" | "anonymous"`. Exposes `householdId` (from Google `sub` if signed in, or anonymous UUID). Does not redirect — anonymous users access all routes freely.

### `src/contexts/RagnarokContext.tsx`
Ragnarok threshold provider. When >= 5 cards have urgent status, triggers the Ragnarok overlay effect and dramatic mode on HowlPanel.

### `src/components/layout/AppShell.tsx`
Root layout wrapper providing the persistent shell: TopBar (mobile), SiteHeader (desktop), SideNav (collapsible), HowlPanel, UpsellBanner, main content slot, Footer. Also mounts ConsoleSignature, KonamiHowl, and ForgeMasterEgg easter egg components.

### `src/components/layout/HowlPanel.tsx`
Urgent cards sidebar. Slides in via Framer Motion when urgent cards exist. Has a dramatic mode triggered by RagnarokContext.

### `src/components/layout/Footer.tsx`
Three-column footer. Contains the Loki Mode 7-click trigger and the GleipnirFishBreath "Breath of a Fish" easter egg hover trigger.

### `src/components/layout/UpsellBanner.tsx`
Dismissible cloud sync upsell banner for anonymous users. Rendered on the dashboard route only. Dismiss sets `fenrir:upsell_dismissed` in localStorage permanently.

### `src/components/layout/SyncIndicator.tsx`
Sync status indicator dot. Clicking triggers Gleipnir fragment 1 (Cat's Footfall).

### `src/components/layout/ConsoleSignature.tsx`
Client-only component that prints Elder Futhark ASCII art spelling ᚠᛖᚾᚱᛁᚱ (FENRIR) to the browser console once per session.

### `src/components/layout/KonamiHowl.tsx`
Listens for the Konami code sequence and triggers a full-screen howl animation.

### `src/app/page.tsx` (Dashboard)
Client component. On mount: reads `householdId` from `useAuth()`, loads all cards for the household, renders the `Dashboard` component.

### `src/components/dashboard/Dashboard.tsx`
Renders the animated card grid, summary counts, and empty state. Receives `cards: Card[]` as props. All data-fetching is in the parent page.

### `src/components/dashboard/AnimatedCardGrid.tsx`
Framer Motion `AnimatePresence` wrapper with stagger animation for card grid entries.

### `src/components/dashboard/CardSkeletonGrid.tsx`
Gold-palette shimmer loading state shown while cards are loading.

### `src/components/dashboard/CardTile.tsx`
Displays a single card with the Saga Ledger theme. Shows issuer, name, status badge, StatusRing, annual fee date, sign-up bonus deadline. Clicking navigates to `/cards/[id]/edit`.

### `src/components/dashboard/StatusBadge.tsx`
Renders a Norse realm-labelled badge for the card's status using `getRealmLabel()`. Color and label mapped to the Saga Ledger realm vocabulary.

### `src/components/dashboard/StatusRing.tsx`
SVG progress ring around card issuer initials. `strokeDashoffset` driven by `daysRemaining / totalDays`. Muspel-pulse animation when `daysRemaining <= 30`.

### `src/components/shared/WolfHungerMeter.tsx`
Aggregate bonus summary meter shown in AboutModal and ForgeMasterEgg. Visualises how many sign-up bonuses have been met.

### `src/components/shared/AuthGate.tsx`
Wrapper that hides its children for anonymous users. Used to gate import buttons behind authentication.

### `src/components/cards/CardForm.tsx`
Shared form for both add and edit flows. Accepts `initialValues?: Card` for edit mode. Uses `react-hook-form` + Zod. On submit: generates/preserves card ID, computes status, calls `saveCard()`, redirects to dashboard. Scroll-to-first-error on validation failure.

### `src/components/sheets/ImportWizard.tsx`
Three-path import wizard: Google Sheets URL, CSV upload, or manual entry. Steps through method selection, data entry, deduplication, and confirmation.

### `src/components/easter-eggs/EasterEggModal.tsx`
Shared modal shell for all Gleipnir fragment reveals. Each fragment component wraps this with a unique SVG artifact image.

---

## UI Patterns and Component Conventions

### Button Alignment

All form and dialog action buttons follow a single global rule. This convention applies to every form, dialog, and confirmation panel in the application.

| Position | Button type | Examples |
|----------|-------------|---------|
| Far right | Primary / positive action | Save, Add, Continue, OK |
| Immediately left of primary | Cancel | Cancel |
| Far left (isolated) | Destructive action (only when co-present with primary) | Close Card, Delete |

**Desktop layout** (single row):

```
[ Destructive ]                    [ Cancel ] [ Primary ]
```

**Mobile layout** (stacked, primary on top):

```
[ Primary     ]
[ Cancel      ]
[ Destructive ]
```

Implementation guidance:
- Use `justify-between` on the button row container when a destructive action is present; `justify-end` otherwise.
- On mobile apply `flex-col md:flex-row` with `md:justify-end` (or `md:justify-between` when destructive is present).
- Touch targets must be at least 44 x 44 px (see team norms).
- See `ux/wireframes.md` for the full visual specification.

---

## Dependencies

### Runtime
| Package | Version | Purpose |
|---------|---------|---------|
| `next` | ^15.1.12 | Framework (upgraded from latest for CVE-2025-66478 fix) |
| `react` | ^19.0.0 | UI |
| `react-dom` | ^19.0.0 | DOM renderer |
| `react-hook-form` | ^7.54.2 | Form state management |
| `zod` | ^3.24.1 | Schema validation |
| `@hookform/resolvers` | ^3.9.1 | Bridge between react-hook-form and Zod |
| `framer-motion` | ^12.34.3 | Card animations, Howl panel slide, AnimatePresence |
| `sonner` | ^2.0.7 | Toast notifications (milestone toasts) |
| `lucide-react` | ^0.469.0 | Icon set |
| `class-variance-authority` | ^0.7.1 | Component variant management |
| `clsx` | ^2.1.1 | Conditional class names |
| `tailwind-merge` | ^2.6.0 | Tailwind class deduplication |
| `tailwindcss-animate` | ^1.0.7 | Animation utilities |

### Dev
| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.x | Type checking |
| `tailwindcss` | ^3.4.1 | Styling |
| `eslint` | ^8.x | Linting |
| `@types/react` | ^19 | React type definitions |
| `@types/node` | ^20 | Node.js type definitions |

### shadcn/ui (copy-owned, not a package dependency)
Components installed via `npx shadcn@latest add`: `button`, `card`, `input`, `label`, `select`, `badge`, `dialog`, `textarea`, `checkbox`

### Fonts (via `next/font/google`, no extra dependencies)
Cinzel Decorative (display), Cinzel (headings), Source Serif 4 (body), JetBrains Mono (data)

---

## Technical Constraints and Decisions

| Constraint | Detail |
|-----------|--------|
| All components using hooks or browser APIs | Must have `"use client"` at top |
| No direct `window.localStorage` access | Must go through `src/lib/storage.ts` |
| Schema changes | Must bump `SCHEMA_VERSION` in `storage.ts` and add migration |
| All money amounts | Stored as integer cents (not floats) to avoid floating-point errors |
| All dates | Stored as ISO 8601 strings (YYYY-MM-DD for dates, full ISO for timestamps) |
| Card IDs | Generated with `crypto.randomUUID()` |
| Household ID | Hardcoded `"default-household"` in Sprint 2; replaced by real UUID in Sprint 3 (ADR-004) |
| Vercel Root Directory | Set to `development/frontend/` |
| Font loading | `next/font/google` with `display: 'swap'` on all four Norse typefaces |

---

## Architecture Evolution Notes

### Auth progression (ADR-004 → ADR-005 → ADR-006)
- ADR-004 proposed Auth.js v5 with server-side sessions — superseded.
- ADR-005 replaced with Authorization Code + PKCE, server token proxy — accepted.
- ADR-006 removed the auth gate, made the app anonymous-first — accepted (current).

### Backend removal (Sprint 5 → serverless)
- Sprint 5 initially introduced a dedicated Hono backend at `development/backend/`. This was removed in PR #60 in favour of fully serverless Vercel API routes. The import workflow now uses `/api/sheets/import` as a Next.js API route.

### Deployment
- Vercel production: https://fenrir-ledger.vercel.app
- Vercel Root Directory: `development/frontend/`
- No separate backend server — fully serverless on Vercel.
