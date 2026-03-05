# QA Handoff -- Story 1: Theme Foundation + CSS Variables

**Branch:** `feat/theme-foundation`
**Date:** 2026-03-04
**Engineer:** FiremanDecko

## What Was Implemented

### Task: theme-foundation
Installed `next-themes` and restructured the CSS variable system to support both dark and light themes. This is the foundation layer -- no toggle UI yet (that is Story 2).

### Changes summary:
1. Installed `next-themes` package
2. Restructured `globals.css`: `:root` now defines the light (Norse parchment) palette, `.dark` defines the dark (Norse war-room) palette
3. Updated `layout.tsx`: removed hardcoded `"dark"` class, added `suppressHydrationWarning`, wrapped app in `<ThemeProvider>` from next-themes with `defaultTheme="system"` and `storageKey="fenrir-theme"`
4. Converted all hardcoded hex values in CSS animations/shadows to CSS variables (skeleton shimmer, milestone toast, gleipnir shimmer, sealed rune pulse, card-chain hover, myth-link borders, gleipnir copyright tooltip)
5. Removed stray `dark:text-amber-400` prefixed classes from CardTile.tsx (2 instances) and Dashboard.tsx (1 instance)
6. Added theme-aware body background textures (light: lower opacity warm glow; dark: original gold glow + stone grain)

## Files Modified

| File | Description |
|------|-------------|
| `development/frontend/package.json` | Added `next-themes` dependency |
| `development/frontend/src/app/globals.css` | Restructured into `:root` (light) + `.dark` (dark) variable blocks; converted hardcoded hex to CSS vars |
| `development/frontend/src/app/layout.tsx` | Removed hardcoded `"dark"` class; added `suppressHydrationWarning`; wrapped app in `<ThemeProvider>` |
| `development/frontend/src/components/dashboard/CardTile.tsx` | Removed `dark:text-amber-400` (2 instances) |
| `development/frontend/src/components/dashboard/Dashboard.tsx` | Removed `dark:text-amber-400` (1 instance) |

## How to Test

### Test 1: Dark mode visual regression (primary concern)

1. `cd development/frontend && npm install && npm run dev`
2. Open browser, set OS to dark mode (or set `fenrir-theme` to `"dark"` in localStorage)
3. Verify: App looks identical to before -- same Norse war-room aesthetic
4. Check: Card hover glow, skeleton shimmer, milestone toast styling, gleipnir copyright tooltip, myth links

### Test 2: Light mode renders parchment palette

1. Set OS to light mode (or set `fenrir-theme` to `"light"` in localStorage)
2. Verify: Warm parchment backgrounds, dark brown text, adapted gold accents
3. Verify: Skeleton shimmer uses parchment tones, not dark hex values

### Test 3: System theme follows OS

1. Remove `fenrir-theme` from localStorage (or set to `"system"`)
2. Toggle OS dark/light mode
3. Verify: App follows OS preference

### Test 4: Build validation

```bash
cd development/frontend && npx tsc --noEmit   # Should pass
cd development/frontend && npx next build      # Should succeed
```

### Test 5: No stray dark: prefixes

```bash
grep -rn 'dark:' development/frontend/src/ --include='*.tsx' --include='*.ts'
# Should return zero results
```

## Known Limitations

- No theme toggle UI yet -- that is Story 2 (feat/theme-toggle-ui)
- To test light mode manually, change OS preference or set `fenrir-theme` to `"light"` in localStorage
- Tailwind config still has hardcoded hex in direct color tokens (void, forge, chain, gold, realm) -- these are design tokens, not theme-variable candidates. Story 2 color audit will address components using them incorrectly.
- Light theme contrast ratios for muted-foreground on card/background are around 3.3-3.6:1 -- acceptable for large/bold text but may need adjustment for small body text in Story 2

## Suggested Test Focus Areas

- Visual regression in dark mode (nothing should look different from current production)
- Body background texture rendering in both themes
- Skeleton loading shimmer appearance in both themes
- Gleipnir hunt easter egg CSS (copyright tooltip color)
- Card hover glow effect
- Milestone toast styling
- Myth link underline color
