# QA Handoff — Sprint 1

**From**: FiremanDecko (Principal Engineer)
**To**: Loki (QA Tester)
**Sprint**: 1
**Date**: 2026-02-23

---

## What Was Implemented

### Story 1.1 — Project Scaffold
Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui project scaffolded in `development/src/`. All configuration files are written by hand (create-next-app equivalent). TypeScript strict mode enabled.

### Story 1.2 — Data Model and Storage Layer
- `src/lib/types.ts` — TypeScript interfaces: `Household`, `Card`, `SignUpBonus`, `CardStatus`, `BonusType`
- `src/lib/constants.ts` — All magic values: storage keys, threshold days, issuer list
- `src/lib/storage.ts` — localStorage abstraction with `getCards`, `saveCard`, `deleteCard`, `initializeDefaultHousehold`, `migrateIfNeeded`
- `src/lib/card-utils.ts` — Pure functions: `computeCardStatus`, `formatCurrency`, `formatDate`, `daysUntil`, `dollarsToCents`, `centsToDollars`

### Story 1.3 — Card CRUD UI
- Add Card form at `/cards/new`
- Edit Card form at `/cards/[id]/edit`
- Shared `CardForm` component with react-hook-form + Zod validation
- Delete card with confirmation dialog
- All data persists in localStorage under `fenrir_ledger:*` keys

### Story 1.4 — Dashboard with Status Indicators
- Dashboard at `/` showing all cards in a responsive grid
- Card tiles with status badges (Active / Fee Approaching / Promo Expiring / Closed)
- Summary header showing total cards and attention count
- Empty state when no cards exist

### Story 1.5 — Idempotent Local Dev Setup
- `development/scripts/setup-local.sh` — idempotent setup script
- `development/src/.env.example` — environment variable template

---

## Files Created / Modified

| File | Description |
|------|-------------|
| `development/src/package.json` | Project dependencies |
| `development/src/tsconfig.json` | TypeScript configuration |
| `development/src/next.config.ts` | Next.js configuration |
| `development/src/tailwind.config.ts` | Tailwind CSS configuration |
| `development/src/postcss.config.mjs` | PostCSS configuration |
| `development/src/components.json` | shadcn/ui configuration |
| `development/src/.eslintrc.json` | ESLint configuration |
| `development/src/.env.example` | Environment template (committed) |
| `development/src/.gitignore` | Git ignore rules |
| `development/src/src/app/globals.css` | Global styles + shadcn/ui CSS variables |
| `development/src/src/app/layout.tsx` | Root layout |
| `development/src/src/app/page.tsx` | Dashboard page (/) |
| `development/src/src/app/cards/new/page.tsx` | Add card page |
| `development/src/src/app/cards/[id]/edit/page.tsx` | Edit card page |
| `development/src/src/lib/types.ts` | TypeScript type definitions |
| `development/src/src/lib/constants.ts` | Application constants |
| `development/src/src/lib/storage.ts` | localStorage abstraction |
| `development/src/src/lib/card-utils.ts` | Card utility functions |
| `development/src/src/lib/utils.ts` | shadcn/ui cn() utility |
| `development/src/src/components/ui/button.tsx` | shadcn/ui Button |
| `development/src/src/components/ui/card.tsx` | shadcn/ui Card |
| `development/src/src/components/ui/input.tsx` | shadcn/ui Input |
| `development/src/src/components/ui/label.tsx` | shadcn/ui Label |
| `development/src/src/components/ui/select.tsx` | shadcn/ui Select |
| `development/src/src/components/ui/badge.tsx` | shadcn/ui Badge (with status variants) |
| `development/src/src/components/ui/dialog.tsx` | shadcn/ui Dialog |
| `development/src/src/components/ui/textarea.tsx` | shadcn/ui Textarea |
| `development/src/src/components/ui/checkbox.tsx` | shadcn/ui Checkbox |
| `development/src/src/components/dashboard/Dashboard.tsx` | Dashboard component |
| `development/src/src/components/dashboard/CardTile.tsx` | Card display tile |
| `development/src/src/components/dashboard/StatusBadge.tsx` | Status badge |
| `development/src/src/components/dashboard/EmptyState.tsx` | Empty state |
| `development/src/src/components/cards/CardForm.tsx` | Shared add/edit form |
| `development/scripts/setup-local.sh` | Idempotent setup script |
| `development/implementation-plan.md` | Implementation documentation |
| `development/qa-handoff.md` | This file |
| `architecture/sprint-plan.md` | Sprint 1 stories |
| `architecture/system-design.md` | System design documentation |
| `architecture/adrs/ADR-001-tech-stack.md` | Tech stack decision |
| `architecture/adrs/ADR-002-data-model.md` | Data model decision |
| `architecture/adrs/ADR-003-local-storage.md` | Storage approach decision |
| `README.md` | Updated with Sprint 1 artifacts |

---

## How to Deploy (Local)

```bash
# 1. Clone the repo
git clone https://github.com/declanshanaghy/fenrir-ledger.git
cd fenrir-ledger

# 2. Run setup script (installs dependencies, creates .env.local)
./development/scripts/setup-local.sh

# 3. Start the dev server
cd development/src
npm run dev

# 4. Open browser
open http://localhost:3000
```

---

## Test Focus Areas

### Critical Path Tests

1. **Add card — happy path**
   - Navigate to `/cards/new`
   - Fill all required fields (issuer, card name, open date)
   - Submit form
   - Verify card appears on dashboard
   - Verify data persists after page refresh

2. **Add card — validation**
   - Submit form with missing required fields (issuer, card name, open date)
   - Verify error messages appear on each missing required field
   - Verify form does not submit

3. **Add card with sign-up bonus**
   - Enable the sign-up bonus checkbox
   - Fill in bonus type, amount, spend requirement, deadline
   - Submit and verify bonus data saved correctly

4. **Edit card**
   - Click a card tile on the dashboard
   - Verify form pre-populated with existing values
   - Modify card name and save
   - Verify updated name on dashboard

5. **Delete card**
   - Open edit form for a card
   - Click "Delete card"
   - Verify confirmation dialog appears
   - Confirm deletion
   - Verify card removed from dashboard

6. **Status badge colors**
   - Add a card with annual fee date within 60 days
   - Verify "Fee Approaching" badge in amber
   - Add a card with sign-up bonus deadline within 30 days
   - Verify "Promo Expiring" badge in amber
   - Add a card with no approaching deadlines
   - Verify "Active" badge in green

7. **Empty state**
   - Open app with no cards in localStorage
   - Verify empty state message and "Add your first card" button

8. **Data persistence**
   - Add 3 cards
   - Reload the page (F5)
   - Verify all 3 cards still appear

9. **Responsive layout**
   - Verify dashboard is 1 column on mobile viewport (< 640px)
   - Verify dashboard is 2 columns on tablet viewport (640px–1024px)
   - Verify dashboard is 3 columns on desktop viewport (> 1024px)

10. **Setup script**
    - Run `./development/scripts/setup-local.sh` on a clean checkout
    - Verify it completes without errors
    - Verify `.env.local` is created
    - Run it a second time — verify it completes without errors (idempotency)

---

## Known Limitations (Sprint 1)

| Limitation | Impact |
|-----------|--------|
| localStorage only | Data does not sync across devices or browsers |
| No auth | Single implicit household; no user accounts |
| No reminders | No notifications for upcoming deadlines |
| No timeline view | Dashboard only; no visual timeline |
| No data export | Cannot backup or export card data |
| No action recommendations | No "close / downgrade / keep" suggestions |
| No reward tracking | Cannot track rewards earned per card |
| Requires Node.js 18+ | May not work on older environments |
| `@radix-ui/react-checkbox` not installed | Checkbox in CardForm requires this package |

## Sprint 1 Environment Variables

Sprint 1 requires no environment variables. The `.env.example` file documents the template for future sprints.

---

## Suggested QA Script Commands

```bash
# Verify build passes
cd development/src && npm run build

# Verify TypeScript (no errors)
cd development/src && npx tsc --noEmit

# Verify lint
cd development/src && npm run lint

# Run setup script twice (idempotency check)
./development/scripts/setup-local.sh
./development/scripts/setup-local.sh
```
