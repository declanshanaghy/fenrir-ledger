# QA Handoff -- Terminal Skin Story 4: Install Script + Setup Guide

**Branch:** `feat/terminal-skin-install`
**Date:** 2026-03-02
**Author:** FiremanDecko (Principal Engineer)

---

## What Was Implemented

Story 4 of the Norse terminal skin: an idempotent install script and a comprehensive setup guide README.

## Files Created

| File | Description |
|------|-------------|
| `terminal/install.sh` | Idempotent bash installer -- symlinks, settings merge, shell wrapper, color instructions |
| `terminal/README.md` | Setup guide covering all 4 skin components, rune semantics, color palette, troubleshooting |

## Files Already on Main (Unchanged)

| File | Description |
|------|-------------|
| `.claude/statusline-command.sh` | Norse statusline script (Story 1, PR #72) |
| `.claude/splash.sh` | Elder Futhark splash screen (Story 2, PR #71) |
| `terminal/fenrir.itermcolors` | iTerm2 color preset (Story 3, PR #70) |
| `terminal/ghostty.conf` | Ghostty color config (Story 3, PR #70) |
| `terminal/wezterm-colors.lua` | WezTerm color scheme (Story 3, PR #70) |
| `terminal/kitty.conf` | Kitty theme file (Story 3, PR #70) |
| `terminal/zshrc-snippet.sh` | Zsh wrapper snippet (Story 3, PR #70) |

---

## How to Test

### Test 1: First Run (Clean State)

```bash
# Remove any existing artifacts from previous testing
rm -f ~/.claude/statusline-command.sh ~/.claude/splash.sh
# Remove wrapper from .zshrc if present
sed -i '' '/# >>> fenrir-ledger claude wrapper >>>/,/# <<< fenrir-ledger claude wrapper <<</d' ~/.zshrc

# Run the installer
bash terminal/install.sh

# Expected: all steps show green "+" checkmarks
# Verify:
ls -la ~/.claude/statusline-command.sh  # Should be symlink to repo's .claude/statusline-command.sh
ls -la ~/.claude/splash.sh              # Should be symlink to repo's .claude/splash.sh
jq '.statusLine' ~/.claude/settings.json  # Should show command config
grep "fenrir-ledger claude wrapper" ~/.zshrc  # Should find guard markers
```

### Test 2: Idempotency (Second Run)

```bash
bash terminal/install.sh

# Expected: steps 1-4 show grey "-" skip markers
# No new symlinks created, no duplicate .zshrc entries
```

### Test 3: plutil Lint

```bash
plutil -lint terminal/fenrir.itermcolors
# Expected: OK
```

### Test 4: Shell Wrapper Function

```bash
source ~/.zshrc
type fenrir-claude  # Should show function definition
type claude         # Should show alias to fenrir-claude
```

### Test 5: README Completeness

Verify `terminal/README.md` covers:
- [ ] Overview of all components
- [ ] Prerequisites (jq, Unicode terminal)
- [ ] Quick install instructions
- [ ] Manual setup for statusline, splash, color palette (all 4 emulators)
- [ ] Rune semantics reference table (8 runes)
- [ ] Norse color palette table (special + 16 ANSI colors)
- [ ] Cost and context tier color tables
- [ ] Troubleshooting section (rune rendering, narrow terminal, no color, etc.)
- [ ] Uninstall instructions

---

## Known Limitations

- The install script targets zsh only. Bash users need to manually source the snippet in `.bashrc`.
- The symlinks point to the absolute path of the repo clone. If the repo moves, symlinks break (re-run the installer from the new location).
- Color palette import for iTerm2 is manual (cannot be automated without AppleScript).
- The settings merge preserves existing `statusLine` config -- if someone already has a different statusline command, the script will skip (not overwrite). This is intentional for safety.

## Test Focus Areas

- Idempotency: run the script 3+ times, verify no duplicates or errors
- Backup behavior: place a different file at `~/.claude/statusline-command.sh`, verify it gets backed up with timestamp
- Settings merge: verify `jq` correctly merges into existing settings without losing other keys
- Guard markers in `.zshrc`: verify the markers prevent duplicate appends
