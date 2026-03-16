# Interaction Spec: Trash Tab — Issue #1127

Wireframe: [trash-tab.html](trash-tab.html)

## Overview

The Trash tab is the rightmost tab in DashboardTabs. It surfaces cards with `deletedAt` set
(soft-deleted), allowing users to restore them to active or expunge them permanently from
localStorage. Trash data is **always local** — only restored cards may sync to Firestore.

Tier access:
- **Thrall**: Tab visible, click triggers `KarlUpsellDialog` — tab stays unselected.
- **Free Trial**: Full access + Karl bling (softer gold intensity).
- **Karl**: Full access + Karl bling (full gold intensity).

---

## 1. Tab Navigation

### Tab placement
The Trash tab is added at the extreme right of the `DashboardTabs` tab bar.

```
[ᚲ The Howl | n] [ᛉ Active | n] [ᛞ Trash | n]
                                  ^^ new tab ^^
```

### Tab selection state machine

```
State: activeTab = "howl" | "active" | "trash"

(Karl/trial) Click Trash tab
  → setActiveTab("trash")
  → render TrashView panel

(Thrall) Click Trash tab
  → DO NOT setActiveTab("trash")
  → setTrashUpsellOpen(true) → KarlUpsellDialog opens
  → tab remains visually unselected

Arrow key ← / →
  → cycles through all three tabs (wraps at ends)
  → Home key: jump to "howl"
  → End key: jump to "trash"
  → Matches existing handleTabKeyDown behavior in DashboardTabs
```

### Keyboard navigation (Arrow keys cycle all 3 tabs)

The existing `handleTabKeyDown` in `DashboardTabs.tsx` must be extended to handle the
third tab. Currently navigates between `["howl", "active"]` — extend to
`["howl", "active", "trash"]`.

---

## 2. Restore Flow

### Trigger
User clicks "ᚢ Restore" button on a trash card row.

### Steps
```
1. User clicks Restore on card X
2. NO confirmation dialog — restore is non-destructive, immediately reversible
3. restoreCard(householdId, card.id) — clears card.deletedAt in localStorage
4. Card disappears from TrashView (no longer has deletedAt)
5. Card reappears in Active or Howl tab (depending on its status)
6. If tier === "karl": trigger existing cloud sync for card X
   If tier === "trial" or "thrall": no sync (Thrall can't reach here)
7. Toast notification (optional, implementation decision):
   "[Card name] restored" — brief, bottom of screen
```

### Data contract
- Input: `householdId: string`, `cardId: string`
- Action: set `card.deletedAt = undefined` in localStorage record
- Output: updated card (no deletedAt), cloud sync if Karl

### Cloud sync behavior
| Tier | Sync on restore? |
|---|---|
| Thrall | N/A (blocked by upsell) |
| Free Trial | No — trial is local-only |
| Karl | Yes — same sync mechanism as card create/update |

---

## 3. Expunge Single Card Flow

### Trigger
User clicks "ᛟ Expunge" button on a trash card row.

### Steps
```
1. User clicks Expunge on card X
2. Expunge confirmation dialog opens (Section D in wireframe)
   - Dialog title: "Expunge [Card Name]?"
   - Dialog aria-label: "Expunge confirmation"
   - Focus lands on "Cancel" button (autofocus)
3a. User clicks "Cancel" / presses ESC / clicks backdrop
    → dialog closes, NO action taken
    → focus returns to the Expunge button that opened the dialog
3b. User clicks "ᛟ Expunge Forever"
    → expungeCard(householdId, card.id)
    → removes card record entirely from localStorage (no deletedAt — record gone)
    → card disappears from TrashView
    → dialog closes
    → focus moves to next card in list, or to Empty Trash button if list is now empty,
      or to tab bar if all cards are gone
```

### Data contract
- Input: `householdId: string`, `cardId: string`
- Action: delete card record from localStorage array entirely
- Output: localStorage updated, card gone — no cloud call, no undo

### Irreversibility note
Expunge is permanent and local. No undo. No cloud record is touched.
Clarified in dialog body: "Cloud records (if any) are not affected — only this device's local storage will be cleared."

---

## 4. Empty Trash Flow

### Trigger
User clicks "ᛞ Empty Trash" button in the TrashView header.

### Precondition
Button is only rendered when `trashedCards.length > 0`. If trash is empty, button is
not present in the DOM.

### Steps
```
1. User clicks "Empty Trash" button
2. Empty Trash confirmation dialog opens (Section E in wireframe)
   - Dialog title: "Empty the Void?"
   - Shows count: "N deleted cards will be permanently removed"
   - Focus lands on "Cancel" (autofocus)
3a. User clicks "Cancel" / ESC / backdrop
    → dialog closes, NO action
    → focus returns to "Empty Trash" button
3b. User clicks "ᛞ Empty Trash (N)"
    → expungeAllCards(householdId) — removes all cards with deletedAt from localStorage
    → TrashView transitions to empty state (Section C in wireframe)
    → dialog closes
    → focus moves to TrashView empty state heading or tab bar
```

### Data contract
- Input: `householdId: string`
- Action: filter out all cards with `deletedAt` from localStorage household record
- Output: localStorage updated, all deleted cards gone — no cloud call

---

## 5. Thrall Upsell Flow

### Trigger
Thrall user clicks the Trash tab.

### Steps
```
1. User clicks Trash tab (opacity 0.65, lock glyph ᛜ visible)
2. onClick handler fires
3. Check tier: tier === "thrall" → intercept, do NOT call setActiveTab("trash")
4. setTrashUpsellOpen(true) → KarlUpsellDialog opens with Trash props
5. Tab remains visually unselected (aria-selected stays false)
6. User dismisses dialog ("Not now" / ESC / backdrop / ✕)
   → KarlUpsellDialog closes, setTrashUpsellOpen(false)
   → focus returns to Trash tab button
7. User clicks "Upgrade to Karl"
   → existing KarlUpsellDialog CTA flow (POST /api/stripe/checkout)
```

### KarlUpsellDialog props
```typescript
<KarlUpsellDialog
  featureIcon="ᛞ"
  featureName="Trash"
  featureTagline="Where Forgotten Cards Rest"
  featureTeaser="Retrieve deleted cards before they vanish, or banish them from the ledger forever."
  featureBenefits={[
    "Restore deleted cards to active",
    "Expunge cards permanently",
    "Bulk empty trash",
    "Local-first — your data, your device",
  ]}
  featureImage="trash"
  open={trashUpsellOpen}
  onOpenChange={setTrashUpsellOpen}
/>
```

Note: `featureImage="trash"` requires new artwork assets:
- `/public/images/features/trash-dark.png`
- `/public/images/features/trash-light.png`
These follow the same ThemedFeatureImage pattern as valhalla, howl, velocity.

---

## 6. Data Model

### deletedAt cards in localStorage
Cards with `deletedAt` are **already** supported in the storage layer (added in schema v2).
They are currently filtered out of all public-facing queries.

The Trash feature exposes them through a new query:
```typescript
// New function needed in storage.ts
function getDeletedCards(householdId: string): Card[]
// Returns: cards where deletedAt is truthy, sorted by deletedAt DESC
```

### Trash data is always local
Trash state (which cards are deleted, when) lives exclusively in localStorage.
- `deletedAt` is **never** synced to Firestore.
- When a card is restored: `deletedAt` is cleared, and the restored card (without deletedAt)
  may sync to Firestore (if Karl tier).
- When a card is expunged: it is removed from localStorage entirely. No Firestore call.

### Restore sync behavior
```
restoreCard(householdId, cardId):
  1. Find card in localStorage by id
  2. Set card.deletedAt = undefined
  3. Persist to localStorage
  4. Return updated card
  → Caller (TrashView or Dashboard) triggers cloud sync if tier === "karl"
```

---

## 7. Animation Spec

### Trash card removed after Restore or Expunge
Use Framer Motion `AnimatePresence` (same as active card removal — "Sent to Valhalla"):

```tsx
<AnimatePresence>
  {trashedCards.map(card => (
    <motion.div
      key={card.id}
      initial={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <TrashCard card={card} ... />
    </motion.div>
  ))}
</AnimatePresence>
```

After exit animation, card is gone from list. If last card exits → empty state fades in.

### Empty state entrance
```tsx
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
>
  <TrashEmptyState />
</motion.div>
```

### Reduced motion
All animations must respect `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  .trash-card-exit { animation: none; transition: none; }
}
```

---

## 8. Accessibility (WCAG 2.1 AA)

### Tab bar
- `role="tablist"` on container
- Each tab: `role="tab"`, `aria-selected`, `aria-controls="panel-trash"`
- Tab panel: `role="tabpanel"`, `aria-labelledby="tab-trash"`
- Arrow key navigation cycles all three tabs

### Thrall lock glyph
- ᛜ appended after "Trash" label in Thrall tab
- `aria-hidden="true"` on the glyph span
- `aria-label="Trash — upgrade to Karl to access"` on the tab button

### Trash card list
- Each card: `<article>` element with `aria-label="Deleted card: [Name], deleted [date]"`
- Restore button: `aria-label="Restore [Card Name] — move back to active cards"`
- Expunge button: `aria-label="Expunge [Card Name] — permanently delete from this device"`
- Rune corners: `aria-hidden="true"` (decorative)

### Confirmation dialogs
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`
- Focus trap: Tab/Shift-Tab cycle within dialog only
- Focus on open: "Cancel" button (autofocus) — safer default
- ESC closes dialog without action
- On close: focus returns to the button that triggered the dialog

### Empty state
- Empty state container: `aria-label="Trash is empty"`
- Heading: standard `<p>` or `<h2>` — not aria-live (not a dynamic update)

### Count badge
- `aria-label="N deleted cards"` (not just the number)
- When 0: `aria-label="0 deleted cards"`, `opacity-40` visual treatment

---

## 9. Responsive Breakpoints

| Viewport | Trash card layout | Header layout | Tab labels |
|---|---|---|---|
| ≥1024px | Row: body left, actions right (column) | Row: title left, Empty Trash right | Full ("The Howl", "Active", "Trash") |
| 600–1024px | Row: body left, actions right (column) | Row: title + subtitle, Empty Trash below | Full labels |
| <600px (375px+) | Column: body top, actions row (Restore+Expunge side-by-side, flex:1) | Column: title, subtitle, Empty Trash full-width | Short ("Howl", "Active", "Trash") |

---

## 10. Component Summary

| Component | Change Type | File |
|---|---|---|
| `DashboardTabs.tsx` | Modify — add trash tab, extend TabId, intercept Thrall click | `src/components/dashboard/DashboardTabs.tsx` |
| `TrashView.tsx` | New — card list, empty state, header, confirmation dialogs | `src/components/dashboard/TrashView.tsx` |
| `storage.ts` | Modify — add getDeletedCards, restoreCard, expungeCard, expungeAllCards | `src/lib/storage.ts` |
| `karl-bling.css` | Modify — add trash tab + trash card bling rules | `src/styles/karl-bling.css` (or equivalent) |
| KarlUpsellDialog | No change — called with new Trash props from DashboardTabs | `src/components/entitlement/KarlUpsellDialog.tsx` |
| Feature artwork | New — trash-dark.png, trash-light.png | `public/images/features/` |
| `types.ts` | No change — `deletedAt?: string` already exists on Card | `src/lib/types.ts` |

No new pages. No new routes. No Firestore schema changes. Trash is entirely local.
