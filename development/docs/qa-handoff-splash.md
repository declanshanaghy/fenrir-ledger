# QA Handoff: Story 2 — Fenrir Splash Screen

## What Was Implemented

Elder Futhark FENRIR splash screen for Claude Code launch (Story 2 of the Claude Terminal Skin epic).

Two files created:

### Files Created

| File | Description |
|------|-------------|
| `.claude/splash.sh` | Main splash screen script. Detects terminal width and color support, renders full/compact/no-color variants. |
| `terminal/zshrc-snippet.sh` | Shell function wrapper template. Defines `fenrir-claude()` function and `claude` alias that prints the splash before launching Claude Code. |

## How to Test

### 1. Full Splash (>=60 cols, colors >=8)

Run in a color-capable terminal with at least 60 columns:

```bash
bash .claude/splash.sh
```

Expected: Gold-colored rune art inside a rounded box border, rune labels in stone gray, bold gold tagline, stone subtitle, dim credits, dim-dark final quote. All text properly aligned at 80 columns.

### 2. Compact Splash (<60 cols with color)

Force narrow terminal:

```bash
COLUMNS=40 bash -c '
  cols=40
  colors=256
  eval "$(tail -n +13 .claude/splash.sh | head -n 54)"
'
```

Or resize terminal to under 60 columns and run:

```bash
bash .claude/splash.sh
```

Expected: Three lines only — Othala rune + "Fenrir Ledger" in gold, tagline in stone, six runes in dim stone. No box art.

### 3. No-Color Fallback

Force no color support:

```bash
TERM=dumb bash .claude/splash.sh
```

Expected: Plain text, no ANSI escape codes visible. Three lines: "Fenrir Ledger", tagline, "F E N R I R".

### 4. Performance (<50ms)

```bash
time bash .claude/splash.sh > /dev/null 2>&1
```

Expected: Real time under 50ms (typically 5-10ms).

### 5. No Color Bleed

```bash
bash .claude/splash.sh; echo "This text should be normal color"
```

Expected: The echo text renders in the terminal's default color, not gold or stone.

### 6. zshrc-snippet.sh Function Guard

```bash
source terminal/zshrc-snippet.sh
type fenrir-claude
# Source again — should not error or redefine
source terminal/zshrc-snippet.sh
```

Expected: `fenrir-claude` is defined as a function. Second source is a no-op.

### 7. Executable Permission

```bash
ls -la .claude/splash.sh
```

Expected: File has execute permission (`-rwxr-xr-x` or similar).

## Acceptance Criteria Checklist

- [ ] Full splash renders at 80 cols in gold
- [ ] Compact splash renders at 40 cols without garbling
- [ ] No-color fallback works when `tput colors` returns 0 or 2
- [ ] Script completes in <50ms
- [ ] All ANSI sequences end with `\033[0m` — no color bleed
- [ ] `terminal/zshrc-snippet.sh` has correct function definition with guard
- [ ] `.claude/splash.sh` has `chmod +x`

## Known Limitations

- `readlink -f` is not available on stock macOS. The zshrc-snippet includes fallbacks for `greadlink` (coreutils) and a manual `cd/pwd` resolution.
- The compact no-color fallback uses plain ASCII "F E N R I R" instead of Unicode runes, since terminals without color support may also lack rune glyph fonts.
- The splash does not detect whether Claude Code will clear the screen on startup. If Claude Code clears immediately, the splash may flash briefly. This is by design (no `sleep` per spec).

## Suggested Test Focus Areas

1. Verify the rune art alignment is pixel-perfect at exactly 80 columns — count characters per line.
2. Test in iTerm2, Terminal.app, and Ghostty to confirm ANSI 24-bit color rendering.
3. Verify the `\` (backslash) characters in the rune art render correctly and are not interpreted as escape sequences.
4. Test the zshrc-snippet with both bash and zsh shells.
