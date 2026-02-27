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

1. **Incubate MVP** — Core functionality with localStorage + Google OIDC auth. Ship fast, iterate.
2. **Early Access** — Open to real users. Collect feedback. Auth on, backend off.
3. **Integrate Feedback** — Refine the product based on actual usage patterns.
4. **Loop** — Repeat steps 1–3 until the product is well-validated.
5. **GA (General Availability)** — Remote storage, multi-device sync, and data migration ship here.

### What Ships in MVP

**Google OIDC authentication is included in the MVP.** Auth establishes the identity model the data layer will rely on when remote storage arrives at GA. It also enables authorization patterns in the local UI and localStorage scoping (data is keyed to the authenticated user's household). Shipping auth early means the data model is right from day one — retrofitting identity onto an existing dataset is far more expensive.

Auth in MVP means:
- Sign-in with Google (Auth.js v5)
- localStorage data scoped to the authenticated user's household ID
- Protected routes — unauthenticated users land on a sign-in gate
- HttpOnly session cookie — no client-JS token exposure

### Constraints Until GA

**Remote storage and data migration are explicitly deferred until the team has received multiple rounds of real user feedback and declared the product ready for GA.**

Rationale:
- localStorage is sufficient for single-device use through the entire validation cycle. Auth gives us identity without needing a backend.
- Introducing a database (Supabase, Postgres, etc.) adds secrets management, deployment ops, RLS, and billing complexity — all before we know whether the product is worth it.
- Data migration tooling belongs in the sprint where we know what users actually need, not before.
- These concerns all resolve naturally at GA when the product is proven and the user base justifies the investment.

**The team must not plan, scope, or begin implementation of the following until GA planning is explicitly triggered:**
- Remote / server-side storage (Supabase, Postgres, any DB)
- Data migration tooling or localStorage export wizards
- Multi-device sync

## Tech Stack

- **Framework**: Next.js (App Router) + TypeScript
- **Frontend**: React (latest)
- **Styling**: Tailwind CSS + shadcn/ui
- **Hosting**: Vercel (future — not in Sprint 1 scope); Root Directory configured to `development/src/`
- **Data model**: Household-scoped from day one (single-user UI initially; multi-user sharing is future)
- **Auth**: Future — OIDC via Google, Facebook, etc. (not in Sprint 1)

## Technical Constraints

- Max stories per sprint: 5
- Code review required
- All diagrams (architecture, flow, sequence, state, etc.) must use Mermaid syntax
- Every sprint must include stories for idempotent deployment scripts
- Mobile-responsive design (churners check this on the go)

## Target Users

Credit card churners and rewards optimizers — people who strategically open credit cards for sign-up bonuses, promotional rates, and rewards programs, then manage a portfolio of 5-20+ active cards. These users currently track cards in spreadsheets, notes apps, or their heads, and risk losing value through missed deadlines or unexpected fees.

## Success Metrics

- User can add a card and see reminders within 2 minutes of first use
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
- Multi-device sync (requires backend)
- Bank API integration for auto-detection
- Shared household card tracking (OIDC login — Google, Facebook, etc.)
- Vercel hosting + deployment pipeline
- Smart reminders / notification engine
