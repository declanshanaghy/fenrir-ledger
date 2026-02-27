# Easter Egg Modal — Design Template

Fenrir-themed modal dialog shown when the user discovers a hidden easter egg. Applies full Saga Ledger design tokens: void background, gold accent border glow, Cinzel Decorative headline, animated entry.

**Standalone file**: [`wireframes/easter-egg-modal.html`](./wireframes/easter-egg-modal.html) (wireframe also embedded below)

---

## Wireframe

<div class="eew-root">
<style>
.eew-root{font-family:sans-serif;font-size:14px;padding:2rem;display:flex;flex-direction:column;align-items:center;justify-content:center;}
.eew-root *{box-sizing:border-box;margin:0;padding:0;}
.eew-backdrop{position:relative;width:min(680px,92vw);}
.eew-modal{position:relative;width:100%;border:1px solid;}
.eew-modal-header{padding:1.5rem 2rem 1rem;text-align:center;border-bottom:1px solid;}
.eew-eyebrow{display:flex;align-items:center;justify-content:space-between;font-size:0.7rem;font-weight:500;text-transform:uppercase;margin-bottom:0.5rem;}
.eew-eyebrow-runes{flex:1;text-align:center;letter-spacing:0.25em;}
.eew-title{font-size:clamp(1.4rem,4vw,2rem);font-weight:700;}
.eew-body{margin:1.25rem;border:1px solid;display:grid;grid-template-columns:1fr 1px 1fr;min-height:200px;}
.eew-col-image{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.5rem;gap:0.75rem;}
.eew-image-placeholder{width:100%;aspect-ratio:4/3;max-width:200px;border:1px dashed;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.5rem;font-size:0.7rem;text-transform:uppercase;}
.eew-image-icon{font-size:2rem;opacity:0.35;}
.eew-divider{width:1px;border-left:1px solid;}
.eew-col-text{display:flex;flex-direction:column;justify-content:center;padding:1.5rem;gap:0.75rem;}
.eew-text-label{font-size:0.65rem;text-transform:uppercase;}
.eew-text-block{display:flex;flex-direction:column;gap:0.5rem;}
.eew-line{height:0.875rem;border:1px solid;opacity:0.3;}
.eew-line:nth-child(1){width:92%;}
.eew-line:nth-child(2){width:78%;}
.eew-line:nth-child(3){width:85%;}
.eew-line:nth-child(4){width:60%;}
.eew-footer{display:flex;justify-content:center;padding:1rem 2rem 1.5rem;border-top:1px solid;}
.eew-btn-ok{padding:0.625rem 2.5rem;font-size:0.875rem;font-weight:600;text-transform:uppercase;border:1px solid;cursor:pointer;background:none;font-family:inherit;}
.eew-btn-close{position:absolute;top:0.75rem;right:0.75rem;width:1.75rem;height:1.75rem;border:1px solid;cursor:pointer;display:flex;align-items:center;justify-content:center;background:none;font-family:inherit;}
.eew-note{font-size:11px;font-style:italic;opacity:0.6;margin-top:0.5rem;}
</style>
<div class="eew-backdrop">
  <div class="eew-modal">
    <button class="eew-btn-close" aria-label="Dismiss">×</button>
    <header class="eew-modal-header">
      <p class="eew-eyebrow">
        <span class="eew-eyebrow-runes" aria-hidden="true">ᚠ ᛖ ᚾ ᚱ</span>
        Easter Egg Discovered
        <span class="eew-eyebrow-runes" aria-hidden="true">ᛁ ᚱ ᛊ</span>
      </p>
      <h1 class="eew-title" id="egg-title">[EASTER EGG TITLE]</h1>
    </header>
    <div class="eew-body">
      <div class="eew-col-image">
        <div class="eew-image-placeholder">
          <span class="eew-image-icon">ᚠ</span>
          <span>Image Placeholder</span>
        </div>
      </div>
      <div class="eew-divider" aria-hidden="true"></div>
      <div class="eew-col-text">
        <span class="eew-text-label">Discovery Text</span>
        <div class="eew-text-block">
          <div class="eew-line"></div>
          <div class="eew-line"></div>
          <div class="eew-line"></div>
          <div class="eew-line"></div>
        </div>
      </div>
    </div>
    <footer class="eew-footer">
      <button class="eew-btn-ok" type="button">OK</button>
    </footer>
  </div>
</div>
<p class="eew-note">Wireframe — easter-egg-modal · z-index 9653 (W-O-L-F) · standalone: <a href="./wireframes/easter-egg-modal.html">wireframes/easter-egg-modal.html</a></p>
</div>

---

## Placeholders to Replace

| Placeholder | Location | Replace with |
|---|---|---|
| `[EASTER EGG TITLE]` | `<h1 id="egg-title">` | Name of the discovered egg (e.g., *"The Gleipnir Fragment"*) |
| `.image-placeholder` | `.col-image` — left column | `<img>` or `<svg>` of the egg's artifact |
| `.text-line` skeleton divs | `.text-placeholder-block` — right column | Discovery copy, lore, or reward details |
| `.text-placeholder-label` span | `.col-text` — right column | Remove entirely in implementation — wireframe annotation only |
| `aria-labelledby="egg-title"` | `.modal-backdrop[role="dialog"]` | Inherits from H1 — no change needed |

---

## Integrating into the React App

### 1. Copy the modal structure as a component

```tsx
// src/components/easter-eggs/EasterEggModal.tsx
import { Dialog, DialogContent } from '@/components/ui/dialog'

interface EasterEggModalProps {
  open: boolean
  onClose: () => void
  title: string
  image?: React.ReactNode   // <img> or <svg>
  children: React.ReactNode // discovery text + caption
}

export function EasterEggModal({ open, onClose, title, image, children }: EasterEggModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="easter-egg-modal">
        {/* eyebrow */}
        <p className="font-mono text-[0.7rem] tracking-[0.18em] uppercase text-gold before:content-['ᛊ_'] after:content-['_ᛊ']">
          Easter Egg Discovered
        </p>
        {/* title */}
        <h1 className="font-display text-gold-bright text-2xl">{title}</h1>

        {/* two-column body */}
        <div className="grid grid-cols-[1fr_1px_1fr] border border-iron-border rounded-sm">
          <div className="flex flex-col items-center justify-center p-8 bg-chain">
            {image ?? <span className="text-4xl opacity-30">ᚠ</span>}
          </div>
          <div className="bg-gradient-to-b from-transparent via-iron-border to-transparent" />
          <div className="flex flex-col justify-center p-8 bg-chain gap-3">
            {children}
          </div>
        </div>

        {/* footer */}
        <button
          onClick={onClose}
          className="mx-auto px-10 py-2.5 font-heading text-sm font-semibold tracking-widest uppercase bg-gold text-void rounded-sm hover:bg-gold-bright transition-colors"
        >
          OK
        </button>
      </DialogContent>
    </Dialog>
  )
}
```

### 2. Usage example — Gleipnir fragment found

```tsx
<EasterEggModal
  open={gleipnirModalOpen}
  onClose={() => setGleipnirModalOpen(false)}
  title="The Sound of a Cat's Footfall"
  image={<img src="/easter-eggs/gleipnir-fragment-1.svg" alt="Gleipnir strand" />}
>
  <p className="font-body text-saga text-sm leading-relaxed">
    One of the six impossible things woven into Gleipnir — the only chain strong enough
    to bind the great wolf.
  </p>
  <p className="font-body text-rune text-xs italic border-t border-rune-border pt-2">
    1 of 6 fragments found. The chain grows stronger.
  </p>
</EasterEggModal>
```

### 3. Triggering the modal

Wire dismissal to `localStorage` so the modal only fires once per egg:

```tsx
function useEasterEgg(key: string) {
  const [open, setOpen] = useState(false)

  function trigger() {
    if (!localStorage.getItem(`egg:${key}`)) {
      localStorage.setItem(`egg:${key}`, '1')
      setOpen(true)
    }
  }

  return { open, trigger, dismiss: () => setOpen(false) }
}
```

---

## Design Tokens Used

All tokens match `theme-system.md`. No custom values were introduced.

| Token | Value | Role |
|---|---|---|
| `--void` | `#07070d` | Backdrop tint base |
| `--forge` | `#0f1018` | Modal background |
| `--chain` | `#13151f` | Column fill |
| `--iron-border` | `#2a2d45` | Outer + inner border |
| `--rune-border` | `#1e2235` | Hairline dividers |
| `--gold` | `#c9920a` | Button fill, eyebrow |
| `--gold-bright` | `#f0b429` | Title glow, button hover |
| `--text-saga` | `#e8e4d4` | Primary copy |
| `--text-rune` | `#8a8578` | Captions |
| Cinzel Decorative 700 | — | `[EASTER EGG TITLE]` |
| Cinzel 600 | — | OK button |
| JetBrains Mono 500 | — | Eyebrow label |

---

## Animation Summary

| Element | Keyframe | Duration |
|---|---|---|
| Backdrop | `backdrop-in` (opacity 0→1) | 280ms ease |
| Modal shell | `modal-rise` (translateY + scale) | 320ms cubic-bezier(0.16, 1, 0.3, 1) |
| Skeleton lines | `shimmer` (background-position sweep) | 2.4s infinite |

The entry animation uses the same `saga-enter` easing documented in `interactions.md`.

---

## Accessibility

- `role="dialog"` + `aria-modal="true"` on the backdrop
- `aria-labelledby` points to the `<h1>` title
- `×` close button has `aria-label="Dismiss"`
- OK button is the natural keyboard focus target on open
- Color contrast: gold `#c9920a` on void `#07070d` passes WCAG AA for large text; `#f0b429` on `#07070d` passes AA for small text too

---

## Related Files

- [`easter-eggs.md`](./easter-eggs.md) — full catalog of all easter eggs and their triggers
- [`theme-system.md`](./theme-system.md) — color palette, typography, and CSS tokens
- [`interactions.md`](./interactions.md) — `saga-enter`, `wolf-rise`, and other animation keyframes
