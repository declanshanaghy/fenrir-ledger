#!/usr/bin/env bash
# Fenrir Ledger — Claude Code splash screen
# Prints Elder Futhark FENRIR rune art before Claude Code launches
#
# Behavior:
#   - Full splash (>=60 cols, colors >=8): gold rune art in rounded box
#   - Compact splash (<60 cols OR no color): plain text, no ANSI
#   - No sleep. No delays. Pure printf. Completes in <50ms.

# ---------------------------------------------------------------------------
# Terminal capability detection
# ---------------------------------------------------------------------------
cols=$(tput cols 2>/dev/null || echo 80)
colors=$(tput colors 2>/dev/null || echo 0)

# ---------------------------------------------------------------------------
# ANSI color definitions (24-bit RGB)
# ---------------------------------------------------------------------------
GOLD='\033[38;2;201;146;10m'
BOLD_GOLD='\033[1;38;2;201;146;10m'
STONE='\033[38;2;138;133;120m'
DIM_STONE='\033[2;38;2;138;133;120m'
DIM_DARK='\033[2;38;2;60;60;80m'
RESET='\033[0m'

# ---------------------------------------------------------------------------
# Full splash (>=60 cols and color support)
# ---------------------------------------------------------------------------
if [ "$cols" -ge 60 ] && [ "$colors" -ge 8 ]; then
    printf "${GOLD}"
    printf '                ╭──────────────────────────────────────────────────╮\n'
    printf '                │                                                  │\n'
    printf '                │   |      | |    |   |   |--       |      |--     │\n'
    printf '                │   |\\     |/|    |\\  |   |  \\      |      |  \\    │\n'
    printf '                │   | \\    | |    | \\ |   |--       |      |--     │\n'
    printf '                │   |\\     |\\|    |  \\|   |  \\      |      |  \\    │\n'
    printf '                │   | \\    | |    |   |   |   \\     |      |   \   │\n'
    printf '                │   |      | |    |   |   |         |      |       │\n'
    printf '                │   |      | |    |   |   |         |      |       │\n'
    printf '                │                                                  │\n'
    printf '                ╰──────────────────────────────────────────────────╯\n'
    printf "${STONE}"
    printf '       ᚠ FEHU    ᛖ EHWAZ   ᚾ NAUDIZ   ᚱ RAIDHO    ᛁ ISA    ᚱ RAIDHO\n'
    printf "${RESET}\n"
    printf "${BOLD_GOLD}                   You opened the forge, mortal. 🐺${RESET}\n"
    printf "${STONE}                Fenrir sees all chains. Including yours.${RESET}\n"
    printf '\n'
    printf "${DIM_STONE}      Built by FiremanDecko  ·  Guarded by Freya  ·  Tested by Loki${RESET}\n"
    printf "${DIM_DARK}            Odin bound Fenrir. Fenrir built Ledger.${RESET}\n"
    printf '\n'

# ---------------------------------------------------------------------------
# Compact splash (<60 cols OR no color)
# ---------------------------------------------------------------------------
elif [ "$colors" -ge 8 ]; then
    # Narrow terminal with color support
    printf "${BOLD_GOLD}  ᛟ Fenrir Ledger${RESET}\n"
    printf "${STONE}  The forge is lit. Break free.${RESET}\n"
    printf "${DIM_STONE}  ᚠ ᛖ ᚾ ᚱ ᛁ ᚱ${RESET}\n"
    printf '\n'
else
    # No color support — plain text, no ANSI escape codes
    printf '  Fenrir Ledger\n'
    printf '  The forge is lit. Break free.\n'
    printf '  F E N R I R\n'
    printf '\n'
fi
