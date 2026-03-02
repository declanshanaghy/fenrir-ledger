#!/usr/bin/env bash
# Fenrir Ledger -- Norse Statusline for Claude Code
# Renders a single-line statusline with Elder Futhark rune prefixes,
# realm-color thresholds, and responsive width breakpoints.
#
# Input:  JSON on stdin from Claude Code
# Output: ANSI-colored statusline text on stdout
#
# JSON fields consumed:
#   workspace.current_dir     -- for git detection
#   model.display_name        -- model name
#   context_window.used_percentage -- integer 0-100
#   cost.total_cost_usd       -- float
#   cost.total_duration_ms    -- milliseconds
#   agent.name                -- optional, present in subagent mode

set -euo pipefail

# ---------------------------------------------------------------------------
# ANSI color variables (24-bit RGB)
# ---------------------------------------------------------------------------
FG_GOLD="\033[38;2;201;146;10m"
FG_PARCHMENT="\033[38;2;240;237;228m"
FG_STONE="\033[38;2;138;133;120m"
FG_ASGARD="\033[38;2;10;140;110m"
FG_HATI="\033[38;2;245;158;11m"
FG_MUSPEL="\033[38;2;201;74;10m"
FG_RAGNAROK="\033[38;2;239;68;68m"
BOLD="\033[1m"
DIM="\033[2m"
RESET="\033[0m"

# ---------------------------------------------------------------------------
# Read JSON from stdin
# ---------------------------------------------------------------------------
INPUT="$(cat)"

# ---------------------------------------------------------------------------
# JSON parsing -- prefer jq, fallback to python3
# ---------------------------------------------------------------------------
parse_json_field() {
    local field="$1"
    local default="${2:-}"
    local val=""

    if command -v jq >/dev/null 2>&1; then
        val="$(printf '%s' "$INPUT" | jq -r "$field // empty" 2>/dev/null)" || true
    fi

    if [ -z "$val" ] && command -v python3 >/dev/null 2>&1; then
        val="$(printf '%s' "$INPUT" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    keys = '''$field'''.strip('.').split('.')
    v = d
    for k in keys:
        if isinstance(v, dict):
            v = v.get(k)
        else:
            v = None
            break
    if v is not None:
        print(v)
except Exception:
    pass
" 2>/dev/null)" || true
    fi

    if [ -z "$val" ]; then
        printf '%s' "$default"
    else
        printf '%s' "$val"
    fi
}

CWD="$(parse_json_field '.workspace.current_dir' '.')"
MODEL="$(parse_json_field '.model.display_name' 'unknown')"
CTX_PCT="$(parse_json_field '.context_window.used_percentage' '0')"
COST_USD="$(parse_json_field '.cost.total_cost_usd' '0')"
DURATION_MS="$(parse_json_field '.cost.total_duration_ms' '0')"
AGENT_NAME="$(parse_json_field '.agent.name' '')"

# Ensure numeric values are integers where needed
CTX_PCT="${CTX_PCT%%.*}"
DURATION_MS="${DURATION_MS%%.*}"

# ---------------------------------------------------------------------------
# Git detection
# ---------------------------------------------------------------------------
GIT_BRANCH=""
GIT_DIRTY=""
GIT_UNTRACKED=""

if git -C "$CWD" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    GIT_BRANCH="$(git -C "$CWD" symbolic-ref --short HEAD 2>/dev/null || git -C "$CWD" rev-parse --short HEAD 2>/dev/null || echo '')"

    if ! git -C "$CWD" diff --quiet 2>/dev/null || ! git -C "$CWD" diff --cached --quiet 2>/dev/null; then
        GIT_DIRTY="!"
    fi

    if [ -n "$(git -C "$CWD" ls-files --others --exclude-standard 2>/dev/null | head -1)" ]; then
        GIT_UNTRACKED="?"
    fi
fi

# ---------------------------------------------------------------------------
# Git diff stats (lines added/deleted)
# ---------------------------------------------------------------------------
LINES_ADDED=0
LINES_DELETED=0

if [ -n "$GIT_BRANCH" ]; then
    SHORTSTAT="$(git -C "$CWD" diff --shortstat HEAD 2>/dev/null || echo '')"
    if [ -n "$SHORTSTAT" ]; then
        # Extract insertions
        INS="$(printf '%s' "$SHORTSTAT" | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo '0')"
        DEL="$(printf '%s' "$SHORTSTAT" | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' || echo '0')"
        LINES_ADDED="${INS:-0}"
        LINES_DELETED="${DEL:-0}"
    fi
fi

# ---------------------------------------------------------------------------
# Terminal width detection
# ---------------------------------------------------------------------------
TERM_WIDTH="$(tput cols 2>/dev/null || echo 120)"

# ---------------------------------------------------------------------------
# Model name shortening
# ---------------------------------------------------------------------------
shorten_model() {
    local m="$1"
    case "$m" in
        *opus-4-6*|*opus-4*)    printf 'opus-4' ;;
        *sonnet-4-6*|*sonnet-4*|*sonnet*) printf 'sonnet' ;;
        *haiku-4-5*|*haiku*)    printf 'haiku' ;;
        *)                      printf '%s' "$m" ;;
    esac
}

MODEL_SHORT="$(shorten_model "$MODEL")"

# Compact abbreviations for 80-99 col mode
abbreviate_model() {
    local m="$1"
    case "$m" in
        opus-4)  printf 'op4' ;;
        sonnet)  printf 'son' ;;
        haiku)   printf 'hai' ;;
        *)       printf '%s' "$m" ;;
    esac
}

MODEL_ABBREV="$(abbreviate_model "$MODEL_SHORT")"

# ---------------------------------------------------------------------------
# Branch truncation
# ---------------------------------------------------------------------------
truncate_branch() {
    local branch="$1"
    local max="$2"
    if [ "${#branch}" -gt "$max" ]; then
        local cut=$((max - 1))
        printf '%s' "${branch:0:$cut}…"
    else
        printf '%s' "$branch"
    fi
}

# ---------------------------------------------------------------------------
# Cost formatting and color
# ---------------------------------------------------------------------------
format_cost() {
    printf '$%.2f' "$COST_USD"
}

cost_color() {
    # Use bc for floating-point comparison, fallback to python3
    local cost="$COST_USD"
    if command -v bc >/dev/null 2>&1; then
        if [ "$(echo "$cost > 10" | bc -l 2>/dev/null)" = "1" ]; then
            printf '%b%b' "$FG_RAGNAROK" "$BOLD"
            return
        elif [ "$(echo "$cost > 5" | bc -l 2>/dev/null)" = "1" ]; then
            printf '%b' "$FG_MUSPEL"
            return
        elif [ "$(echo "$cost >= 2" | bc -l 2>/dev/null)" = "1" ]; then
            printf '%b' "$FG_HATI"
            return
        else
            printf '%b' "$FG_PARCHMENT"
            return
        fi
    fi

    # Fallback: python3
    if command -v python3 >/dev/null 2>&1; then
        local tier
        tier="$(python3 -c "
c = float('$cost')
if c > 10: print('ragnarok')
elif c > 5: print('muspel')
elif c >= 2: print('hati')
else: print('parchment')
" 2>/dev/null)" || true
        case "$tier" in
            ragnarok) printf '%b%b' "$FG_RAGNAROK" "$BOLD" ;;
            muspel)   printf '%b' "$FG_MUSPEL" ;;
            hati)     printf '%b' "$FG_HATI" ;;
            *)        printf '%b' "$FG_PARCHMENT" ;;
        esac
        return
    fi

    # Last resort: treat as parchment
    printf '%b' "$FG_PARCHMENT"
}

# ---------------------------------------------------------------------------
# Context bar color
# ---------------------------------------------------------------------------
ctx_color() {
    local pct="$1"
    if [ "$pct" -ge 90 ]; then
        printf '%b%b' "$FG_RAGNAROK" "$BOLD"
    elif [ "$pct" -ge 80 ]; then
        printf '%b' "$FG_MUSPEL"
    elif [ "$pct" -ge 60 ]; then
        printf '%b' "$FG_HATI"
    else
        printf '%b' "$FG_ASGARD"
    fi
}

# ---------------------------------------------------------------------------
# Progress bar (10 chars: filled=▓, empty=░)
# ---------------------------------------------------------------------------
progress_bar() {
    local pct="$1"
    local width=10
    local filled=$(( (pct * width + 50) / 100 ))
    if [ "$filled" -gt "$width" ]; then filled=$width; fi
    if [ "$filled" -lt 0 ]; then filled=0; fi
    local empty=$(( width - filled ))

    local bar=""
    local i=0
    while [ "$i" -lt "$filled" ]; do
        bar="${bar}▓"
        i=$((i + 1))
    done
    i=0
    while [ "$i" -lt "$empty" ]; do
        bar="${bar}░"
        i=$((i + 1))
    done
    printf '%s' "$bar"
}

# ---------------------------------------------------------------------------
# Duration formatting
# ---------------------------------------------------------------------------
format_duration() {
    local ms="$1"
    local total_sec=$(( ms / 1000 ))
    local hours=$(( total_sec / 3600 ))
    local mins=$(( (total_sec % 3600) / 60 ))

    if [ "$hours" -gt 0 ]; then
        printf '%dh %dm' "$hours" "$mins"
    else
        printf '%dm' "$mins"
    fi
}

# ---------------------------------------------------------------------------
# Ragnarok mode detection: context >= 90% AND cost > $10
# ---------------------------------------------------------------------------
is_ragnarok_mode() {
    if [ "$CTX_PCT" -ge 90 ]; then
        if command -v bc >/dev/null 2>&1; then
            if [ "$(echo "$COST_USD > 10" | bc -l 2>/dev/null)" = "1" ]; then
                return 0
            fi
        elif command -v python3 >/dev/null 2>&1; then
            if python3 -c "exit(0 if float('$COST_USD') > 10 else 1)" 2>/dev/null; then
                return 0
            fi
        fi
    fi
    return 1
}

# ---------------------------------------------------------------------------
# Separator: normal = gold │, Ragnarok = red ┃
# ---------------------------------------------------------------------------
separator() {
    if is_ragnarok_mode; then
        printf '%b┃%b' "${FG_RAGNAROK}" "${RESET}"
    else
        printf '%b│%b' "${FG_GOLD}" "${RESET}"
    fi
}

# ---------------------------------------------------------------------------
# Section builders
# ---------------------------------------------------------------------------

# Section 1: Git branch with dirty/untracked markers
section_branch() {
    local max_len="${1:-20}"
    local branch_display
    branch_display="$(truncate_branch "$GIT_BRANCH" "$max_len")"
    local markers=""
    if [ -n "$GIT_DIRTY" ] || [ -n "$GIT_UNTRACKED" ]; then
        markers="${FG_HATI}${GIT_DIRTY}${GIT_UNTRACKED}${RESET}"
    fi
    printf '%b%bᚱ %b%s%b%b' "${FG_GOLD}" "" "${FG_PARCHMENT}" "$branch_display" "${RESET}" "$markers"
}

# Section 2: Model name
section_model() {
    local name="${1:-$MODEL_SHORT}"
    printf '%bᛖ %b%s%b' "${FG_GOLD}" "${FG_PARCHMENT}" "$name" "${RESET}"
}

# Section 3: Cost
section_cost() {
    local cost_str
    cost_str="$(format_cost)"
    local color
    color="$(cost_color)"
    printf '%bᚠ %b%s%b' "${FG_GOLD}" "$color" "$cost_str" "${RESET}"
}

# Section 4: Context window with progress bar
section_context() {
    local color
    color="$(ctx_color "$CTX_PCT")"
    local bar
    bar="$(progress_bar "$CTX_PCT")"
    printf '%bᚾ %b%d%% %s%b' "${FG_GOLD}" "$color" "$CTX_PCT" "$bar" "${RESET}"
}

# Section 5: Lines added/deleted
section_lines() {
    if [ "$LINES_ADDED" -eq 0 ] && [ "$LINES_DELETED" -eq 0 ]; then
        printf '%b+0/-0%b' "${FG_STONE}" "${RESET}"
    else
        printf '%b+%d%b/%b-%d%b' "${FG_ASGARD}" "$LINES_ADDED" "${RESET}" "${FG_RAGNAROK}" "$LINES_DELETED" "${RESET}"
    fi
}

# Section 6: Duration
section_duration() {
    local dur
    dur="$(format_duration "$DURATION_MS")"
    printf '%bᛏ %b%s%b' "${FG_GOLD}" "${FG_STONE}" "$dur" "${RESET}"
}

# Section 7: Agent
section_agent() {
    if [ -n "$AGENT_NAME" ]; then
        printf '%bᚲ %b%b%s%b' "${FG_GOLD}" "${FG_PARCHMENT}" "${BOLD}" "$AGENT_NAME" "${RESET}"
    else
        printf '%bᛁ%b' "${FG_STONE}" "${RESET}"
    fi
}

# ---------------------------------------------------------------------------
# Width-responsive rendering
# ---------------------------------------------------------------------------
SEP="$(separator)"

if [ "$TERM_WIDTH" -ge 100 ]; then
    # Full layout: all 7 sections
    printf '%b' "$(section_branch 20) ${SEP} $(section_model "$MODEL_SHORT") ${SEP} $(section_cost) ${SEP} $(section_context) ${SEP} $(section_lines) ${SEP} $(section_duration) ${SEP} $(section_agent)"

elif [ "$TERM_WIDTH" -ge 80 ]; then
    # Compact: truncate branch to 15, abbreviate model, drop duration
    printf '%b' "$(section_branch 15) ${SEP} $(section_model "$MODEL_ABBREV") ${SEP} $(section_cost) ${SEP} $(section_context) ${SEP} $(section_lines) ${SEP} $(section_agent)"

elif [ "$TERM_WIDTH" -ge 60 ]; then
    # Minimal: branch + cost + context bar only
    printf '%b' "$(section_branch 12) ${SEP} $(section_cost) ${SEP} $(section_context)"

else
    # Ultra-compact: ctx:XX% | $cost
    printf '%bctx:%d%%%b %b│%b %b%s%b' "${FG_PARCHMENT}" "$CTX_PCT" "${RESET}" "${FG_GOLD}" "${RESET}" "$(cost_color)" "$(format_cost)" "${RESET}"
fi
