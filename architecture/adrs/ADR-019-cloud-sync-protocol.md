# ADR-019: Cloud Sync Protocol — Pull-Before-Push, Version Tracking, and Conflict Detection

**Status:** Accepted
**Date:** 2026-04-01
**Authors:** FiremanDecko (Principal Engineer)
**Related issues:** #1122, #1192, #1193, #2003, #2004, #2006, #2007
**Builds on:** ADR-014 (Firestore Cloud Sync), ADR-015 (requireAuthz), ADR-017 (Trial Tier)

---

## Context

ADR-014 established Firestore as the cloud persistence layer for Karl-tier card data.
The initial push/pull implementation (`/api/sync/push`, `/api/sync/pull`) used a simple
last-write-wins (LWW) merge but had no protection against concurrent writers — a second
household member could overwrite changes from the first without any conflict signal.

Three additional problems surfaced in production and via issue tracking:

1. **Stale client overwrites**: Member A pushes at `t=10`. Member B, who last synced at
   `t=5`, then pushes at `t=12`. Member B's push has no knowledge of A's `t=10` changes
   and silently overwrites them in Firestore.

2. **New-device blank-state hazard**: A user's first sync on a new device has an empty
   localStorage. Treating this empty state as authoritative would expunge all remote cards
   from Firestore — a complete data loss. (Issue #2003.)

3. **No cross-device pull signal**: After Member A pushes, Member B has no indication
   that their local data is stale and needs a pull. Household members would drift silently.

---

## Decision

### 1. Household `syncVersion` counter

Each household in Firestore maintains a monotonically incrementing integer `syncVersion`.

- **Push increments `syncVersion`** and records which household member performed the push.
- **Pull reads `syncVersion`** and returns it to the client.
- **Clients persist their last-known `syncVersion`** in localStorage alongside card data.

This creates a lightweight vector clock: any client can detect whether remote state has
advanced past what it last saw.

### 2. 409 Stale-Client Detection on Push

Push requests include `clientSyncVersion` in the request body. The server rejects pushes
where `clientSyncVersion < currentSyncVersion`:

```
POST /api/sync/push
{
  "householdId": "...",
  "cards": [...],
  "clientSyncVersion": 7
}

→ 409 Conflict (if server is at version 8+):
{
  "error": "sync_conflict",
  "currentSyncVersion": 8
}
```

The client must pull (`GET /api/sync/pull`) and merge locally before retrying the push.
This converts a silent overwrite into an explicit pull-then-push cycle.

### 3. Pull-Before-Push Client Orchestration

The sync client in `development/ledger/src/lib/sync/` orchestrates the full cycle:

```
1. GET /api/sync/pull            → receive remote cards + syncVersion
2. mergeCards(local, remote)     → LWW merge (per-card, by effectiveTimestamp)
3. Write merged result to localStorage
4. POST /api/sync/push           → upload merged cards + clientSyncVersion
   → on 409: go to step 1
5. Write server-merged result to localStorage + persist new syncVersion
```

The pull is mandatory at the start of every sync, not just on 409. This ensures the
client always has the latest remote state before uploading.

### 4. `needsDownload` / `needsUpload` Per-Member State

After a successful push by Member A, the server sets `needsDownload: true` on all other
household members' sync state documents. This is the cross-device signal.

When a member completes a pull, `needsDownload` is cleared for that member.

The sync UI reads `/api/sync/state` to display indicators:

| Indicator | Meaning |
|-----------|---------|
| `needsUpload` | Local changes exist that haven't been pushed |
| `needsDownload` | Another household member has pushed since this member's last sync |

Auto-sync triggers on tab focus when either indicator is set (Issue #2007).

### 5. New-Device Guard (Empty Push Protection)

A push from a client with zero cards is **never treated as expunge-all**. Instead:

- If `localCards.length === 0`, the expunge pass is skipped entirely.
- The LWW merge returns all remote cards unchanged.
- The server response contains the full remote card set.
- The client writes this to localStorage (populating the new device).

This is implemented as an explicit guard in the push route (Issue #2003):

```typescript
if (localCards.length > 0) {
  // expunge pass: remote-only cards = intentionally deleted locally
  const expungedIds = remoteCards.filter(c => !localIds.has(c.id)).map(c => c.id)
  await deleteCards(verifiedHouseholdId, expungedIds)
}
```

### 6. Last-Write-Wins Merge Algorithm

Conflict resolution within the merge is per-card LWW using `effectiveTimestamp`:

```typescript
effectiveTimestamp(card) = max(updatedAt, deletedAt ?? 0)
```

Tombstones (`deletedAt` set) propagate in both directions — a deletion at `t=10` beats
an update at `t=8`. The merge is implemented as a pure, side-effect-free function in
`development/ledger/src/lib/sync/sync-engine.ts`.

---

## Options Considered

### Operational Transform / CRDT

Full operational transform or CRDT would enable true concurrent editing without conflicts.

**Why rejected:** Overkill for card-level sync where the unit of conflict is an entire
`Card` object, not a character or field. The LWW + pull-before-push protocol achieves
correctness with far less complexity. A CRDT library would add significant bundle weight
for a feature used by Karl-tier users only.

### Server-Side Merge Only (No Client Pull Step)

The server could apply the LWW merge entirely server-side without requiring a client pull.

**Why rejected:** The 409 + pull-before-push cycle ensures the client's localStorage is
always authoritative after sync — the client sees the same merged state the server wrote.
A server-only merge would require a second GET to sync the merged result back to the
client, ending up at the same round-trip count with no benefit.

### Event Sourcing / Append-Only Log

Store individual card events (create, update, delete) rather than full card snapshots.

**Why rejected:** Increases storage and query complexity significantly. The card data model
is small (typically < 100 cards per household) and full-document replacement is acceptable.

---

## Consequences

### Positive

- **No silent overwrites** — concurrent pushers always pull first, then merge, then retry.
- **New-device bootstrap safety** — empty localStorage never destroys remote data.
- **Cross-device visibility** — `needsDownload` flag signals stale state to household members.
- **Bounded round-trips** — worst case is one extra pull before push (2 extra requests
  total per conflict); typical single-user case is pull + push (no 409).
- **Pure merge function** — `mergeCards()` is fully unit-testable with no I/O.

### Negative

- **Mandatory pull on every sync** — even when the client is current, a GET is issued.
  This is a deliberate trade-off for correctness; `syncVersion` could be used to skip
  the pull when versions match (future optimisation — Issue #2004 deferred).
- **`clientSyncVersion` is optional** — clients that omit it (old client versions) bypass
  the 409 check. A future migration should make it required.
- **Pull-before-push adds latency** — two serial requests vs. one. Acceptable given the
  low frequency of explicit user-initiated syncs. Auto-sync on tab focus mitigates UX impact.

### Invariants Introduced

- Push requests MUST include `clientSyncVersion` for conflict detection to work.
- The client MUST write the server-merged card array back to localStorage after push.
- The client MUST persist the returned `syncVersion` after every successful push or pull.
- The push route MUST skip the expunge pass when `localCards.length === 0`.

---

## References

- `development/ledger/src/lib/sync/sync-engine.ts` — LWW merge algorithm
- `development/ledger/src/lib/sync/migration.ts` — first-sync bootstrap (new device pull)
- `development/ledger/src/app/api/sync/push/route.ts` — push handler, 409 guard, expunge logic
- `development/ledger/src/app/api/sync/pull/route.ts` — pull handler, syncVersion tracking
- `development/ledger/src/app/api/sync/state/route.ts` — needsUpload/needsDownload indicators
- [ADR-014: Firestore Cloud Sync](ADR-014-firestore-cloud-sync.md)
- [ADR-015: Centralized Authorization Layer](ADR-015-authz-layer.md)
