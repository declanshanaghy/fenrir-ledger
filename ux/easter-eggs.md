# Easter Eggs: Fenrir Ledger

Hidden references for the wolves who look closely. None of these should obstruct task flow. All are discoverable through exploration, not documentation.

---

## 1. The Gleipnir Hunt (Six Impossible Things)

**What it is**: A hidden collectible game. Gleipnir — the magical ribbon that bound Fenrir — was made of six impossible things. These six phrases are hidden across the UI. Finding all six unlocks a secret Valhalla entry for "Gleipnir itself."

**The six ingredients** (from Prose Edda, Gylfaginning):
1. *The sound of a cat's footfall*
2. *The beard of a woman*
3. *The roots of a mountain*
4. *The sinews of a bear*
5. *The breath of a fish*
6. *The spittle of a bird*

**Placement**:

| # | Ingredient | Location | Storage Key |
|---|-----------|----------|-------------|
| 1 | *Sound of a cat's footfall* | Click SyncIndicator dot (bottom-right corner) | `egg:gleipnir-1` |
| 2 | *Beard of a woman* | Click ingredient II in AboutModal | `egg:gleipnir-2` |
| 3 | *Roots of a mountain* | First sidebar collapse | `egg:gleipnir-3` |
| 4 | *Sinews of a bear* | 7th card save (`fenrir:card-save-count`) | `egg:gleipnir-4` |
| 5 | *Breath of a fish* | Footer — hover on the copyright `©` symbol | `egg:gleipnir-5` |
| 6 | *Spittle of a bird* | 15 seconds idle on empty Valhalla page | `egg:gleipnir-6` |

**Unlock mechanic**: A `localStorage` key `gleipnir-found` stores a Set of found ingredients. When all six are found, the page briefly shimmers (CSS `@keyframes gleipnir-shimmer`) and the Valhalla page gains a new special entry:

> **Gleipnir** — *The chain that bound the great wolf. Made of impossible things. No chain is stronger.*
> Opened: [first card open date] · Closed: [today] · Rewards extracted: *Freedom itself*

---

## 2. Konami Code → The Howl

**Trigger**: `↑ ↑ ↓ ↓ ← → ← → B A` on keyboard.

**Effect**:
- A wolf-head silhouette rises from the bottom of the viewport (CSS keyframe `@keyframes wolf-rise`)
- The viewport shakes subtly (`@keyframes saga-shake` — 3 quick horizontal nudges)
- Status bar / notification area reads: **FENRIR AWAKENS** for 3 seconds in blood orange with Cinzel Decorative
- If the user has any overdue cards: the background flashes deep red once (Ragnarök pulse)
- Sound: optional — only if `AudioContext` is already running (never autoplay)

**Implementation note**: Listen for the sequence in `useEffect` on the layout root. Store the sequence in a ref, reset on wrong key.

---

## 3. Loki Mode

**Trigger**: Click the footer credit "Loki" exactly 7 times.

**Effect**:
- Card grid shuffles into random order with a scramble animation
- Status badges briefly show random realm names (Loki is a shapeshifter)
- A toast appears: *"Loki was here. Your data is fine. Probably."*
- After 5 seconds: order restores with a fade back

**Why 7**: In Norse myth, Loki has 7 known children (by various partners). Only a true Loki devotee counts.

---

## 4. Console ASCII Art

**Trigger**: Opening browser DevTools.

**Implementation**: In `layout.tsx` (or a `console-signature.ts` utility imported on client-side only):

The art uses ASCII-drawn Elder Futhark rune glyphs spelling **ᚠ ᛖ ᚾ ᚱ ᛁ ᚱ** (F-E-N-R-I-R). Each glyph is 8 characters wide, 7 lines tall, drawn with `|`, `/`, `\`, `-` to approximate the rune shapes:

| Rune | Name | Shape |
|------|------|-------|
| ᚠ | Fehu | Vertical stave, two right-branching diagonals in upper half |
| ᛖ | Ehwaz | Two parallel staves, X-crossing between |
| ᚾ | Naudiz | Two staves, single diagonal connecting upper-left to lower-right |
| ᚱ | Raidho | Stave, angular P-bump (`|--` / `|  \`), diagonal leg |
| ᛁ | Isa | Pure vertical stave (ice — still, unbending) |
| ᚱ | Raidho | (same as above) |

```typescript
// Only runs in browser, only runs once per session
if (typeof window !== 'undefined' && !sessionStorage.getItem('console-signed')) {
  sessionStorage.setItem('console-signed', '1')

  const art = `
   |      | |    |   |   |--       |      |--
   |\\     |/|    |\\  |   |  \\      |      |  \\
   | \\    | |    | \\ |   |--       |      |--
   |\\     |\\|    |  \\|   |  \\      |      |  \\
   | \\    | |    |   |   |   \\     |      |   \\
   |      | |    |   |   |         |      |
   |      | |    |   |   |         |      |
`
  const runeLabel = `  ᚠ FEHU    ᛖ EHWAZ   ᚾ NAUDIZ   ᚱ RAIDHO    ᛁ ISA    ᚱ RAIDHO`

  console.log('%c' + art, 'color: #c9920a; font-family: monospace; font-size: 11px; line-height: 1.3')
  console.log('%c' + runeLabel, 'color: #c9920a; font-family: monospace; font-size: 10px; letter-spacing: 1px')
  console.log('%cYou opened the forge, mortal. 🐺', 'color: #f0b429; font-size: 14px; font-family: monospace;')
  console.log('%cFenrir sees all chains. Including yours.', 'color: #8a8578; font-size: 12px; font-family: monospace;')
  console.log('%c ', 'font-size: 4px;')
  console.log('%cBuilt by FiremanDecko  ·  Guarded by Freya  ·  Tested by Loki', 'color: #3d3d52; font-size: 11px; font-family: monospace;')
  console.log('%cOdin bound Fenrir. Fenrir built Ledger.', 'color: #2a2d45; font-size: 10px; font-family: monospace; font-style: italic;')
}
```

---

## 5. HTML Source Signature

A comment block at the top of the rendered HTML (in `layout.tsx` via a server component comment pattern):

```html
<!--
  ╔══════════════════════════════════════════════════════╗
  ║          F E N R I R   L E D G E R                  ║
  ║    Break free. Harvest every reward. Let no          ║
  ║    chain hold.                                       ║
  ╠══════════════════════════════════════════════════════╣
  ║  Forged by FiremanDecko in the fires of Muspelheim. ║
  ║  Debugged by Loki (mostly for fun).                  ║
  ║  Warded by Freya's seiðr.                            ║
  ║  Designed by Luna under the light of Bifröst.        ║
  ╠══════════════════════════════════════════════════════╣
  ║  Gleipnir was made of six impossible things.         ║
  ║  Can you find them all?                              ║
  ╚══════════════════════════════════════════════════════╝
-->
```

---

## 6. Star Trek / LCARS Mode

**Trigger**: `Cmd+Shift+W` (or `Ctrl+Shift+W` on non-Mac).

**Effect**: For exactly 5 seconds, the dashboard header switches to LCARS-style display:

```
STARDATE [current ISO date as float e.g. 2026.054]
FENRIR LEDGER — TACTICAL OPERATIONS
CARDS ON SCREEN: [N]   URGENT: [N]   VALHALLA: [N]
CAPTAIN'S LOG: N days until next deadline. Shields at [X]%.
```

Styled in amber monochrome (classic LCARS amber `#ff9900`) on black, with LCARS-style rectangular panel shapes. Returns to normal after 5 seconds with a scan-line wipe.

**Why**: FiremanDecko is the forgemaster. Forgemasters watch Star Trek.

---

## 7. Runic Cipher (The Deep Cut)

**What it is**: The page's HTML meta tag includes:
```html
<meta name="fenrir:runes" content="ᚠᛖᚾᚱᛁᚱ" />
```

`ᚠᛖᚾᚱᛁᚱ` is FENRIR spelled in Elder Futhark runes. For the truly initiated.

The `<meta name="description">` is:
```html
<meta name="description" content="Break free from fee traps. Harvest every reward. Let no chain hold. Gleipnir breaks." />
```

---

## 8. Ragnarök Threshold

**What it is**: When ≥ 3 cards simultaneously have `fee_approaching` or overdue status, the UI enters Ragnarök mode.

**Effect**:
- Background gradient gains a deep red radial overlay
- Gold accents shift toward blood orange
- The page title becomes: **Ragnarök — Fenrir Ledger**
- The Howl panel header glows red and reads: *"Ragnarök approaches. Multiple chains tighten."*
- Konami code during this state plays the howl at double intensity

**Dismiss**: Resolves automatically when cards drop below threshold.

---

## 9. The Forgemaster's Signature (About Modal)

A hidden keyboard shortcut `?` (shift+/) triggers the easter egg.

> **Fenrir Ledger**
> *Sprint [N] · Built with the fires of Muspelheim*
>
> **The Pack**
> Freya — Product Owner
> Luna — UX Designer
> FiremanDecko — Principal Engineer
> Loki — QA Tester
>
> **Gleipnir was made of:**
> The sound of a cat's footfall · The beard of a woman
> The roots of a mountain · The sinews of a bear
> The breath of a fish · The spittle of a bird
>
> *Though it looks like silk ribbon, no chain is stronger.*
>
> [*N of 6 Gleipnir fragments found*]

---

## 10. The Wolf's Hunger Meter

In the About modal (see #9), at the bottom:

> **Fenrir has consumed:** [total lifetime rewards value] pts / miles / $ cashback
> *The chain grows heavier.*

Pulls from the aggregate of all cards (active + Valhalla).

---

## 11. Card Count Milestones

When the user's active card count hits certain numbers, a one-time toast appears:

| Count | Toast |
|-------|-------|
| 1 | *"The first chain is forged. Fenrir stirs."* |
| 5 | *"Five chains. The Pack grows."* |
| 9 | *"Nine chains — one for each realm. Odin watches."* |
| 13 | *"Thirteen chains. Even Loki is impressed."* |
| 20 | *"Twenty chains. The great wolf is bound no longer — it is the gods who should fear you."* |

---

## Easter Egg Implementation Priority

| # | Easter Egg | Complexity | Sprint | Status |
|---|-----------|-----------|--------|--------|
| 4 | Console ASCII art | Low | Sprint 2 | Done — `ConsoleSignature.tsx` |
| 5 | HTML source signature | Low | Sprint 2 | Done — `layout.tsx` JSDoc block |
| 7 | Runic meta tag cipher | Trivial | Sprint 2 | Done — `metadata.other["fenrir:runes"]` in `layout.tsx` |
| 2 | Konami code howl | Medium | Sprint 2 | Done — `KonamiHowl.tsx` |
| 3 | Loki mode | Medium | Sprint 2 | Done — Footer "Loki" 7-click shuffle |
| 1 (frag 5) | Gleipnir — Breath of a Fish | Low | Sprint 2 | Done — Footer © hover → `GleipnirFishBreath` modal |
| 8 | Ragnarök threshold | Medium | Sprint 4 | Done — `RagnarokContext.tsx`, overlay + title change (Story 4.1) |
| 11 | Card count milestones | Low | Sprint 4 | Done — `milestone-utils.ts`, Norse toasts at 1/5/9/13/20 (Story 4.2) |
| 1 | Gleipnir Hunt (fragments 4 + 6) | High | Sprint 4 | Done — Fragment 4 (7th save), Fragment 6 (15s Valhalla idle), reward card (Story 4.3) |
| 10 | Wolf's Hunger meter | Medium | Sprint 4 | Done — `WolfHungerMeter.tsx` in AboutModal + ForgeMasterEgg (Story 4.5) |
| 9 | About modal (`?` key) | Medium | Sprint 4 | Done — AboutModal with team pack + Gleipnir ingredients (Story 4.5) |
| 6 | Star Trek LCARS mode | High | Sprint 5 | Done — `LcarsMode.tsx`, 5s auto-dismiss (Story 5.5) |
