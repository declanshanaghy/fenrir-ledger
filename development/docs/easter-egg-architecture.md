# Easter Egg Architecture

## Overview

Fenrir Ledger has 10 easter eggs: 6 collectible Gleipnir fragments, and 4 standalone eggs. All use `--egg-*` CSS variables for theming.

## Component Inventory

| # | Name | Component | Location | Modal Type | Trigger | Repeatable |
|---|------|-----------|----------|------------|---------|------------|
| 1 | Cat's Footfall | GleipnirCatFootfall | `cards/` | Custom Dialog | Click SyncIndicator dot | No |
| 2 | Woman's Beard | GleipnirWomansBeard | `cards/` | Custom Dialog | Click ingredient II in AboutModal | No |
| 3 | Mountain Roots | GleipnirMountainRoots | `cards/` | EasterEggModal | First sidebar collapse | No |
| 4 | Bear Sinews | GleipnirBearSinews | `cards/` | EasterEggModal | TBD (not wired) | No |
| 5 | Fish Breath | GleipnirFishBreath | `cards/` | EasterEggModal | Hover copyright symbol | No |
| 6 | Bird Spittle | GleipnirBirdSpittle | `cards/` | EasterEggModal | TBD (not wired) | No |
| 7 | Forgemaster | ForgeMasterEgg | `layout/` | EasterEggModal | Shift+? keypress | No |
| 8 | Heilung | HeilungModal | `easter-eggs/` | Custom Framer Motion | Ctrl+Shift+L | Yes |
| 9 | Konami Howl | KonamiHowl | `layout/` | Visual overlay | Konami code | Yes |
| 10 | Console Sig | ConsoleSignature | `layout/` | Console output | Open DevTools | Per-session |

## Storage Keys

| Key | Component | Storage |
|-----|-----------|---------|
| `egg:gleipnir-1` through `egg:gleipnir-6` | Fragments 1-6 | localStorage |
| `egg:forgemaster` | ForgeMasterEgg | localStorage |
| `fenrir:console-signed` | ConsoleSignature | sessionStorage |
| (none) | HeilungModal, KonamiHowl | repeatable |

## Shared Infrastructure

### EasterEggModal (`components/easter-eggs/EasterEggModal.tsx`)

Shared shell used by Gleipnir fragments 3-6 and ForgeMasterEgg. Wraps shadcn Dialog with:
- Two-column layout (image left, text right; stacked on mobile)
- Auto-playing audio on open
- "So it is written" dismiss button
- z-index 9653 (W-O-L-F on phone keypad)

### gleipnir-utils.ts (`lib/gleipnir-utils.ts`)

- `GLEIPNIR_FRAGMENTS`: Array of 6 fragment definitions
- `getFoundFragmentCount()`: Counts localStorage entries (0-6)
- `isGleipnirComplete()`: True when all 6 found

### CSS Variables (`globals.css`)

All eggs use `--egg-*` variables. Howl uses `--howl-*` variables.

## Snowflakes Worth Consolidating

### 1. Fragments 1-2 vs 3-6: Different modal patterns

**Problem:** Fragments 1-2 use hand-rolled Dialog components with custom audio fade logic (500ms in, 600ms out). Fragments 3-6 delegate everything to EasterEggModal.

**Recommendation:** Refactor fragments 1-2 to use EasterEggModal. The custom audio fade can be moved into EasterEggModal as an optional prop (`audioFade?: { in: number; out: number }`). This eliminates ~100 lines of duplicated dialog/audio code.

### 2. HeilungModal: Completely standalone

**Problem:** HeilungModal is a full custom Framer Motion modal (7-section layout, custom animations, own z-index management). It shares no code with EasterEggModal.

**Recommendation:** Keep as-is. Its layout (video embed, rune bands, multi-section scrolling) is fundamentally different from the two-column artifact+text pattern of EasterEggModal. Forcing it into the shared shell would require so many overrides that it would be worse than standalone.

### 3. KonamiHowl: Pure visual overlay

**Problem:** KonamiHowl is not a modal at all. It's a multi-phase visual sequence (pulse, wolf rise, status band, fade). No dialog, no close button, no focus trap.

**Recommendation:** Keep as-is. It's architecturally different from all other eggs.

### 4. Audio handling split

**Problem:** Fragments 1-2 manage their own Audio objects with fade. Fragments 3-6 pass `audioSrc` to EasterEggModal which calls `.play()` without fade. Inconsistent audio experience.

**Recommendation:** Add optional fade support to EasterEggModal. All fragments use the same audio file (`/sounds/fenrir-growl.mp3`), so the fade behavior should be consistent.

### 5. Light theme (Issue #1811)

**Problem:** `--egg-*` CSS variables define dark colors for both light and dark themes. Easter egg modals appear as dark overlays regardless of app theme.

**Recommendation:** Update `:root` (light theme) values in `globals.css` to use warm parchment backgrounds with dark text. Keep dark theme values unchanged.

## File Locations

```
development/ledger/src/
  components/
    cards/
      GleipnirCatFootfall.tsx      # Fragment 1
      GleipnirWomansBeard.tsx      # Fragment 2
      GleipnirMountainRoots.tsx    # Fragment 3
      GleipnirBearSinews.tsx       # Fragment 4
      GleipnirFishBreath.tsx       # Fragment 5
      GleipnirBirdSpittle.tsx      # Fragment 6
    easter-eggs/
      EasterEggModal.tsx           # Shared modal shell
      HeilungModal.tsx             # Standalone Framer Motion modal
    layout/
      ForgeMasterEgg.tsx           # Shift+? egg
      KonamiHowl.tsx               # Konami code visual
      ConsoleSignature.tsx         # DevTools console art
    shared/
      WolfHungerMeter.tsx          # Bonus aggregate (used in ForgeMasterEgg)
  lib/
    gleipnir-utils.ts              # Fragment tracking utilities
  app/
    globals.css                    # --egg-* and --howl-* CSS variables

public/easter-eggs/
  gleipnir-1.svg through gleipnir-6.svg
  forgemaster.svg

public/sounds/
  fenrir-growl.mp3
```

## Unimplemented (Design Only)

- Fragment 4 trigger: 7th card save (designed, not wired)
- Fragment 6 trigger: 15s idle on Valhalla (designed, not wired)
- Loki Mode (Egg #3): Full design in `ux/easter-eggs.md`, no component
- Star Trek LCARS (Egg #6): Full design, no component
- HTML source signature (Egg #5): Designed, status unknown
