# Future / Deferred Items

Stories explicitly parked by Freya. These are not forgotten — they are in the queue for the right sprint. Last reviewed 2026-03-01 after Sprint 5 shipped.

---

## LCARS Mode (Star Trek Easter Egg #6) — Pulled into Sprint 5

**Status**: Scheduled as Story 5.5. No longer deferred.

---

## localStorage Migration Wizard — Explicitly and Permanently Deferred to GA

**Why deferred**: The product brief is unambiguous: "Remote storage and data migration are explicitly deferred until the team has received multiple rounds of real user feedback and declared the product ready for GA." This is a product constraint, not a technical one. localStorage is sufficient for the entire validation cycle.

**This cannot be moved up** regardless of sprint capacity. If FiremanDecko wants to do preparatory architectural work, he can open an ADR for review — but no user-visible migration UI will ship before GA planning is triggered.

---

## Smart Reminders / Notification Engine — Deferred to Sprint 6+

**Why deferred**: The product brief lists this as a "Future" item. It requires either push notifications (requires a backend service) or in-browser notifications (requires the Notifications API + user permission). The dedicated backend server was removed in PR #60 (replaced with Vercel serverless API routes), so push notifications would need a new delivery mechanism. The Howl panel is the current reminder surface and is sufficient for MVP validation.

---

## Reward Value Tracking + Net ROI — Deferred to Sprint 6+

**Why deferred**: The Wolf's Hunger meter (Story 4.5) surfaces existing bonus data. True reward tracking — logging ongoing spend per category, calculating net value after fees paid — requires new data model fields (`feePaid`, `rewardsEarned` log, etc.) and likely a new UI surface. This is a significant feature that deserves its own sprint, not a bolt-on to the easter egg system.

---

## Timeline View — Deferred

**Why deferred**: The product brief describes a timeline view showing card opening dates, promo expiration, and fee dates on a visual axis. This is a meaningful feature but has no UX wireframe and no architecture plan. It belongs in a dedicated sprint with Luna designing it first.

---

## Action Recommendations (Valkyrie Engine) — Deferred

**Why deferred**: The mythology-map describes a "Valkyrie" recommendation engine (keep, close, downgrade, transfer). This requires business logic that touches card ROI, issuer rules, and user preferences. It's a product feature that warrants its own design brief. Not Sprint 4.

---

## Optional Login / Google OIDC (Iteration 2) — Deferred to GA

**Status**: Story `story-auth-oidc-google.md` exists in the backlog and is marked P3-Medium. The anonymous-first auth + cloud sync upsell banner shipped in Sprint 3. Actual OIDC authentication and backend storage are deferred to GA per the product brief. Nothing changes here.

---

## Wolf Paw Cursor — Deferred

**Spec**: `public/cursors/wolf-paw.svg` is mentioned in the architecture brief as a Sprint 4 item. However, custom SVG cursors have inconsistent browser support (especially on mobile, where cursors don't apply) and add non-trivial asset work for minimal user impact. Deferred indefinitely unless Luna champions it with a specific UX rationale.

---

## Data Export (CSV/JSON) — Deferred

**Why deferred**: Useful for power users who want a backup or want to switch tools. But this is pre-GA work only — during the validation cycle, localStorage data is visible via DevTools and the upsell banner will eventually prompt users toward cloud sync. No sprint target yet.
