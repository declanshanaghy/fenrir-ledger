import React from "react";
import { Box, Text, useInput } from "ink";
import { log } from "@fenrir/logger";

// ─── Colors ──────────────────────────────────────────────────────────────────

const GOLD = "#c9920a";
const DIM = "#6b6b80";

// ─── Shortcut sections ────────────────────────────────────────────────────────

interface Shortcut {
  key: string;
  desc: string;
}

interface Section {
  title: string;
  shortcuts: Shortcut[];
}

const SECTIONS: Section[] = [
  {
    title: "Navigation",
    shortcuts: [
      { key: "Tab",      desc: "Switch tab (Users / Households)" },
      { key: "↑ / ↓",   desc: "Navigate list" },
      { key: "Enter",    desc: "Select item" },
      { key: "Esc",      desc: "Go back / close overlay" },
      { key: "/",        desc: "Open command palette" },
      { key: "?",        desc: "Show this help" },
      { key: "q",        desc: "Quit" },
    ],
  },
  {
    title: "User Actions  (user selected)",
    shortcuts: [
      { key: "d",  desc: "Delete selected user" },
      { key: "t",  desc: "Update subscription tier" },
      { key: "h",  desc: "Jump to user's household" },
    ],
  },
  {
    title: "Household Actions  (household selected)",
    shortcuts: [
      { key: "d",  desc: "Delete selected household" },
      { key: "u",  desc: "List household members" },
    ],
  },
  {
    title: "Trial Actions  (trial in scope)",
    shortcuts: [
      { key: "s",  desc: "Cancel active Stripe subscription" },
      { key: "e",  desc: "Extend trial period" },
    ],
  },
  {
    title: "System Commands",
    shortcuts: [
      { key: "Ctrl+R",  desc: "Reload current view" },
      { key: "/redis-ping",       desc: "Ping Redis" },
      { key: "/redis-keys",       desc: "List all Redis keys" },
      { key: "/redis-info",       desc: "Redis server INFO" },
      { key: "/firestore-list-collections", desc: "List Firestore collections" },
      { key: "/stripe-check-key", desc: "Verify Stripe key" },
    ],
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export interface HelpOverlayProps {
  onClose: () => void;
}

export function HelpOverlay({ onClose }: HelpOverlayProps): React.JSX.Element {
  log.debug("HelpOverlay render");

  useInput((_input, _key) => {
    log.debug("HelpOverlay: key pressed, closing");
    onClose();
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={GOLD}
      paddingX={3}
      paddingY={1}
      marginX={4}
      marginY={1}
    >
      <Text bold color={GOLD}>Keyboard Shortcuts — Odin{"'"}s Spear</Text>

      {SECTIONS.map((section) => (
        <Box key={section.title} flexDirection="column" marginTop={1}>
          {/* Section heading */}
          <Text color={GOLD} bold underline>{section.title}</Text>

          {/* Shortcut rows */}
          {section.shortcuts.map(({ key, desc }) => (
            <Box key={key} flexDirection="row" gap={1} marginLeft={1}>
              <Box minWidth={26}>
                <Text color="#e5e5f0" bold>{key}</Text>
              </Box>
              <Text color="#9b9baa">{desc}</Text>
            </Box>
          ))}
        </Box>
      ))}

      <Box height={1} />
      <Text color={DIM} dimColor>Press any key to close</Text>
    </Box>
  );
}
