# Agent Profile Image — Reusable Prompt Template

Generate consistent Reddit profile avatars for the Fenrir Ledger agent team.

## Common Base (always included)

```
Reddit profile avatar, 3D digital art style, Norse fantasy portrait.
{{CHARACTER_DESCRIPTION}}
Wearing dark Nordic armor with fur trim and gold Celtic knotwork embroidery.
{{SIGNATURE_PROP}}
Elder Futhark runes {{RUNE_PLACEMENT}}.
Ice-blue and gold accent lighting, dramatic cinematic light from the runes
illuminating the face. Portrait framed from chest up, circular medallion
composition. {{FADE_INSTRUCTION}}
```

## Fade Instructions

| Theme | `{{FADE_INSTRUCTION}}` |
|-------|------------------------|
| dark  | `Circular vignette fading to pure solid black at the edges. Solid black background, no transparency.` |
| light | `Circular vignette fading to pure solid white at the edges. Solid white background, no transparency.` |

## Agent Variables

### Freya (Product Owner — Seer / Oracle)

From: `.claude/agents/freya.md` — "voice of the end user", owns product vision

| Variable | Value |
|----------|-------|
| `CHARACTER_DESCRIPTION` | `Norse seer oracle woman, dark braided hair under a fur-lined hood, pale luminous skin with faint runic tattoo markings on cheeks, wise commanding expression, Celtic knot pendant at chest.` |
| `SIGNATURE_PROP` | `Both hands extended palms-up, casting glowing translucent runestones that hover and spin above her hands.` |
| `RUNE_PLACEMENT` | `orbiting in a sweeping halo arc above her head` |

### FiremanDecko (Principal Engineer — Runic Engineer)

From: `.claude/agents/fireman-decko.md` — translates vision into technical solutions

| Variable | Value |
|----------|-------|
| `CHARACTER_DESCRIPTION` | `Grizzled Norse runic engineer, grey-streaked braided beard with metal rings, intense focused expression, wolf-head shoulder pauldron.` |
| `SIGNATURE_PROP` | `Holding an inscribing stylus in one hand, surrounded by floating holographic runic blueprints and mechanical schematics glowing ice-blue.` |
| `RUNE_PLACEMENT` | `embedded in the floating blueprint panels around him` |

### Loki (QA Tester — Trickster with Magnifying Glass)

From: `.claude/agents/loki.md` — devil's advocate, tests to prove it doesn't work

| Variable | Value |
|----------|-------|
| `CHARACTER_DESCRIPTION` | `Young Norse trickster, slender build, sharp angular face, black slicked-back hair with braids, pale skin, mischievous knowing smirk, bright green eyes.` |
| `SIGNATURE_PROP` | `Holding an ornate golden magnifying glass with runic inscriptions, examining glowing code runes through the lens. Green magical fire wisps flickering around him.` |
| `RUNE_PLACEMENT` | `visible through the magnifying glass lens, distorted and glowing` |

### Luna (UX Designer — Moon Priestess)

From: `.claude/agents/luna.md` — designs polished, accessible, delightful UI

| Variable | Value |
|----------|-------|
| `CHARACTER_DESCRIPTION` | `Norse moon priestess, silver-white hair in a thick braid over one shoulder, prominent crescent moon crown with horns pointing upward, ice-blue eyes, serene determined expression.` |
| `SIGNATURE_PROP` | `Touching a glowing holographic wireframe UI panel with her fingertip, silver moonlight emanating from the interface.` |
| `RUNE_PLACEMENT` | `inscribed in a circular Elder Futhark border frame surrounding the portrait` |

### Heimdall (Security Specialist)

From: `.claude/agents/heimdall.md` — guardian, watchman, sees all threats

| Variable | Value |
|----------|-------|
| `CHARACTER_DESCRIPTION` | `Imposing Norse guardian, dark skin, golden eyes that glow with omniscient sight, close-cropped hair, stoic vigilant expression, heavy plate armor with rainbow-bridge (Bifrost) shimmer.` |
| `SIGNATURE_PROP` | `Gripping the hilt of a massive sword planted point-down, a shimmering golden shield barrier radiating outward from him.` |
| `RUNE_PLACEMENT` | `burning in protective ward patterns on his shield and armor` |

## Usage

Assemble the prompt by replacing all `{{VARIABLES}}` with agent-specific values,
then pass to `/imagen`:

```bash
npx tsx .claude/skills/imagen/generate.ts "<assembled prompt>" \
  --size 1:1 --output .claude/agents/{{name}}-{{theme}}.png
```

## Notes

- Keep prompts concise — overloaded prompts degrade quality
- The theme prefix in `generate.ts` auto-prepends; these prompts work WITH it
- Gemini has no reference-image mode, so character consistency comes from
  matching descriptions, not image-to-image
- Transparent backgrounds do NOT work with Gemini — always use solid black/white
