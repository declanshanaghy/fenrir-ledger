# Product Brief: Fenrir Ledger

Credit card churn tracker: track every card, harvest every reward, break free before the fees bite.

## Project Overview

Fenrir Ledger is a personal finance tool for credit card churners and rewards optimizers. It tracks all open credit cards, records opening dates, credit limits, promotional bonuses (points, miles, cashback), annual fees, and renewal dates. The app proactively reminds users to use or transfer promotional credits, hit sign-up bonus spending thresholds, and close or downgrade cards before the annual fee kicks in after the first promotional year.

## Core Value Proposition

- **Never Pay a Surprise Annual Fee**: Automated reminders before every fee renewal date so you can close, downgrade, or decide to keep with full awareness.
- **Harvest Every Reward**: Track sign-up bonuses, spending thresholds, and promo credit deadlines so nothing expires unused.
- **Complete Card Portfolio Visibility**: One dashboard showing every open card, its status, upcoming deadlines, and lifetime value extracted.

## Key Features

1. **Card Portfolio Dashboard** — Central view of all open credit cards with status indicators (active, approaching fee, promo expiring, closed).
2. **Card Entry & Management** — Add cards with: issuer, card name, open date, credit limit, annual fee amount, fee date, promo period length, sign-up bonus details (type, amount, spend requirement, deadline).
3. **Smart Reminders** — Configurable notifications before key dates: annual fee renewal (e.g., 30/60/90 days), sign-up bonus spend deadline, promo credit expiration.
4. **Timeline View** — Visual timeline showing when cards were opened, when promos expire, and when fees hit — past and future.
5. **Action Recommendations** — For each card approaching a decision point, suggest: close, downgrade to no-fee version, keep (with ROI justification), or transfer credits.
6. **Reward Tracking** — Log rewards earned (points, miles, cashback) per card and calculate net value after annual fees.

## Product Launch Strategy

Fenrir Ledger follows a staged launch model designed to validate product-market fit before introducing infrastructure complexity:

1. **Incubate MVP** — Core functionality with anonymous localStorage use. No login required. Ship fast, iterate.
2. **Early Access** — Open to real users. Collect feedback. Login optional, backend off.
3. **Integrate Feedback** — Refine the product based on actual usage patterns.
4. **Loop** — Repeat steps 1–3 until the product is well-validated.
5. **GA (General Availability)** — Remote storage, multi-device sync, and data migration ship here. Login becomes the gateway to cloud sync.

### Anonymous-First Design

**Users can open Fenrir Ledger and start tracking cards immediately — no login required.**

The app works fully offline and anonymously, forever, as a free tier. localStorage is the primary data store for all users.

For anonymous users:
- A `householdId` is generated as a UUID on first use and persisted in localStorage under `fenrir:household`
- All card data is keyed to this locally-generated UUID, exactly as it would be for a logged-in user
- The user never sees a sign-in gate or redirect

Login is optional and surfaced as an upsell: when a logged-in account is supported in a future release, users will be prompted to sign in to unlock cloud sync and multi-device access. Until that feature ships, the upsell is informational only and must never block the user.

### What Ships in MVP

**Authentication is not required in the MVP.** The priority is zero friction: a user lands on the dashboard, adds their first card, and the app is immediately useful. No account creation. No OAuth redirect. No waiting.

The `householdId` field exists on every `Card` from Sprint 1. For anonymous users it is populated with a locally-generated UUID — the data model is already correct and will require no structural change when cloud sync arrives.

### Login as Cloud Sync Upsell (Future)

When remote storage ships at GA, logged-in users gain:
- Cloud backup of their card portfolio
- Multi-device access (desktop + mobile in sync)
- Optional household sharing with a partner

The upsell surface is a non-blocking banner or settings option: "Sync your data to the cloud — sign in to keep your ledger safe across devices."

Login in this model is a feature unlock, not a gate.

### Constraints Until GA

**Remote storage and data migration are explicitly deferred until the team has received multiple rounds of real user feedback and declared the product ready for GA.**

Rationale:
- localStorage is sufficient for single-device use through the entire validation cycle. No auth is required to provide identity — a locally-generated UUID is enough for namespacing.
- Introducing a database (Supabase, Postgres, etc.) adds secrets management, deployment ops, RLS, and billing complexity — all before we know whether the product is worth it.
- Data migration tooling belongs in the sprint where we know what users actually need, not before.
- These concerns all resolve naturally at GA when the product is proven and the user base justifies the investment.

**The team must not plan, scope, or begin implementation of the following until GA planning is explicitly triggered:**
- Remote / server-side storage (Supabase, Postgres, any DB)
- Data migration tooling or localStorage export wizards
- Multi-device sync
- Required authentication / sign-in gates

## Tech Stack

- **Framework**: Next.js (App Router) + TypeScript
- **Frontend**: React (latest)
- **Styling**: Tailwind CSS + shadcn/ui
- **Hosting**: Vercel; Root Directory configured to `development/src/`
- **Data model**: Household-scoped from day one (single-user UI initially; multi-user sharing is future)
- **Auth**: Optional — OIDC via Google surfaced as cloud-sync upsell at GA; not a gate in MVP

## Technical Constraints

- Max stories per sprint: 5
- Code review required
- All diagrams (architecture, flow, sequence, state, etc.) must use Mermaid syntax
- Every sprint must include stories for idempotent deployment scripts
- Mobile-responsive design (churners check this on the go)

## Target Users

Credit card churners and rewards optimizers — people who strategically open credit cards for sign-up bonuses, promotional rates, and rewards programs, then manage a portfolio of 5-20+ active cards. These users currently track cards in spreadsheets, notes apps, or their heads, and risk losing value through missed deadlines or unexpected fees.

## Success Metrics

- User can add a card and see reminders within 2 minutes of first use — no login required
- Zero missed annual fee deadlines for active users
- Positive user feedback on deadline awareness and reward harvesting
- Support for managing 20+ simultaneous cards without performance issues

## Sprint 1 Backlog

1. Card CRUD operations + local storage
2. Dashboard with card status indicators

## Future

- Reminder engine with configurable lead times
- Timeline visualization
- Action recommendation logic
- Reward value tracking + net ROI calculation
- Data export (CSV/JSON)
- Optional login — upsell for cloud sync (requires backend)
- Multi-device sync (requires backend + login)
- Bank API integration for auto-detection
- Shared household card tracking (requires login)
- Smart reminders / notification engine
