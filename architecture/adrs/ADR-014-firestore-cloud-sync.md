# ADR-014: Firestore for Card Cloud Sync

## Status: Accepted

## Context

Fenrir Ledger has reached the point where card data must leave the browser. Two
forcing functions drove this:

1. **Karl tier** — paid users expect their portfolio to survive a browser wipe and
   sync across devices.
2. **Household sharing** — Sprint 3+ will allow up to 3 members to view and edit
   the same card portfolio in real time.

The question is: **which persistence layer should own card data?**

We already run Redis (AOF persistence, 1 Gi PVC, single-zone) for entitlement
caching and Stripe session state. Should we extend Redis to store cards, or
introduce a dedicated document store?

---

## Options Considered

### Option 1 — Redis (extend existing)

Redis is already in-cluster. AOF persistence gives us durability on the local PVC.
We could encode cards as JSON in Redis hashes (e.g., `household:{id}:cards`).

**Pros:**
- Zero new infrastructure — already deployed.
- Low latency — in-cluster, no TLS handshake overhead.
- No new SDK dependency.

**Cons:**
- **No HA / no replication.** Single pod, single zone. Pod restart = brief unavailability.
- **No managed backups.** The 1 Gi PVC has AOF but no snapshot policy, no off-site copy,
  no point-in-time recovery. A PVC delete or node failure permanently loses user data.
- **Not a document store.** Redis has no query language. Listing all cards for a
  household or filtering by status requires loading the full hash and filtering in
  application code.
- **Card data is primary user data.** Entitlements and Stripe state are *recoverable*
  from Stripe's ledger; card records are not recoverable from any external source.
  Storing them in an unmanaged single-zone Redis is inappropriate for production.
- **Real-time sync is not Redis's strength.** Websocket fan-out for household sharing
  would require additional infrastructure (Pub/Sub or a custom relay).

### Option 2 — Cloud Firestore (chosen)

Google Cloud Firestore is a managed, serverless, multi-region document database in
the same GCP project as our GKE cluster. It requires no provisioning, scales to zero,
and is free under our expected load.

**Pros:**
- **Managed durability.** Multi-region replication, automatic backups, point-in-time
  recovery — no ops burden.
- **Zero infrastructure.** No StatefulSets, no PVCs, no backup scripts.
- **Document model fits the data.** Collections and sub-collections map naturally to
  `/users/{clerkUserId}` and `/households/{id}/cards/{cardId}`.
- **Security rules.** Firestore's native security rules enforce household isolation at
  the database layer, not just the application layer.
- **Future real-time sync.** Firestore's `onSnapshot` enables live updates for
  household sharing without additional infrastructure.
- **Free tier more than sufficient.** 50K reads / 20K writes per day — Fenrir Ledger
  at scale is nowhere near this.
- **GKE Workload Identity.** The `fenrir-app-sa` K8s service account can be bound to
  a GCP service account with Firestore permissions via Workload Identity — no
  credentials file required in production.

**Cons:**
- **New SDK dependency.** Adds `@google-cloud/firestore` to the bundle (server-side
  only — no client bundle impact).
- **Network latency.** Cross-VPC call to Firestore API vs. in-cluster Redis. Measured
  as ~10–30 ms per call from GKE in the same region. Acceptable for a card-sync
  use case (not hot-path for every page render).
- **Cold start.** Firestore Admin SDK initialization adds ~50–100 ms on first request
  in a fresh pod. Mitigated by module-level singleton initialization.

### Option 3 — Cloud SQL (PostgreSQL)

Relational model, managed by GCP. Overkill for a document-shaped workload. Adds
provisioning cost even at minimum instance size (~$9/month). Rejected.

---

## Decision

**Use Firestore for card data. Keep Redis for entitlements and Stripe state.**

The critical distinction: card data is **primary user data** (not recoverable from
any external source). Entitlement data is **recoverable** from Stripe's payment
ledger. Redis is appropriate for recoverable data with in-cluster latency requirements;
Firestore is appropriate for primary user data that requires managed durability.

---

## Collection Schema

All server-side access only via `@google-cloud/firestore` Admin SDK through API routes.
No client SDK is used — this prevents credentials from leaking to the browser.

### `/users/{clerkUserId}`

```typescript
interface FirestoreUser {
  clerkUserId: string;        // document ID — Clerk's user ID
  email: string;
  displayName: string;
  householdId: string;        // exactly one household per user (enforced by security rules)
  role: "owner" | "member";
  createdAt: string;          // UTC ISO 8601
  updatedAt: string;          // UTC ISO 8601
}
```

### `/households/{householdId}`

```typescript
interface FirestoreHousehold {
  id: string;                 // document ID — UUID
  name: string;
  ownerId: string;            // clerkUserId of the owner
  memberIds: string[];        // clerkUserIds of all members (max 3, includes owner)
  inviteCode: string;         // 6-char alphanumeric, rotated on demand
  inviteCodeExpiresAt: string; // UTC ISO 8601, 1 month TTL
  tier: "free" | "karl";      // Karl tier lives here, not on user doc
  createdAt: string;          // UTC ISO 8601
  updatedAt: string;          // UTC ISO 8601
}
```

### `/households/{householdId}/cards/{cardId}`

```typescript
// Mirrors the Card interface from src/lib/types.ts exactly.
// No separate definition — the same Card type is serialised/deserialised as-is.
```

---

## Security Rules

Security rules enforce:
- A user can only read/write their own `/users/{clerkUserId}` document.
- A user can only read/write households they are a member of (`memberIds` contains their UID).
- `memberIds` is capped at 3 entries.
- All card CRUD requires the caller to be a member of the parent household.

See `infrastructure/firestore/firestore.rules` for the full rule set.

---

## Environment Variables

Production uses GKE Workload Identity (no credentials file). Local development uses
a service account JSON key or the Firebase emulator.

| Variable | Purpose |
|---|---|
| `FIRESTORE_PROJECT_ID` | GCP project ID (e.g., `fenrir-ledger-prod`) |
| `FIRESTORE_EMULATOR_HOST` | Optional — points to local emulator (`localhost:8080`) |

No `FIRESTORE_CLIENT_EMAIL` or `FIRESTORE_PRIVATE_KEY` needed in production;
Workload Identity provides ambient credentials via the metadata server.

---

## Consequences

- **Redis continues running** for entitlements, Stripe session, and KV-based rate
  limiting. It is not removed.
- **Card data in localStorage** is the migration source — future issues will handle
  the one-time sync from browser storage to Firestore on first Karl sign-in.
- **Firestore becomes the source of truth** for card data once cloud sync is live.
- **Real-time household sharing** (issue #1122+) can be built on top of this
  foundation without schema changes — just add `onSnapshot` listeners.
- This ADR supersedes the localStorage-first strategy in ADR-003 for Karl-tier users.

## Date

2026-03-16
