---
name: easter-egg-modal
description: This skill should be used when the user asks to "generate an easter egg modal", "create a Gleipnir fragment modal", "build easter egg component", "make an easter egg screen", or provides an egg number (1–6) referring to the six Gleipnir ingredients. Generates a TSX modal component with a SVG artifact image (converted via ImageMagick) for the specified Fenrir Ledger easter egg.
version: 1.0.0
---

# Easter Egg Modal Generator — Fenrir Ledger

Generates a fully-styled TSX modal component for one of the six Gleipnir fragment easter eggs.
Each egg has a unique SVG artifact image created inline and converted via ImageMagick.

---

## Step 1 — Check Prerequisites

Run this command and examine the output:

```bash
convert --version
```

If the command fails or is not found, output this message and **STOP ALL WORK immediately**:

> ImageMagick is required but not installed.
> Install it with:
>   • macOS:  `brew install imagemagick`
>   • Ubuntu: `sudo apt-get install imagemagick`
>   • Windows: https://imagemagick.org/script/download.php
>
> Re-run the skill after installation.

Do not proceed past this step unless `convert --version` succeeds.

---

## Step 2 — Resolve Inputs

### Output Format (`{{FORMAT}}`)

If the user specified a format (e.g. "generate as WEBP", "PNG please"), use that value,
uppercased, as `{{FORMAT}}`. If no format was specified, default to `PNG`.

Supported values: `PNG`, `WEBP`, `JPEG`, `AVIF`.

### Egg Number (1–6)

The user provides a number from 1 to 6 referring to the six impossible ingredients used to
forge Gleipnir (the ribbon that bound Fenrir). Select the matching row from this table:

| # | Component Name            | Title                          | Storage key              | Rune | SVG Theme            |
|---|---------------------------|--------------------------------|--------------------------|------|----------------------|
| 1 | `GleipnirCatFootfall`     | The Sound of a Cat's Footfall  | `egg:gleipnir-1`         | ᚲ    | silent paw           |
| 2 | `GleipnirWomansBeard`     | The Beard of a Woman           | `egg:gleipnir-2`         | ᛒ    | flowing braid        |
| 3 | `GleipnirMountainRoots`   | The Roots of a Mountain        | `egg:gleipnir-3`         | ᚱ    | inverted mountain    |
| 4 | `GleipnirBearSinews`      | The Sinews of a Bear           | `egg:gleipnir-4`         | ᚢ    | fibrous muscle weave |
| 5 | `GleipnirFishBreath`      | The Breath of a Fish           | `egg:gleipnir-5`         | ᛚ    | rising bubbles       |
| 6 | `GleipnirBirdSpittle`     | The Spittle of a Bird          | `egg:gleipnir-6`         | ᛊ    | mist droplets        |

Call these resolved values:
- `{{N}}` — the egg number (1–6)
- `{{COMPONENT}}` — component name from the table
- `{{TITLE}}` — ingredient title from the table
- `{{STORAGE_KEY}}` — localStorage key from the table
- `{{RUNE}}` — Elder Futhark rune character from the table
- `{{SVG_THEME}}` — art direction keyword from the table

---

## Step 3 — Prepare Directories

```bash
mkdir -p ./tmp
mkdir -p ./development/src/public/easter-eggs
```

---

## Step 4 — Create the SVG Artifact Image

Write a 1024×1024 SVG file to `./tmp/gleipnir-{{N}}.svg`.

Design rules for all eggs:
- Background: deep void `#07070d` fill
- Accent: gold `#c9920a` for primary shapes; bright gold `#f0b429` for glows/highlights
- Secondary: dim iron `#1e2235` for structural lines
- The rune `{{RUNE}}` must appear prominently — large, centered or offset, low opacity (0.08–0.15)
  as a background watermark, plus one crisp foreground instance
- Center the unique SVG motif for this egg's `{{SVG_THEME}}`
- Add a subtle circular gold ring: `cx="512" cy="512" r="400"`, stroke `#c9920a` at opacity 0.18,
  stroke-width 1, no fill
- Add `<title>{{TITLE}}</title>` as the first child of `<svg>`
- No external references — all paths must be inline SVG

### Per-egg motif guidance

**Egg 1 — silent paw (ᚲ)**
Draw a single stylised paw print (4 toe beans + main pad) using ellipses.
Pads: warm gold fill `#c9920a`. Surround with faint concentric rings suggesting silence/soundlessness.
Add a faint dashed horizontal line through center — the ground that was not disturbed.

**Egg 2 — flowing braid (ᛒ)**
Three long curved `<path>` strokes interweaving top to bottom, gold gradients.
Add tiny Norse knotwork diamond lozenges where the strands cross.
The braid should feel both delicate and impossibly complex.

**Egg 3 — inverted mountain (ᚱ)**
A mountain silhouette (`<polygon>`) flipped upside-down so roots descend.
From the inverted peaks, draw branching `<line>` root tendrils spreading outward.
Ground line at top (where sky would be) — single dim iron stroke.

**Egg 4 — fibrous muscle weave (ᚢ)**
A tight diagonal grid of curved `<path>` sinew strands, alternating gold/iron-border colors.
In the center: a single knot where all strands converge — this is the binding point.
Texture should read as both biological and architectural.

**Egg 5 — rising bubbles (ᛚ)**
7–12 circles of varying sizes rising from bottom to top, decreasing size upward.
Each circle: stroke `#c9920a`, no fill, opacity scaled from 0.9 (bottom) to 0.2 (top).
A subtle shimmer glow filter (`<feGaussianBlur>`) behind the largest bubble.
Implied water: horizontal ellipse at bottom in dim iron.

**Egg 6 — mist droplets (ᛊ)**
A bird-beak silhouette (`<path>`) pointing right, gold outline only.
From the beak tip: 9–15 tiny `<circle>` droplets scattered in a spray pattern,
radii 2–6px, gold fill, opacity 0.3–0.9 (denser near beak, fading outward).
Thin radial guide lines from beak tip to each droplet, opacity 0.08.

---

## Step 5 — Convert SVG to {{FORMAT}}

```bash
convert \
  -background "#07070d" \
  -flatten \
  ./tmp/gleipnir-{{N}}.svg \
  ./development/src/public/easter-eggs/gleipnir-{{N}}.{{FORMAT_LOWER}}
```

Where `{{FORMAT_LOWER}}` is `{{FORMAT}}` lowercased (e.g. `png`, `webp`).

The `-background` + `-flatten` flags ensure the SVG transparent canvas composites correctly
against the void background color.

Verify the output file exists and is non-zero bytes:

```bash
ls -lh ./development/src/public/easter-eggs/gleipnir-{{N}}.{{FORMAT_LOWER}}
```

If the file is missing or zero bytes, report the ImageMagick error and stop.

---

## Step 6 — Generate the TSX Component

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
 * Image:    /easter-eggs/gleipnir-{{N}}.{{FORMAT_LOWER}}
 * z-index:  9653 (W-O-L-F on a phone keypad)
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "{{STORAGE_KEY}}";
const FRAGMENT_NUMBER = {{N}};
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

          {/* Left — artifact image */}
          <div className="flex items-center justify-center p-6 md:p-8">
            <div className="relative w-full max-w-[200px] aspect-square md:max-w-[240px]">
              <Image
                src="/easter-eggs/gleipnir-{{N}}.{{FORMAT_LOWER}}"
                alt="{{TITLE}} — Gleipnir artifact"
                fill
                className="object-contain"
                priority
              />
            </div>
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
                Fragment {FRAGMENT_NUMBER} of {TOTAL_FRAGMENTS} found
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

## Step 7 — Verify

Confirm the following files now exist:

| File | Expected |
|------|----------|
| `./tmp/gleipnir-{{N}}.svg` | SVG source, non-zero |
| `development/src/public/easter-eggs/gleipnir-{{N}}.{{FORMAT_LOWER}}` | Converted image, non-zero |
| `development/src/src/components/cards/{{COMPONENT}}.tsx` | TSX component |

Report the created files and their sizes. If any file is missing, diagnose and fix before finishing.

---

## Step 8 — Usage Summary

Output a concise summary for the engineer showing:

1. **Image path** (as referenced in the component): `/easter-eggs/gleipnir-{{N}}.{{FORMAT_LOWER}}`
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
| `void` | `#07070d` | Page / SVG background |
| `forge` | `#0f1018` | Modal background |
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
