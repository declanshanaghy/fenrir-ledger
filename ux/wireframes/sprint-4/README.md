# Sprint 4 Wireframes

All five Sprint 4 stories have wireframes produced by Luna (UX Designer) before FiremanDecko begins implementation.

## Wireframes

| Story | File | Description |
|-------|------|-------------|
| 4.1 — Ragnarök Threshold Mode | [ragnarok-threshold.html](ragnarok-threshold.html) | 3 dashboard states (normal / warning / Ragnarök active), red radial overlay spec, RagnarokContext data flow diagram, HowlPanel header override, Konami volume escalation, transition spec |
| 4.2 — Card Count Milestone Toasts | [card-count-milestones.html](card-count-milestones.html) | All 5 milestone toast designs, desktop + mobile positioning, stacked-toast behavior, localStorage gate flow diagram, visual design token table |
| 4.3 — Full Gleipnir Hunt | [gleipnir-hunt-complete.html](gleipnir-hunt-complete.html) | Fragment 4 trigger (7th card save in CardForm), Fragment 6 trigger (15s Valhalla idle), Gleipnir Complete Valhalla reward card, DEF-001 aria-description bug fix |
| 4.4 — Accessibility + UX Polish | [accessibility-polish.html](accessibility-polish.html) | Focus ring spec, skip-nav placement, ARIA landmark + heading hierarchy diagrams, modal focus trap tab order, touch target audit (8 elements), mobile 375px layouts, screen reader ARIA labels, reduced-motion CSS + Framer Motion patterns, focus management after card actions |
| 4.5 — Wolf's Hunger Meter + About Modal | [wolves-hunger-about-modal.html](wolves-hunger-about-modal.html) | Wolf's Hunger Meter in About modal and ForgeMasterEgg overlay, all 4 display format variants, shared WolfHungerMeter component spec, mobile full-screen sheet layout, aggregation state flow diagram |

---

## Key UX Decisions Per Story

### 4.1 — Ragnarök Threshold

- The threshold is ≥ 3 cards with `fee_approaching` OR `promo_expiring` status simultaneously.
- The red radial overlay is `position:fixed, inset:0, pointer-events:none, z-index:1` — it never blocks clicks, forms, or keyboard navigation.
- Do NOT use CSS `filter` on any layout element — it creates stacking contexts that break portal-rendered modals.
- Valhalla is excluded from the overlay (closed cards are beyond the storm).
- The HowlPanel header override is the only copy change — "Ragnarök approaches. Multiple chains tighten." The rest of the UI is subtle.
- Transitions: 1.2s ease-in on activate, 0.8s ease-out on deactivate.
- Under `prefers-reduced-motion`: transitions become instant; overlay still appears.

### 4.2 — Card Count Milestone Toasts

- Toasts are celebratory, not actionable — no close button.
- Rune prefix: ᚠ (Fehu) for milestones 1 and 5; ᛊ (Sowilo) for milestones 9, 13, 20.
- Auto-dismiss: 5 seconds with a 2px progress bar draining from 100% to 0%.
- Desktop: top-right anchor (below TopBar). Mobile: bottom anchor.
- The milestone-20 toast is long — container must accommodate without clipping.
- Multiple thresholds crossed in one action: queue with 200ms stagger between each toast.

### 4.3 — Gleipnir Hunt

- Fragment 4 (Sinews of a Bear): trigger is the 7th save of any card in CardForm. Fallback if this is too complex: 600ms long-press on the Delete button confirmation.
- Fragment 6 (Spittle of a Bird): 15-second idle timer on Valhalla empty state. useEffect cleanup cancels on navigation.
- DEF-001 bug fix: remove `aria-description="the beard of a woman"` from ValhallaEmptyState — that ingredient belongs to fragment 2, not fragment 6.
- The Gleipnir special Valhalla entry has a 2px gold border, no issuer badge, and italicized rewards field. It is NOT a real Card object.
- First card open date: `Math.min` of all `openDate` values across active + closed cards. Fallback: "Before memory".

### 4.4 — Accessibility + UX Polish

- Focus rings: `:focus-visible` only (not `:focus`) — suppresses ring on mouse click.
- Skip-nav link is the first focusable element, visually hidden until focused, then slides in above the TopBar.
- HowlPanel on mobile renders as a bottom drawer (max-h-[70vh]) — not a sidebar. `AnimatedHowlPanel` already implements this; verify at 375px.
- All modal focus traps rely on Radix UI Dialog — verify each modal instance.
- Touch targets: 44x44px minimum effective area. SyncIndicator, HowlPanel View links, mobile close button all need audit.
- Reduced motion: `animation: none` on all CSS keyframes under `@media (prefers-reduced-motion: reduce)`. Framer Motion: `useReducedMotion()` hook in `AnimatedCardGrid`.

### 4.5 — Wolf's Hunger Meter

- Data source: `signUpBonus.met === true` (NOT `bonusMet` — confirmed Sprint 4 groom). Active + closed cards both included.
- Display format: mixed types on one line separated by ` · `. Cash: `$N`. Points/miles: `N type`.
- Fallback when no bonuses met: "The wolf has not yet fed. Add reward details to your cards." — no "Fenrir has consumed:" label, no "The chain grows heavier." subline.
- The hunger section is the last section in both About modal and ForgeMasterEgg, separated by a divider from the fragment count.
- Extract `<WolfHungerMeter householdId={...} />` as a shared component to avoid duplicating aggregation logic.
- Data reads once on modal open — no live polling.

---

## Accessibility Non-Negotiables

These requirements cannot be traded away in implementation:

1. All Gleipnir fragment modals trap focus and close on Escape.
2. All rune decorative characters carry `aria-hidden="true"`.
3. StatusBadge: `aria-label` in plain English (not just rune glyphs or status codes).
4. StatusRing SVG: `<title>` element with days-remaining value.
5. Skip-nav link is the first focusable element on every page.
6. No WCAG AA contrast failures introduced by the Ragnarök overlay or milestone toasts.
7. All CSS animations suppressed under `prefers-reduced-motion: reduce` — content still appears.

---

## Where FiremanDecko Has Flexibility

The following implementation details are flexible (UX does not prescribe the exact approach):

- Fragment 4 trigger: 7th card save (preferred) OR long-press on Delete button (fallback). FiremanDecko chooses.
- Fragment 6 idle duration: 15 seconds preferred; 10 seconds acceptable if product team finds 15 too long in testing.
- Toast positioning library: shadcn/ui `useToast` or `sonner` — whichever is installed (check package.json).
- `WolfHungerMeter` can be a function component or a custom hook — whatever fits the existing pattern.
- The exact DOM structure for focus management after card actions (ref vs. querySelector) is an implementation detail.
