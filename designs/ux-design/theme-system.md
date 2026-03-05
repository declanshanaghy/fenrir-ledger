# Fenrir Ledger -- Theme System

## Theme Architecture

Fenrir Ledger supports three theme modes: **Dark** (Norse war-room), **Light** (Norse parchment), and **System** (follows OS `prefers-color-scheme`).

### How It Works

- **CSS custom properties** define all colors in two blocks:
  - `:root` -- light palette (Norse parchment)
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
- **Light** (Sun icon) -- Norse parchment aesthetic
- **Dark** (Moon icon) -- Norse war-room aesthetic
- **System** (Monitor icon) -- follows OS preference

Default on fresh visit: **System**.

---

## Light Palette (Norse Parchment)

| Token | HSL | Hex (approx) | Description |
|-------|-----|--------------|-------------|
| `--background` | `36 33% 88%` | `#e8dcc8` | Warm parchment |
| `--foreground` | `25 30% 12%` | `#2a1f14` | Deep brown-black |
| `--card` | `35 30% 83%` | `#ddd0b8` | Lighter parchment |
| `--popover` | `37 35% 90%` | `#ede2d0` | Warm cream |
| `--primary` | `42 80% 38%` | `#ae8510` | Darker gold for light bg |
| `--primary-foreground` | `37 35% 95%` | -- | Light text on gold |
| `--secondary` | `28 20% 72%` | `#c4b5a0` | Leather tan |
| `--muted` | `30 15% 65%` | `#b0a494` | Faded leather |
| `--muted-foreground` | `25 12% 42%` | `#6b5f52` | Dark stone |
| `--border` | `28 18% 65%` | `#b5a590` | Leather seam |
| `--input` | `25 12% 78%` | `#ccc2b4` | Light stone |
| `--ring` | `42 80% 38%` | -- | Gold focus ring |
| `--destructive` | `15 85% 42%` | -- | Blood orange |

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

### Light Theme

| Pair | Ratio | WCAG Level |
|------|-------|------------|
| Foreground `#2a1f14` on parchment `#e8dcc8` | ~10.5:1 | AA + AAA |
| Gold `#ae8510` on parchment `#e8dcc8` | ~3.6:1 | AA (large/bold text) |
| Muted fg `#6b5f52` on parchment `#e8dcc8` | ~3.6:1 | AA (large/bold text) |

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
| Realm Status | `--realm-*` | Status ring and urgency indicator colors |

All groups have values in both `:root` and `.dark` blocks.

---

## File Reference

| File | Role |
|------|------|
| `globals.css` | CSS variable definitions (`:root` + `.dark`) |
| `tailwind.config.ts` | Tailwind token-to-variable mappings |
| `layout.tsx` | ThemeProvider wrapper |
| `ThemeToggle.tsx` | Three-way toggle component |
| `TopBar.tsx` | Toggle integration (both auth states) |
