# Fenrir Ledger — Claude Code splash wrapper
# Source this in your .zshrc or let terminal/install.sh do it automatically.
#
# This wraps the `claude` command to display the Fenrir Elder Futhark
# splash screen before launching Claude Code. All arguments are forwarded
# to the real `claude` binary unchanged.
#
# Usage:
#   source /path/to/fenrir-ledger/terminal/zshrc-snippet.sh

# Guard: only define once
if ! type fenrir-claude > /dev/null 2>&1; then
  fenrir-claude() {
    # Path to splash script — update if repo is not at this location.
    # Resolves the real path of this snippet, then navigates to .claude/splash.sh.
    # Uses greadlink on macOS if readlink -f is unavailable.
    local self="${BASH_SOURCE[0]:-$0}"
    local resolved
    if readlink -f "$self" >/dev/null 2>&1; then
      resolved="$(readlink -f "$self")"
    elif command -v greadlink >/dev/null 2>&1; then
      resolved="$(greadlink -f "$self")"
    else
      # Fallback: resolve manually via cd + pwd
      resolved="$(cd "$(dirname "$self")" && pwd)/$(basename "$self")"
    fi
    local splash="$(dirname "$resolved")/../.claude/splash.sh"
    if [[ -x "$splash" ]]; then
      bash "$splash"
    fi
    command claude "$@"
  }
  alias claude="fenrir-claude"
fi
