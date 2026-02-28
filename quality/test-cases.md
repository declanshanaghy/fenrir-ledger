# Test Cases — Fenrir Ledger

## Easter Egg Test Cases

### TC-E2-001: Konami Code Sequence Trigger
**Category:** Functional
**Priority:** P2-High
**Type:** UI

**Preconditions:**
- App is loaded and visible
- User has no open modals or dialogs
- Keyboard focus is on the document body (not on input/textarea/select)

**Steps:**
1. Press Arrow Up, Arrow Up, Arrow Down, Arrow Down, Arrow Left, Arrow Right, Arrow Left, Arrow Right, B, A in sequence
2. Observe the viewport for visual feedback

**Expected Result:**
- FENRIR AWAKENS status band appears at the top of the viewport (blood orange text, Cinzel Decorative font)
- Wolf head silhouette rises from the bottom of the viewport
- Both elements remain visible for ~3 seconds then fade out
- Body shakes subtly during the animation
- If any cards have fee_approaching or promo_expiring status, a deep-red Ragnarök pulse flashes before the wolf rises

**Idempotent:** Yes (can be triggered multiple times, state resets after sequence completes)

---

### TC-E2-002: Konami Code Sequence Reset
**Category:** Edge Case
**Priority:** P3-Medium
**Type:** UI

**Preconditions:**
- App is loaded
- Konami listener is active

**Steps:**
1. Press Arrow Up, Arrow Up, Arrow Down
2. Press 'X' (a key not in the sequence)
3. Press Arrow Up, Arrow Up
4. Wait 1 second

**Expected Result:**
- FENRIR AWAKENS overlay does NOT appear
- The sequence state is reset after the wrong key, so pressing Up, Up alone does not trigger the egg

**Idempotent:** Yes

---

### TC-E2-003: Konami Code Should Not Trigger on Input Focus
**Category:** Edge Case
**Priority:** P3-Medium
**Type:** UI

**Preconditions:**
- App is loaded
- There is a visible input/textarea/select field on the page

**Steps:**
1. Click on an input/textarea/select field to focus it
2. Type the full Konami sequence while the field is focused
3. Observe the viewport

**Expected Result:**
- FENRIR AWAKENS overlay does NOT appear
- The keydown listener ignores input when input fields have focus to avoid interfering with user typing

**Idempotent:** Yes

---

### TC-E3-001: Mountain Roots Modal Opens on First Sidebar Collapse
**Category:** Functional
**Priority:** P2-High
**Type:** UI

**Preconditions:**
- App is loaded
- Sidebar is not collapsed (standard expanded state)
- localStorage key "egg:gleipnir-3" is NOT set
- Collapse button/toggle is visible

**Steps:**
1. Click the sidebar collapse button (usually near the top-left of the sidebar or in the TopBar)
2. Observe the modal that appears

**Expected Result:**
- EasterEggModal dialog opens with:
  - Title: "The Roots of a Mountain" (exact match, Cinzel Decorative font, gold #f0b429)
  - Image src contains "gleipnir-3.svg"
  - Image alt contains "Roots of a Mountain" or "Gleipnir artifact"
  - Body text mentions "six impossible things" and Gleipnir
  - Fragment counter shows "1 of 6" (or higher if other eggs have been found)
  - "So it is written" dismiss button is visible
  - Modal plays fenrir-growl.mp3 audio

**Idempotent:** No — one-time gate via localStorage

---

### TC-E3-002: Mountain Roots One-Time Gate
**Category:** Functional
**Priority:** P2-High
**Type:** UI

**Preconditions:**
- App is loaded
- Egg #3 has already been triggered and dismissed (localStorage key "egg:gleipnir-3" is set)
- Sidebar is currently expanded

**Steps:**
1. Click the sidebar collapse button
2. Expand the sidebar again
3. Click the sidebar collapse button again
4. Wait 1 second

**Expected Result:**
- First collapse: modal opens and can be dismissed
- Second collapse: modal does NOT open again
- The localStorage gate prevents re-triggering

**Idempotent:** No — idempotency test for gate

---

### TC-E3-003: Modal Dismiss Closes Dialog
**Category:** Functional
**Priority:** P2-High
**Type:** UI

**Preconditions:**
- Mountain Roots modal is open

**Steps:**
1. Click the "So it is written" button
2. Observe the modal

**Expected Result:**
- Modal closes immediately
- Focus returns to the collapse button (or nearby element)

**Idempotent:** Yes

---

### TC-E5-001: Fish Breath Modal Opens on Copyright Hover
**Category:** Functional
**Priority:** P2-High
**Type:** UI

**Preconditions:**
- App is loaded
- Footer is visible
- Copyright symbol (©) is visible in the footer
- localStorage key "egg:gleipnir-5" is NOT set

**Steps:**
1. Hover the mouse over the © symbol in the footer
2. Observe the modal that appears

**Expected Result:**
- EasterEggModal dialog opens with:
  - Title: "The Breath of a Fish" (exact match, Cinzel Decorative font, gold #f0b429)
  - Image src contains "gleipnir-5.svg"
  - Image alt contains "Breath of a Fish" or "Gleipnir artifact"
  - Body text mentions "six impossible things" and Gleipnir
  - Fragment counter shows "1 of 6" (or higher if other eggs have been found)
  - "So it is written" dismiss button is visible
  - Modal plays fenrir-growl.mp3 audio

**Idempotent:** No — one-time gate via localStorage

---

### TC-E5-002: Fish Breath One-Time Gate
**Category:** Functional
**Priority:** P2-High
**Type:** UI

**Preconditions:**
- App is loaded
- Egg #5 has already been triggered and dismissed (localStorage key "egg:gleipnir-5" is set)
- Footer is visible

**Steps:**
1. Move mouse away from the © symbol
2. Hover the © symbol again
3. Wait 1 second

**Expected Result:**
- First hover: modal opens and can be dismissed
- Second hover: modal does NOT open again
- The localStorage gate prevents re-triggering

**Idempotent:** No — idempotency test for gate

---

### TC-E5-003: Fish Breath Touch Trigger
**Category:** Functional
**Priority:** P2-High
**Type:** UI

**Preconditions:**
- App is loaded on a touch device or in touch simulation mode
- Footer is visible
- Copyright symbol (©) is visible
- localStorage key "egg:gleipnir-5" is NOT set

**Steps:**
1. Touch the © symbol (onTouchStart)
2. Observe the modal

**Expected Result:**
- Modal opens with same content as hover trigger
- Touch provides the user gesture needed for audio playback

**Idempotent:** No — one-time gate

---

### TC-E9-001: Forgemaster Modal Opens on ? Key
**Category:** Functional
**Priority:** P2-High
**Type:** UI

**Preconditions:**
- App is loaded
- Keyboard focus is on the document body (not on input/textarea/select)
- localStorage key "egg:forgemaster" is NOT set

**Steps:**
1. Press ? (Shift+/)
2. Observe the modal that appears

**Expected Result:**
- EasterEggModal dialog opens with:
  - Title: "The Forgemaster's Signature" (exact match, Cinzel Decorative font, gold #f0b429)
  - Image src contains "forgemaster.svg"
  - Image alt contains "Forgemaster" or "forge" or "artifact"
  - Body text lists The Pack:
    - Freya — Product Owner
    - Luna — UX Designer
    - FiremanDecko — Principal Engineer
    - Loki — QA Tester
  - Lore quote: "Forged in the fires of Muspelheim..."
  - Fragment counter shows "N of 6" (depends on other eggs found)
  - If all 6 fragments are found, shows "Gleipnir is complete. The wolf stirs."
  - "So it is written" dismiss button is visible
  - Modal plays fenrir-growl.mp3 audio

**Idempotent:** No — one-time gate via localStorage

---

### TC-E9-002: Forgemaster One-Time Gate
**Category:** Functional
**Priority:** P2-High
**Type:** UI

**Preconditions:**
- App is loaded
- Egg #9 has already been triggered and dismissed (localStorage key "egg:forgemaster" is set)

**Steps:**
1. Press ? (Shift+/)
2. Wait 1 second

**Expected Result:**
- Modal does NOT open again
- The localStorage gate prevents re-triggering

**Idempotent:** No — idempotency test for gate

---

### TC-E9-003: Forgemaster Should Not Trigger on Input Focus
**Category:** Edge Case
**Priority:** P3-Medium
**Type:** UI

**Preconditions:**
- App is loaded
- There is a visible input/textarea/select field
- localStorage key "egg:forgemaster" is NOT set

**Steps:**
1. Click on an input/textarea/select field to focus it
2. Press ? (Shift+/) while focused
3. Observe the modal

**Expected Result:**
- Modal does NOT open
- The keydown listener ignores input when input fields have focus

**Idempotent:** Yes

---

### TC-LOK-001: Loki Mode Toast Appears After 7 Clicks
**Category:** Functional
**Priority:** P2-High
**Type:** UI

**Preconditions:**
- App is loaded
- Footer is visible
- "Loki" text/link is visible in the footer colophon
- localStorage key for Loki Mode (if any) is NOT set

**Steps:**
1. Click the "Loki" text 7 times in rapid succession
2. Observe the viewport

**Expected Result:**
- After 7 clicks, a toast appears at the top of the viewport with text:
  - "Loki was here. Your data is fine. Probably."
  - Toast has gold color (#f0c040) text
  - Toast has semi-transparent dark background with gold border
  - Toast is role="status" aria-live="polite"
- Toast persists for ~5 seconds then fades
- Card grid may shuffle into random order (visual indicator of Loki's chaos)

**Idempotent:** Yes (7-click threshold resets automatically)

---

### TC-LOK-002: Loki Mode Should Not Trigger With Fewer Clicks
**Category:** Edge Case
**Priority:** P3-Medium
**Type:** UI

**Preconditions:**
- App is loaded
- "Loki" text is visible

**Steps:**
1. Click the "Loki" text 5 times
2. Wait 2 seconds

**Expected Result:**
- Toast does NOT appear
- Fewer than 7 clicks does not trigger the mode

**Idempotent:** Yes

---

### TC-MOD-001: Modal Closes on X Button Click
**Category:** Functional
**Priority:** P2-High
**Type:** UI

**Preconditions:**
- Any EasterEggModal is open

**Steps:**
1. Click the X close button (top-right corner of the modal)
2. Observe the modal

**Expected Result:**
- Modal closes immediately
- Focus management returns focus to the trigger element

**Idempotent:** Yes

---

### TC-MOD-002: Modal Styling (Dark Theme)
**Category:** Functional
**Priority:** P1-Critical
**Type:** UI

**Preconditions:**
- Any EasterEggModal is open

**Steps:**
1. Inspect the modal DOM

**Expected Result:**
- Modal background color is dark (#0f1018 or similar)
- Modal title text is gold (#f0b429)
- Modal border is subtle (#2a2d45 or similar)
- Modal button is gold background with dark text
- Modal button text is "So it is written"
- Font family for title is Cinzel Decorative (or fallback serif)

**Idempotent:** Yes

---

### TC-MOD-003: Modal Responsive on Mobile
**Category:** Functional
**Priority:** P2-High
**Type:** UI

**Preconditions:**
- Any EasterEggModal is open
- Viewport width is 375px (mobile) or less

**Steps:**
1. Open modal on mobile viewport
2. Measure modal width

**Expected Result:**
- Modal width is 92vw (92% of viewport width)
- Modal has max-width of 680px
- Content is readable and not cut off on small screens
- Image and text stack vertically on mobile (not side-by-side)

**Idempotent:** Yes

---

### TC-FRAG-001: Fragment Count Tracking Across Eggs
**Category:** Functional
**Priority:** P2-High
**Type:** Integration

**Preconditions:**
- App is loaded with clean localStorage
- All eggs are available to trigger

**Steps:**
1. Trigger Egg #3 (Sidebar collapse) and dismiss
2. Open DevTools and verify localStorage has `egg:gleipnir-3` = "1"
3. Trigger Egg #5 (Footer hover) and check fragment count in modal
4. Open DevTools and verify localStorage has `egg:gleipnir-5` = "1"
5. Trigger Egg #9 (? key) and check fragment count in modal
6. Verify the count increments across all eggs

**Expected Result:**
- After Egg #3: modal shows "1 of 6 Gleipnir fragments found"
- After Egg #5: modal shows "2 of 6 Gleipnir fragments found"
- After Egg #9: modal shows "2 of 6 Gleipnir fragments found" (since #9 doesn't trigger, it reads existing count)
- localStorage persists each fragment discovery

**Idempotent:** No — fragment count is cumulative

---

### TC-FRAG-002: Complete Gleipnir Collection Message
**Category:** Functional
**Priority:** P3-Medium
**Type:** Integration

**Preconditions:**
- App is loaded
- All 6 Gleipnir fragment localStorage keys are manually set:
  - egg:gleipnir-1 through egg:gleipnir-6 all = "1"

**Steps:**
1. Open any EasterEggModal (e.g., Forgemaster by pressing ?)
2. Observe the fragment counter section

**Expected Result:**
- Fragment counter displays "6 of 6 Gleipnir fragments found"
- Additional message appears: "✦ Gleipnir is complete. The wolf stirs." (pulsing/animated text)
- Message indicates special state when all six impossible things are collected

**Idempotent:** Yes

---

## Summary

**Total Test Cases:** 22
**Easter Egg Coverage:**
- Konami Howl (#2): 3 test cases
- Mountain Roots (#3): 3 test cases
- Fish Breath (#5): 3 test cases
- Forgemaster (#9): 3 test cases
- Loki Mode (#3 variant): 2 test cases
- Modal UI/UX: 3 test cases
- Fragment Tracking: 2 test cases

**Execution Type:** Playwright UI automation (quality/scripts/test-easter-eggs.spec.ts)
