# Fenrir Ledger -- Theme System

## Theme Architecture

Fenrir Ledger supports three theme modes: **Dark** (Norse war-room), **Light** (Stone/Marble), and **System** (follows OS `prefers-color-scheme`).

### How It Works

- **CSS custom properties** define all colors in two blocks:
  - `:root` -- light palette (Stone/Marble — cool, crisp, Nordic daylight)
  - `.dark` -- dark palette (Norse war-room)
- **`next-themes`** manages the class on `<html>`, handles system preference detection, and persists the choice to `localStorage` (key: `fenrir-theme`).
- **Tailwind CSS** is configured with `darkMode: ["class"]`, so the `.dark` class on `<html>` activates dark mode utilities.
- **Semantic Tailwind tokens** (`bg-background`, `text-foreground`, `border-border`, etc.) map to CSS variables, so components automatically adapt.

### ThemeProvider Configuration

```tsx
<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  storageKey="fenrir-theme"
>
```

### Theme Toggle

Three-way toggle in the TopBar dropdown (both anonymous and signed-in states):
- **Light** (Sun icon) -- Stone/Marble aesthetic (cool, crisp, Nordic daylight)
- **Dark** (Moon icon) -- Norse war-room aesthetic
- **System** (Monitor icon) -- follows OS preference

Default on fresh visit: **System**.

---

## Light Palette (Stone/Marble)

| Token | HSL | Hex (approx) | Description |
|-------|-----|--------------|-------------|
| `--background` | `220 10% 95%` | `#f0f1f3` | Cool marble white |
| `--foreground` | `220 20% 10%` | `#14161a` | Ink black |
| `--card` | `220 8% 90%` | `#e2e4e8` | Cooler marble |
| `--popover` | `220 12% 97%` | `#f6f7f8` | Lightest cool white |
| `--primary` | `38 75% 32%` | `#8a6a0a` | Burnt gold for light bg |
| `--primary-foreground` | `220 12% 97%` | -- | Light text on gold |
| `--secondary` | `215 10% 78%` | `#bec2c8` | Cool medium grey |
| `--muted` | `215 8% 85%` | `#d4d7db` | Cool light grey |
| `--muted-foreground` | `215 12% 42%` | `#5e6570` | Cool dark grey |
| `--border` | `215 10% 75%` | `#b8bcc2` | Cool light grey border |
| `--input` | `215 12% 92%` | `#e8eaed` | Cool light grey input |
| `--ring` | `38 75% 32%` | -- | Burnt gold focus ring |
| `--destructive` | `15 85% 42%` | `#c94020` | Blood orange |

---

## Dark Palette (Norse War-Room)

| Token | HSL | Hex (approx) | Description |
|-------|-----|--------------|-------------|
| `--background` | `28 15% 7%` | `#12100e` | Warm charcoal |
| `--foreground` | `40 27% 91%` | `#f0ede4` | Light parchment |
| `--card` | `25 14% 10%` | `#1c1917` | Forge |
| `--popover` | `20 9% 13%` | `#242120` | Chain |
| `--primary` | `42 75% 48%` | `#d4a520` | Brighter gold |
| `--primary-foreground` | `28 15% 7%` | -- | Dark text on gold |
| `--secondary` | `22 8% 20%` | `#3a3530` | Stone border |
| `--muted` | `20 7% 27%` | `#4a4540` | Emphasized border |
| `--muted-foreground` | `30 11% 58%` | `#a09888` | Lighter stone gray |
| `--border` | `22 8% 20%` | `#3a3530` | Stone seam |
| `--input` | `20 7% 27%` | `#4a4540` | -- |
| `--ring` | `42 75% 48%` | -- | Gold focus ring |
| `--destructive` | `22 88% 41%` | `#c94a0a` | Muspelheim fire |

---

## WCAG Contrast Ratios

### Dark Theme

| Pair | Ratio | WCAG Level |
|------|-------|------------|
| Gold `#d4a520` on charcoal `#12100e` | ~6.9:1 | AA + AAA |
| Muted `#a09888` on card `#1c1917` | ~4.8:1 | AA |
| Foreground `#f0ede4` on background `#12100e` | ~15:1 | AAA |

### Light Theme (Stone/Marble)

| Pair | Ratio | WCAG Level |
|------|-------|------------|
| Ink black `#14161a` on marble `#f0f1f3` | ~15.2:1 | AA + AAA |
| Burnt gold `#8a6a0a` on marble `#f0f1f3` | ~5.8:1 | AA |
| Cool grey `#5e6570` on marble `#f0f1f3` | ~6.9:1 | AA |
| Cool grey `#5e6570` on card `#e2e4e8` | ~6.5:1 | AA |
| Burnt gold `#8a6a0a` on card `#e2e4e8` | ~5.5:1 | AA |
| Blood orange `#c94020` on marble `#f0f1f3` | ~4.8:1 | AA |

---

## Design Rules for Future Features

### MUST

1. **Use semantic Tailwind classes** -- `bg-background`, `text-foreground`, `border-border`, `bg-card`, `text-muted-foreground`, etc. Never hardcode hex values in component files.

2. **Use CSS variables for custom color tokens** -- If a component needs a color not covered by the semantic tokens, define a CSS variable in `globals.css` with values in both `:root` (light) and `.dark` (dark) blocks.

3. **Test in both themes** -- Every new component must be visually verified in both light and dark modes before shipping.

4. **Maintain WCAG AA contrast** -- All text must meet at least 4.5:1 contrast ratio on its background in both themes. Large text (18px+ or 14px+ bold) must meet at least 3:1.

### MUST NOT

1. **Never use the `dark:` Tailwind prefix** -- The CSS variable system handles both themes automatically. Using `dark:` creates a parallel, unmaintainable color system.

2. **Never hardcode hex colors in inline styles** -- Use CSS variable references (`hsl(var(--token))`) if inline styles are unavoidable (e.g., SVG attributes).

3. **Never hardcode hex colors in Tailwind arbitrary values** -- Use `bg-[hsl(var(--token))]` instead of `bg-[#hex]`.

### Exceptions

- **Third-party brand colors** (e.g., Google logo `#4285F4`, `#34A853`, `#FBBC05`, `#EA4335`) may remain as hardcoded hex because they are mandated by brand guidelines and do not change with theme.

---

## CSS Variable Groups

Beyond the core shadcn/ui tokens, Fenrir Ledger defines these additional variable groups in `globals.css`:

| Group | Prefix | Purpose |
|-------|--------|---------|
| Easter Egg Modal | `--egg-*` | Backgrounds, borders, text, buttons for the shared easter egg modal |
| LCARS Overlay | `--lcars-*` | Star Trek LCARS overlay colors |
| Konami Howl | `--howl-*` | Wolf silhouette, pulse flash, status band |
| Loki Toast | `--loki-toast-*` | Loki Mode toast notification |
| Realm Status | `--realm-*` | Status ring and urgency indicator colors (see table below) |

All groups have values in both `:root` and `.dark` blocks.

### Realm Status Tokens

Seven `--realm-*` tokens map to the card status system. Each has `:root` (light) and `.dark` values in `globals.css`.

| CSS Variable | Tailwind class | Card Status | Color | Notes |
|---|---|---|---|---|
| `--realm-asgard` | `realm-asgard` | `active` | Teal `#0a8c6e` | Healthy — active card |
| `--realm-hati` | `realm-hati` | `promo_expiring` | Amber `#f59e0b` | Warning — promo ending |
| `--realm-muspel` | `realm-muspel` | `fee_approaching` | Blood orange `#c94a0a` | Danger — fee due |
| `--realm-ragnarok` | `realm-ragnarok` | _(overdue in tailwind.config)_ | Red `#ef4444` | Critical |
| `--realm-ragnarok-dark` | — | — | `#c94020` | Ragnarok accent only |
| `--realm-alfheim` | `realm-alfheim` | `bonus_open` | Teal `#1a99a5` | Opportunity — bonus window |
| `--realm-niflheim` | `realm-niflheim` | `overdue` | Deep red `#aa1919` | Overdue — fee missed |
| `--realm-stone` | — | _(light theme only)_ | Cool grey `#797e87` | Closed status (light) |

**Note on `closed` status**: `badge.tsx` uses Tailwind class `realm-hel` which maps to the **direct color token** `realm.hel = "#8a8578"` in `tailwind.config.ts` (not a CSS variable). This is a static dark-theme value and does not adapt per-theme. `--realm-stone` is defined in `globals.css` but is only consumed via inline styles in components (e.g., `StatusRing.tsx`), not via Tailwind classes. The `realm-alfheim` and `realm-niflheim` Tailwind classes are resolved from CSS variables via component inline styles — they are **not** in the `tailwind.config.ts realm` object.

---

## File Reference

| File | Role |
|------|------|
| `src/app/globals.css` | CSS variable definitions (`:root` + `.dark`) |
| `tailwind.config.ts` | Tailwind token-to-variable mappings |
| `src/app/layout.tsx` | ThemeProvider wrapper |
| `src/components/layout/ThemeToggle.tsx` | Three-way toggle component |
| `src/components/layout/TopBar.tsx` | Toggle integration (both auth states) |
| `src/components/ui/badge.tsx` | Badge variants using realm status tokens |
| `src/components/dashboard/StatusRing.tsx` | Ring component using realm status CSS vars |
| `src/components/dashboard/StatusBadge.tsx` | Badge wrapper with Norse realm tooltip |
