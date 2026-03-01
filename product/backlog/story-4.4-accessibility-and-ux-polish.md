# Story 4.4: Accessibility and UX Polish Pass

- **As a**: Credit card churner and rewards optimizer
- **I want**: The app to work correctly at every breakpoint, with keyboard-only navigation, and without jarring rough edges
- **So that**: I can use Fenrir Ledger efficiently on any device, in any context, without fighting the UI
- **Priority**: P2-High
- **Sprint Target**: 4
- **Status**: Done

---

## Context / Problem

Sprint 1 through 3 prioritized feature velocity. The design system is in, the mythology is wired, the easter eggs are landing. But this sprint creates an opportunity to address the accumulated roughness that fast-moving sprints always leave behind.

This is not a "nice to have" polish sprint. Accessibility is a minimum bar for any product that will reach real users. Several concrete issues have been identified or are likely based on the component inventory:

1. **Keyboard navigation through easter eggs**: The Gleipnir fragment modals, the About modal, and the ForgeMasterEgg dialog all need verified keyboard trap behavior (focus does not escape modal; Escape closes; Tab cycles within).
2. **Mobile layout at 375px**: The HowlPanel sidebar has not been verified on 375px width. At narrow widths it could overlap card content or push the main column.
3. **Focus management on card add/edit**: After a successful card save, focus should return to a sensible location (the "Add Card" button or the card tile that was just created). Right now focus likely falls off into the void.
4. **Toast positioning**: Toasts added in Story 4.2 need positioning verified on mobile so they do not overlap the sticky TopBar.
5. **StatusRing and StatusBadge aria labels**: Screen reader users need to understand the card status without relying on color or rune glyphs.
6. **The HowlPanel on mobile**: The spec calls for it to be a drawer on mobile. Verify it renders as a drawer (from the bottom or side) at <768px, not a fixed sidebar that overlaps content.
7. **Animation reduced-motion support**: `prefers-reduced-motion` should suppress or reduce all `framer-motion` and CSS keyframe animations. The `globals.css` likely does not have these media query overrides yet.

---

## Desired Outcome

After this story ships:
- A keyboard-only user can add a card, navigate to Valhalla, open and close the About modal, and dismiss the HowlPanel without using a mouse
- A user on a 375px mobile device sees no horizontal overflow on any page
- Screen readers announce card status in plain English (not just rune glyphs)
- All animations respect `prefers-reduced-motion: reduce`
- Focus is managed correctly on modal open and close throughout the app

---

## Acceptance Criteria

**Keyboard Navigation:**
- [ ] The About modal traps focus when open: Tab cycles through interactive elements inside the modal; Escape closes it; focus returns to the trigger element (Fenrir logo button) on close
- [ ] The ForgeMasterEgg (`?` shortcut) modal traps focus and closes on Escape; focus returns to the previously focused element
- [ ] All 6 Gleipnir fragment modals trap focus and close on Escape
- [ ] The HowlPanel is keyboard-reachable (a skip link or Tab order includes it)
- [ ] The SyncIndicator dot is keyboard-accessible (Tab-focusable, Enter/Space triggers the fragment)

**Mobile Layout (375px minimum):**
- [ ] Dashboard card grid renders without horizontal overflow at 375px
- [ ] HowlPanel renders as a bottom drawer or dismissible overlay on mobile (<768px) — not as a sidebar that narrows the content column
- [ ] The TopBar, SideNav (collapsed), and main content column are all visible at 375px with no content clipped
- [ ] Toast notifications render within the viewport at 375px without overlapping the TopBar

**Focus Management:**
- [ ] After a successful card save (add or edit), focus moves to the newly created/updated card tile OR to the "Add Card" button — not lost
- [ ] After closing a card (sending to Valhalla), focus moves to the next card tile or the empty state if no cards remain
- [ ] After dismissing any modal, focus returns to the element that triggered it

**Screen Reader Accessibility:**
- [ ] `StatusBadge` includes an `aria-label` that reads the status in plain English (e.g. "Card status: Fee Due Soon — 14 days remaining")
- [ ] `StatusRing` SVG includes a `<title>` or `aria-label` with the days-remaining value
- [ ] Rune characters used as decorative elements carry `aria-hidden="true"` throughout
- [ ] Gleipnir fragment modals have accessible `DialogDescription` text (already partially implemented — verify all 6)

**Reduced Motion:**
- [ ] `@media (prefers-reduced-motion: reduce)` disables or reduces: `saga-enter`, `saga-shimmer`, `muspel-pulse`, `wolf-rise`, `raven-warn`, and `gleipnir-shimmer` animations
- [ ] Framer Motion's `useReducedMotion()` hook is applied in `AnimatedCardGrid.tsx` to suppress card enter/exit animations when the user prefers reduced motion

**Contrast:**
- [ ] No WCAG AA contrast failures on any foreground text against the Ragnarök red overlay (from Story 4.1)
- [ ] No WCAG AA contrast failures introduced by milestone toasts (from Story 4.2)

---

## Technical Notes for FiremanDecko

**Focus trap**: shadcn/ui `Dialog` handles focus trap by default via Radix UI. Verify this is working correctly for all modals — it should be, but test explicitly. The `ForgeMasterEgg` modal likely uses `Dialog` as well.

**HowlPanel mobile (code audit, Sprint 4 groom)**: `HowlPanel.tsx` exports both `HowlPanel` and `AnimatedHowlPanel`. The `AnimatedHowlPanel` already implements the mobile bottom-sheet pattern: when `mobileOpen` is true, it renders a backdrop + a `motion.div` anchored to `bottom-0` with `max-h-[70vh]`. The desktop panel slides in from the right using `AnimatePresence`. This is very close to the specified behaviour. FiremanDecko should verify the mobile sheet renders correctly at 375px and that the close button within the sheet is keyboard-accessible. No full rewrite should be necessary — just verification and any gap fixes.

**Reduced motion CSS**:
```css
@media (prefers-reduced-motion: reduce) {
  .saga-reveal > * {
    animation: none;
    opacity: 1;
    transform: none;
  }
  .ring--urgent {
    animation: none;
  }
  @keyframes saga-shimmer { /* no-op */ }
  html.gleipnir-complete {
    animation: none;
  }
}
```

**Framer Motion reduced motion**:
```tsx
import { useReducedMotion } from 'framer-motion';
const shouldReduce = useReducedMotion();
// Pass shouldReduce to AnimatePresence/motion.div to skip animations
```

**`aria-hidden` audit**: Search the codebase for all rune character renders. Each one should have `aria-hidden="true"`. Common patterns: `<span>ᚠ</span>` — add `aria-hidden="true"` to all.

**StatusBadge aria-label**: The badge text already uses plain English ("Active", "Fee Due Soon") per the copywriting doc. Verify these read correctly with VoiceOver/NVDA. Add `role="status"` if the badge updates dynamically.

---

## Open Questions Resolved

- **HowlPanel on mobile**: Drawer behavior at <768px. The spec always called for this; implementation was deferred.
- **Reduced motion scope**: All CSS animations and all Framer Motion transitions. No exceptions.
- **WCAG target**: AA (not AAA) for color contrast.

---

## UX Notes

See team norms (`memory/team-norms.md`) for the touch target minimum (44x44px) and mobile width minimum (375px). All items in this story are enforcement of existing team norms, not new requirements.

---

## Future (Not Sprint 4)

- Full WCAG AAA audit
- Automated accessibility testing in the Playwright CI suite (Axe integration)
- i18n / localization groundwork
