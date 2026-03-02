# Backlog Item: Bank Glyphs — Norse Issuer Logos

**Status:** Backlog
**Priority:** P2-High
**Owner:** Luna (UX Designer) + Freya (Product Owner)
**Sprint:** Unscheduled

---

## Summary

Replace generic text issuer names with custom Norse-themed SVG glyphs for each bank/issuer. Each glyph should be a wolf-perspective reimagining of the real bank's logo — Fenrir stalking his prey. The banks are the chains that bind; their logos become the glyphs of enemies the wolf must pursue and overcome.

## Creative Direction

**Voice of the Wolf:** Each bank is a fetter, a chain-maker. Their glyphs should feel like prey marks — symbols Fenrir has carved to track his quarry. The logos should be recognizable echoes of the real bank logos, but rendered through Norse mythology and the predator's eye.

**Style guidelines:**
- SVG format (scalable, theme-aware, works at 24px and 48px)
- Monochrome base with gold accent capability (follows Saga Ledger theme)
- Each glyph should evoke the real bank's visual identity but transformed through Norse aesthetic
- Rune-like line quality — angular, carved, deliberate
- The wolf is the viewer; these are his prey's sigils

## Issuer Glyph Map

Each glyph should reference the real logo's most recognizable visual element:

| Issuer ID | Bank | Real Logo Reference | Norse Glyph Concept |
|-----------|------|--------------------|--------------------|
| `amex` | American Express | Centurion warrior, blue box | A Norse shield-bearer or einherjar silhouette, angular box frame |
| `bank_of_america` | Bank of America | Red/blue flag stripes | A tattered war banner with runic stripe pattern |
| `barclays` | Barclays | Spread eagle | A raven (Huginn/Muninn) with spread wings |
| `capital_one` | Capital One | Swoosh arc | A crescent moon arc — Hati chasing Máni |
| `chase` | Chase | Octagon/pinwheel | A valknut or interlocking angular form |
| `citibank` | Citibank | Arc over text | Bifröst bridge arc |
| `discover` | Discover | Orange circle/sun | Sól (sun) disc being pursued by Sköll |
| `hsbc` | HSBC | Red hexagon/arrows | Interlocking axes forming a hex shape |
| `us_bank` | US Bank | Shield/eagle | A round shield with runic inscription |
| `wells_fargo` | Wells Fargo | Stagecoach | A Viking longship in profile |
| `other` | Other | Generic | A single Elder Futhark rune (ᚠ Fehu — wealth) |

## Technical Context

### Current State
- Issuers defined in `development/frontend/src/lib/constants.ts` as `KNOWN_ISSUERS: Issuer[]`
- Issuer type: `{ id: string; name: string }` in `development/frontend/src/lib/types.ts`
- Cards display issuer as text: `issuer?.name ?? card.issuerId`
- No existing issuer icons/logos anywhere in the codebase

### Implementation Approach
1. **Create SVG glyphs** using `/imagen` skill — one per issuer, output as inline SVG components
2. **New component**: `components/shared/IssuerGlyph.tsx` — maps `issuerId` to the corresponding SVG
3. **Integration points**: Card list items, card detail view, import preview, CardForm issuer dropdown
4. **Sizing**: Support `size` prop — `"sm"` (24px for list items), `"md"` (32px for cards), `"lg"` (48px for detail view)
5. **Theme-aware**: Use `currentColor` for strokes, `var(--gold)` for accents, respects dark theme

### Files to Modify
- `development/frontend/src/lib/types.ts` — No change needed (id is already the key)
- `development/frontend/src/app/page.tsx` — Add glyph next to issuer name in card list
- `development/frontend/src/components/sheets/ImportWizard.tsx` — Add glyph in preview step
- New: `development/frontend/src/components/shared/IssuerGlyph.tsx`
- New: `development/frontend/src/components/shared/glyphs/` — individual SVG components per issuer

## Production Process

1. **Luna** defines the visual spec: exact proportions, stroke weights, gold accent placement
2. **Use `/imagen` skill** to generate each SVG glyph with the Norse wolf aesthetic
3. **FiremanDecko** builds the `IssuerGlyph` component and integrates across the app
4. **Loki** validates rendering at all sizes, theme compliance, and accessibility (aria-labels)

## Acceptance Criteria

- [ ] Each of the 10 known issuers + "other" has a unique Norse-themed SVG glyph
- [ ] Glyphs are recognizably inspired by the real bank logos
- [ ] All glyphs render cleanly at 24px, 32px, and 48px
- [ ] Glyphs use `currentColor` and theme variables (no hardcoded colors)
- [ ] `IssuerGlyph` component accepts `issuerId` and `size` props
- [ ] Glyphs appear in: card list, card detail, import preview, issuer dropdown
- [ ] Each glyph has an `aria-label` with the bank name
- [ ] "Other" issuer uses the Fehu (ᚠ) rune as fallback
- [ ] Build passes, TypeScript passes
