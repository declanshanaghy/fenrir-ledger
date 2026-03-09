# Interaction Spec — Profile Dropdown Redesign
**Issue:** #434
**Branch:** fix/issue-434-profile-dropdown-redesign
**Component:** `ProfileDropdown` in `LedgerTopBar.tsx`
**Wireframe:** `ux/wireframes/chrome/profile-dropdown-redesign.html`

---

## Problem

After the sidebar removal (#403), the profile dropdown has inconsistent icon placement:

| Row | Current state | Problem |
|---|---|---|
| Theme | Label (left) + three toggle icons (right) | Icon(s) on wrong side; multiple icons break pattern |
| Settings | Gear icon + label (left) + chevron icon (right) | Icons on both sides |
| Sign out | Text only | Missing icon entirely |

**Odin's direction:** Icons on LEFT only. Every row: icon + label. No right-side elements.

---

## Design Decisions

### 1. Consistent Row Pattern
Every action row follows a single pattern:

```
[ icon ] [ label ]
```

- Icon: LEFT, `h-4 w-4` (16px), `aria-hidden="true"`, `flex-shrink: 0`
- Label: text only, `font-body`, `text-muted-foreground`
- Gap: `gap-2` (8px) between icon and label
- Padding: `px-4 py-3`
- Min height: 44px (touch target compliance)
- **No right-side icons, chevrons, or secondary controls**

### 2. Theme Row — Single Rotary Icon
- Replace three-icon toggle cluster with a **single icon** that reflects current theme state
- Icon cycles: `Sun` (light) → `Moon` (dark) → `Monitor` (system) → `Sun` …
- Label: always reads "Theme" (static)
- Click: advances to next theme state (existing ThemeToggle logic)
- The `<ThemeToggle variant="icon" />` component already renders a single cycling icon — wrap it in the new row layout

**ARIA:** `aria-label="Toggle theme, current: Light"` (updates dynamically to Dark / System)

### 3. Settings Row — Remove Chevron
- Keep: `Settings` icon (lucide: `Settings`) on LEFT
- Keep: `Settings` label
- **Remove:** `ChevronRight` icon from right side
- Active state (when `pathname === "/ledger/settings"`): `text-gold` applies to both icon and label
- `role="menuitem"`, `onClick` navigates to `/ledger/settings` then closes dropdown

### 4. Sign Out Row — Add Icon
- Add: `LogOut` icon (lucide: `LogOut`) on LEFT
- Keep: `Sign out` label
- `role="menuitem"`, `onClick` calls `onSignOut()` then closes dropdown
- Color: `text-muted-foreground`, hover: `text-foreground`

### 5. User Info Header — Unchanged
The header (avatar + name + email + tagline) remains structurally identical:
- Not interactive (`aria-hidden="true"`)
- `Avatar` size={40} with `goldRing`
- Name: `font-heading`, `text-foreground`
- Email: `font-mono`, `text-muted-foreground`
- Tagline: italic, `text-muted-foreground/60`
- Separated from action rows by `border-b border-border`

---

## Theme Toggle Placement Change

**Current:** `ThemeToggle variant="icon"` appears BOTH in the topbar controls cluster AND inside the dropdown.

**Redesigned:** Theme toggle lives **only inside the dropdown**. The standalone `<ThemeToggle variant="icon" />` in the topbar right cluster should be **removed when the user is signed in**, since theme control is accessible via the dropdown.

> **Note to engineer:** Verify whether the topbar ThemeToggle should be removed entirely for signed-in users, or retained as a convenience. Odin's direction implies dropdown-only. Confirm with product before removing.

---

## Interaction Flows

### Open Dropdown
1. User clicks avatar button in topbar
2. `panelOpen` state → `true`
3. `ProfileDropdown` renders with `role="menu"`
4. Focus moves to first `menuitem` (Theme row)

### Close Dropdown
Triggers:
- Click outside panel (`mousedown` outside `panelRef`)
- Press `Escape`
- Activate any menu item (Settings or Sign out)

On close:
- `panelOpen` → `false`
- Focus returns to avatar trigger button

### Theme Cycle (inside dropdown)
1. User clicks Theme row
2. ThemeToggle advances to next state (light → dark → system → light)
3. Icon updates to reflect new state
4. Dropdown **stays open** (theme toggle does not close the dropdown)
5. `aria-label` on the row updates to reflect new state

### Navigate to Settings
1. User clicks Settings row
2. `onClose()` called → dropdown closes, focus returns to trigger
3. `router.push("/ledger/settings")` navigates
4. On `/ledger/settings`: Settings row renders with `text-gold` active state

### Sign Out
1. User clicks Sign out row
2. `onClose()` called → dropdown closes
3. `onSignOut()` called → auth session cleared
4. User redirected (per existing sign-out flow)

---

## Keyboard Navigation

| Key | Behavior |
|---|---|
| `Tab` / `Shift+Tab` | Move focus between menu items |
| `Enter` / `Space` | Activate focused menu item |
| `Escape` | Close dropdown, return focus to avatar trigger |
| `Arrow Down` / `Arrow Up` | (Optional enhancement) Move between menu items |

---

## Mobile Behavior (375px minimum)

- Dropdown width: 256px (`w-64`) — unchanged
- Right-aligned to viewport edge; fits within 375px (16px padding each side = 343px usable)
- All touch targets: 44px minimum height — already enforced by `style={{ minHeight: 44 }}`
- Topbar layout unchanged; dropdown position: `absolute right-0 top-full mt-2`
- No horizontal scroll at 375px

---

## Lucide Icon Reference

| Row | Icon name | Lucide import |
|---|---|---|
| Theme (light) | Sun | `import { Sun } from "lucide-react"` |
| Theme (dark) | Moon | `import { Moon } from "lucide-react"` |
| Theme (system) | Monitor | `import { Monitor } from "lucide-react"` |
| Settings | Settings | `import { Settings } from "lucide-react"` — already imported |
| Sign out | LogOut | `import { LogOut } from "lucide-react"` |

Note: `ChevronRight` import should be **removed** from `LedgerTopBar.tsx` after this change (currently imported but will be unused).

---

## Implementation Checklist (for FiremanDecko)

- [ ] Update `ProfileDropdown` component in `LedgerTopBar.tsx`
- [ ] Theme row: replace `justify-between` layout with `flex items-center gap-2` + `<ThemeToggle variant="icon" />` on left
- [ ] Settings row: remove `<ChevronRight>`, change layout to `flex items-center gap-2`, remove `justify-between`
- [ ] Sign out row: add `<LogOut className="h-4 w-4" aria-hidden="true" />` on left, `flex items-center gap-2`
- [ ] Remove `ChevronRight` from lucide import
- [ ] Add `LogOut` to lucide import
- [ ] Verify active state (text-gold) applies to Settings icon + label together
- [ ] Verify Theme row: dropdown stays open after theme cycle
- [ ] Verify touch targets: all rows ≥ 44px height
- [ ] Verify at 375px: no overflow, dropdown fits
- [ ] Confirm with product: remove standalone ThemeToggle from topbar when signed in?

---

*Luna UX — Interaction Spec · Issue #434*
