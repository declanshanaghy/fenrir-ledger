# QA Handoff: Terminal Color Palette Files

## What Was Implemented

Story 3 from the Claude Terminal Skin sprint: Norse terminal color palette config files for four terminal emulators.

## Files Created

| File | Format | Target Terminal |
|------|--------|-----------------|
| `terminal/fenrir.itermcolors` | XML plist | iTerm2 |
| `terminal/ghostty.conf` | Key-value config | Ghostty |
| `terminal/wezterm-colors.lua` | Lua table | WezTerm |
| `terminal/kitty.conf` | Key-value config | Kitty |

## Color Palette Mapped

All 16 ANSI colors (0-15) plus background, foreground, cursor, and selection colors. Full mapping:

| Slot | Name | Hex |
|------|------|-----|
| 0 | Void Black | #07070d |
| 1 | Ragnarok Red | #ef4444 |
| 2 | Asgard Teal | #0a8c6e |
| 3 | Hati Amber | #f59e0b |
| 4 | Deep Fjord | #2563eb |
| 5 | Muspel Orange | #c94a0a |
| 6 | Forge Gold | #c9920a |
| 7 | Parchment | #f0ede4 |
| 8 | Stone | #8a8578 |
| 9 | Light Ragnarok | #f87171 |
| 10 | Light Asgard | #34d399 |
| 11 | Light Hati | #fbbf24 |
| 12 | Light Fjord | #60a5fa |
| 13 | Light Muspel | #fb923c |
| 14 | Light Gold | #eab308 |
| 15 | Pure Parchment | #faf9f6 |
| BG | Void Black | #07070d |
| FG | Parchment | #f0ede4 |
| Cursor | Forge Gold | #c9920a |
| Sel BG | Warm Charcoal | #1c1917 |
| Sel FG | Pure Parchment | #faf9f6 |

## Validation Already Performed

- `plutil -lint terminal/fenrir.itermcolors` exits 0 (valid XML plist)
- All 4 files contain correct background (#07070d), cursor (#c9920a), green (#0a8c6e), yellow (#f59e0b)
- All files include import instructions in header comments
- No hardcoded absolute paths in any file
- Float conversions for iTerm2 verified against Python3 `hex / 255` computation

## Suggested Test Focus Areas

1. **iTerm2**: Import `fenrir.itermcolors` via Profiles > Colors > Color Presets > Import. Verify dark background, gold cursor, teal for green text.
2. **Ghostty**: Append `ghostty.conf` to `~/.config/ghostty/config`. Verify palette renders correctly.
3. **WezTerm**: Place `wezterm-colors.lua` in colors dir, set `config.color_scheme = "Fenrir"`. Verify ansi/brights arrays.
4. **Kitty**: Include `kitty.conf` via `include themes/fenrir.conf`. Verify color0-color15 plus special colors.
5. **Cross-file consistency**: All 4 files must use identical hex values for each ANSI slot.
6. **Spot-check specific colors**: Run `echo -e "\033[32mGreen\033[0m"` and verify it appears as Asgard Teal (#0a8c6e), not a standard green.

## Known Limitations

- These are static config files, not runtime code. No deployment or server needed.
- Ghostty background/foreground use bare hex (no `#` prefix) per Ghostty's config format.
- WezTerm instructions mention both the color scheme registry approach and inline `dofile()` approach.
