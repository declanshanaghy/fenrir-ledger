# Backlog: Evaluate Alternative IDP for Testing & Production

**Priority**: Medium
**Category**: Infrastructure / Auth
**Sprint**: Unscheduled (GA prerequisite)
**Status**: Proposed

## Problem

The current product brief specifies OIDC via Google for authentication at GA.
Google OAuth is difficult to test:

- Requires real Google accounts or complex test-user setup
- OAuth consent screen is cumbersome in development
- Cannot easily create/destroy disposable test accounts
- Rate limits and verification requirements slow down CI/E2E testing

We need an IDP that is both **easy for developers to test against** and **appropriate for the target audience** (credit card churners and rewards optimizers — mainstream consumers, mobile-first, privacy-conscious about financial data).

## Recommendation: Clerk

**Clerk** is the strongest fit for both testing ease and target audience alignment.

### Why Clerk

| Criterion | Clerk |
|---|---|
| **Next.js integration** | First-class — `@clerk/nextjs` with App Router support, middleware, server components |
| **Test mode** | Built-in development instance with test accounts; no real OAuth needed locally |
| **Social providers** | Google, Apple, Facebook, GitHub — all toggle-on, no per-provider OAuth app setup |
| **Passwordless** | Email magic link + passkeys out of the box |
| **Mobile UX** | Drop-in `<SignIn />` component, responsive, customizable |
| **Privacy** | SOC 2 compliant, user data stays with Clerk (not a third-party aggregator) |
| **Free tier** | 10,000 MAU free — more than enough through Early Access |
| **E2E testing** | Testing tokens API for Playwright/Cypress — no real login flow needed in CI |

### Why it beats Google-only

- **Testing**: Clerk's dev mode gives instant test users. No Google OAuth dance in local/CI.
- **Audience fit**: Credit card churners are mainstream consumers who expect Apple/Google sign-in options. Clerk aggregates both plus email magic link — one integration, all providers.
- **Speed to ship**: Drop-in components mean auth UI ships in hours, not days.

### Alternatives Considered

| IDP | Pros | Cons | Verdict |
|---|---|---|---|
| **Auth.js (NextAuth)** | Open source, no vendor lock-in, lightweight | DIY test user management, no built-in test mode, each provider needs separate OAuth app | Good fallback if Clerk pricing becomes a concern at scale |
| **Auth0** | Excellent test user management, database connections | More enterprise-focused, heavier SDK, overkill for consumer app | Over-engineered for this audience |
| **Supabase Auth** | Bundled with Supabase DB | Product brief explicitly defers Supabase until GA; coupling auth to DB prematurely | Violates current constraints |
| **Firebase Auth** | Easy test accounts, Google-native | Google-centric, vendor lock-in, less Next.js-native | Worse DX than Clerk for this stack |
| **Magic.link** | Great passwordless UX | Limited social login support, smaller ecosystem | Too narrow |

## Acceptance Criteria

- [ ] Spike: Stand up Clerk dev instance, integrate with Next.js App Router
- [ ] Verify test-mode flow works for local dev and CI (Playwright)
- [ ] Enable Google + Apple + email magic link providers
- [ ] Document migration path from anonymous localStorage to Clerk-authenticated flow
- [ ] Update product brief auth section to reflect chosen IDP

## Dependencies

- This is a **GA prerequisite** — no auth work ships before GA planning is triggered (per product brief constraints)
- Must preserve anonymous-first design: auth is an upsell, never a gate
