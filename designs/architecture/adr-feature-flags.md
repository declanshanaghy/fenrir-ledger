# ADR: Feature Flag System (Phase 1 -- Environment Variables)

## Status: Accepted

## Context

Fenrir Ledger is pivoting from Patreon to Stripe Direct for subscriptions. Rather
than a risky rip-and-replace, we need the ability to feature-flag Patreon off and
Stripe on. This is the first use case, but feature flagging will be reused for all
future feature rollouts.

Phase 1 requires only build-time / server-start-time flags with no external service
dependency. Runtime toggling, user targeting, and A/B testing are Phase 2 concerns
(see `specs/feature-flagging-system.md` for the full research).

## Options Considered

### 1. Inline env checks scattered across files

Pros: zero abstraction overhead.
Cons: magic strings everywhere, no single source of truth, easy to miss a check,
no type safety.

### 2. Single registry file with typed helpers (chosen)

Pros: one file to audit, type-safe flag names, helper functions (`isStripe()`,
`isPatreon()`) prevent typos, trivial to grep for usage, no runtime dependency.
Cons: requires a redeploy to change flag values, no gradual rollout.

### 3. Vercel Edge Config (Phase 2 candidate)

Pros: runtime toggling without redeploy, ultra-low latency, native to our hosting
platform.
Cons: overkill for the current need (binary platform switch), adds operational
surface area we do not need yet.

## Decision

Implement Option 2: a single `src/lib/feature-flags.ts` registry that reads
environment variables at module evaluation time.

- `SUBSCRIPTION_PLATFORM` (server) / `NEXT_PUBLIC_SUBSCRIPTION_PLATFORM` (client)
  controls the active subscription platform.
- Default is `"patreon"` for backwards compatibility.
- All 7 Patreon API routes check `isPatreon()` at the top of every handler and
  return `404 { error: "Patreon integration is disabled" }` when the flag is set
  to `"stripe"`.

## Consequences

### Positive

- **Safe pivot**: Patreon routes become inert with a single env var change.
- **Backwards compatible**: missing or unset env var defaults to `"patreon"` -- no
  change in behavior for existing deployments.
- **Type-safe**: `FeatureFlagName` type prevents typos; `isStripe()` / `isPatreon()`
  give exhaustive checking at call sites.
- **Auditable**: `grep -r "isPatreon\|isStripe\|FeatureFlags" src/` shows every
  flag consumer.
- **No new dependencies**: zero additional packages or services.

### Negative

- **Requires redeploy**: changing a flag value means redeploying the application.
  Acceptable for a binary platform switch; would not scale to per-user feature
  targeting.
- **No runtime toggling**: if Patreon needs to be re-enabled urgently, a new
  deployment is required.
- **Build-time evaluation**: client-side flags are baked into the JS bundle at build
  time. Different environments (preview vs production) get different bundles, which
  is the desired behavior for Next.js on Vercel.

### Migration Path to Phase 2

When any of these triggers occur, evaluate Vercel Edge Config or Flipt Cloud:
- Need to toggle a flag without redeploying
- Need user-level targeting (beta testers see feature X)
- Need A/B testing or experimentation
- Operational pain from env-var-based flags across environments
