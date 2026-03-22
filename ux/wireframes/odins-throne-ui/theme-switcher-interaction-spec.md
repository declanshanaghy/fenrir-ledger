# Interaction Spec — Monitor UI Theme Switcher
**Issue:** #964
**Author:** Luna (UX Designer)
**Wireframe:** `ux/wireframes/monitor-ui/theme-switcher.html`

---

## 1. User Flow

```
User opens monitor UI
  └─ JS reads localStorage("fenrir-odins-throne-theme")
       ├─ "light" → apply data-theme="light" to <html>
       └─ "dark" / null → default dark (no attribute on <html>)

User clicks "Light" button
  ├─ Set data-theme="light" on <html>
  ├─ Write localStorage.setItem("fenrir-odins-throne-theme", "light")
  ├─ Swap Odin portrait: odin-dark.png → odin-light.png
  └─ Update aria-pressed on both buttons

User clicks "Dark" button
  ├─ Remove data-theme attribute from <html> (or set to "dark")
  ├─ Write localStorage.setItem("fenrir-odins-throne-theme", "dark")
  ├─ Swap Odin portrait: odin-light.png → odin-dark.png
  └─ Update aria-pressed on both buttons
```

---

## 2. Mermaid Flow Diagram

```mermaid
flowchart TD
    A[Page Load] --> B{localStorage\nfenrir-odins-throne-theme}
    B -- '"light"' --> C[Set html data-theme=light\nSwap to odin-light.png\nLight btn aria-pressed=true]
    B -- '"dark" or null' --> D[Default: no data-theme attr\nKeep odin-dark.png\nDark btn aria-pressed=true]

    C --> E[UI Renders in Light Theme]
    D --> F[UI Renders in Dark Theme]

    E --> G{User clicks Dark btn}
    F --> H{User clicks Light btn}

    G --> I[Remove data-theme attr\nSwap to odin-dark.png\nWrite 'dark' to localStorage\nDark btn aria-pressed=true]
    H --> J[Set data-theme=light\nSwap to odin-light.png\nWrite 'light' to localStorage\nLight btn aria-pressed=true]

    I --> F
    J --> E
```

---

## 3. Component Specification

### `ThemeSwitcher.tsx`

**Location:** `development/odins-throne-ui/src/components/ThemeSwitcher.tsx`

**Props:** None (reads/writes via `useTheme` hook)

**Rendered HTML:**
```html
<div role="group" aria-label="Choose theme" class="theme-switcher">
  <button
    class="theme-btn"
    aria-pressed="true|false"
    onClick={setLight}
  >
    ☀ Light
  </button>
  <button
    class="theme-btn"
    aria-pressed="true|false"
    onClick={setDark}
  >
    ☽ Dark
  </button>
</div>
```

**Placement:** Inside `<div class="sidebar-header">`, after the `.quote` div and before the `.count` div.

---

### `useTheme.ts`

**Location:** `development/odins-throne-ui/src/hooks/useTheme.ts`

**localStorage key:** `fenrir-odins-throne-theme`
**Values:** `"light"` | `"dark"` (default when absent = dark)

**Behavior:**
1. On mount: read key → apply `data-theme` attribute to `document.documentElement`
2. `setTheme("light")`: set `document.documentElement.dataset.theme = "light"`, write to localStorage
3. `setTheme("dark")`: delete `document.documentElement.dataset.theme` (or set to `"dark"`), write to localStorage

**Returned shape:**
```ts
{
  theme: "light" | "dark",
  setTheme: (t: "light" | "dark") => void,
}
```

---

## 4. CSS Variable Strategy

### Selector structure in `index.css`

```css
/* ── DARK THEME (default) ── */
:root {
  --void: #07070d;
  --forge: #12121f;
  /* … all existing dark variables … */
}

/* ── LIGHT THEME override ── */
[data-theme="light"] {
  --void:       #f7fafc;   /* body bg     — globals.css --background: 210 40% 98% */
  --forge:      #ffffff;   /* sidebar bg  — globals.css --card: 0 0% 100% */
  --chain:      #f1f7fa;   /* card hover  — globals.css --input: 210 40% 96% */
  --gold:       #8f6e0e;   /* accent gold — globals.css --primary: 38 80% 28% */
  --gold-bright: #d97706;  /* bright gold — globals.css --realm-hati: 38 92% 42% */
  --text-saga:  #0f1419;   /* primary txt — globals.css --foreground: 220 40% 8% */
  --text-rune:  #475569;   /* sec. text   — globals.css --muted-foreground: 215 20% 35% */
  --text-void:  #94a3b8;   /* tertiary    — derived */
  --rune-border: #d0dce5;  /* borders     — globals.css --border: 214 32% 88% */
  --teal-asgard: #077558;  /* status teal — globals.css --realm-asgard: 163 83% 25% */
  --mayo-red:   #CF2734;   /* unchanged — readable on white */
  --mayo-green: #005a00;   /* darkened for white bg */
  --mayo-red-dim:   #8b1a22;
  --mayo-green-dim: #004400;
  --kildare-blue: #1E3A8A; /* unchanged — already dark */
  --kildare-white: #1a1a2e; /* inverted for light bg */
  --kildare-blue-bright: #2563eb;
  --kildare-blue-dim: #dbeafe;
}
```

### Body transition

```css
body {
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}
```

**Note:** Only transition `background`, `color`, and `border-color`. Do NOT use `transition: all` — avoids flickering layout properties.

---

## 5. Theme-Aware Elements

All elements below respond automatically via CSS variable cascade when `data-theme="light"` is set on `<html>`:

| Element | Dark value | Light value |
|---------|-----------|-------------|
| `body` background | `--void` (#07070d) | `--void` (#f7fafc) |
| `.sidebar` background | `--forge` (#12121f) | `--forge` (#ffffff) |
| `.card:hover`, `.card.active` | `--chain` (#1a1a2e) | `--chain` (#f1f7fa) |
| `.sidebar-header h1` | `--gold` | `--gold` (dark burnt) |
| `.sidebar-header .quote` | `--text-rune` | `--text-rune` (#475569) |
| `.card-meta` | `--text-rune` | `--text-rune` (#475569) |
| Log terminal text | `--text-saga` | `--text-saga` (#0f1419) |
| `ev-assistant-text` | `--mayo-green` | `--mayo-green` (#005a00) |
| Tool call block borders | `--kildare-blue` | unchanged |
| `.ws-badge.open` | `--teal-asgard` | `--teal-asgard` (#077558) |
| All borders | `--rune-border` | `--rune-border` (#d0dce5) |
| Profile image (`<img>`) | `odin-dark.png` | `odin-light.png` |

---

## 6. Profile Image Swap

The sidebar brand avatar and job card avatars reference agent portrait images.

**Strategy:** Use a data attribute or conditional React render:

```tsx
// Sidebar brand avatar
<img
  src={theme === "light" ? "/odin-light.png" : "/odin-dark.png"}
  alt="Odin"
  aria-hidden="true"
/>
```

**Fallback (if odin-light.png is not yet available):**
```css
[data-theme="light"] .sidebar-header img {
  filter: brightness(0.15) sepia(1) hue-rotate(10deg);
}
```
This produces a dark-on-light silhouette from the existing dark image. Not ideal — flag in PR and request `odin-light.png` from design/assets pipeline.

---

## 7. Animation / Transition Behavior

| Behavior | Spec |
|----------|------|
| Theme switch transition | `background 0.2s ease, color 0.2s ease, border-color 0.2s ease` on `body` |
| Button active underline | Instant (no transition) — it's a state change, not an animation |
| Profile image swap | Instant (`<img src>` swap) — no cross-fade needed for monitor UI |
| `prefers-reduced-motion` | The body transition should be disabled: `@media (prefers-reduced-motion: reduce) { body { transition: none; } }` |

---

## 8. localStorage Persistence

- **Key:** `fenrir-odins-throne-theme`
- **Value:** `"light"` or `"dark"`
- **Read:** On React app mount (before first render to avoid flash)
- **Write:** Immediately on toggle click
- **Default:** Dark (no value in storage → dark theme)
- **Cross-tab:** Not required for v1. Theme applies to current tab only.

### Flash-of-incorrect-theme (FOIT) prevention

Since this is a Vite/React SPA (not SSR), the simplest approach is to apply the theme attribute in `main.tsx` before React mounts:

```ts
// main.tsx — before ReactDOM.createRoot(...)
const saved = localStorage.getItem("fenrir-odins-throne-theme");
if (saved === "light") {
  document.documentElement.dataset.theme = "light";
}
```

This ensures the correct theme is applied before the first paint.

---

## 9. Acceptance Criteria Mapping

| AC | Design coverage |
|----|----------------|
| Two side-by-side buttons (light/dark) below Odin's quote | Sections 1–4 of wireframe; component anatomy section 5 |
| Dark theme matches main app Saga Ledger dark | Token map: existing `:root` vars unchanged |
| Light theme derived from main app light styles | Section 5 token map + interaction spec section 4 |
| Profile images update with theme | Section 5 image swap + interaction spec section 6 |
| All UI elements respond to theme | Section 5 theme-aware elements table + CSS variable cascade |
| localStorage persistence | Interaction spec section 8 |
| Mobile responsive | Section 4 mobile wireframe + 44px touch target annotation |
