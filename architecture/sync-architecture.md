# Sync Architecture — Fenrir Ledger

Multi-device, multi-user household cloud sync with server-side version tracking.

## Overview

Fenrir Ledger uses an offline-first architecture: cards live in localStorage and are synced to Firestore for Karl-tier users. Sync is household-scoped — all members of a household share the same card portfolio.

### Design Principles

1. **Offline-first**: localStorage is the primary store; Firestore is the backup
2. **Household-scoped**: all sync operations use the household ID, not user ID
3. **Pull-before-push**: clients must download before uploading to prevent data loss
4. **Server-side versioning**: a `syncVersion` counter on the household doc tracks change generations
5. **Last-write-wins (LWW)**: per-card conflict resolution using `effectiveTimestamp`

---

## UML Class Diagrams

### Firestore Data Model

```mermaid
classDiagram
    class FirestoreHousehold {
        +string id
        +string name
        +string ownerId
        +string[] memberIds
        +number syncVersion
        +string inviteCode
        +string inviteCodeExpiresAt
        +string createdAt
        +string updatedAt
    }

    class FirestoreUser {
        +string userId
        +string email
        +string displayName
        +string householdId
        +string role
        +string stripeCustomerId
        +string createdAt
        +string updatedAt
    }

    class FirestoreMemberSyncState {
        +string userId
        +number lastSyncedVersion
        +boolean needsDownload
        +string updatedAt
    }

    class FirestoreCard {
        +string id
        +string householdId
        +string issuer
        +string cardName
        +string status
        +string openDate
        +string annualFee
        +string createdAt
        +string updatedAt
        +string deletedAt
    }

    class FirestoreStripeSubscription {
        +string stripeCustomerId
        +string stripeSubscriptionId
        +string stripeStatus
        +string tier
        +boolean active
        +boolean cancelAtPeriodEnd
        +string currentPeriodEnd
        +string linkedAt
        +string checkedAt
    }

    FirestoreHousehold "1" --> "*" FirestoreUser : memberIds
    FirestoreHousehold "1" --> "*" FirestoreCard : /cards subcollection
    FirestoreHousehold "1" --> "*" FirestoreMemberSyncState : /syncState subcollection
    FirestoreHousehold "1" --> "0..1" FirestoreStripeSubscription : /stripe/subscription
    FirestoreUser "1" --> "1" FirestoreHousehold : householdId FK
```

### Client-Side Sync Interfaces

```mermaid
classDiagram
    class CloudSyncState {
        +CloudSyncStatus status
        +Date lastSyncedAt
        +number cardCount
        +number syncVersion
        +string errorMessage
        +string errorCode
        +Date errorTimestamp
        +number retryIn
        +syncNow() Promise~void~
        +dismissError() void
    }

    class CloudSyncStatus {
        <<enumeration>>
        idle
        needs-upload
        needs-download
        syncing
        synced
        offline
        error
    }

    class MigrationResult {
        +boolean ran
        +number cardCount
        +MigrationDirection direction
    }

    class MigrationDirection {
        <<enumeration>>
        download
        upload
        merge
        empty
    }

    class SyncEngine {
        +effectiveTimestamp(card) number
        +mergeCards(local, remote) Card[]
        +mergeCardsWithStats(local, remote) MergeResult
    }

    class MergeResult {
        +Card[] merged
        +MergeStats stats
    }

    class MergeStats {
        +number total
        +number unchanged
        +number localWon
        +number remoteWon
        +number localOnly
        +number remoteOnly
        +number activeCount
    }

    class StorageLayer {
        +saveCard(card) void
        +deleteCard(householdId, id) void
        +getAllCards(householdId) Card[]
        +getRawAllCards(householdId) Card[]
        +setAllCards(householdId, cards) void
        +getEffectiveHouseholdId(fallback) string
        +notifyCardsChanged(householdId) void
        +notifyCardsBulkChanged(householdId) void
        +getNeedsUpload() boolean
        +clearNeedsUpload() void
    }

    CloudSyncState --> CloudSyncStatus
    MigrationResult --> MigrationDirection
    SyncEngine --> MergeResult
    MergeResult --> MergeStats
    CloudSyncState ..> StorageLayer : reads/writes localStorage
    CloudSyncState ..> SyncEngine : uses for merge
    CloudSyncState ..> MigrationResult : on first sign-in
```

### API Route Interfaces

```mermaid
classDiagram
    class PushRequest {
        +string householdId
        +Card[] cards
        +number clientSyncVersion
    }

    class PushResponse {
        +Card[] cards
        +number syncedCount
        +number syncVersion
    }

    class PullResponse {
        +Card[] cards
        +number activeCount
        +number syncVersion
    }

    class SyncStateResponse {
        +number syncVersion
        +number lastSyncedVersion
        +boolean needsDownload
    }

    class PushConflictResponse {
        +string error
        +number syncVersion
    }

    PushRequest ..> PushResponse : 200 OK
    PushRequest ..> PushConflictResponse : 409 Conflict
```

---

## Firestore Collection Structure

```mermaid
erDiagram
    USERS ||--o{ HOUSEHOLDS : "belongs to"
    HOUSEHOLDS ||--o{ CARDS : "contains"
    HOUSEHOLDS ||--o{ SYNC_STATE : "tracks per-member"
    HOUSEHOLDS ||--o| STRIPE : "billing"

    USERS {
        string userId PK "Google OAuth sub"
        string email
        string displayName
        string householdId FK
        string role "owner | member"
        string stripeCustomerId
    }

    HOUSEHOLDS {
        string id PK "owner's userId"
        string name
        string ownerId FK
        string[] memberIds "max 3"
        int syncVersion "increments on push"
        string inviteCode "6-char"
        string inviteCodeExpiresAt
    }

    CARDS {
        string id PK
        string householdId FK
        string issuer
        string cardName
        string status
        string deletedAt "tombstone"
        string updatedAt "LWW key"
    }

    SYNC_STATE {
        string userId PK
        int lastSyncedVersion
        bool needsDownload
        string updatedAt
    }

    STRIPE {
        string stripeCustomerId
        string stripeSubscriptionId
        string tier "free | karl"
        bool active
    }
```

---

## State Machine — CloudSyncStatus

```mermaid
stateDiagram-v2
    [*] --> idle : mount

    idle --> needs_upload : local card change
    idle --> needs_download : server check (login / tab visit)
    idle --> offline : navigator.onLine = false

    needs_upload --> syncing : debounce fires / bulk-changed / syncNow()
    needs_download --> syncing : auto-trigger / syncNow()

    syncing --> synced : sync success
    syncing --> error : sync failure
    syncing --> needs_download : push returned 409

    synced --> idle : after 3s (SYNCED_DISPLAY_MS)

    error --> idle : dismissError()
    error --> syncing : retry (syncNow)

    offline --> needs_upload : reconnect + needs-upload flag
    offline --> idle : reconnect (no pending)

    note right of needs_upload : localStorage flag persists across sessions
    note right of needs_download : Server-side needsDownload flag
```

---

## Sequence Diagrams

### 1. Card Import + Auto-Push (Bug 1 Fix)

```mermaid
sequenceDiagram
    participant User
    participant ImportWizard
    participant Dashboard as page.tsx
    participant Storage as storage.ts
    participant Hook as useCloudSync
    participant API as /api/sync/push
    participant Firestore

    User->>ImportWizard: Confirm import (9 cards)
    ImportWizard->>Dashboard: onConfirmImport(cards)
    
    loop For each card
        Dashboard->>Storage: saveCard(card)
        Storage->>Storage: setAllCards() + notifyCardsChanged()
        Note over Storage: Sets fenrir:needs-upload = true
        Storage-->>Hook: fenrir:cards-changed (debounce resets)
    end

    Dashboard->>Storage: notifyCardsBulkChanged()
    Note over Storage: Dispatches fenrir:cards-bulk-changed
    Storage-->>Hook: fenrir:cards-bulk-changed (NO debounce)
    
    Hook->>Hook: performSync() immediately
    Hook->>API: POST {householdId, cards, clientSyncVersion}
    API->>Firestore: getAllFirestoreCards()
    Firestore-->>API: remoteCards
    API->>API: mergeCardsWithStats(local, remote)
    API->>Firestore: setCards(merged)
    API->>Firestore: updateSyncStateAfterPush()
    Note over Firestore: syncVersion++, flag other members
    API-->>Hook: {cards, syncedCount, syncVersion}
    Hook->>Storage: setAllCards(merged)
    Hook->>Storage: clearNeedsUpload()
    Hook-->>User: status: synced (green dot)
```

### 2. New Device Login + Pull (Bug 2 Fix)

```mermaid
sequenceDiagram
    participant User
    participant Auth as AuthContext
    participant Hook as useCloudSync
    participant Migration as migration.ts
    participant PullAPI as /api/sync/pull
    participant Firestore

    User->>Auth: Sign in (new device)
    Auth-->>Hook: isKarl transition (false → true)
    Hook->>Hook: handleLoginTransition()

    alt First sign-in (not migrated)
        Hook->>Migration: runMigration(householdId, token)
        Migration->>Migration: localCards = getRawAllCards()
        Note over Migration: localCards.length === 0 (new device)
        
        Migration->>PullAPI: GET /api/sync/pull?householdId=X
        Note over Migration: Pull-first when local is empty
        PullAPI->>Firestore: getAllFirestoreCards()
        Firestore-->>PullAPI: 9 cards
        PullAPI->>Firestore: updateSyncStateAfterPull()
        PullAPI-->>Migration: {cards: 9, activeCount: 9, syncVersion}
        
        Migration->>Migration: setAllCards(householdId, cards)
        Migration->>Migration: markMigrated()
        Migration-->>Hook: {ran: true, cardCount: 9, direction: "download"}
    else Already migrated
        Hook->>PullAPI: performPull()
        PullAPI->>Firestore: getAllFirestoreCards()
        Firestore-->>PullAPI: cards
        PullAPI-->>Hook: {cards, activeCount, syncVersion}
        Hook->>Hook: lwwMerge(local, cloud)
        Hook->>Hook: setAllCards(merged)
    end
    
    Hook-->>User: 9 cards displayed, status: synced
```

### 3. Multi-User Household Sync

```mermaid
sequenceDiagram
    participant UserA as User A (Device 1)
    participant HookA as useCloudSync (A)
    participant PushAPI as /api/sync/push
    participant Firestore
    participant PullAPI as /api/sync/pull
    participant HookB as useCloudSync (B)
    participant UserB as User B (Device 2)

    Note over Firestore: syncVersion = 5
    Note over Firestore: A.lastSyncedVersion = 5
    Note over Firestore: B.lastSyncedVersion = 5

    UserA->>HookA: Add new card
    HookA->>HookA: status → needs-upload
    HookA->>PushAPI: POST {cards, clientSyncVersion: 5}
    PushAPI->>Firestore: merge + write cards
    PushAPI->>Firestore: updateSyncStateAfterPush()
    Note over Firestore: syncVersion = 6
    Note over Firestore: A.lastSyncedVersion = 6
    Note over Firestore: B.needsDownload = true
    PushAPI-->>HookA: {syncVersion: 6, cards, syncedCount}
    HookA-->>UserA: status → synced

    Note over UserB: Opens app / visits Settings tab
    
    HookB->>HookB: Check sync state (login or tab mount)
    HookB->>PullAPI: GET /api/sync/state
    Note over HookB: needsDownload = true
    HookB->>HookB: status → needs-download
    HookB->>PullAPI: GET /api/sync/pull?householdId=X
    PullAPI->>Firestore: getAllFirestoreCards()
    Firestore-->>PullAPI: cards (including A's new card)
    PullAPI->>Firestore: updateSyncStateAfterPull()
    Note over Firestore: B.lastSyncedVersion = 6
    Note over Firestore: B.needsDownload = false
    PullAPI-->>HookB: {cards, activeCount, syncVersion: 6}
    HookB->>HookB: lwwMerge(local, cloud)
    HookB-->>UserB: New card appears, status → synced
```

### 4. Conflict Resolution — 409 Stale Version

```mermaid
sequenceDiagram
    participant Client
    participant Hook as useCloudSync
    participant StateAPI as /api/sync/state
    participant PushAPI as /api/sync/push
    participant PullAPI as /api/sync/pull
    participant Firestore

    Note over Firestore: syncVersion = 7
    Note over Client: lastSyncedVersion = 5 (stale)

    Client->>Hook: Edit card
    Hook->>Hook: status → needs-upload
    Hook->>StateAPI: GET /api/sync/state
    StateAPI-->>Hook: {syncVersion: 7, lastSyncedVersion: 5, needsDownload: true}
    
    Note over Hook: needsDownload = true, pull first

    Hook->>PullAPI: GET /api/sync/pull?householdId=X
    PullAPI->>Firestore: getAllFirestoreCards()
    Firestore-->>PullAPI: remote cards (version 7)
    PullAPI->>Firestore: updateSyncStateAfterPull()
    PullAPI-->>Hook: {cards, syncVersion: 7}
    Hook->>Hook: lwwMerge(local, cloud)
    Hook->>Hook: setAllCards(merged)

    Hook->>PushAPI: POST {cards: merged, clientSyncVersion: 7}
    PushAPI->>Firestore: merge + write
    PushAPI->>Firestore: updateSyncStateAfterPush()
    Note over Firestore: syncVersion = 8
    PushAPI-->>Hook: {syncVersion: 8, cards, syncedCount}
    Hook-->>Client: status → synced
```

### 5. Push Expunge Safety Guard

```mermaid
sequenceDiagram
    participant Client as New Device (0 local cards)
    participant PushAPI as /api/sync/push
    participant Firestore

    Note over Client: OLD behavior (Bug 2 — data destruction)

    Client->>PushAPI: POST {cards: [], clientSyncVersion: 0}
    PushAPI->>Firestore: getAllFirestoreCards() → 9 cards
    PushAPI->>PushAPI: expungedIds = all 9 (none in local)
    PushAPI->>Firestore: deleteCards(9 cards)
    Note over Firestore: ALL CARDS DELETED
    PushAPI->>PushAPI: merge([], []) → []
    PushAPI-->>Client: {cards: [], syncedCount: 0}
    Note over Client: Data destroyed silently

    Note over Client: NEW behavior (fixed)

    Client->>PushAPI: POST {cards: [], clientSyncVersion: 0}
    PushAPI->>PushAPI: clientSyncVersion(0) < syncVersion(6)
    PushAPI-->>Client: 409 {error: "needs_download", syncVersion: 6}
    Note over Client: Client pulls first, gets all 9 cards
```

---

## Sync Protocol Rules

### Pull-Before-Push Ordering

1. Before any push, client calls `GET /api/sync/state`
2. If `needsDownload = true` OR `lastSyncedVersion < syncVersion`: pull first
3. Push includes `clientSyncVersion` — server rejects with 409 if stale
4. This prevents the expunge-on-empty-device bug and ensures LWW merge has full context

### Version Tracking

- `syncVersion` on household doc: incremented atomically on every successful push
- `lastSyncedVersion` per member: updated on pull to match current `syncVersion`
- `needsDownload` per member: set `true` for all OTHER members on push, cleared on pull

### Conflict Resolution (LWW)

- Per-card, not per-field
- `effectiveTimestamp = max(updatedAt, deletedAt)` — tombstones participate in LWW
- Later timestamp wins; ties favor the remote version (cloud wins)
- Merge is deterministic: same inputs always produce same output

### Auto-Sync Triggers

| Trigger | Action | Debounce |
|---------|--------|----------|
| `saveCard()` / `deleteCard()` | `fenrir:cards-changed` → push | 10s |
| Bulk import complete | `fenrir:cards-bulk-changed` → push | None (immediate) |
| Login (Karl transition) | Pull (or migration) | None |
| Settings/Household tab mount | Check state → auto-sync if dirty | None |
| `syncNow()` button | Push (with pull-first check) | None |
| Network reconnect | Restore to idle (no auto-push) | N/A |

### Tier Gating

- **Karl**: Full sync (push + pull + auto-sync)
- **Trial**: No sync — same as Thrall (sync is Karl-only per #1122)
- **Thrall**: No sync — status always "idle", all operations are no-ops

---

## Key Files

| File | Purpose |
|------|---------|
| `src/hooks/useCloudSync.ts` | Client sync state machine + push/pull orchestration |
| `src/hooks/useCloudSync.helpers.ts` | Toast messages, error parsing, first-sync flag |
| `src/lib/sync/sync-engine.ts` | Pure LWW merge logic |
| `src/lib/sync/migration.ts` | One-time first-sign-in migration |
| `src/lib/storage.ts` | localStorage CRUD + event dispatch |
| `src/app/api/sync/push/route.ts` | Push endpoint: merge + write + version tracking |
| `src/app/api/sync/pull/route.ts` | Pull endpoint: read + version update |
| `src/app/api/sync/state/route.ts` | Sync state query endpoint |
| `src/lib/firebase/firestore.ts` | Firestore Admin SDK operations |
| `src/lib/firebase/firestore-types.ts` | Firestore document type definitions |
| `src/components/sync/SyncSettingsSection.tsx` | Cloud Sync UI card in settings |
| `src/components/layout/SyncIndicator.tsx` | Fixed bottom-right sync status dot |
