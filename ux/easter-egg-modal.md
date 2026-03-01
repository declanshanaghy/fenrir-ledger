# Easter Egg Modal — Design Template

Fenrir-themed modal dialog shown when the user discovers a hidden easter egg. Applies full Saga Ledger design tokens: void background, gold accent border glow, Cinzel Decorative headline, animated entry.

**Template file**: [`wireframes/easter-eggs/easter-egg-modal.html`](./wireframes/easter-eggs/easter-egg-modal.html)

---

## Structure

See [wireframes/easter-eggs/easter-egg-modal.html](./wireframes/easter-eggs/easter-egg-modal.html).

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
