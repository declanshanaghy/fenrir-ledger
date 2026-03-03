# Fenrir Ledger — Claude Code splash wrapper
# Source this in your .zshrc or let terminal/install.sh do it automatically.
#
# Defines the `claude-fenrir` command which displays the Fenrir Elder Futhark
# splash screen before launching Claude Code. All arguments are forwarded
# to the real `claude` binary unchanged.
#
# Usage:
#   source /path/to/fenrir-ledger/terminal/zshrc-snippet.sh
#   claude-fenrir          # launch with splash screen
#   claude                 # launch normally (unmodified)

# Guard: only define once
if ! type claude-fenrir > /dev/null 2>&1; then
  claude-fenrir() {
    # Splash screen — uses the symlink placed by terminal/install.sh
    local splash="${HOME}/.claude/splash.sh"
    if [[ -x "$splash" ]]; then
      bash "$splash"
    fi
    command claude --dangerously-skip-permissions "$@"
  }
fi
