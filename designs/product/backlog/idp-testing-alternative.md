# Backlog: Evaluate Alternative IDP for Testing & Production

**Priority**: Medium | **Status**: Proposed | **Sprint**: Unscheduled (GA prerequisite)

## Problem

Google OAuth is hard to test: no easy disposable test accounts, consent screen friction, rate limits in CI.

## Recommendation: Clerk

Best fit for both testing ease and target audience (mainstream consumers, mobile-first).

- First-class Next.js App Router integration (`@clerk/nextjs`)
- Built-in dev/test mode — no real OAuth needed locally or in CI
- Social providers (Google, Apple, GitHub) toggle-on from dashboard — no code changes
- Testing tokens API for Playwright — no login flow in CI
- 10K MAU free tier — sufficient through Early Access
- SOC 2 compliant

**Rollout**: Phase 1 = GitHub only (team accounts). Phase 2 = Add Google, Apple, email magic link via dashboard toggles.

## Acceptance Criteria

- [ ] Spike: Clerk dev instance + Next.js App Router integration
- [ ] Verify test-mode works for local dev and CI (Playwright)
- [ ] Enable GitHub as initial IDP
- [ ] Confirm adding providers later is dashboard-only
- [ ] Document migration from anonymous localStorage to Clerk-authenticated flow
- [ ] Update product brief auth section

## Dependencies

- GA prerequisite — no auth work ships before GA planning
- Must preserve anonymous-first design: auth is upsell, never a gate
