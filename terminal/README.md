# Fenrir Ledger -- Norse Terminal Skin

A complete terminal skin for Claude Code that transforms your coding environment into
the Saga Ledger dark Norse aesthetic. Elder Futhark runes, realm-color thresholds,
a splash screen forged in gold, and a 16-color palette drawn from the Nine Realms.

## What Is Included

| Component | File | Description |
|-----------|------|-------------|
| Statusline | `.claude/statusline-command.sh` | Norse rune-prefixed statusline with 7 sections, 4 width breakpoints, and Ragnarok mode |
| Splash Screen | `.claude/splash.sh` | Elder Futhark FENRIR rune art displayed before Claude Code launches |
| Color Palette | `terminal/fenrir.itermcolors` | iTerm2 color preset (Void Black + Forge Gold + Saga palette) |
| Color Palette | `terminal/ghostty.conf` | Ghostty terminal color configuration |
| Color Palette | `terminal/wezterm-colors.lua` | WezTerm color scheme (Lua table) |
| Color Palette | `terminal/kitty.conf` | Kitty terminal theme file |
| Shell Wrapper | `terminal/zshrc-snippet.sh` | Zsh function that shows splash screen before launching Claude |
| Installer | `terminal/install.sh` | Idempotent setup script that wires everything together |

## Prerequisites

- **jq** -- required for merging JSON settings. Install with `brew install jq` (macOS) or `apt-get install jq` (Linux).
- **A modern terminal** with Unicode support (for Elder Futhark runes) and 24-bit ANSI color (for the full palette).
- **zsh** -- the shell wrapper targets `.zshrc`. Bash users can adapt the snippet manually.

## Quick Install

```bash
# From the repo root:
bash terminal/install.sh
```

The installer is idempotent -- safe to run multiple times. It will:

1. Symlink the statusline and splash scripts into `~/.claude/`
2. Merge the `statusLine` configuration into `~/.claude/settings.json`
3. Append a `claude` wrapper function to `~/.zshrc` (with guard markers)
4. Print color palette import instructions for your terminal emulator

After running, restart your terminal (or `source ~/.zshrc`) and type `claude`.

---

## Manual Setup

If you prefer to install components individually, follow the sections below.

### Statusline

The statusline script renders a single-line status bar at the bottom of Claude Code
with Elder Futhark rune prefixes and realm-color thresholds.

**What it shows (left to right):**

1. **Git branch** with dirty/untracked markers
2. **AI model** name (shortened)
3. **Session cost** with color thresholds
4. **Context window** usage with progress bar
5. **Lines changed** (+added/-deleted)
6. **Session duration**
7. **Agent status** (active torch or idle ice)

**Install manually:**

```bash
# Symlink the script
mkdir -p ~/.claude
ln -sf "$(pwd)/.claude/statusline-command.sh" ~/.claude/statusline-command.sh

# Add to settings (requires jq)
jq '. + {"statusLine":{"type":"command","command":"~/.claude/statusline-command.sh"}}' \
    ~/.claude/settings.json > /tmp/claude-settings.json \
    && mv /tmp/claude-settings.json ~/.claude/settings.json
```

**Customization:**

The script responds to terminal width automatically:

| Width | Layout |
|-------|--------|
| >= 100 cols | Full: all 7 sections |
| 80-99 cols | Compact: abbreviated model, no duration |
| 60-79 cols | Minimal: branch + cost + context only |
| < 60 cols | Ultra-compact: context % and cost only |

Color thresholds are hardcoded in the script. To adjust cost tier colors, edit the
`cost_color()` function in `.claude/statusline-command.sh`. Context thresholds are
in `ctx_color()`.

### Splash Screen

The splash screen displays Elder Futhark runes spelling FENRIR in a gold box-drawn
frame before Claude Code launches. It adapts to terminal width and color support.

**Install manually:**

```bash
# Symlink the script
ln -sf "$(pwd)/.claude/splash.sh" ~/.claude/splash.sh

# Add to your .zshrc (or source the snippet file directly):
source /path/to/fenrir-ledger/terminal/zshrc-snippet.sh
```

The wrapper function intercepts the `claude` command, runs the splash script, then
passes all arguments through to the real `claude` binary via `command claude "$@"`.

**Behavior by terminal size:**

| Condition | Output |
|-----------|--------|
| >= 60 cols, color | Full gold rune art in rounded box |
| < 60 cols, color | Compact one-line brand with rune row |
| No color | Plain text, no ANSI escapes |

### Color Palette

The Norse color palette uses 16 ANSI colors mapped to the Saga Ledger design system.
Import instructions for each supported terminal emulator:

#### iTerm2

1. Open **Preferences** > **Profiles** > **Colors**
2. Click the **Color Presets...** dropdown > **Import...**
3. Select `terminal/fenrir.itermcolors`
4. Choose **fenrir** from the presets dropdown

To verify the file is valid:
```bash
plutil -lint terminal/fenrir.itermcolors
```

#### Ghostty

**Option A** -- Append directly to your config:
```bash
cat terminal/ghostty.conf >> ~/.config/ghostty/config
```

**Option B** -- Install as a named theme:
```bash
mkdir -p ~/.config/ghostty/themes
cp terminal/ghostty.conf ~/.config/ghostty/themes/fenrir
# Then in ~/.config/ghostty/config:
#   theme = fenrir
```

#### WezTerm

```bash
mkdir -p ~/.config/wezterm/colors
cp terminal/wezterm-colors.lua ~/.config/wezterm/colors/Fenrir.lua
```

Then in your `wezterm.lua`:
```lua
config.color_scheme = "Fenrir"
```

Or load the colors inline:
```lua
config.colors = dofile(os.getenv("HOME") .. "/.config/wezterm/colors/Fenrir.lua")
```

#### Kitty

```bash
mkdir -p ~/.config/kitty/themes
cp terminal/kitty.conf ~/.config/kitty/themes/fenrir.conf
```

Then in your `kitty.conf`:
```
include themes/fenrir.conf
```

Or use the built-in theme manager:
```bash
kitty +kitten themes --custom-color-dir ~/.config/kitty/themes
```

---

## Rune Semantics Reference

Each Elder Futhark rune in the statusline maps a Norse concept to a Claude Code metric.
The mapping follows the mythological meaning of each rune.

| Rune | Name | Norse Meaning | Statusline Mapping |
|------|------|---------------|-------------------|
| **ᚱ** | Raidho | Journey, travel | Git branch (your coding journey) |
| **ᛖ** | Ehwaz | Partnership, horse | AI model (your coding partner) |
| **ᚠ** | Fehu | Wealth, cattle | Session cost (spending your wealth) |
| **ᚾ** | Naudiz | Need, constraint | Context window pressure (growing need) |
| **ᛏ** | Tiwaz | Tyr, justice, time | Session duration (time spent forging) |
| **ᚲ** | Kenaz | Torch, illumination | Agent active (the torch is lit) |
| **ᛁ** | Isa | Ice, stillness | Agent idle (frozen, awaiting command) |
| **ᛟ** | Othala | Homeland, heritage | Brand mark (Fenrir's home rune) |

---

## Norse Color Palette

The full 16-color ANSI palette, drawn from the Saga Ledger design system.

### Special Colors

| Role | Name | Hex | Usage |
|------|------|-----|-------|
| Background | Void Black | `#07070d` | Terminal background |
| Foreground | Parchment | `#f0ede4` | Default text |
| Cursor | Forge Gold | `#c9920a` | Cursor and accents |
| Selection BG | Warm Charcoal | `#1c1917` | Selected text background |
| Selection FG | Pure Parchment | `#faf9f6` | Selected text foreground |

### Normal Colors (ANSI 0-7)

| ANSI | Name | Hex | Norse Origin |
|------|------|-----|-------------|
| 0 | Void Black | `#07070d` | The void before creation |
| 1 | Ragnarok Red | `#ef4444` | End of days, critical alerts |
| 2 | Asgard Teal | `#0a8c6e` | Realm of the gods, healthy state |
| 3 | Hati Amber | `#f59e0b` | Moon-chasing wolf, warnings |
| 4 | Deep Fjord | `#2563eb` | Norwegian fjords, informational |
| 5 | Muspel Orange | `#c94a0a` | Muspelheim fire realm, elevated alerts |
| 6 | Forge Gold | `#c9920a` | Dwarven forge, primary accent |
| 7 | Parchment | `#f0ede4` | Norse manuscript, default text |

### Bright Colors (ANSI 8-15)

| ANSI | Name | Hex | Norse Origin |
|------|------|-----|-------------|
| 8 | Stone | `#8a8578` | Runestones, dimmed/secondary text |
| 9 | Light Ragnarok | `#f87171` | Lighter fire, less severe warnings |
| 10 | Light Asgard | `#34d399` | Bright realm glow, success |
| 11 | Light Hati | `#fbbf24` | Bright amber, soft warnings |
| 12 | Light Fjord | `#60a5fa` | Shallow waters, links and info |
| 13 | Light Muspel | `#fb923c` | Ember glow, secondary highlights |
| 14 | Light Gold | `#eab308` | Polished gold, secondary accent |
| 15 | Pure Parchment | `#faf9f6` | Fresh vellum, bright white |

### Cost Tier Colors

The statusline uses escalating realm colors for session cost:

| Tier | Threshold | Color | Meaning |
|------|-----------|-------|---------|
| Normal | < $2.00 | Parchment | The wolf sleeps |
| Hati | >= $2.00 | Amber | The moon-wolf stirs |
| Muspel | > $5.00 | Orange | Fire realm burns |
| Ragnarok | > $10.00 | **Red (bold)** | The end of days |

### Context Window Colors

| Tier | Threshold | Color | Meaning |
|------|-----------|-------|---------|
| Asgard | < 60% | Teal | Realm of plenty |
| Hati | >= 60% | Amber | Growing hunger |
| Muspel | >= 80% | Orange | The fire approaches |
| Ragnarok | >= 90% | **Red (bold)** | Twilight of the gods |

---

## Troubleshooting

### Runes Display as Boxes or Question Marks

Your terminal font does not include Elder Futhark glyphs. Solutions:

- Use a font that includes Unicode Block "Runic" (U+16A0-U+16FF). Most modern monospace fonts support this: **JetBrains Mono**, **Fira Code**, **Cascadia Code**, **Iosevka**.
- On macOS, the system fallback font usually renders runes correctly even if your primary font does not.
- If using a bitmap font or a very old terminal, consider switching to a modern font.

### Narrow Terminal -- Statusline Is Clipped or Missing Sections

The statusline is width-responsive and adapts automatically:

- At **< 60 columns**, only context % and cost are shown.
- At **60-79 columns**, branch + cost + context bar.
- At **80-99 columns**, compact layout with abbreviated model names.
- At **>= 100 columns**, the full 7-section layout.

If sections still appear clipped, widen your terminal window.

### No Colors in Terminal

The skin uses 24-bit (truecolor) ANSI escape sequences. Requirements:

- Your terminal must support truecolor. Most modern terminals do: iTerm2, Ghostty, WezTerm, Kitty, Alacritty, Windows Terminal.
- Older terminals (macOS Terminal.app, some tmux configurations) may not support 24-bit color.
- For tmux, ensure `set -g default-terminal "tmux-256color"` and `set -ga terminal-overrides ",*256col*:Tc"` are in your `.tmux.conf`.

### Splash Screen Does Not Appear

1. Verify the wrapper is in your `.zshrc`: look for the `# >>> fenrir-ledger claude wrapper >>>` guard comment.
2. Verify the splash script is executable: `ls -la ~/.claude/splash.sh` should show the symlink.
3. Test the splash directly: `bash ~/.claude/splash.sh`
4. If using bash instead of zsh, source the snippet in `.bashrc` instead.

### The `claude` Command Runs But No Splash Shows

The wrapper function uses `command claude` to find the real binary. If Claude Code is not in your `$PATH`, the wrapper will still try to run it but the splash may not trigger. Verify with:

```bash
command -v claude
```

### Install Script Fails With "jq not found"

Install jq:

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# Fedora
sudo dnf install jq
```

### Settings Were Overwritten

The install script merges into existing `~/.claude/settings.json` using `jq`. It will not overwrite other keys. If you had a custom `statusLine` configuration, the script skips the merge and keeps your existing config.

If you need to reset, delete the `statusLine` key from `~/.claude/settings.json` and re-run the installer.

---

## Uninstall

To remove the terminal skin:

```bash
# 1. Remove symlinks
rm -f ~/.claude/statusline-command.sh ~/.claude/splash.sh

# 2. Remove statusLine from settings
jq 'del(.statusLine)' ~/.claude/settings.json > /tmp/claude-settings.json \
    && mv /tmp/claude-settings.json ~/.claude/settings.json

# 3. Remove the wrapper from ~/.zshrc
# Delete everything between these markers:
#   # >>> fenrir-ledger claude wrapper >>>
#   # <<< fenrir-ledger claude wrapper <<<
```

---

*The wolf does not wait. The forge is lit.*
