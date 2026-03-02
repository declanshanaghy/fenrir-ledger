# Claude Code Terminal Skin — Orchestration Plan

## Task Description

Build the Fenrir Ledger Norse terminal skin for Claude Code: a branded statusline script, Elder Futhark splash screen, terminal color palette files, and a self-contained install script. All work is shell scripting and config — no app code changes.

The design is complete. Both design artifacts must be read before implementation:
- **Product Brief**: `designs/product/backlog/claude-terminal-skin.md`
- **UX Spec**: `designs/ux-design/interactions/claude-terminal-skin.md`

## Objective

After this ships, a developer running `claude` in the Fenrir Ledger repo will:
1. See the Elder Futhark FENRIR rune art splash screen in gold ANSI before Claude Code launches
2. Have a Norse-themed statusline at the bottom of every session: rune prefixes, realm-colored context bar (Asgard/Hati/Muspel/Ragnarök), cost display, and agent name
3. Be able to import a terminal color palette (iTerm2, Ghostty) that makes their whole terminal match the Dark Nordic War Room aesthetic
4. Have a single `terminal/install.sh` script that wires everything up in one command

## Relevant Files

### Existing Files to Modify

- `~/.claude/statusline-command.sh` — existing generic statusline script (user-level). The new Norse version replaces this. The repo copy at `.claude/statusline-command.sh` is the source of truth; install.sh symlinks it.
- `.claude/settings.json` — add `statusLine.command` pointing to `.claude/statusline-command.sh`

### New Files to Create

- `.claude/statusline-command.sh` — Norse-themed statusline script (in-repo, symlinked to `~/.claude/`)
- `.claude/splash.sh` — splash screen script (standalone, called by the shell wrapper)
- `terminal/fenrir.itermcolors` — iTerm2 color preset XML
- `terminal/ghostty.conf` — Ghostty color config snippet
- `terminal/wezterm-colors.lua` — WezTerm color scheme (Lua)
- `terminal/kitty.conf` — Kitty theme conf
- `terminal/install.sh` — idempotent install script (symlinks statusline, patches `.zshrc`, prints palette instructions)
- `terminal/README.md` — setup guide

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to do the building, validating, testing, deploying, and other tasks.
- Take note of the session id of each team member. This is how you'll reference them.

### Team Members

- Builder
  - Name: fireman-decko
  - Role: Architecture, system design, implementation
  - Agent Type: fireman-decko-principal-engineer
  - Resume: true
- Validator
  - Name: loki
  - Role: QA testing, validation, ship/no-ship decision
  - Agent Type: loki-qa-tester
  - Resume: true

## Step by Step Tasks

### 1. Norse Statusline Script

- **Task ID**: statusline-script
- **Depends On**: none
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: true (can run alongside tasks 2 and 3)
- **Branch**: `feat/terminal-skin-statusline`

**Scope:**

Read the UX spec section 4 (Statusline Layout), section 5 (State Variations), section 6 (Responsive Behavior), and Appendix A (ANSI sequences) from `designs/ux-design/interactions/claude-terminal-skin.md`.

Create `.claude/statusline-command.sh`:
- Receives Claude Code JSON on stdin (fields: `workspace.current_dir`, `model.display_name`, `context_window.used_percentage`, `cost.total_cost_usd`, `cost.total_duration_ms`, `agent.name`)
- Detects git branch + dirty/untracked markers via `git -C $cwd`
- Parses JSON with `jq` (fallback: `python3 -c`)
- Reads terminal width via `tput cols` at each render
- Implements all 4 width breakpoints: `>= 100` (full), `80-99` (compact), `60-79` (minimal), `< 60` (ultra-compact)
- Implements 7 sections: ᚱ branch │ ᛖ model │ ᚠ cost │ ᚾ ctx% progress-bar │ +add/-del │ ᛏ duration │ [ᚲ/ᛁ] agent
- Implements state machine from spec: Normal, HighContext (≥80%), CriticalContext (≥90%), HighCost (>$5, >$10), AgentActive, Ragnarök (both critical)
- Progress bar: 10 chars of `▓` and `░`, color threshold: Asgard teal (<60%), Hati amber (60-79%), Muspel orange (80-89%), Ragnarök red (≥90%)
- Cost color threshold: parchment (<$2), Hati amber ($2-5), Muspel orange ($5-10), Ragnarök red+bold (>$10)
- In Ragnarök mode: all separators switch from `│` to `┃` in Ragnarök red
- All ANSI sequences from Appendix A; use 24-bit RGB with 256-color fallback
- Script must run in < 50ms; no heavy interpreters
- Use `chmod +x`

Update `.claude/settings.json`:
- Add `"statusLine": { "type": "command", "command": ".claude/statusline-command.sh" }`
- The path is relative to the project root; Claude Code resolves it from the project dir

**Acceptance Criteria:**
- [ ] Script parses all 7 JSON fields without errors
- [ ] All 4 width breakpoints render correctly (`COLUMNS=120`, `90`, `70`, `50`)
- [ ] Context bar is teal at 23%, amber at 67%, orange at 85%, red+bold at 97%
- [ ] Cost displays: parchment at $0.50, amber at $3, orange at $7, red+bold at $12
- [ ] Ragnarök mode activates when context ≥90% AND cost >$10 (heavy separators in red)
- [ ] Agent section shows ᚲ (active) or ᛁ (idle) rune prefix when agent name present
- [ ] Branch truncates at 20 chars with `…`
- [ ] Script completes in < 50ms on typical inputs
- [ ] `settings.json` has `statusLine.command` set
- [ ] Build passes: `cd development/frontend && npm run build`

---

### 2. Fenrir Splash Screen

- **Task ID**: splash-screen
- **Depends On**: none
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: true (can run alongside tasks 1 and 3)
- **Branch**: `feat/terminal-skin-splash`

**Scope:**

Read the UX spec section 3 (Splash Screen Design) from `designs/ux-design/interactions/claude-terminal-skin.md` and the splash specification from `designs/product/backlog/claude-terminal-skin.md`.

Create `.claude/splash.sh`:
- Detects terminal width via `tput cols` or `$COLUMNS`
- For terminals ≥ 60 cols: prints the full splash layout from UX spec section 3:
  - Rounded box border in Forge Gold
  - 7-line FENRIR rune art (same letterforms as `ConsoleSignature.tsx`)
  - Rune label line: `ᚠ FEHU  ᛖ EHWAZ  ᚾ NAUDIZ  ᚱ RAIDHO  ᛁ ISA  ᚱ RAIDHO` in dim stone
  - Tagline: `The wolf does not wait. The forge is lit.` in bold gold
  - Subtitle: `Break free from fee traps. Harvest every reward.` in stone muted
  - Credits line: `Built by FiremanDecko · Designed by Luna · Guarded by Freya · Tested by Loki` in very dim
  - Final quote: `Odin bound Fenrir. Fenrir built Ledger. The chain remembers.` in dim dark
- For terminals < 60 cols: compact form (ᛟ Fenrir Ledger / tagline / ᚠ ᛖ ᚾ ᚱ ᛁ ᚱ)
- Detects color support via `tput colors`; falls back gracefully (no color, no art)
- No delays, no `sleep`, no interactive prompts — pure printf
- `chmod +x`

Also create `terminal/zshrc-snippet.sh`:
- Contains the shell function wrapper:
  ```bash
  fenrir-claude() {
      source "$HOME/.claude/splash.sh"
      command claude "$@"
  }
  alias claude="fenrir-claude"
  ```
- This file is NOT auto-added to `.zshrc`; `install.sh` will do that idempotently

**Acceptance Criteria:**
- [ ] Full splash renders correctly in an 80-column terminal
- [ ] Compact splash renders in a 40-column terminal (no garbling, no wrapping)
- [ ] Script completes in < 50ms (no delays)
- [ ] All ANSI sequences properly reset with `\033[0m`
- [ ] Script is idempotent — running it twice prints the splash twice without errors
- [ ] Arguments pass through correctly when used as a Claude wrapper
- [ ] `terminal/zshrc-snippet.sh` contains the correct shell function

---

### 3. Terminal Color Palette Files

- **Task ID**: color-palette-files
- **Depends On**: none
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: true (can run alongside tasks 1 and 2)
- **Branch**: `feat/terminal-skin-palette`

**Scope:**

Read the UX spec section 8 (Theme Palette) and the product brief terminal color palette specification from `designs/product/backlog/claude-terminal-skin.md`.

Create `terminal/fenrir.itermcolors`:
- Valid iTerm2 color preset XML (plist format)
- All 16 ANSI slots mapped per spec section 8
- Background: `#07070d`, Foreground: `#f0ede4`, Cursor: `#c9920a`, Selection BG: `#1c1917`
- Importable via iTerm2 → Preferences → Profiles → Colors → Color Presets → Import

Create `terminal/ghostty.conf`:
- Ghostty color config snippet (key = value format)
- All 16 palette entries + background, foreground, cursor
- Include comment header explaining how to merge into `~/.config/ghostty/config`

Create `terminal/wezterm-colors.lua`:
- WezTerm color scheme as a Lua table
- Returns a `ColorScheme` table compatible with WezTerm's `color_scheme_dirs`
- Include comment header with instructions

Create `terminal/kitty.conf`:
- Kitty theme file format
- All 16 color slots + background, foreground, cursor, selection

**Acceptance Criteria:**
- [ ] `terminal/fenrir.itermcolors` is valid XML/plist (parseable via `plutil -lint` on macOS)
- [ ] All 4 files use the Norse color palette from the spec — verify background `#07070d`, cursor `#c9920a`, green slot `#0a8c6e`, yellow slot `#f59e0b`
- [ ] File headers include import instructions for each terminal emulator
- [ ] No hardcoded paths — all files are portable

---

### 4. Install Script + Setup Guide

- **Task ID**: install-and-docs
- **Depends On**: statusline-script, splash-screen, color-palette-files
- **Assigned To**: fireman-decko (script) then loki (validation)
- **Agent Type**: fireman-decko-principal-engineer, then loki-qa-tester
- **Parallel**: false (depends on tasks 1, 2, 3 being merged to main first)
- **Branch**: `feat/terminal-skin-install`

**Scope (fireman-decko):**

Create `terminal/install.sh`:
- Idempotent — running it multiple times has no ill effects
- Steps:
  1. Symlink `.claude/statusline-command.sh` → `~/.claude/statusline-command.sh` (backs up existing if different)
  2. Symlink `.claude/splash.sh` → `~/.claude/splash.sh`
  3. Add `statusLine` block to `~/.claude/settings.json` if not already present (user-level fallback)
  4. Check if `.zshrc` already sources the fenrir-claude function; if not, append `terminal/zshrc-snippet.sh` with guard comment
  5. Print instructions for iTerm2 and Ghostty color import (with file path)
  6. Print next steps: "Restart your terminal, then run `claude`"
- Uses `#!/usr/bin/env bash` with `set -e`
- `chmod +x`

Create `terminal/README.md`:
- Overview: what the skin does
- Prerequisites (jq, modern terminal emulator)
- Quick install: `bash terminal/install.sh`
- Manual steps for each component (statusline, splash, palette)
- Per-emulator color import instructions (iTerm2, Ghostty, WezTerm, Kitty)
- Rune semantics reference table (from UX spec Appendix B)
- Troubleshooting: narrow terminal, rune rendering, no color support

**Scope (loki):**
- Read `terminal/README.md` and follow installation steps manually
- Verify `install.sh` is idempotent (run it twice)
- Verify statusline script runs and outputs valid ANSI
- Verify splash script runs without delays or errors
- Verify iTerm2 color file is importable (`plutil -lint terminal/fenrir.itermcolors`)
- Report: SHIP / FIX REQUIRED

**Acceptance Criteria:**
- [ ] `bash terminal/install.sh` completes without errors on a clean macOS system
- [ ] Running it a second time is safe (idempotent)
- [ ] After install: `claude` alias exists in current shell (after `source ~/.zshrc`)
- [ ] After install: `~/.claude/statusline-command.sh` is symlinked from repo
- [ ] `terminal/README.md` covers all 4 components with working instructions
- [ ] `plutil -lint terminal/fenrir.itermcolors` exits 0
- [ ] Loki: SHIP verdict

## Acceptance Criteria

### Statusline
- [ ] Rune prefix (ᚱ branch, ᛖ model, ᚠ cost, ᚾ context, ᛏ time, ᚲ/ᛁ agent) in gold
- [ ] Context bar color: Asgard teal (<60%), Hati amber (60-79%), Muspel orange (80-89%), Ragnarök red (≥90%)
- [ ] Cost color: parchment (<$2), amber ($2-5), orange ($5-10), red+bold (>$10)
- [ ] Ragnarök mode: heavy separators (┃) in red when context ≥90% AND cost >$10
- [ ] Width-responsive: all 4 breakpoints work without wrapping
- [ ] `settings.json` wired with `statusLine.command`

### Splash Screen
- [ ] Full art in gold at ≥60 cols; compact at <60 cols
- [ ] Instant — no perceptible delay before Claude Code launches
- [ ] All args forwarded to `claude`

### Color Palette
- [ ] `fenrir.itermcolors` valid and importable
- [ ] Ghostty, WezTerm, Kitty configs correct and annotated
- [ ] Void-black background, gold cursor throughout

### Install
- [ ] `bash terminal/install.sh` is idempotent and safe
- [ ] `terminal/README.md` covers full setup
- [ ] Loki PASS

## Validation Commands

```bash
# Statusline — pipe test JSON to the script
echo '{"workspace":{"current_dir":"/Users/test/fenrir-ledger"},"model":{"display_name":"Sonnet"},"context_window":{"used_percentage":67},"cost":{"total_cost_usd":1.42,"total_duration_ms":900000},"agent":{"name":"Luna"}}' | bash .claude/statusline-command.sh

# Splash — run standalone
bash .claude/splash.sh

# Palette — lint iTerm2 XML
plutil -lint terminal/fenrir.itermcolors

# Build — no app changes but confirm nothing broke
cd development/frontend && npm run build
```

## Dependency Graph

```
Story 1 (statusline)  ─────────┐
Story 2 (splash)      ─────────┼──→ Story 4 (install + docs + QA)
Story 3 (palette)     ─────────┘
```

**Execution:** Stories 1, 2, 3 run in parallel (independent). Story 4 runs after all three are merged to main.
