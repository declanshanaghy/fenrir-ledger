# Interaction Spec: Anon Cards Empty State — Sign-in CTA
**Issue:** #1748
**Wireframe:** [wireframes/cards/anon-empty-state.html](anon-empty-state.html)

---

## User Flow

```mermaid
flowchart TD
    A([User lands on /ledger]) --> B{Auth status?}
    B -->|authenticated| C{Card count?}
    B -->|anonymous| D{Card count?}
    B -->|loading| E[Show skeleton / null]

    C -->|0 cards| F[EmptyState — unchanged\nImport + Add Card]
    C -->|1+ cards| G[Dashboard tabs\nSignInNudge hidden]

    D -->|0 cards| H[AnonEmptyState\nSign-in primary + Add locally secondary]
    D -->|1+ cards| I[Dashboard tabs\nSignInNudge full banner shown]

    H --> J{User action?}
    J -->|Click primary CTA\n"Start free 30-day trial"| K[router.push buildSignInUrl pathname\nNavigates to /ledger/sign-in?returnTo=/ledger]
    J -->|Click secondary CTA\n"Add a card locally"| L[Navigate to /ledger/cards/new\nSame as current Add Card link]
    J -->|No action| M[Page remains, no auto-redirect]
```

---

## State Machine: AnonEmptyState

| Trigger | Action | Notes |
|---|---|---|
| Page load, status=anonymous, cards=0 | Render AnonEmptyState | No loading delay — renders immediately once status resolves |
| Click "Start your free 30-day trial" | `router.push(buildSignInUrl(pathname))` | Matches pattern in SignInNudge.tsx — preserves returnTo |
| Click "Add a card locally" | Navigate to `/ledger/cards/new` | Same href as current EmptyState "Add Card" Link |
| User completes sign-in (auth callback) | Redirect back to /ledger | returnTo param preserved through OAuth flow |
| User adds a card locally then later signs in | Merge flow | Existing merge flow unchanged |

---

## Primary CTA: Sign-in Navigation

```
onClick → router.push(buildSignInUrl(pathname))
```

- `buildSignInUrl` from `@/lib/auth/sign-in-url` — already used by SignInNudge
- `pathname` = `/ledger` (current route)
- Produces: `/ledger/sign-in?returnTo=%2Fledger` (or equivalent)
- After OAuth callback, user is redirected back to `/ledger`
- No special handling needed — auth callback already processes returnTo

---

## Secondary CTA: Add Card Locally

```
<Link href="/ledger/cards/new">Add a card locally</Link>
```

- Same destination as the current EmptyState "Add Card" button
- Renders as an `<a>` element (Next.js Link)
- No modal, no confirmation — direct navigation
- After adding a card, user returns to `/ledger` with 1 card — AnonEmptyState replaced by Dashboard tabs + SignInNudge banner

---

## SignInNudge: hasCards=false Branch Removal

The `!hasCards` early-return branch in `SignInNudge.tsx` (lines 66–78) is removed.

**Before (removed):**
```tsx
if (!hasCards) {
  return (
    <p className="text-center text-sm text-muted-foreground/70 ...">
      <button onClick={() => router.push(buildSignInUrl(pathname))}>
        Sign in to sync your data — start your free 30-day trial
      </button>
    </p>
  );
}
```

**After:** The `!hasCards` branch is deleted. `SignInNudge` returns `null` for all anonymous users with zero cards. The `hasCards=true` full banner is untouched.

---

## Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| Mobile < 600px | CTA group stretches to full content width (minus 32px padding). Heading 20px. Footnotes 11px. |
| Tablet 600–1024px | CTA group centered, max-width 320px. Heading 22px. |
| Desktop > 1024px | CTA group centered, max-width 320px. Heading 24px. |

CTA group is always vertically stacked (column flex). No side-by-side layout at any breakpoint — the two CTAs are not equal in weight, and horizontal layout risks visual equivalence.

---

## Animation / Motion

- No entrance animation required for the empty state itself — it replaces content, not a panel
- If the existing EmptyState uses a CSS class with an entrance fade, apply the same class to AnonEmptyState for consistency
- `@media (prefers-reduced-motion: reduce)`: skip any entrance transitions

---

## Copy

| Element | Copy |
|---|---|
| Hero heading | "Before Gleipnir was forged, Fenrir roamed free." (unchanged) |
| Hero subtext | "Before your first card is added, no chain can be broken." (unchanged) |
| Primary CTA | "Start your free 30-day trial" |
| Primary footnote | "Sign in to sync cards, access all devices & unlock Karl." |
| Divider | "or" |
| Secondary CTA | "Add a card locally" |
| Secondary footnote | "No account needed — cards are stored on this device only." |

Copy rationale:
- "Start your free 30-day trial" leads with value (trial) over friction (sign in)
- "Add a card locally" is honest about the limitation — "locally" signals data won't sync
- Footnotes carry the decision context below the buttons, not inside them, keeping buttons scannable

---

## Component Summary

| File | Change |
|---|---|
| `components/dashboard/AnonEmptyState.tsx` | **New** — anon-specific empty state with sign-in primary CTA |
| `components/dashboard/Dashboard.tsx` | **Modify** — in zero-cards early return, check auth status and render AnonEmptyState for anon, EmptyState for authenticated |
| `components/layout/SignInNudge.tsx` | **Modify** — remove the `!hasCards` early-return branch (lines 66–78) |
| `components/dashboard/EmptyState.tsx` | **Unchanged** — continues to serve authenticated zero-card state |

---

## Acceptance Criteria Mapping

| AC | Wireframe Section |
|---|---|
| Primary CTA prominently encourages sign-in / start trial | Section B — btn-primary hierarchy |
| Secondary option allows adding a card without signing in | Section B — btn-secondary + Section G matrix |
| Visual hierarchy makes the sign-in path clearly primary | Section B — hierarchy annotation, Section F component notes |
| Mobile-friendly layout (min 375px) | Section C — mobile frame |
| Luna wireframe approved before engineering begins | This document + anon-empty-state.html |
