# System Design: Fenrir Ledger Sprint 1

## Overview

Fenrir Ledger Sprint 1 is a client-side-only Next.js application. No backend, no API, no authentication. All data is persisted in the browser's localStorage behind a typed abstraction layer. The app runs at `http://localhost:3000` during Sprint 1.

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

    %% Dashboard page components
    dashpage --> dashboard[Dashboard Component]
    dashboard --> cardtile[CardTile Component]
    dashboard --> statusbadge[StatusBadge Component]
    dashboard --> emptyst[EmptyState Component]

    %% Form pages
    newpage --> cardform[CardForm Component]
    editpage --> cardform

    %% Shared lib
    dashboard -->|reads| storage[storage.ts\nLocalStorage Abstraction]
    cardform -->|reads/writes| storage
    storage -->|JSON serialize/deserialize| ls[(localStorage\nbrowser storage)]

    %% Utilities
    storage --> types[types.ts\nTypeScript Interfaces]
    cardform --> cardutils[card-utils.ts\ncomputeCardStatus]
    storage --> cardutils

    class dashpage primary
    class newpage primary
    class editpage primary
    class dashboard primary
    class cardform primary
    class storage healthy
    class ls background
    class types neutral
    class cardutils neutral
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
        F-->>U: Show field errors
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
| `fenrir_ledger:schema_version` | string (integer) | Schema version number. Sprint 1 = `"1"` |
| `fenrir_ledger:households` | JSON string (Household[]) | All households. Sprint 1 has exactly one. |
| `fenrir_ledger:cards` | JSON string (Card[]) | All cards across all households. |

---

## File Structure

```
development/src/
├── .env.example                     # Committed placeholder env template
├── .env.local                       # Local secrets (gitignored)
├── next.config.ts                   # Next.js configuration
├── tailwind.config.ts               # Tailwind configuration
├── components.json                  # shadcn/ui configuration
├── src/
│   ├── app/
│   │   ├── layout.tsx               # Root layout (fonts, global styles)
│   │   ├── page.tsx                 # Dashboard (/) — "use client"
│   │   ├── globals.css              # Tailwind base + shadcn/ui CSS vars
│   │   └── cards/
│   │       ├── new/
│   │       │   └── page.tsx         # Add card page — "use client"
│   │       └── [id]/
│   │           └── edit/
│   │               └── page.tsx     # Edit card page — "use client"
│   ├── components/
│   │   ├── ui/                      # shadcn/ui generated components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── select.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── textarea.tsx
│   │   ├── dashboard/
│   │   │   ├── Dashboard.tsx        # "use client" — reads cards from storage
│   │   │   ├── CardTile.tsx         # Card display tile with status badge
│   │   │   ├── StatusBadge.tsx      # Color-coded status badge
│   │   │   └── EmptyState.tsx       # Prompt shown when card list is empty
│   │   └── cards/
│   │       ├── CardForm.tsx         # "use client" — shared add/edit form
│   │       └── CardListItem.tsx     # Compact list item (used in mobile views)
│   └── lib/
│       ├── types.ts                 # TypeScript interfaces: Household, Card, etc.
│       ├── storage.ts               # localStorage abstraction layer
│       ├── card-utils.ts            # Pure functions: computeCardStatus, etc.
│       └── constants.ts             # STORAGE_KEY_PREFIX, DEFAULT_HOUSEHOLD, etc.
```

---

## Component Responsibilities

### `src/lib/types.ts`
Defines all shared TypeScript interfaces. No logic — types only.

### `src/lib/constants.ts`
Defines all magic values: storage key prefixes, default household ID, status threshold days (60 for fee approaching, 30 for promo expiring).

### `src/lib/storage.ts`
The localStorage abstraction. All reads/writes to `window.localStorage` go through here. Wraps operations in try/catch. Calls `migrateIfNeeded()` on module load.

### `src/lib/card-utils.ts`
Pure utility functions. `computeCardStatus(card, today)` is deterministic and takes an optional `today` parameter for testability.

### `src/app/page.tsx` (Dashboard)
Client component. On mount: calls `initializeDefaultHousehold()`, loads all cards for the default household, renders the `Dashboard` component.

### `src/components/dashboard/Dashboard.tsx`
Renders the card grid, summary counts, and empty state. Receives `cards: Card[]` as props. All data-fetching is in the parent page.

### `src/components/dashboard/CardTile.tsx`
Displays a single card. Shows issuer, name, status badge, annual fee date, sign-up bonus deadline. Clicking navigates to `/cards/[id]/edit`.

### `src/components/cards/CardForm.tsx`
Shared form for both add and edit flows. Accepts `initialValues?: Card` for edit mode. Uses `react-hook-form` + Zod. On submit: generates/preserves card ID, computes status, calls `saveCard()`, redirects to dashboard.

---

## Dependencies

### Runtime
| Package | Version | Purpose |
|---------|---------|---------|
| `next` | latest | Framework |
| `react` | latest | UI |
| `react-dom` | latest | DOM renderer |
| `react-hook-form` | ^7.x | Form state management |
| `zod` | ^3.x | Schema validation |
| `@hookform/resolvers` | ^3.x | Bridge between react-hook-form and Zod |

### Dev
| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.x | Type checking |
| `tailwindcss` | ^3.x | Styling |
| `eslint` | ^8.x | Linting |
| `@types/react` | latest | React type definitions |
| `@types/node` | latest | Node.js type definitions |

### shadcn/ui (copy-owned, not a package dependency)
Components installed via `npx shadcn@latest add`: `button`, `card`, `input`, `label`, `select`, `badge`, `dialog`, `textarea`

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
| Household ID | Hardcoded `"default-household"` in Sprint 1 |
