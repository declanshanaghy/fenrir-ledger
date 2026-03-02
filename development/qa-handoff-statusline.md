# QA Handoff: Norse Statusline Script

## What Was Implemented

**Story**: Norse Statusline for Claude Code (from the Claude Terminal Skin product design brief)

A bash script at `.claude/statusline-command.sh` that renders a single-line statusline with Elder Futhark rune prefixes, Norse realm-color thresholds, and responsive width breakpoints. The `statusLine` configuration has been added to `.claude/settings-bare.json`.

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `.claude/statusline-command.sh` | Created | Main statusline script (executable). Reads JSON on stdin, outputs ANSI-colored text. |
| `.claude/settings-bare.json` | Modified | Added `statusLine.type: "command"` and `statusLine.command: ".claude/statusline-command.sh"` |
| `development/qa-handoff-statusline.md` | Created | This file |

## How to Test

### Basic Functionality Test

Run this command from the repo root to verify the script parses JSON and outputs valid ANSI:

```bash
echo '{"workspace":{"current_dir":"'"$(pwd)"'"},"model":{"display_name":"claude-sonnet-4-6"},"context_window":{"used_percentage":67},"cost":{"total_cost_usd":1.42,"total_duration_ms":900000},"agent":{"name":"Luna"}}' | bash .claude/statusline-command.sh
```

Expected: A single line with rune prefixes, branch name, model name, cost, context bar, line counts, duration, and agent name.

### Width Breakpoint Tests

Test each breakpoint by overriding `tput cols`:

```bash
# Full layout (>= 100 cols): all 7 sections
echo '...' | COLUMNS=120 bash -c 'tput() { echo 120; }; export -f tput; source .claude/statusline-command.sh'

# Compact (80-99 cols): drop duration, truncate branch to 15, abbreviate model
echo '...' | COLUMNS=90 bash -c 'tput() { echo 90; }; export -f tput; source .claude/statusline-command.sh'

# Minimal (60-79 cols): branch + cost + context only
echo '...' | COLUMNS=70 bash -c 'tput() { echo 70; }; export -f tput; source .claude/statusline-command.sh'

# Ultra-compact (< 60 cols): ctx:XX% | $X.XX
echo '...' | COLUMNS=50 bash -c 'tput() { echo 50; }; export -f tput; source .claude/statusline-command.sh'
```

### Color Threshold Tests

**Context bar colors** (verify with `cat -v` or visual inspection in a terminal):

| Percentage | Expected Color | ANSI Code |
|------------|---------------|-----------|
| 23% | Asgard teal | `38;2;10;140;110` |
| 67% | Hati amber | `38;2;245;158;11` |
| 85% | Muspel orange | `38;2;201;74;10` |
| 97% | Ragnarok red + bold | `38;2;239;68;68` + `1` |

**Cost colors**:

| Amount | Expected Color | ANSI Code |
|--------|---------------|-----------|
| $0.50 | Parchment | `38;2;240;237;228` |
| $3.00 | Hati amber | `38;2;245;158;11` |
| $7.00 | Muspel orange | `38;2;201;74;10` |
| $12.00 | Ragnarok red + bold | `38;2;239;68;68` + `1` |

### Ragnarok Mode Test

When context >= 90% AND cost > $10, separators switch from `│` (light) to `┃` (heavy) in Ragnarok red:

```bash
echo '{"workspace":{"current_dir":"'"$(pwd)"'"},"model":{"display_name":"claude-opus-4-6"},"context_window":{"used_percentage":95},"cost":{"total_cost_usd":14.20,"total_duration_ms":11400000}}' | bash .claude/statusline-command.sh
```

### Agent Section Test

- With agent: shows `ᚲ <name>` (Kenaz rune in gold, name in parchment bold)
- Without agent: shows `ᛁ` (Isa rune in stone muted)

### Branch Truncation Test

Branches longer than 20 characters should truncate with `...` (ellipsis character). The current branch `feat/terminal-skin-statusline` is 30 chars, so it should truncate.

### Git Detection Test

- Script detects branch name via `git symbolic-ref`
- Dirty flag `!` appears when there are uncommitted changes
- Untracked flag `?` appears when there are untracked files
- Lines added/deleted from `git diff --shortstat HEAD`

## Acceptance Criteria Checklist

- [ ] Script parses all JSON fields without errors
- [ ] All 4 width breakpoints render correctly (>=100, 80-99, 60-79, <60)
- [ ] Context bar: teal at 23%, amber at 67%, orange at 85%, red+bold at 97%
- [ ] Cost: parchment at $0.50, amber at $3, orange at $7, red+bold at $12
- [ ] Ragnarok mode: heavy separators when context >= 90% AND cost > $10
- [ ] Agent section shows Kenaz rune when agent present, Isa rune when absent
- [ ] Branch truncates at 20 chars with ellipsis
- [ ] `settings-bare.json` has `statusLine.command` set
- [ ] `.claude/statusline-command.sh` is executable (`chmod +x`)
- [ ] Test command produces valid ANSI output

## Known Limitations

1. **Git diff stats**: The `+add/-del` section counts lines from `git diff --shortstat HEAD`. In a clean working tree, this shows `+0/-0`. It does not include staged-only changes or commits not yet pushed.
2. **Width detection in non-TTY**: When piped (e.g., `echo ... | bash script`), `tput cols` may fall back to 120. In a real Claude Code session, the terminal width is correctly detected.
3. **Font requirements**: Elder Futhark rune characters (U+16A0..U+16DF) require a font with runic support. Most modern terminal fonts (JetBrains Mono, Fira Code, etc.) support these via fallback fonts on macOS.
4. **settings-observability.json**: The tracked `settings-bare.json` has the statusLine config. Users running with the observability hooks setup need to add the `statusLine` block to their local `settings-observability.json` manually.

## Suggested Test Focus Areas

1. Visual rendering in an actual terminal (iTerm2, Terminal.app, Ghostty) to confirm colors display correctly
2. Edge cases: empty JSON, missing fields, very long branch names
3. Ragnarok mode transitions (both entering and exiting the threshold)
4. Performance: the script should execute in under 50ms per render
