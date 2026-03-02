# Backlog Item: Patreon Integration for Paid Subscription Features

**Status:** Discovery
**Priority:** TBD (pending Freya/Odin interview)
**Owner:** Freya (Product Owner)
**Sprint:** Unscheduled

---

## Summary

Integrate Patreon as the payment and subscription platform for Fenrir Ledger's premium features. Freya to define the full product brief through an interview with Odin.

## Discovery Action

Freya to conduct a product discovery interview with Odin (the human operator) to define:

- Which features are free vs. paid
- Patreon tier structure (names, pricing, benefits)
- How Patreon membership maps to in-app feature gating
- Whether to use Patreon OAuth for identity or just for entitlement checks
- Integration approach (Patreon API v2, webhooks, or OAuth)
- How this interacts with the existing Google OIDC auth (ADR-005/006)
- Migration path for existing users
- Norse-themed tier naming

## Open Questions

1. What premium features justify a subscription? (e.g., cloud sync, multi-household, advanced analytics, priority import)
2. How many tiers? (free / supporter / premium?)
3. Does Patreon replace or complement the existing anonymous-first model (ADR-006)?
4. Do we gate features hard (locked) or soft (upsell banners)?
5. What Patreon API scopes are needed?
6. How do we handle users who cancel their Patreon subscription?

## Technical Context

- Current auth: Google OIDC with PKCE (ADR-005), anonymous-first (ADR-006)
- Patreon API v2: OAuth2 for identity, REST API for membership/tier checks
- Patreon webhooks: `members:pledge:create`, `members:pledge:update`, `members:pledge:delete`
- Potential new env vars: `PATREON_CLIENT_ID`, `PATREON_CLIENT_SECRET`, `PATREON_CAMPAIGN_ID`

## Next Step

Freya to schedule and conduct the discovery interview with Odin, then produce a full Product Design Brief at `designs/product/backlog/patreon-subscription-brief.md`.

## Acceptance Criteria

- [ ] Product discovery interview with Odin completed
- [ ] Full product brief produced at `designs/product/backlog/patreon-subscription-brief.md`
- [ ] All 6 open questions answered in the brief
- [ ] Patreon tier structure defined with Norse-themed naming
- [ ] Integration approach selected and documented
