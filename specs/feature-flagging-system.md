# Feature Flagging System

**Author:** Odin (Product Owner directive)
**Assignee:** FiremanDecko (Principal Engineer)
**Priority:** P1 — Prerequisite for Stripe Direct pivot
**Date:** 2026-03-04

---

## Context

We are pivoting from Patreon to Stripe Direct for subscriptions. Rather than
rip-and-replace, we need the ability to feature-flag Patreon off and Stripe on.
This is the first use case, but feature flagging will be used going forward for
all new feature rollouts.

**Phase 1:** Simple, build-side feature flags using environment variables.
**Phase 2 (future):** Evaluate and potentially integrate a managed feature flag
service (LaunchDarkly, Flipt, or similar) when runtime toggling, user targeting,
or A/B testing is needed.

---

## Phase 1: Simple Feature Flags (Build Now)

### Design Principles

1. **Single source of truth** — All flags defined in one file
2. **Type-safe** — TypeScript enum/const for flag names, no magic strings
3. **Server + client** — Flags must work in API routes (server) and React
   components (client)
4. **Default-safe** — Every flag has an explicit default; missing env vars don't
   break the build
5. **No runtime dependency** — Flags are resolved at build time or server start;
   no external service calls

### Implementation

#### Flag Registry

```typescript
// development/frontend/src/lib/feature-flags.ts

/**
 * Feature flag definitions.
 * Values are read from environment variables at build/server-start time.
 * Client-side flags use NEXT_PUBLIC_ prefix.
 */

export const FeatureFlags = {
  /** Active subscription platform: "stripe" | "patreon" */
  SUBSCRIPTION_PLATFORM: (process.env.SUBSCRIPTION_PLATFORM ??
    process.env.NEXT_PUBLIC_SUBSCRIPTION_PLATFORM ??
    "patreon") as "stripe" | "patreon",

  // Future flags follow the same pattern:
  // ENABLE_ANNUAL_BILLING: process.env.NEXT_PUBLIC_ENABLE_ANNUAL_BILLING === "true",
  // ENABLE_CSV_EXPORT: process.env.NEXT_PUBLIC_ENABLE_CSV_EXPORT === "true",
} as const;

/** Type-safe flag name */
export type FeatureFlagName = keyof typeof FeatureFlags;

/** Check if a boolean flag is enabled */
export function isEnabled(flag: FeatureFlagName): boolean {
  const value = FeatureFlags[flag];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return false;
}

/** Check active subscription platform */
export function isStripe(): boolean {
  return FeatureFlags.SUBSCRIPTION_PLATFORM === "stripe";
}

export function isPatreon(): boolean {
  return FeatureFlags.SUBSCRIPTION_PLATFORM === "patreon";
}
```

#### Usage in API Routes

```typescript
// Example: /api/patreon/authorize/route.ts
import { isPatreon } from "@/lib/feature-flags";

export async function GET(request: NextRequest) {
  if (!isPatreon()) {
    return NextResponse.json(
      { error: "Patreon integration is disabled" },
      { status: 404 }
    );
  }
  // ... existing handler
}
```

#### Usage in React Components

```typescript
// Example: Settings page
import { isStripe, isPatreon } from "@/lib/feature-flags";

export function SubscriptionSettings() {
  if (isStripe()) return <StripeSettings />;
  if (isPatreon()) return <PatreonSettings />;
  return null;
}
```

#### Environment Variables

```bash
# .env.local (development — keep Patreon active until Stripe is ready)
SUBSCRIPTION_PLATFORM=patreon

# .env.production (flip when Stripe is ready)
SUBSCRIPTION_PLATFORM=stripe

# Client-side access (for conditional UI rendering)
NEXT_PUBLIC_SUBSCRIPTION_PLATFORM=patreon
```

### Scope of Work

1. Create `src/lib/feature-flags.ts` with the registry above
2. Add `SUBSCRIPTION_PLATFORM` to `.env.local` and `.env.example`
3. Guard all 6 Patreon API routes with `if (!isPatreon()) return 404`
4. Guard `PatreonSettings` component rendering with flag check
5. Guard `SealedRuneModal` Patreon campaign URL with flag check
6. Add unit tests for the flag registry (default values, env override)
7. Document in `designs/architecture/` as an ADR

### What This Does NOT Do

- No runtime toggling (requires restart/redeploy)
- No user-level targeting (all users see the same flag state)
- No gradual rollout / percentage-based release
- No analytics on flag evaluation
- No flag management UI

These are Phase 2 concerns.

---

## Phase 2: Managed Feature Flag Service (Research — Do Not Build Yet)

When we need runtime toggling, user targeting, or A/B testing, we should
evaluate a managed service. Here is the research:

### Option A: LaunchDarkly

**Pros:**
- Industry leader, battle-tested at scale
- First-class [Vercel + Next.js integration](https://vercel.com/templates/next.js/feature-flag-launchdarkly) via Edge Config
- [Vercel SDK](https://launchdarkly.com/docs/sdk/edge/vercel) for edge-side flag evaluation
- Rich targeting rules, experiments, and progressive rollouts
- Real-time flag updates without redeployment

**Cons:**
- **$10/seat/month minimum**, no free tier (14-day trial only)
- Enterprise pricing ranges $20k–$120k/year for larger teams
- Overkill for a small indie project with simple needs
- Vendor lock-in on flag evaluation logic

**Verdict:** Best-in-class but expensive. Consider only if we hit 500+
subscribers and need sophisticated targeting/experimentation.

### Option B: Flipt (Open Source)

**Pros:**
- Open source, self-hostable, no seat limits
- Git-native workflow — flags live alongside code
- [Flipt Cloud](https://openalternative.co/flipt) for managed option
- Simple REST/gRPC API
- ~80% cheaper than LaunchDarkly

**Cons:**
- No native Vercel/Next.js SDK (requires custom integration)
- Smaller community than LaunchDarkly/Unleash
- Self-hosting adds operational burden

**Verdict:** Good middle ground if we want runtime flags without LaunchDarkly
pricing. Git-native approach fits our workflow.

### Option C: Vercel Feature Flags (Edge Config)

**Pros:**
- Native to our hosting platform
- Ultra-low latency (Edge Config reads in ~1ms)
- No additional service to manage
- Works with LaunchDarkly, Hypertune, or custom providers
- Free tier includes Edge Config

**Cons:**
- Basic feature — no targeting UI, no experiments
- Requires manual Edge Config updates or integration with a provider
- Limited to Vercel deployments

**Verdict:** Most natural fit for our stack. Can start with raw Edge Config
and plug in LaunchDarkly/Flipt later if needed.

### Option D: Unleash (Open Source)

**Pros:**
- Most popular open-source feature flag platform
- Self-hosted, hosted, or hybrid deployment
- Enterprise governance features
- Good SDK ecosystem including Node.js

**Cons:**
- No native Next.js/Vercel integration
- Self-hosting requires infrastructure
- Hosted plan starts at $80/month

**Verdict:** Strong option for teams wanting full control. Less relevant for
us since we're Vercel-native.

### Recommendation for Phase 2

**When the time comes:** Start with **Vercel Edge Config** for runtime flags
(free, native, low-latency). If we outgrow it, evaluate **Flipt Cloud** or
**LaunchDarkly** based on scale and budget.

**Trigger to move to Phase 2:** Any of these:
- Need to toggle a flag without redeploying
- Need user-level targeting (e.g., beta testers see feature X)
- Need A/B testing or experimentation
- Operational pain from env-var-based flags across environments

---

## Sources

- [LaunchDarkly Pricing](https://launchdarkly.com/pricing/)
- [LaunchDarkly Vercel SDK](https://launchdarkly.com/docs/sdk/edge/vercel)
- [LaunchDarkly Next.js Template (Vercel)](https://vercel.com/templates/next.js/feature-flag-launchdarkly)
- [LaunchDarkly Pricing Guide (Spendflo)](https://www.spendflo.com/blog/launchdarkly-pricing-guide)
- [Feature Flags for Startups (DEV)](https://dev.to/rami_rosenblum_78e41f28d8/feature-flags-for-startups-who-cant-afford-launchdarkly-50jg)
- [7 Best Open Source LaunchDarkly Alternatives](https://openalternative.co/alternatives/launchdarkly)
- [Flipt - Open Source Feature Flags](https://openalternative.co/flipt)
- [LaunchDarkly Alternatives (Schematic)](https://schematichq.com/blog/launchdarkly-alternatives)
- [LaunchDarkly Alternatives (Flagsmith)](https://www.flagsmith.com/blog/launchdarkly-alternatives)
- [Best LaunchDarkly Alternatives - Pricing Comparison](https://www.buildmvpfast.com/alternatives/launchdarkly)
