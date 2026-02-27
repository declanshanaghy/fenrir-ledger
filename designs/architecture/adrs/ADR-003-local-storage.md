# ADR-003: localStorage for Sprint 1 Persistence + Migration Path

## Status: Accepted

## Context

Sprint 1 runs locally only. There is no backend, no database, and no auth. Data must persist across page refreshes within the same browser. The question is how to persist data in Sprint 1, and what migration path to the eventual server-side persistence looks like.

Future sprints will introduce a backend API (likely a Next.js API route layer backed by a cloud database). The persistence strategy chosen now must not create a dead end.

## Options Considered

### 1. localStorage (chosen)

Browser-native key-value store. Stores string values. JSON serialization required. Synchronous API. Scoped to origin. Available in all modern browsers.

**Pros**:
- Zero dependencies. No backend required.
- Works identically in development and when the app is statically exported.
- Data persists across page refreshes and browser restarts.
- Trivial to implement — `JSON.parse` / `JSON.stringify` on a typed object.
- Easy to inspect and debug (browser DevTools → Application → Local Storage).

**Cons**:
- 5–10 MB storage limit per origin (sufficient for 1000s of cards).
- Not accessible across devices or browsers.
- Not accessible server-side (cannot be used in Next.js Server Components — must be in `"use client"` components).
- No real-time sync.
- Data is lost if the user clears browser storage.

### 2. IndexedDB

More powerful browser storage: structured data, transactions, indices, larger limits.

**Pros**: Handles large datasets better. Asynchronous API.

**Cons**: Significantly more complex API. Would require a library (e.g., Dexie.js) to be usable. Overkill for Sprint 1 scope (< 50 cards for typical users). Adds a dependency that becomes dead weight when the backend arrives.

### 3. In-memory state only (no persistence)

**Pros**: Simplest possible Sprint 1.

**Cons**: Data lost on every page refresh. Not useful for real use. Fails the acceptance criterion "data persists across sessions."

### 4. SQLite via WASM (e.g., sql.js)

**Pros**: SQL querying, relational integrity.

**Cons**: Large binary payload (~1 MB for WASM). Complex persistence (must serialize to localStorage or OPFS anyway). Massive overkill.

## Decision

Use **localStorage** for Sprint 1, with a typed abstraction layer that encapsulates all storage operations behind clean interfaces. This abstraction is the migration seam — when a backend API is added, only the implementation of this layer changes; call sites remain identical.

### Storage Key Schema

```
fenrir_ledger:households    → JSON array of Household objects
fenrir_ledger:cards         → JSON array of Card objects
```

Prefixed keys prevent collisions with other apps on the same origin during development.

### Abstraction Layer

All localStorage access goes through `development/src/src/lib/storage.ts`. No component or page accesses `window.localStorage` directly.

```typescript
// Public interface of storage.ts (Sprint 1)
export function getHouseholds(): Household[]
export function saveHouseholds(households: Household[]): void
export function getCards(householdId: string): Card[]
export function saveCards(householdId: string, cards: Card[]): void
export function initializeDefaultHousehold(): Household
```

### Migration Path to Server-Side Persistence

When the backend is ready:

1. Implement `useCards()` as a React hook backed by an API client instead of localStorage
2. The storage abstraction layer is replaced by API calls — no component changes required
3. A one-time migration script will read from localStorage and POST to the new API on first authenticated load (export current data, seed the user's household on the server)
4. localStorage keys are cleared post-migration

### Schema Versioning

A `fenrir_ledger:schema_version` key stores an integer version. Sprint 1 sets it to `1`. Any future sprint that changes the schema increments this and runs a migration function in `storage.ts` on app initialization.

```typescript
const SCHEMA_VERSION = 1

export function migrateIfNeeded(): void {
  const stored = localStorage.getItem("fenrir_ledger:schema_version")
  const version = stored ? parseInt(stored, 10) : 0
  if (version < SCHEMA_VERSION) {
    runMigrations(version, SCHEMA_VERSION)
    localStorage.setItem("fenrir_ledger:schema_version", String(SCHEMA_VERSION))
  }
}
```

## Consequences

**Positive**:
- Zero setup cost — works out of the box with no external services.
- The abstraction layer means the rest of the codebase is completely isolated from the localStorage implementation detail.
- Schema versioning prevents data corruption when future sprints change the shape of stored objects.
- Inspectable in browser DevTools — fast debugging cycle.

**Negative**:
- Data is browser/device-local. Cannot be shared or synced.
- Users who clear browser storage lose all data. (Mitigated by future data export feature.)
- localStorage is synchronous — large reads/writes could theoretically block the main thread. At Sprint 1 scale (< 100 cards), this is not a concern.

**Constraints introduced**:
- All localStorage access must go through `development/src/src/lib/storage.ts`
- Components that read/write cards must use `"use client"` (localStorage is browser-only)
- The schema version key must be bumped and a migration written whenever the Card or Household interfaces change
