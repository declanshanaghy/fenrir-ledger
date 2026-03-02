# ADR-007 — Clerk as Auth Platform with GitHub as Initial Identity Provider

**Status:** Proposed (deferred until GA planning)
**Date:** 2026-03-01
**Author:** FiremanDecko (Principal Engineer)
**Extends:** ADR-005 (auth/PKCE), ADR-006 (anonymous-first)

---

## Context

Google OAuth is hard to test in CI/E2E. Clerk provides Testing Tokens API for Playwright, dashboard-driven multi-provider expansion, and first-class Next.js App Router SDK. 10k MAU free tier is sufficient through Early Access.

## Decision

**Use Clerk as the auth platform. GitHub as initial identity provider. Implementation deferred until GA sprint.**

### What Clerk Owns

| Concern | Before | After |
|---------|--------|-------|
| Session storage | `fenrir:auth` localStorage | Clerk cookie/session |
| Provider OAuth | DIY Google client | Clerk Dashboard toggle |
| User identity | `session.user.sub` (Google) | `userId` from `useAuth()` / `auth()` |
| Sign-in UI | Custom page | `<SignIn />` component |
| Middleware | No-op | `clerkMiddleware()` — all routes public |
| E2E testing | Manual token mgmt | `@clerk/testing` + Playwright |

### What Does NOT Change

- `Card`, `Household`, `CardStatus` types — unchanged
- `storage.ts` functions — accept `householdId: string`, agnostic about source
- Anonymous-first model — anonymous users use UUID from localStorage forever
- `merge-anonymous.ts` — logic unchanged, only trigger point changes (Clerk `isSignedIn` transition)
- `householdId` contract — Clerk's `user.id` becomes `householdId` for signed-in users

### Middleware

`clerkMiddleware()` with no `auth.protect()` calls. All routes public. Auth is an upsell, never a gate.

### Provider Rollout

| Phase | Provider | Method |
|-------|----------|--------|
| GA Phase 1 | GitHub | Clerk Dashboard |
| GA Phase 2+ | Google, Apple, magic link | Clerk Dashboard — zero code changes |

## Rejected Alternatives

- **Auth.js v5** — No Testing Tokens for E2E; per-provider OAuth app management burden
- **Supabase Auth** — Couples auth to storage prematurely; violates product brief constraints

## Consequences

**Positive:** Trivial Playwright testing, free provider expansion, server-side auth via `auth()`, no data model changes, anonymous-first preserved.

**Trade-offs:** Vendor dependency (fallback: Auth.js migration). `FenrirSession` type removed. New env vars: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`.

---

**References:** [Implementation plan](clerk-implementation-plan.md) | [Backlog item](../product/backlog/idp-testing-alternative.md) | [Clerk docs](https://clerk.com/docs/quickstarts/nextjs)
