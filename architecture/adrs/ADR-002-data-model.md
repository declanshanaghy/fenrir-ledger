# ADR-002: Household-Scoped Data Model

## Status: Accepted

## Context

Fenrir Ledger tracks credit cards for rewards optimizers. The product brief calls out a future feature: "Shared household card tracking (OIDC login)". This implies that multiple users in the same household may share a card portfolio — e.g., a partner opening cards under the same rewards strategy.

Sprint 1 has no authentication. The UI exposes single-user flows only. However, the data model is being designed now, and if we model cards as belonging to a user with no intermediate entity, we will need a breaking schema migration when households are introduced.

The question is: should Sprint 1 use a flat `Card[]` model, or should it introduce a `Household` entity now?

## Options Considered

### 1. Flat Card List (no household entity)

Schema:
```typescript
interface Card {
  id: string
  issuerId: string
  cardName: string
  openDate: string
  // ...
}
```

**Pros**: Simpler for Sprint 1. Less data model complexity.

**Cons**: When households are introduced, every stored card must be migrated to include a `householdId`. localStorage data is not versioned — migration is error-prone for real users. API contracts would need to change. All downstream query patterns change.

### 2. Household-Scoped from Day One (chosen)

Schema:
```typescript
interface Household {
  id: string
  name: string
  createdAt: string
}

interface Card {
  id: string
  householdId: string   // foreign key to Household
  issuerId: string
  cardName: string
  openDate: string
  // ...
}
```

Sprint 1 hardcodes a single implicit household (`id: "default-household"`) with no UI to manage households. The household entity exists in localStorage but the user never sees or touches it.

**Pros**:
- Zero breaking changes when multi-household support is added. The `householdId` field is already there.
- All CRUD operations already filter by `householdId` — the query pattern is established from day one.
- When OIDC auth arrives, we map the authenticated user to a household and the data model is already correct.
- Demonstrates thoughtful design to future contributors.

**Cons**:
- Slightly more complex Sprint 1 implementation (initialize default household on first load).
- More fields in the data model to understand for new contributors.

## Decision

Use the **household-scoped data model** from Sprint 1.

A default household is created on app initialization:
```typescript
const DEFAULT_HOUSEHOLD: Household = {
  id: "default-household",
  name: "My Household",
  createdAt: new Date().toISOString(),
}
```

All Card objects include `householdId: "default-household"`. All queries filter by `householdId`. No household management UI is exposed in Sprint 1.

## Consequences

**Positive**:
- The OIDC + multi-household migration in a future sprint requires no schema change, only an auth layer to determine which `householdId` to use.
- Consistent query patterns established early — all card reads are `getCardsByHouseholdId(householdId)`.
- localStorage data will survive the transition to a real backend with minimal transformation.

**Negative**:
- Sprint 1 has slightly more boilerplate: a `households` key in localStorage alongside `cards`.
- Contributors must understand that `householdId` is always required even in single-user mode.

**Data model summary**:

```typescript
// Household — root entity
interface Household {
  id: string          // UUID
  name: string        // Display name
  createdAt: string   // ISO 8601
}

// Card — belongs to a household
interface Card {
  id: string             // UUID
  householdId: string    // Foreign key → Household.id
  issuerId: string       // e.g., "chase", "amex", "citi"
  cardName: string       // e.g., "Sapphire Preferred"
  openDate: string       // ISO 8601 date (YYYY-MM-DD)
  creditLimit: number    // USD cents
  annualFee: number      // USD cents
  annualFeeDate: string  // ISO 8601 date — next fee due
  promoPeriodMonths: number
  signUpBonus: SignUpBonus | null
  status: CardStatus     // "active" | "fee_approaching" | "promo_expiring" | "closed"
  notes: string
  createdAt: string      // ISO 8601
  updatedAt: string      // ISO 8601
}

// Sign-up bonus sub-object
interface SignUpBonus {
  type: "points" | "miles" | "cashback"
  amount: number          // Points/miles/cents
  spendRequirement: number // USD cents
  deadline: string        // ISO 8601 date
  met: boolean
}

// Card status — derived from dates but stored for display performance
type CardStatus = "active" | "fee_approaching" | "promo_expiring" | "closed"
```
