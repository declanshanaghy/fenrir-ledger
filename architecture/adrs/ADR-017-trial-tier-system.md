# ADR-017: Trial Tier System

**Status:** Accepted
**Date:** 2026-03-01
**Authors:** FiremanDecko (Principal Engineer)
**Related issues:** #1122, #1648

---

## Context

Fenrir Ledger has two paid tiers (Thrall and Karl) with Stripe as the billing platform
(ADR-010). To lower the conversion barrier, a **free trial** was introduced that gives
new users full Karl-level features for a limited period — with one deliberate exception:
cloud sync remains Karl-only to preserve a concrete paid-tier differentiator.

The trial state is server-authoritative (Firestore) to prevent client-side manipulation,
and is permanent (never deleted) to block restart attempts after expiry.

---

## Decision

Implement a **30-day free trial** triggered on first card creation. The trial:

- Grants Karl-level feature access **except cloud sync**
- Is tracked server-side in Firestore at `/households/{userId}/trial`
- Cannot be restarted after expiry
- Converts automatically when the user subscribes to Karl

### Tier model

| Tier | How granted | Cloud sync | Import pipeline | Card limit |
|------|-------------|------------|-----------------|------------|
| Thrall (unauthenticated) | Default | No | No | 3 cards |
| Thrall (authenticated, post-trial) | Default | No | No | Configurable |
| Trial | Auto on first card creation | **No** | Yes | Unlimited |
| Karl | Active Stripe subscription | Yes | Yes | Unlimited |

### Trial gating in code

Cloud sync is explicitly excluded from trial access. The gate is in
`development/ledger/src/hooks/useCloudSync.ts`:

```typescript
// Karl-only: no sync for Thrall or free-trial users (#1122 acceptance criterion)
const isKarl = isAuthenticated && tier === "karl" && isActive;
```

All other Karl-gated features use `tier: "karl-or-trial"` in `requireAuthz()`:

```typescript
// ADR-015 authz layer — grants access to Karl subscribers AND active trial users
const authz = await requireAuthz(request, { tier: "karl-or-trial" });
```

### Trial Firestore schema

Stored at `/households/{userId}/trial` (via `development/ledger/src/lib/kv/trial-store.ts`):

```typescript
interface StoredTrial {
  startDate: string;     // ISO — when trial started (first card creation)
  expiresAt: string;     // ISO — startDate + 30 days
  convertedDate?: string; // ISO — when user subscribed to Karl (if ever)
}
```

The document is permanent. `TrialRestartError` is thrown if a user attempts to start a
second trial after the first has expired.

### Trial duration

`TRIAL_DURATION_DAYS = 30` (defined in `development/ledger/src/lib/trial-utils.ts`).

### Stripe pricing (Karl tier)

- Price: **$3.99/month** (recurring)
- Platform: Stripe Checkout + Customer Portal (ADR-010)
- Entitlements written to Firestore by Stripe webhook handler; read by `requireAuthz()`

---

## Alternatives Considered

### 1. No trial — Karl paywall from day one

**Pros**: Simpler entitlement logic; no trial/Karl distinction to maintain.

**Cons**: High conversion friction for new users with no card data yet. Trial lowers the
barrier to evaluating import, dashboards, and budget tools before committing to a subscription.

### 2. Trial with cloud sync included

**Pros**: Users experience the full Karl feature set before deciding.

**Cons**: Cloud sync requires Firestore reads/writes per sync operation. Offering it during
trial creates infrastructure cost with no revenue offset and removes a key paid-tier differentiator.

### 3. Trial stored client-side (localStorage)

**Pros**: Zero server round-trip to check trial status.

**Cons**: Trivially bypassable — clearing localStorage or using DevTools resets the trial.
Server-authoritative Firestore is the only tamper-resistant option.

### 4. 14-day trial

**Pros**: Shorter trial reduces the window of free Karl access.

**Cons**: 30 days gives users enough time to import real card data, evaluate reminders, and
see a billing cycle — sufficient for a genuine conversion decision. 14 days was considered
too short for the import-heavy onboarding flow.

---

## Consequences

### Positive

- **Lower conversion friction** — users experience Karl features before committing
- **Tamper-resistant** — trial state is server-side; client cannot extend or restart it
- **Clean differentiator** — cloud sync remains exclusively Karl-tier; trial is not "free Karl"
- **Automatic conversion** — Stripe webhook sets `convertedDate` when subscription activates

### Negative

- **Extra Firestore read per request** — `requireAuthz()` reads trial state on every
  `karl-or-trial` gated route; mitigated by short-lived in-process caching
- **UI complexity** — trial expiry modals, mid-trial nudges, and post-trial banners require
  localStorage flags (`fenrir:trial-start-toast-shown`, etc.) to avoid repeated display
- **Support surface** — users expect trial restart; the hard block requires clear UX messaging

### Constraints introduced

- Trial state MUST be read from Firestore, never from client-supplied data
- Cloud sync routes (`/api/sync/*`) MUST use `tier: "karl"` (not `"karl-or-trial"`) in `requireAuthz()`
- All other Karl-gated routes use `tier: "karl-or-trial"`
- `TRIAL_DURATION_DAYS` is the single source of truth — do not hardcode `30` elsewhere

---

## Related

- [ADR-010-stripe-direct.md](ADR-010-stripe-direct.md) — Stripe Checkout and webhook-driven entitlements
- [ADR-014-firestore-cloud-sync.md](ADR-014-firestore-cloud-sync.md) — Firestore cloud sync (Karl-only)
- [ADR-015-authz-layer.md](ADR-015-authz-layer.md) — `requireAuthz()` tier gating implementation
- `development/ledger/src/hooks/useCloudSync.ts` — cloud sync Karl gate (line ~177)
- `development/ledger/src/lib/kv/trial-store.ts` — Firestore trial read/write
- `development/ledger/src/lib/trial-utils.ts` — `TRIAL_DURATION_DAYS` constant
- `development/ledger/src/lib/auth/authz.ts` — `requireAuthz()` with `karl-or-trial` tier
- GitHub Issue #1122 — trial tier acceptance criteria (cloud sync exclusion)
