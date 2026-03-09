# Interaction Spec — Issue #403
## Sidebar Removal, Dropdown Settings & Rotary Theme Toggle

**Designer:** Luna
**Date:** 2026-03-09
**Wireframe:** `ux/wireframes/chrome/sidebar-removal-dropdown-settings.html`
**Branch:** fix/issue-403-remove-sidebar-dropdown

---

## 1. Dashboard Layout Changes

### 1.1 Sidebar Removed (Desktop)

- The `<aside>` sidebar (`SideNav.tsx`) is **deleted entirely**.
- No sidebar wrapper (`hidden md:flex`) remains in `LedgerShell.tsx`.
- No collapse toggle button anywhere.
- `localStorage` key `fenrir:sidenav-collapsed` no longer read or written.
- Dashboard `<main>` content spans 100% of the available width below the top bar.
- SSR placeholder in `LedgerShell.tsx` must remove the `hidden md:block w-[220px]` div.

### 1.2 Bottom Tab Bar — Settings Removed (Mobile)

- `LedgerBottomTabs.tsx` removes the 4th tab (Settings → `/ledger/settings`).
- Remaining 3 tabs: **Dashboard** | **Add** | **Valhalla**
- Each tab grows to fill one-third of the tab bar width.
- Touch target per tab: full 56px height × ~33% viewport width — exceeds 44×44px minimum.
- The Settings route (`/ledger/settings`) is **not removed** — it still works, accessed via the profile dropdown.

---

## 2. Profile Dropdown — Menu Item Order & Behavior

### 2.1 Signed-in ProfileDropdown (LedgerTopBar.tsx)

**Menu structure (top to bottom):**

| # | Element | Interaction |
|---|---------|-------------|
| — | Profile header: avatar (40px) + name + email + "The wolf is named." | Static, `aria-hidden`. Not focusable. |
| 1 | **Theme row**: label "Theme" (left) + rotary toggle button (right) | Click rotary icon → advance theme one step. Row itself not a button. |
| 2 | **Settings** (new) | Click → navigate to `/ledger/settings` + close dropdown. `role="menuitem"`. |
| 3 | **Sign out** | Click → sign out + close dropdown. `role="menuitem"`. |

**Settings link specifics:**
- Renders as `<Link href="/ledger/settings">` or a `<button>` that calls `router.push('/ledger/settings')` then `onClose()`.
- Visually matches Sign out row: `px-4 py-3 text-base text-muted-foreground hover:text-foreground hover:bg-secondary/50 font-body`.
- Has a right-arrow indicator (→) on the right side to signal navigation.
- Active state: when `pathname === '/ledger/settings'`, the text/icon receives the gold active color (matches existing nav active pattern).
- `min-height: 44px`.

### 2.2 Anonymous UpsellPromptPanel (TopBar.tsx + LedgerTopBar.tsx)

- Replace the `ThemeToggle` (default inline variant) with `ThemeToggle variant="icon"`.
- No Settings link added here (user is not signed in, Settings not relevant).
- Layout unchanged: "Theme" label left, rotary toggle button right, inside the panel.

### 2.3 Dropdown Dismissal (unchanged behavior)
- Click outside the dropdown container → close.
- Press `Escape` → close, return focus to avatar trigger button.
- Click Settings → close + navigate.
- Click Sign out → close + sign out.

---

## 3. Rotary Theme Toggle

### 3.1 Rotation Order

```
light (Sun ☀) → dark (Moon 🌙) → system (Monitor ⊙) → light (wraps)
```

- Each click advances one step.
- No skip or reverse direction.
- Order matches: `THEME_OPTIONS = [light, dark, system]` in `ThemeToggle.tsx`.

### 3.2 Icon States

| Current theme | Icon | aria-label |
|---------------|------|------------|
| `light` | Sun | "Theme: Light. Click to switch to Dark." |
| `dark` | Moon | "Theme: Dark. Click to switch to System." |
| `system` | Monitor | "Theme: System. Click to switch to Light." |
| undefined/null | Monitor (fallback: system) | "Theme: System. Click to switch to Light." |

- `title` attribute = `"Theme: {current}"` (hover tooltip).
- SSR placeholder: `44×44px` empty div with `aria-hidden` (existing behavior — no change).

### 3.3 Placement Contexts

| Location | File | Variant | Min size | Change needed? |
|----------|------|---------|----------|----------------|
| LedgerTopBar — top bar | `LedgerTopBar.tsx` | `variant="icon"` | 44×44px | **No change** (already uses icon variant) |
| LedgerTopBar — ProfileDropdown | `LedgerTopBar.tsx` | `variant="icon"` ← **change** | 36×36px in row | **Yes** — was inline (3-button) |
| TopBar — ProfileDropdown | `TopBar.tsx` | `variant="icon"` ← **change** | 36×36px in row | **Yes** — was inline (3-button) |
| TopBar — UpsellPromptPanel | `TopBar.tsx` | `variant="icon"` ← **change** | 36×36px in row | **Yes** — was inline (3-button) |
| MarketingNavbar | `MarketingNavbar.tsx` | Inline `NavThemeToggle` | 40×40px | **No change** (already rotary) |

### 3.4 Implementation Path

`ThemeToggle.tsx` already has `variant="icon"` fully implemented with the exact rotary behavior.
No changes to `ThemeToggle.tsx` itself are needed.

The only changes: replace `<ThemeToggle />` (default variant = "inline") with `<ThemeToggle variant="icon" />` in the three locations listed above.

---

## 4. Mobile Bottom Tab Bar Changes

### 4.1 New 3-Tab Layout

| Tab | Route | Icon | Condition |
|-----|-------|------|-----------|
| Dashboard | `/ledger` (no tab param) | LayoutGrid | Always shown |
| Add | `/ledger/cards/new` | Plus | Always shown |
| Valhalla | event dispatch or `/ledger?tab=valhalla` | ↑ rune | Always shown; gated for Thrall (upsell dialog) |

- Settings tab removed entirely.
- `KarlUpsellDialog` remains for Valhalla tab.
- `aria-current="page"` on active tab — same as before.
- Bottom padding `pb-14 md:pb-0` on `<main>` remains (56px bottom tabs still present on mobile).

---

## 5. Route Accessibility

- `/ledger/settings` route continues to function.
- The Settings page is reached via: profile dropdown → Settings link.
- No change to the settings page itself.
- Breadcrumb / back navigation on settings page: unchanged.

---

## 6. LedgerShell.tsx Changes Summary

```
// REMOVE:
import { SideNav } from "./SideNav";
const [collapsed, setCollapsed] = useState(false);
useEffect([localStorage read for STORAGE_KEY]);
const STORAGE_KEY = ...;
function handleToggle() { ... }

// REMOVE from JSX:
<div className="hidden md:flex">
  <Suspense fallback={...}>
    <SideNav collapsed={collapsed} onToggle={handleToggle} />
  </Suspense>
</div>

// REMOVE from SSR placeholder:
<div className="hidden md:block w-[220px] shrink-0 border-r border-border" />

// KEEP:
LedgerTopBar, LedgerBottomTabs, SyncIndicator, KonamiHowl, ForgeMasterEgg,
HeilungModal, GleipnirMountainRoots, Ragnarok overlay, Toaster
```

---

## 7. Acceptance Criteria Cross-Reference

| Acceptance Criterion | Design Decision |
|---------------------|-----------------|
| Sidebar component removed (desktop + mobile) | SideNav.tsx deleted; LedgerShell wrapper div removed |
| No sidebar toggle/hamburger button | Collapse button was inside SideNav — removed with it |
| Dashboard content takes full width | main flex-1 fills entire row (no flex sibling) |
| Settings link in profile dropdown, under theme toggle, above sign out | Section 2.1 above |
| Settings removed from nav references | Bottom tab removed; sidebar link deleted |
| Theme selector is a single rotary click (cycles through all 3) | ThemeToggle variant="icon" everywhere |
| Theme selector matches marketing site pattern | NavThemeToggle in MarketingNavbar is same pattern |
| /ledger/settings route still functions | Route not touched |
| Mobile and desktop layouts work | Sections 1.1, 1.2 above |
| No layout regressions | Only LedgerShell, LedgerBottomTabs, dropdown components touched |
