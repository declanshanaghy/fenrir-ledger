-- Fenrir Ledger — Norse Terminal Palette for WezTerm
-- ==================================================
-- Install instructions:
--   1. Copy this file to ~/.config/wezterm/colors/Fenrir.toml
--      OR save it anywhere and register via wezterm.lua
--   2. In your wezterm.lua, add:
--        local wezterm = require("wezterm")
--        config.color_scheme = "Fenrir"
--
--   Alternative (inline): In wezterm.lua, paste the table directly:
--        config.colors = dofile(os.getenv("HOME") .. "/.config/wezterm/colors/Fenrir.lua")
--
-- Palette: Saga Ledger dark Norse theme
-- Background: Void Black #07070d
-- Foreground: Parchment #f0ede4
-- Cursor: Forge Gold #c9920a

return {
  foreground = "#f0ede4",    -- Parchment
  background = "#07070d",    -- Void Black

  cursor_bg = "#c9920a",     -- Forge Gold
  cursor_fg = "#07070d",     -- Void Black
  cursor_border = "#c9920a", -- Forge Gold

  selection_fg = "#faf9f6",  -- Pure Parchment
  selection_bg = "#1c1917",  -- Warm Charcoal

  ansi = {
    "#07070d",  -- 0  Void Black
    "#ef4444",  -- 1  Ragnarok Red
    "#0a8c6e",  -- 2  Asgard Teal
    "#f59e0b",  -- 3  Hati Amber
    "#2563eb",  -- 4  Deep Fjord
    "#c94a0a",  -- 5  Muspel Orange
    "#c9920a",  -- 6  Forge Gold
    "#f0ede4",  -- 7  Parchment
  },

  brights = {
    "#8a8578",  -- 8  Stone (Bright Black)
    "#f87171",  -- 9  Light Ragnarok (Bright Red)
    "#34d399",  -- 10 Light Asgard (Bright Green)
    "#fbbf24",  -- 11 Light Hati (Bright Yellow)
    "#60a5fa",  -- 12 Light Fjord (Bright Blue)
    "#fb923c",  -- 13 Light Muspel (Bright Magenta)
    "#eab308",  -- 14 Light Gold (Bright Cyan)
    "#faf9f6",  -- 15 Pure Parchment (Bright White)
  },
}
