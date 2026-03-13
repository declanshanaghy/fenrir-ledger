#!/usr/bin/env bash
# Fenrir Ledger -- Norse Statusline for Claude Code
# Renders a single-line statusline with Elder Futhark rune prefixes,
# realm-color thresholds, and dynamic full-width justification.
#
# Input:  JSON on stdin from Claude Code
# Output: ANSI-colored statusline text on stdout
#
# JSON fields consumed:
#   model.display_name                -- model name
#   context_window.used_percentage    -- integer 0-100
#   cost.total_cost_usd              -- float
#   cost.total_duration_ms           -- milliseconds
#   cost.total_lines_added           -- integer
#   cost.total_lines_removed         -- integer
#   agent.name                       -- optional, present in subagent mode
#   worktree.branch                  -- optional, present in --worktree mode

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

MODEL="$(parse_json_field '.model.display_name' 'unknown')"
CTX_PCT="$(parse_json_field '.context_window.used_percentage' '0')"
COST_USD="$(parse_json_field '.cost.total_cost_usd' '0')"
DURATION_MS="$(parse_json_field '.cost.total_duration_ms' '0')"
LINES_ADDED="$(parse_json_field '.cost.total_lines_added' '0')"
LINES_REMOVED="$(parse_json_field '.cost.total_lines_removed' '0')"
AGENT_NAME="$(parse_json_field '.agent.name' '')"
WT_BRANCH="$(parse_json_field '.worktree.branch' '')"

# Ensure numeric values are integers where needed
CTX_PCT="${CTX_PCT%%.*}"
DURATION_MS="${DURATION_MS%%.*}"
LINES_ADDED="${LINES_ADDED%%.*}"
LINES_REMOVED="${LINES_REMOVED%%.*}"

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
    local cost="$COST_USD"
    if command -v bc >/dev/null 2>&1; then
        if [ "$(echo "$cost > 10" | bc -l 2>/dev/null)" = "1" ]; then
            printf '%b%b' "$FG_RAGNAROK" "$BOLD"; return
        elif [ "$(echo "$cost > 5" | bc -l 2>/dev/null)" = "1" ]; then
            printf '%b' "$FG_MUSPEL"; return
        elif [ "$(echo "$cost >= 2" | bc -l 2>/dev/null)" = "1" ]; then
            printf '%b' "$FG_HATI"; return
        else
            printf '%b' "$FG_PARCHMENT"; return
        fi
    fi
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
# Progress bar (filled=▓, empty=░)
# ---------------------------------------------------------------------------
progress_bar() {
    local pct="$1"
    local width="${2:-10}"
    local filled=$(( (pct * width + 50) / 100 ))
    if [ "$filled" -gt "$width" ]; then filled=$width; fi
    if [ "$filled" -lt 0 ]; then filled=0; fi
    local empty=$(( width - filled ))

    local bar=""
    local i=0
    while [ "$i" -lt "$filled" ]; do bar="${bar}▓"; i=$((i + 1)); done
    i=0
    while [ "$i" -lt "$empty" ]; do bar="${bar}░"; i=$((i + 1)); done
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
SEP_CHAR="│"
SEP_COLOR="$FG_GOLD"
if is_ragnarok_mode; then
    SEP_CHAR="┃"
    SEP_COLOR="$FG_RAGNAROK"
fi

# ---------------------------------------------------------------------------
# Section builders — each outputs ANSI text; plain_* returns visible length
# ---------------------------------------------------------------------------

# Worktree branch (only shown when present)
section_branch() {
    local max_len="${1:-20}"
    local branch_display
    branch_display="$(truncate_branch "$WT_BRANCH" "$max_len")"
    printf '%bᚱ %b%s%b' "${FG_GOLD}" "${FG_PARCHMENT}" "$branch_display" "${RESET}"
}
plain_branch() {
    local max_len="${1:-20}"
    local branch_display
    branch_display="$(truncate_branch "$WT_BRANCH" "$max_len")"
    printf 'ᚱ %s' "$branch_display"
}

# Model name
section_model() {
    local name="${1:-$MODEL_SHORT}"
    printf '%bᛖ %b%s%b' "${FG_GOLD}" "${FG_PARCHMENT}" "$name" "${RESET}"
}
plain_model() {
    local name="${1:-$MODEL_SHORT}"
    printf 'ᛖ %s' "$name"
}

# Cost
section_cost() {
    printf '%bᚠ %b%s%b' "${FG_GOLD}" "$(cost_color)" "$(format_cost)" "${RESET}"
}
plain_cost() {
    printf 'ᚠ %s' "$(format_cost)"
}

# Lines changed
section_lines() {
    printf '%bᛚ %b+%d%b %b-%d%b' "${FG_GOLD}" "${FG_ASGARD}" "$LINES_ADDED" "${RESET}" "${FG_MUSPEL}" "$LINES_REMOVED" "${RESET}"
}
plain_lines() {
    printf 'ᛚ +%d -%d' "$LINES_ADDED" "$LINES_REMOVED"
}

# Context window with progress bar
section_context() {
    local bar_width="${1:-10}"
    printf '%bᚾ %b%d%% %s%b' "${FG_GOLD}" "$(ctx_color "$CTX_PCT")" "$CTX_PCT" "$(progress_bar "$CTX_PCT" "$bar_width")" "${RESET}"
}
plain_context() {
    local bar_width="${1:-10}"
    printf 'ᚾ %d%% %s' "$CTX_PCT" "$(progress_bar "$CTX_PCT" "$bar_width")"
}

# Duration
section_duration() {
    printf '%bᛏ %b%s%b' "${FG_GOLD}" "${FG_STONE}" "$(format_duration "$DURATION_MS")" "${RESET}"
}
plain_duration() {
    printf 'ᛏ %s' "$(format_duration "$DURATION_MS")"
}

# Agent (only shown when present)
section_agent() {
    printf '%bᚲ %b%b%s%b' "${FG_GOLD}" "${FG_PARCHMENT}" "${BOLD}" "$AGENT_NAME" "${RESET}"
}
plain_agent() {
    printf 'ᚲ %s' "$AGENT_NAME"
}

# ---------------------------------------------------------------------------
# Dynamic full-width justification
#
# Strategy: collect the visible segments into an array, measure total visible
# character count, then distribute remaining space as padding between segments.
# ---------------------------------------------------------------------------

# Build segment lists based on width tier
SEGMENTS_ANSI=()
SEGMENTS_PLAIN=()

add_segment() {
    SEGMENTS_ANSI+=("$1")
    SEGMENTS_PLAIN+=("$2")
}

if [ "$TERM_WIDTH" -ge 100 ]; then
    # Full layout
    if [ -n "$WT_BRANCH" ]; then
        add_segment "$(section_branch 25)" "$(plain_branch 25)"
    fi
    add_segment "$(section_model "$MODEL_SHORT")" "$(plain_model "$MODEL_SHORT")"
    add_segment "$(section_cost)" "$(plain_cost)"
    add_segment "$(section_lines)" "$(plain_lines)"
    add_segment "$(section_context 10)" "$(plain_context 10)"
    add_segment "$(section_duration)" "$(plain_duration)"
    if [ -n "$AGENT_NAME" ]; then
        add_segment "$(section_agent)" "$(plain_agent)"
    fi

elif [ "$TERM_WIDTH" -ge 80 ]; then
    # Compact: abbreviate model, drop duration
    if [ -n "$WT_BRANCH" ]; then
        add_segment "$(section_branch 18)" "$(plain_branch 18)"
    fi
    add_segment "$(section_model "$MODEL_ABBREV")" "$(plain_model "$MODEL_ABBREV")"
    add_segment "$(section_cost)" "$(plain_cost)"
    add_segment "$(section_lines)" "$(plain_lines)"
    add_segment "$(section_context 8)" "$(plain_context 8)"
    if [ -n "$AGENT_NAME" ]; then
        add_segment "$(section_agent)" "$(plain_agent)"
    fi

elif [ "$TERM_WIDTH" -ge 60 ]; then
    # Minimal: model + cost + lines + context
    add_segment "$(section_model "$MODEL_ABBREV")" "$(plain_model "$MODEL_ABBREV")"
    add_segment "$(section_cost)" "$(plain_cost)"
    add_segment "$(section_lines)" "$(plain_lines)"
    add_segment "$(section_context 6)" "$(plain_context 6)"

else
    # Ultra-compact: ctx:XX% | $cost
    printf '%bctx:%d%%%b %b│%b %b%s%b' "${FG_PARCHMENT}" "$CTX_PCT" "${RESET}" "${FG_GOLD}" "${RESET}" "$(cost_color)" "$(format_cost)" "${RESET}"
    exit 0
fi

# ---------------------------------------------------------------------------
# Measure total visible width of all segments + minimum separators
# ---------------------------------------------------------------------------
NUM_SEGS="${#SEGMENTS_ANSI[@]}"
NUM_GAPS=$(( NUM_SEGS - 1 ))

# Each gap needs at minimum: space + separator_char + space = 3 visible chars
# Measure visible width using plain text (no ANSI escapes)
total_content_width=0
for plain in "${SEGMENTS_PLAIN[@]}"; do
    # wc -m counts characters; strip trailing whitespace from wc output
    w="$(printf '%s' "$plain" | wc -m | tr -d ' ')"
    total_content_width=$(( total_content_width + w ))
done

min_gap_width=3  # " │ "
total_min_gaps=$(( NUM_GAPS * min_gap_width ))
used=$(( total_content_width + total_min_gaps ))
remaining=$(( TERM_WIDTH - used ))
if [ "$remaining" -lt 0 ]; then remaining=0; fi

# Distribute remaining space evenly across gaps
if [ "$NUM_GAPS" -gt 0 ]; then
    extra_per_gap=$(( remaining / NUM_GAPS ))
    leftover=$(( remaining % NUM_GAPS ))
else
    extra_per_gap=0
    leftover=0
fi

# ---------------------------------------------------------------------------
# Render with dynamic padding
# ---------------------------------------------------------------------------
output=""
for (( i=0; i<NUM_SEGS; i++ )); do
    output+="${SEGMENTS_ANSI[$i]}"
    if [ "$i" -lt "$NUM_GAPS" ]; then
        # Calculate padding for this gap
        pad=$(( extra_per_gap ))
        # Distribute leftover 1 char at a time to earlier gaps
        if [ "$i" -lt "$leftover" ]; then
            pad=$(( pad + 1 ))
        fi
        # Left side padding (half), separator, right side padding (other half)
        left_pad=$(( (pad + 1) / 2 + 1 ))   # +1 for the minimum space
        right_pad=$(( pad / 2 + 1 ))          # +1 for the minimum space
        # Build padding strings
        left_spaces=""
        for (( j=0; j<left_pad; j++ )); do left_spaces+=" "; done
        right_spaces=""
        for (( j=0; j<right_pad; j++ )); do right_spaces+=" "; done
        output+="${left_spaces}${SEP_COLOR}${SEP_CHAR}${RESET}${right_spaces}"
    fi
done

printf '%b' "$output"
