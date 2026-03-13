# Implementation Plan: 30-Day Free Trial Before Karl Upsell

**Objective:** Offer users a 30-day free trial of all Karl features before upselling them to the paid tier ($3.99/mo).

**Status:** Ready for FiremanDecko implementation

---

## Product Decisions (Locked)

### Trial Mechanics
- **Trigger:** Trial starts when user creates their first card (including import)
- **Duration:** 30 days from creation of first card
- **Access:** Full Karl feature access for entire 30-day period
- **Data Preservation:** All data preserved after trial expires; users must subscribe to re-access Karl features
- **Client-Side Implementation:** All trial logic handled client-side until expiry; then hook into existing Karl subscription flow

### Messaging Strategy
- **Tone:** Easy on guilt, show value alongside loss aversion
- **Personalization:** Include saved fees/metrics (e.g., "You've tracked 12 cards, $2,800 in annual fees")
- **Copy:** Shift progressively from "Subscribe" (days 1-25) → "Keep full access" (days 26-30) → "Your data is safe" (expired)

### Success Metrics
- Trial start date (when first card created)
- Conversion date (when user upgrades from trial to paid Karl)
- Trial-to-paid conversion rate target: 2-5% (no-card baseline for freemium SaaS)

---

## Design Artifacts (Luna Completed)

All wireframes located in `ux/wireframes/trial/`:

1. **trial-start.html** — Trial initiation experience
   - Celebration toast (8s via sonner, reuses existing toast infrastructure)
   - TopBar badge showing days remaining
   - 6 scenarios including import variant + mobile 375px

2. **trial-status.html** — During-trial messaging and awareness
   - TrialStatusPanel dropdown with personalized metrics
   - Progress bar, fee savings, card count
   - Mid-trial nudge (day 15, one-time)
   - Settings integration

3. **trial-expiry.html** — Day 30 boundary and upgrade decision
   - Expiry modal with value recap + feature comparison
   - "Keep full access" CTA + "Continue with free plan" option (equal weight)
   - Post-decline dashboard state
   - Returning user re-subscribe path

4. **trial-feature-gates.html** — Feature access matrix after trial expires
   - Tab bar lock states (The Howl, Valhalla locked after trial)
   - Card limit overlays (Thrall limit: 3 visible, 12 on file)
   - Reuses existing KarlUpsellDialog and gate components
   - localStorage key reference for trial tracking

---

## Implementation Scope (for FiremanDecko)

### Phase 1: Trial State Management
- [ ] Create trial state hook: `useTrialStatus()`
  - Read/write trial start date from localStorage (`fenrir:trial-start`)
  - Compute remaining days
  - Track trial status: "active" | "expired" | "converted" | "none"
- [ ] Add trial context to RootContext or useAuth()
- [ ] Create `isKarlOrTrial()` helper (wraps existing `isKarl()` check)

### Phase 2: Toast Infrastructure Expansion
- [ ] Expand existing sonner toast usage to support trial-specific toasts
  - **Trial start toast:** "Your 30-day trial has begun — explore all features"
  - **Day 15 nudge:** "15 days left to experience Karl features"
  - **Day 30 expiry:** "Your trial expires today — keep full access for $3.99/mo"
  - Duration: 8s (consistent with existing toasts)
  - Ensure toast appears only once per trigger (track in localStorage)

### Phase 3: TopBar Trial Badge
- [ ] Add badge to TopBar showing remaining days or trial status
  - Days 1-25: Neutral ("22 days left")
  - Days 26-29: Amber warning ("4 days left")
  - Day 30: Red/urgent ("Expires today")
  - Expired: "THRALL" (reuse existing badge)
- [ ] Click badge to open TrialStatusPanel

### Phase 4: TrialStatusPanel Component
- [ ] Create modal/dropdown for trial status details
  - Personalized metrics: cards tracked, fee alerts, potential savings
  - Compute from actual card data in localStorage
  - "Subscribe Now" CTA
  - "Learn More" link to pricing page
- [ ] Position: Accessible from TopBar badge + Settings page

### Phase 5: Trial Expiry Flow
- [ ] Day 30: Show TrialExpiryModal with:
  - Value recap (cards, savings, alerts)
  - Feature comparison table (Active vs Karl)
  - "Keep Full Access" CTA → Stripe checkout
  - "Continue with Free Plan" button (equal visual weight)
  - "Your data is safe" messaging
  - Show only once; save dismissal state
- [ ] Post-expiry on Thrall: Activate existing feature gates
  - The Howl tab: lock + KARL badge
  - Valhalla tab: lock + KARL badge
  - Active tab: limit to 3 visible cards (existing logic)
  - Reuse existing `isKarlOrTrial()` checks

### Phase 6: Mid-Trial Nudge (Day 15)
- [ ] One-time modal or banner on day 15
  - Highlight most-used Karl feature or saved fees
  - "Not ready yet? You have 15 more days to explore"
  - Close button (do not force)
  - Track dismissal in localStorage

### Phase 7: Returning User Path
- [ ] If user signed out during trial, re-sign in, trial remains active
- [ ] If user previously on trial, expired, and returns: show clear re-subscribe path
  - "Your trial ended. Keep full access for $3.99/mo"
  - Settings → "Upgrade to Karl"

### Phase 8: localStorage Schema
- [ ] Keys to create/maintain:
  - `fenrir:trial-start` — ISO timestamp of first card creation
  - `fenrir:trial-conversion` — ISO timestamp of subscription (if converted)
  - `fenrir:trial-day15-nudge-shown` — boolean (one-time)
  - `fenrir:trial-expiry-modal-shown` — boolean (one-time)
  - `fenrir:trial-start-toast-shown` — boolean (one-time)

---

## Technical Constraints & Notes

1. **Client-Side Only (Until Expiry):** All trial logic lives in browser until day 30. At expiry, hook into existing Karl subscription flow (`KarlUpsellDialog`, Stripe Checkout).

2. **Sonner Integration:** Trial toasts reuse existing `sonner` library already in app. No new dependencies.

3. **Reuse Existing Gates:** The trial does not introduce new feature gate UI. When trial expires, existing Thrall gates activate automatically via `isKarlOrTrial()` wrapper.

4. **No New localStorage Keys Needed (Mostly):** Trial uses existing localStorage structure; add 3-4 tracking keys as listed above.

5. **No Backend Changes:** Trial logic is purely frontend. Stripe subscription flow is unchanged. FiremanDecko only needs to expand existing toast & gate logic.

6. **Accessibility:** All trial UI must follow WCAG 2.1 AA (color contrast, focus management, keyboard navigation). See Luna's wireframes for full a11y spec.

---

## Handoff Criteria

Implementation is complete when:
- [ ] `useTrialStatus()` hook works correctly (computes remaining days, status)
- [ ] Trial badge appears in TopBar with correct urgency color
- [ ] Trial start toast fires once on first card creation
- [ ] TrialStatusPanel opens and shows personalized metrics
- [ ] Mid-trial nudge (day 15) appears once
- [ ] Day 30 expiry modal appears with value recap + feature comparison
- [ ] Post-expiry: feature gates activate (The Howl, Valhalla locked; 3-card limit on Active)
- [ ] Sonner toast infrastructure expanded with trial-specific messages
- [ ] localStorage keys tracked correctly
- [ ] tsc + build pass
- [ ] All acceptance criteria met (no new test suite needed — existing E2E covers Karl gates)

---

## References

- **Wireframes:** `ux/wireframes/trial/` (4 files)
- **Interaction Spec:** `ux/interactions.md` (Trial Flow section)
- **Existing Gates:** `ux/wireframes/app/howl-karl-tier.html`, `valhalla-karl-gated.html`
- **KarlUpsellDialog:** `development/frontend/src/components/entitlement/KarlUpsellDialog.tsx`
- **Existing Toast Usage:** `development/frontend/src/app/ledger/page.tsx` (card import toast example)

