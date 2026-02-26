---
name: easter-egg-modal
description: This skill should be used when the user asks to "generate an easter egg modal", "create a Gleipnir fragment modal", "build easter egg component", "make an easter egg screen", or provides an egg number (1–6) referring to the six Gleipnir ingredients. Generates a TSX modal component with an inline SVG artifact image for the specified Fenrir Ledger easter egg. No external tools required.
---

# Easter Egg Modal Generator — Fenrir Ledger

Generates a fully-styled TSX modal component for one of the six Gleipnir fragment easter eggs.
Each egg includes a unique SVG artifact image written directly to the public directory and
referenced via `<img>` in the component. No ImageMagick or external tools required.

---

## Step 1 — Resolve Inputs

### Output Format

SVG is the only image format — no conversion step.

### Egg Number (1–6)

The user provides a number from 1 to 6 referring to the six impossible ingredients used to
forge Gleipnir (the ribbon that bound Fenrir). Select the matching row from this table:

| # | Component Name            | Title                          | Storage key              | Rune |
|---|---------------------------|--------------------------------|--------------------------|------|
| 1 | `GleipnirCatFootfall`     | The Sound of a Cat's Footfall  | `egg:gleipnir-1`         | ᚲ    |
| 2 | `GleipnirWomansBeard`     | The Beard of a Woman           | `egg:gleipnir-2`         | ᛒ    |
| 3 | `GleipnirMountainRoots`   | The Roots of a Mountain        | `egg:gleipnir-3`         | ᚱ    |
| 4 | `GleipnirBearSinews`      | The Sinews of a Bear           | `egg:gleipnir-4`         | ᚢ    |
| 5 | `GleipnirFishBreath`      | The Breath of a Fish           | `egg:gleipnir-5`         | ᛚ    |
| 6 | `GleipnirBirdSpittle`     | The Spittle of a Bird          | `egg:gleipnir-6`         | ᛊ    |

Call these resolved values:
- `{{N}}` — the egg number (1–6)
- `{{COMPONENT}}` — component name from the table
- `{{TITLE}}` — ingredient title from the table
- `{{STORAGE_KEY}}` — localStorage key from the table
- `{{RUNE}}` — Elder Futhark rune character from the table

---

## Step 2 — Prepare Directory

```bash
mkdir -p ./development/src/public/easter-eggs
```

---

## Step 3 — Create the SVG Artifact Image

Write a 1024×1024 SVG file directly to:
`./development/src/public/easter-eggs/gleipnir-{{N}}.svg`

### Universal design rules (apply to every egg)

- **Viewbox**: `viewBox="0 0 1024 1024"`
- **Background**: filled rect `#07070d` (void) covering the full 1024×1024
- **Primary shapes**: gold `#c9920a`; highlights and glow: `#f0b429`
- **Structural lines**: dim iron `#1e2235`
- **Outer ring**: `<circle cx="512" cy="512" r="440"/>` stroke `#c9920a` opacity `0.18` strokeWidth `1` no fill
- **Rune watermark**: place `{{RUNE}}` as a `<text>` in the **bottom-left corner** —
  `x="32" y="988"`, `font-size="80"`, `fill="#c9920a"`, `opacity="0.22"`, `font-family="serif"`.
  This is a persistent signature across all six eggs. Do not centre it; do not make it large.
- **`<title>`**: first child of `<svg>` — set to `{{TITLE}}`
- **`<desc>`**: second child — the wolf's voice narration for this egg (see per-egg copy below)
- No external references — all paths must be inline SVG elements

### Per-egg motif: art direction + wolf's voice copy

Each egg's `<desc>` should hold the wolf's internal monologue about that ingredient.
Use this voice: ancient, unhurried, neither angry nor defeated — the wolf simply *knows*.

---

**Egg 1 — The Sound of a Cat's Footfall (ᚲ)**

*What the wolf says (use as `<desc>`)* —
"I have hunted every creature that breathes. I know the sound of hooves on frost, of ravens
lifting from the dead. But the cat — the cat makes no sound at all. They took that silence
and wove it into the chain. I did not hear it coming. I still do not."

*Motif* — A single stylised cat paw print centred at (512, 480): four small toe-bean ellipses
above a larger heel pad, all gold `#c9920a`. Radiating outward from the print: 5 concentric
arcs (`<path>`) of decreasing opacity (0.18 → 0.04), representing silence spreading outward
like ripples that make no sound. A faint dashed horizontal line at y=512 — the ground
that was not disturbed. The visual read should be: *something landed here, and you did not hear it*.

---

**Egg 2 — The Beard of a Woman (ᛒ)**

*What the wolf says (use as `<desc>`)* —
"They told me: this does not exist. I laughed. A wolf does not fear what does not exist.
Then I felt it — impossibly fine, impossibly strong. Woven from absence. The beard of a woman.
The most impossible thing is the thing that is there when it should not be."

*Motif* — Three long sinuous braid strands (`<path>` cubic beziers) flowing from top to bottom,
interweaving centre-to-edge across the full 1024px height. Gold gradient from `#c9920a` at top
to `#f0b429` mid-braid, fading to `#c9920a` at base. Where strands cross: small Norse knotwork
diamond lozenges (`<polygon>` 4-point stars, 8px, fill `#f0b429`). The braid should feel
both impossibly delicate and impossibly unbreakable.

---

**Egg 3 — The Roots of a Mountain (ᚱ)**

*What the wolf says (use as `<desc>`)* —
"Mountains do not have roots. Every child of Yggdrasil knows this. Rock simply is —
it does not grip, it does not reach. And yet the dwarves found them: deep below Niðavellir,
older than the stone itself. They are still down there. So am I."

*Motif* — A mountain silhouette (`<polygon>`) drawn upside-down, apex pointing downward at
(512, 820), base edge running across the top quarter of the image at y≈200.
From the inverted apex and each inverted foothill, branching root tendrils spread as `<line>`
elements: 3 levels deep, each branch 0.6× the length of its parent, angle ±28°.
Root lines: stroke `#c9920a` opacity fading from 0.7 (trunk) to 0.15 (finest tips).
A single dim iron horizontal line at y=190 — the surface of the earth, above.
The visual read: *what holds the mountain up is deeper than the mountain*.

---

**Egg 4 — The Sinews of a Bear (ᚢ)**

*What the wolf says (use as `<desc>`)* —
"I have torn bears apart. I know what sinew looks like — thick ropes of it, bloody and strong.
What they wove into Gleipnir was not that. It was the invisible sinew — the force that makes
a bear *a bear*, that binds muscle to will. I felt it tighten and I knew I could not match it."

*Motif* — A tight diagonal crosshatch of curved `<path>` sinew strands across the full canvas,
alternating gold `#c9920a` and iron `#1e2235`, stroke-width 1.5. All strands curve slightly
(not straight lines — biological, not geometric). At the exact centre (512, 512): a convergence
knot — a dense `<circle r="18">` in bright gold `#f0b429` where all strands visually meet.
From the knot, four thicker anchor strands (`stroke-width 2.5`) radiate to each corner.
The visual read: *everything binds to one point; that point holds everything else*.

---

**Egg 5 — The Breath of a Fish (ᛚ)**

*What the wolf says (use as `<desc>`)* —
"The fish does not breathe. I have drowned prey in rivers. I have watched them — they take
in water, not air. There is no breath there. And yet the dwarves gathered it. They said:
we found it between the gills, in the current's memory. I believe them now."

*Motif* — 11 circles rising from bottom to top: radii ranging from 32px (bottom) to 6px (top),
centres forming a gentle S-curve drift. Each circle: stroke `#c9920a`, no fill, opacity scaling
linearly from 0.85 (bottom) to 0.12 (topmost). The largest bubble (bottom, r=32): add a
`<filter>` glow — `<feGaussianBlur stdDeviation="6"/>` in a `<defs>` blur, applied as a
faint gold `#c9920a` ghost behind it. At y=940: a wide flat ellipse (`rx=160 ry=14`)
in dim iron `#1e2235` opacity 0.4 — the water surface.
The visual read: *breath from something that does not breathe, rising out of dark water*.

---

**Egg 6 — The Spittle of a Bird (ᛊ)**

*What the wolf says (use as `<desc>`)* —
"I have eaten birds. Whole. Feathers, hollow bones, the lot. Birds do not spit — they are
too small, too clean, too fast. They told me the dwarves collected it over a thousand years
from the corners of beaks. A thousand years of nothing, gathered into a strand that holds
a god's wolf still. I respect it."

*Motif* — A bird beak silhouette (`<path>`) pointing right, upper mandible tip at (560, 512),
drawn as a gold `#c9920a` outline only (stroke-width 2, no fill), roughly 80px long.
From the beak tip: a spray of 13 droplets (`<circle>`) at varied angles (−30° to +30°),
radii 2–7px, gold fill `#c9920a`, opacity 0.85 near the beak fading to 0.2 at outer edge,
distance from tip ranging 30–160px. Thin radial guide lines from tip to each droplet:
stroke `#c9920a` opacity 0.07, stroke-width 0.5.
The visual read: *something impossibly small, impossibly precise, impossibly powerful*.

---

## Step 4 — Generate the TSX Component

Write the component to:
`development/src/src/components/cards/{{COMPONENT}}.tsx`

Use this template exactly, substituting all `{{...}}` placeholders:

```tsx
"use client";

/**
 * {{COMPONENT}} — Gleipnir Fragment {{N}} of 6
 *
 * Shown when the user discovers: "{{TITLE}}"
 * One of the six impossible things woven into Gleipnir — the ribbon that bound Fenrir.
 *
 * Trigger:  See design/easter-eggs.md #1 — The Gleipnir Hunt
 * Storage:  localStorage key "{{STORAGE_KEY}}"
 * Image:    /easter-eggs/gleipnir-{{N}}.svg
 * z-index:  9653 (W-O-L-F on a phone keypad)
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "{{STORAGE_KEY}}";
const TOTAL_FRAGMENTS = 6;

interface {{COMPONENT}}Props {
  /** Control open state externally (e.g. from the trigger site). */
  open: boolean;
  onClose: () => void;
}

export function {{COMPONENT}}({ open, onClose }: {{COMPONENT}}Props) {
  const [found, setFound] = useState(0);

  useEffect(() => {
    if (open) {
      // Mark this fragment found
      localStorage.setItem(STORAGE_KEY, "1");

      // Count total found
      const count = Array.from({ length: TOTAL_FRAGMENTS }, (_, i) =>
        localStorage.getItem(`egg:gleipnir-${i + 1}`)
      ).filter(Boolean).length;
      setFound(count);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      {/*
       * Overrides: w-[92vw] max-w-[680px] override Dialog defaults.
       * p-0 gap-0 override p-6 gap-4.
       * z-index 9653 = W-O-L-F on a phone keypad (see copywriting.md Magic Numbers).
       */}
      <DialogContent
        className="w-[92vw] max-w-[680px] p-0 gap-0 flex flex-col
                   bg-[#0f1018] border border-[#2a2d45]
                   [&>button]:text-[#8a8578] [&>button]:hover:text-[#e8e4d4]"
        style={{ zIndex: 9653 }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        {/* pr-10 clears the built-in X button */}
        <div className="px-6 pt-5 pb-4 pr-10 text-center border-b border-[#1e2235]">
          <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#c9920a] mb-2">
            <span aria-hidden="true">ᚠ ᛖ ᚾ ᚱ</span>
            {" · "}Easter Egg Discovered{" · "}
            <span aria-hidden="true">ᛁ ᚱ ᛊ</span>
          </p>

          <DialogTitle className="font-display text-[clamp(1.1rem,3.5vw,1.6rem)] font-bold text-[#f0b429] leading-tight">
            {{TITLE}}
          </DialogTitle>
        </div>

        {/* Accessible description */}
        <DialogDescription className="sr-only">
          You have found Gleipnir fragment {{N}} of 6: {{TITLE}}.
          One of the six impossible things woven into the ribbon that bound the great wolf.
        </DialogDescription>

        {/* ── Two-column body ─────────────────────────────────────────── */}
        {/*
         * Desktop: image left | divider | text right
         * Mobile:  stacked (image top, text bottom)
         */}
        <div className="flex flex-col md:grid md:grid-cols-[1fr_1px_1fr] bg-[#13151f]">

          {/* Left — artifact image (SVG served from /public/easter-eggs/) */}
          <div className="flex items-center justify-center p-6 md:p-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/easter-eggs/gleipnir-{{N}}.svg"
              alt="{{TITLE}} — Gleipnir artifact"
              className="w-full max-w-[200px] md:max-w-[240px] aspect-square object-contain"
            />
          </div>

          {/* Vertical divider — desktop only */}
          <div
            className="hidden md:block"
            style={{
              background:
                "linear-gradient(to bottom, transparent, #2a2d45 20%, #2a2d45 80%, transparent)",
            }}
            aria-hidden="true"
          />

          {/* Right — discovery text */}
          <div className="flex flex-col justify-center gap-3 px-6 py-6 md:px-8">
            <p className="font-body text-sm text-[#e8e4d4] leading-relaxed">
              One of the six impossible things woven into{" "}
              <span className="text-[#f0b429] italic">Gleipnir</span> — the only
              chain strong enough to bind the great wolf. Though it looks like silk
              ribbon, no chain is stronger.
            </p>

            <p className="font-body text-xs italic text-[#8a8578] leading-relaxed">
              &ldquo;The dwarves of Svartálfaheimr gathered six things that do not
              exist. From these they wove Gleipnir. When Fenrir felt its touch, he
              knew at last what true binding was.&rdquo;
            </p>

            <div className="border-t border-[#1e2235] pt-3 mt-1">
              <p className="font-mono text-[0.7rem] text-[#c9920a]">
                Fragment {found} of {TOTAL_FRAGMENTS} found
              </p>
              {found === TOTAL_FRAGMENTS && (
                <p className="font-mono text-[0.65rem] text-[#f0b429] mt-1 animate-pulse">
                  ✦ Gleipnir is complete. The wolf stirs.
                </p>
              )}
            </div>
          </div>

        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="flex justify-center px-6 py-4 border-t border-[#1e2235]">
          <DialogClose asChild>
            <Button
              className="px-10 font-heading text-sm font-semibold tracking-widest uppercase
                         bg-[#c9920a] text-[#07070d] hover:bg-[#f0b429]
                         rounded-none min-h-[44px]"
            >
              OK
            </Button>
          </DialogClose>
        </div>

      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook — wire this at the trigger site.
 *
 * Usage:
 *   const { open, trigger, dismiss } = useGleipnirFragment{{N}}();
 *   // Call trigger() when the hidden ingredient text is discovered.
 *   // Render: <{{COMPONENT}} open={open} onClose={dismiss} />
 */
export function useGleipnirFragment{{N}}() {
  const [open, setOpen] = useState(false);

  function trigger() {
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, "1");
      setOpen(true);
    }
  }

  return { open, trigger, dismiss: () => setOpen(false) };
}
```

---

## Step 5 — Verify

Confirm the following files now exist:

| File | Expected |
|------|----------|
| `development/src/public/easter-eggs/gleipnir-{{N}}.svg` | SVG artifact, non-zero |
| `development/src/src/components/cards/{{COMPONENT}}.tsx` | TSX component |

Report the created files and their sizes. If any file is missing, diagnose and fix before finishing.

---

## Step 6 — Usage Summary

Output a concise summary for the engineer showing:

1. **Image path** (as referenced in the component): `/easter-eggs/gleipnir-{{N}}.svg`
2. **Component import**: `import { {{COMPONENT}}, useGleipnirFragment{{N}} } from "@/components/cards/{{COMPONENT}}"`
3. **Trigger site hook usage** (copy-paste example)
4. **Which placement location** to trigger this from (see `design/easter-eggs.md` placement table)

---

## Reference Data

### Gleipnir Placement Map (from `design/easter-eggs.md`)

| # | Ingredient | Where to wire the trigger |
|---|-----------|--------------------------|
| 1 | Sound of a cat's footfall | Tooltip on the silent background sync indicator (bottom-right corner) |
| 2 | Beard of a woman | About modal — listed under "Built from…" |
| 3 | Roots of a mountain | Comment in `storage.ts` — add a `data-gleipnir` attr to the storage indicator |
| 4 | Sinews of a bear | Error boundary fallback component — `data-gleipnir` attribute |
| 5 | Breath of a fish | Footer — hover on the `©` symbol |
| 6 | Spittle of a bird | Empty state for "no cards" — invisible `aria-description` |

### Design Tokens (from `design/theme-system.md`)

| Token | Value | Role |
|-------|-------|------|
| `void` | `#07070d` | SVG / modal background |
| `forge` | `#0f1018` | Modal surface |
| `chain` | `#13151f` | Column fill |
| `iron-border` | `#2a2d45` | Borders |
| `rune-border` | `#1e2235` | Hairline dividers |
| `gold` | `#c9920a` | Primary accent |
| `gold-bright` | `#f0b429` | Highlights, hover |
| `text-saga` | `#e8e4d4` | Primary text |
| `text-rune` | `#8a8578` | Captions, secondary |

### z-index: 9653

The easter egg modal uses z-index 9653 — W-O-L-F on a phone keypad.
This is a magic number documented in `design/copywriting.md`.
