# Product Design Brief: Agent Chronicle MDX Parity

**Status (2026-03-20):** Shipped. `chronicle-norse.css` is live at `development/frontend/src/app/(marketing)/chronicles/chronicle-norse.css`. The `--publish` codepath in `generate-agent-report.mjs` emits decree header, agent callback footer, heckler chat bubbles, and explosion animations in MDX output. `sanitize-chronicle.mjs` handles secret sanitization. All Norse CSS is scoped under `.chronicle-page` and shared across chronicle tiers.

---

## Problem Statement

The `/brandify-agent` skill produces two outputs: (1) rich HTML reports with the full
Norse visual system -- All-Father's Decree header, agent callback footer, explosion
animations, toolbox merging, chat bubbles, and heckler avatars -- and (2) MDX chronicles
published to `/chronicles/{slug}` via `--publish`. The MDX output is structurally basic:
it uses `<details>/<summary>` for collapsible turns and has stats/changes, but lacks the
Norse ceremonial elements that make the HTML reports distinctive. The gap means the
public-facing chronicles on fenrirledger.com are a downgrade from the internal HTML
reports.

This is the first of three planned chronicle tiers. Saga Chronicles (multi-agent chain
stitching) are explicitly deferred.

## Target User

Visitors to fenrirledger.com/chronicles who want to see how the AI agent pack builds
Fenrir Ledger. The chronicles are public-facing content marketing -- they need to carry
the same brand weight as the rest of the site.

## Desired Outcome

After this ships, `/brandify-agent --publish` produces MDX chronicles with visual parity
to the HTML reports. The Norse components (decree header, callback footer, heckler chat
bubbles, explosion animations) are built as **shared, reusable MDX/CSS components** so
all three chronicle tiers (Agent, Session, Saga) can use them.

## Interactions & User Flow

1. Agent dispatched via `/fire-next-up` completes its work
2. Odin runs `/brandify-agent <session-id> --publish`
3. Script generates MDX to `content/blog/agent-{slug}.mdx`
4. MDX includes shared Norse components (decree, callback, hecklers, etc.)
5. Chronicle renders at `/chronicles/agent-{slug}` with full Norse styling
6. Public visitors browse chronicles index, see Agent badge, click through to
   fully-styled report

## Look & Feel Direction

Must match the existing HTML report aesthetic. The Dark Nordic War Room. Specifically:

- **All-Father's Decree header** -- ornamental top border, Cinzel Decorative title,
  decree seal glyph, quoted law/oath sections
- **Agent callback footer** -- runic border lines, avatar, blood-seal declaration,
  wolf howl closer
- **Heckler chat bubbles** -- Mayo heckler identity (avatar, name, bio), colored
  message bubbles with personality
- **Explosion animations** -- `@keyframes explosion-glow` on heckler events
- **Toolbox merging section** -- visual representation of tools used/merged
- **Collapsible turns** -- already present in MDX, keep `<details>/<summary>`
- **Stats grid, changes, commits** -- already present, keep as-is

## Acceptance Criteria

- [x] `/brandify-agent <id> --publish` produces MDX with All-Father's Decree header
- [x] MDX includes agent callback footer with avatar and blood-seal declaration
- [x] Heckler chat bubbles render in MDX turns with correct identity/styling
- [x] Explosion animations render on heckler events in MDX chronicles
- [x] All Norse CSS components live in shared stylesheet(s) under `chronicles/`
      (`chronicle-norse.css` scoped under `.chronicle-page`)
- [x] Shared components are reusable by Session and Saga chronicles (no agent-only coupling)
- [x] Secret sanitization: `sanitize-chronicle.mjs` strips/masks secrets before writing MDX
- [ ] Chronicle renders correctly at `/chronicles/agent-{slug}` on desktop and mobile
      (375px minimum) — verify with Loki QA pass
- [x] Luna provided wireframes (issue #1047 — `ux/wireframes/chronicles/`)
- [x] Existing basic agent chronicles still render (no regression on current MDX files)

## Priority & Constraints

- **Priority:** high
- **Sprint:** next
- **Dependencies:** Luna wireframes must land before FiremanDecko implements
- **Max stories:** 5
- **Constraint:** Saga chronicle stitching is out of scope -- do not design for
  multi-agent chain assembly in this phase
- **Constraint:** All chronicles are public on fenrirledger.com -- secret sanitization
  is a hard requirement, not a nice-to-have

## Suggested Issue Breakdown

| # | Title | Type | Priority | Agent Chain | Description |
|---|-------|------|----------|-------------|-------------|
| 1 | Chronicle page wireframes for Norse MDX components | ux | high | Luna -> FiremanDecko -> Loki | Luna wireframes for decree header, callback footer, heckler bubbles, explosion animations in chronicle layout. Must show desktop + mobile (375px). |
| 2 | Extract shared Norse CSS from HTML generator into chronicle.css | enhancement | high | FiremanDecko -> Loki | Move decree, callback, heckler, explosion CSS from inline in `generate-agent-report.mjs` into `chronicle.css` as shared classes scoped under `.chronicle-page`. Ensure HTML reports still work (they keep their own inline CSS). |
| 3 | MDX generator: decree header + callback footer | enhancement | high | FiremanDecko -> Loki | Update `--publish` codepath in `generate-agent-report.mjs` to emit decree header and callback footer markup in MDX output. Wire to shared CSS classes from story 2. |
| 4 | MDX generator: heckler chat bubbles + explosion animations | enhancement | normal | FiremanDecko -> Loki | Update `--publish` codepath to emit heckler identity bubbles (avatar, name, bio, message) and explosion animation markup. Wire to shared CSS. |
| 5 | Secret sanitization for published chronicles | enhancement | high | FiremanDecko -> Loki | Add a sanitization pass in the `--publish` codepath that strips/masks API keys, tokens, env values, file paths containing secrets, and any output matching secret patterns before writing MDX. Verify against existing masking rules from `CLAUDE.md`. |

## Open Questions for Engineer

1. **CSS delivery:** Should the shared Norse CSS be added to the existing `chronicle.css`
   or split into a separate file (e.g., `chronicle-norse.css`) that both chronicle.css
   and the HTML generator can reference?
2. **Heckler avatars:** The HTML reports use inline base64 or local image paths for
   heckler avatars. For public MDX, should these be committed to `public/` as static
   assets, or generated as inline SVG placeholders?
3. **Explosion animations:** These use `@keyframes` in the HTML CSS. Do they need any
   `prefers-reduced-motion` guard for accessibility compliance?
4. **Backward compatibility:** There are ~25 existing MDX agent chronicles in
   `content/blog/`. Should the new shared CSS be written so they render unchanged, or
   is it acceptable to regenerate them with the updated generator?

## Handoff Notes

- The HTML generator lives at `.claude/skills/brandify-agent/scripts/generate-agent-report.mjs`
- The existing chronicle CSS lives at `development/frontend/src/app/(marketing)/chronicles/chronicle.css`
- The existing MDX publish codepath already handles frontmatter, stats grid, changes,
  commits, and collapsible turns -- this work adds the Norse ceremonial layer on top
- The heckler engine is imported from `infrastructure/k8s/agents/mayo-heckler.mjs` --
  it already runs during `--publish`, the heckle content just is not emitted to MDX yet
- Luna: I need wireframes showing decree header, callback footer, and heckler bubbles
  in the chronicle page layout, at desktop and 375px mobile. The HTML reports
  (in `tmp/agent-logs/*.html`) are the visual reference.
