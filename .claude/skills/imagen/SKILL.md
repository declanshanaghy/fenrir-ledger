---
name: imagen
description: "Generate images using Google Gemini API in the Fenrir Ledger Norse wolf aesthetic. Use this skill when the user says /imagen, asks to generate an image, create artwork, make a logo, or produce visual assets for the project."
---

# Imagen — Fenrir Ledger Image Generator

Generates images using Google's Gemini API with the Fenrir Ledger Norse wolf aesthetic baked in.

---

## Invocation

The user says `/imagen <prompt>` or `/imagen --preset <preset-name>`.

---

## How to Run

```bash
npx tsx .claude/skills/imagen/generate.ts "<prompt>"
```

Or with a preset:

```bash
npx tsx .claude/skills/imagen/generate.ts --preset fenrir-logo
```

### Requirements

- Node.js 18+ (uses native `fetch`)
- `tsx` (included in devDependencies)
- `GOOGLE_API_KEY` or `GEMINI_API_KEY` environment variable set

---

## CLI Arguments

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `prompt` | positional | *(required unless --preset)* | Free-form text prompt for image generation |
| `--preset` | choice | *(none)* | One of: `fenrir-logo`, `fenrir-icon`, `norse-badge`, `fenrir-medallion` |
| `--size` | string | `1:1` | Aspect ratio (e.g. `1:1`, `16:9`, `9:16`, `4:3`, `3:4`) |
| `--output` | path | `generated-{timestamp}.png` | Output file path |
| `--count` | int | `1` | Number of images to generate (max 4) |

---

## Presets

All presets auto-prepend the Fenrir Ledger theme prefix to ensure visual consistency.

### Theme Prefix (always applied)

> Dark Nordic war-room aesthetic, void-black (#07070d) background, ice-blue and antique gold (#c9920a) accents, Elder Futhark rune details, Fenrir wolf motif. The image MUST have a fully transparent PNG background with no white or colored background. Isolated subject on alpha-transparent canvas.

### Available Presets

| Preset | Prompt |
|--------|--------|
| `fenrir-logo` | A fierce Norse wolf head in a circular medallion frame with runic inscriptions around the border, metallic silver and ice-blue tones, dark moody lighting |
| `fenrir-icon` | A compact wolf head icon suitable for favicon use, clean lines, Nordic style, metallic finish |
| `norse-badge` | An ornate Norse shield badge with intertwined wolf and serpent knotwork, aged metal texture |
| `fenrir-medallion` | A heavy iron medallion with Fenrir the wolf breaking chains, Elder Futhark runes inscribed around the edge, moonlit atmosphere |

---

## Usage Examples

### Generate with a preset

```bash
npx tsx .claude/skills/imagen/generate.ts --preset fenrir-logo --output logo.png
```

### Generate with a custom prompt

```bash
npx tsx .claude/skills/imagen/generate.ts "A Norse raven perched on a runic stone, gold and ice-blue palette"
```

### Generate multiple variants

```bash
npx tsx .claude/skills/imagen/generate.ts --preset fenrir-medallion --count 4
```

### Wide format banner

```bash
npx tsx .claude/skills/imagen/generate.ts "Fenrir breaking free from Gleipnir, panoramic scene" --size 16:9
```

---

## Output

- Images are saved as PNG files
- Default filename: `generated-{timestamp}.png` (or `generated-{timestamp}-{N}.png` for count > 1)
- Script prints the absolute path of each saved file to stdout
- Exit code 0 on success, 1 on error

---

## Error Handling

| Condition | Behavior |
|-----------|----------|
| Missing API key | Prints setup instructions to stderr, exits 1 |
| API error | Prints status code and error body to stderr, exits 1 |
| Network timeout | 60s timeout, prints timeout message to stderr, exits 1 |
| No image in response | Prints diagnostic message to stderr, exits 1 |
| Invalid preset | Prints valid choices to stderr, exits 1 |
