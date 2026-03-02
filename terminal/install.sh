#!/usr/bin/env bash
# Fenrir Ledger — Norse Terminal Skin Installer
# ==============================================
# Idempotent install script for the Fenrir Ledger Claude Code terminal skin.
# Safe to run multiple times. Each step checks existing state before acting.
#
# Components installed:
#   1. Statusline script symlink   (~/.claude/statusline-command.sh)
#   2. Splash screen symlink       (~/.claude/splash.sh)
#   3. Claude Code settings.json   (statusLine block merged via jq)
#   4. Shell wrapper function      (appended to ~/.zshrc if absent)
#   5. Color palette instructions  (printed for manual import)
#
# Prerequisites:
#   - jq (for JSON merging)
#   - A terminal with Unicode and 24-bit ANSI color support
#
# Usage:
#   bash terminal/install.sh

set -euo pipefail

# ---------------------------------------------------------------------------
# ANSI colors for output
# ---------------------------------------------------------------------------
GOLD='\033[38;2;201;146;10m'
BOLD_GOLD='\033[1;38;2;201;146;10m'
GREEN='\033[38;2;10;140;110m'
STONE='\033[38;2;138;133;120m'
RED='\033[38;2;239;68;68m'
DIM='\033[2m'
RESET='\033[0m'

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------
header() {
    printf "\n${BOLD_GOLD}  %s${RESET}\n" "$1"
}

ok() {
    printf "  ${GREEN}%s${RESET} %s\n" "+" "$1"
}

skip() {
    printf "  ${STONE}%s${RESET} %s\n" "-" "$1"
}

warn() {
    printf "  ${RED}%s${RESET} %s\n" "!" "$1"
}

info() {
    printf "  ${STONE}%s${RESET}\n" "$1"
}

# ---------------------------------------------------------------------------
# Resolve repo root — ALWAYS the main worktree, never a sub-worktree.
# If run from inside a git worktree, resolve back to the primary checkout
# so that paths written to ~/.zshrc remain stable after worktrees are removed.
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" worktree list --porcelain 2>/dev/null \
             | head -1 | sed 's/^worktree //')" \
  || REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# Fallback if git is unavailable or repo is not a worktree
if [ -z "$REPO_ROOT" ]; then
    REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

# ---------------------------------------------------------------------------
# Prerequisite check: jq
# ---------------------------------------------------------------------------
header "Prerequisite Check"
if ! command -v jq >/dev/null 2>&1; then
    warn "jq is not installed. Required for JSON merging."
    warn "Install with: brew install jq (macOS) or apt-get install jq (Linux)"
    exit 1
fi
ok "jq found at $(command -v jq)"

# ---------------------------------------------------------------------------
# Step 1: Symlink statusline-command.sh
# ---------------------------------------------------------------------------
header "Step 1: Statusline Script"

STATUSLINE_SRC="${REPO_ROOT}/.claude/statusline-command.sh"
STATUSLINE_DST="${HOME}/.claude/statusline-command.sh"

# Ensure ~/.claude directory exists
mkdir -p "${HOME}/.claude"

if [ -L "$STATUSLINE_DST" ]; then
    EXISTING_TARGET="$(readlink "$STATUSLINE_DST")"
    if [ "$EXISTING_TARGET" = "$STATUSLINE_SRC" ]; then
        skip "Symlink already correct: ${STATUSLINE_DST}"
    else
        # Back up the existing different symlink
        BACKUP="${STATUSLINE_DST}.backup.$(date +%Y%m%d%H%M%S)"
        mv "$STATUSLINE_DST" "$BACKUP"
        ok "Backed up existing symlink to ${BACKUP}"
        ln -s "$STATUSLINE_SRC" "$STATUSLINE_DST"
        ok "Symlinked ${STATUSLINE_DST} -> ${STATUSLINE_SRC}"
    fi
elif [ -f "$STATUSLINE_DST" ]; then
    # Regular file exists -- back it up
    BACKUP="${STATUSLINE_DST}.backup.$(date +%Y%m%d%H%M%S)"
    mv "$STATUSLINE_DST" "$BACKUP"
    ok "Backed up existing file to ${BACKUP}"
    ln -s "$STATUSLINE_SRC" "$STATUSLINE_DST"
    ok "Symlinked ${STATUSLINE_DST} -> ${STATUSLINE_SRC}"
else
    ln -s "$STATUSLINE_SRC" "$STATUSLINE_DST"
    ok "Symlinked ${STATUSLINE_DST} -> ${STATUSLINE_SRC}"
fi

# ---------------------------------------------------------------------------
# Step 2: Symlink splash.sh
# ---------------------------------------------------------------------------
header "Step 2: Splash Screen"

SPLASH_SRC="${REPO_ROOT}/.claude/splash.sh"
SPLASH_DST="${HOME}/.claude/splash.sh"

if [ -L "$SPLASH_DST" ]; then
    EXISTING_TARGET="$(readlink "$SPLASH_DST")"
    if [ "$EXISTING_TARGET" = "$SPLASH_SRC" ]; then
        skip "Symlink already correct: ${SPLASH_DST}"
    else
        BACKUP="${SPLASH_DST}.backup.$(date +%Y%m%d%H%M%S)"
        mv "$SPLASH_DST" "$BACKUP"
        ok "Backed up existing symlink to ${BACKUP}"
        ln -s "$SPLASH_SRC" "$SPLASH_DST"
        ok "Symlinked ${SPLASH_DST} -> ${SPLASH_SRC}"
    fi
elif [ -f "$SPLASH_DST" ]; then
    BACKUP="${SPLASH_DST}.backup.$(date +%Y%m%d%H%M%S)"
    mv "$SPLASH_DST" "$BACKUP"
    ok "Backed up existing file to ${BACKUP}"
    ln -s "$SPLASH_SRC" "$SPLASH_DST"
    ok "Symlinked ${SPLASH_DST} -> ${SPLASH_SRC}"
else
    ln -s "$SPLASH_SRC" "$SPLASH_DST"
    ok "Symlinked ${SPLASH_DST} -> ${SPLASH_SRC}"
fi

# ---------------------------------------------------------------------------
# Step 3: Merge statusLine block into ~/.claude/settings.json
# ---------------------------------------------------------------------------
header "Step 3: Claude Code Settings"

SETTINGS_FILE="${HOME}/.claude/settings.json"
STATUSLINE_BLOCK='{"statusLine":{"type":"command","command":"~/.claude/statusline-command.sh"}}'

if [ -f "$SETTINGS_FILE" ]; then
    # Check if statusLine is already configured
    EXISTING_SL="$(jq -r '.statusLine.command // empty' "$SETTINGS_FILE" 2>/dev/null)" || true
    if [ -n "$EXISTING_SL" ]; then
        skip "statusLine already configured in ${SETTINGS_FILE} (command: ${EXISTING_SL})"
    else
        # Merge the statusLine block into existing settings
        MERGED="$(jq ". + ${STATUSLINE_BLOCK}" "$SETTINGS_FILE")"
        printf '%s\n' "$MERGED" > "$SETTINGS_FILE"
        ok "Merged statusLine block into ${SETTINGS_FILE}"
    fi
else
    # Create new settings file with just the statusLine block
    printf '%s\n' "$STATUSLINE_BLOCK" | jq '.' > "$SETTINGS_FILE"
    ok "Created ${SETTINGS_FILE} with statusLine configuration"
fi

# ---------------------------------------------------------------------------
# Step 4: Add fenrir-claude wrapper to ~/.zshrc
# ---------------------------------------------------------------------------
header "Step 4: Shell Wrapper"

ZSHRC="${HOME}/.zshrc"
GUARD_COMMENT="# >>> fenrir-ledger claude wrapper >>>"
END_COMMENT="# <<< fenrir-ledger claude wrapper <<<"

if [ -f "$ZSHRC" ] && grep -qF "$GUARD_COMMENT" "$ZSHRC" 2>/dev/null; then
    skip "Fenrir claude wrapper already present in ${ZSHRC}"
else
    SNIPPET_SRC="${REPO_ROOT}/terminal/zshrc-snippet.sh"

    cat >> "$ZSHRC" << ZSHEOF

${GUARD_COMMENT}
# Defines fenrir-claude command with the Fenrir Elder Futhark splash screen.
# To remove: delete everything between the >>> and <<< markers.
[[ -f "${SNIPPET_SRC}" ]] \\
  && source "${SNIPPET_SRC}"
${END_COMMENT}
ZSHEOF

    ok "Appended fenrir-claude wrapper to ${ZSHRC}"
    info "The wrapper sources: ${SNIPPET_SRC}"
fi

# ---------------------------------------------------------------------------
# Step 5: Color palette import instructions
# ---------------------------------------------------------------------------
header "Step 5: Color Palette"

printf "\n"
printf "  ${BOLD_GOLD}iTerm2:${RESET}\n"
printf "  ${STONE}  1. Open iTerm2 Preferences > Profiles > Colors${RESET}\n"
printf "  ${STONE}  2. Click 'Color Presets...' dropdown > 'Import...'${RESET}\n"
printf "  ${STONE}  3. Select: ${RESET}${GREEN}%s${RESET}\n" "${REPO_ROOT}/terminal/fenrir.itermcolors"
printf "  ${STONE}  4. Choose 'fenrir' from the presets dropdown${RESET}\n"
printf "\n"
printf "  ${BOLD_GOLD}Ghostty:${RESET}\n"
printf "  ${STONE}  Option A: Append contents to ~/.config/ghostty/config${RESET}\n"
printf "  ${STONE}  Option B: Copy to ~/.config/ghostty/themes/fenrir${RESET}\n"
printf "  ${STONE}            then add 'theme = fenrir' to your config${RESET}\n"
printf "  ${STONE}  File: ${RESET}${GREEN}%s${RESET}\n" "${REPO_ROOT}/terminal/ghostty.conf"
printf "\n"
printf "  ${BOLD_GOLD}WezTerm:${RESET}\n"
printf "  ${STONE}  1. Copy to ~/.config/wezterm/colors/Fenrir.lua${RESET}\n"
printf "  ${STONE}  2. In wezterm.lua: config.color_scheme = \"Fenrir\"${RESET}\n"
printf "  ${STONE}  File: ${RESET}${GREEN}%s${RESET}\n" "${REPO_ROOT}/terminal/wezterm-colors.lua"
printf "\n"
printf "  ${BOLD_GOLD}Kitty:${RESET}\n"
printf "  ${STONE}  1. Copy to ~/.config/kitty/themes/fenrir.conf${RESET}\n"
printf "  ${STONE}  2. In kitty.conf: include themes/fenrir.conf${RESET}\n"
printf "  ${STONE}  File: ${RESET}${GREEN}%s${RESET}\n" "${REPO_ROOT}/terminal/kitty.conf"

# ---------------------------------------------------------------------------
# Final instructions
# ---------------------------------------------------------------------------
header "The Forge is Ready"
printf "\n"
printf "  ${BOLD_GOLD}Next steps:${RESET}\n"
printf "  ${STONE}  1. Import your preferred color palette (see above)${RESET}\n"
printf "  ${STONE}  2. Restart your terminal (or run: source ~/.zshrc)${RESET}\n"
printf "  ${STONE}  3. Run: ${RESET}${GREEN}claude${RESET}\n"
printf "\n"
printf "  ${DIM}The wolf does not wait. The forge is lit.${RESET}\n"
printf "\n"
