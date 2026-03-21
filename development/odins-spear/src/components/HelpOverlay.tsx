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
  /** Which tabs show this section. "all" = always visible. */
  tabs: "all" | "users" | "households";
  shortcuts: Shortcut[];
}

const SECTIONS: Section[] = [
  {
    title: "Navigation",
    tabs: "all",
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
    tabs: "users",
    shortcuts: [
      { key: "d",  desc: "Delete selected user" },
      { key: "h",  desc: "Jump to user's household" },
    ],
  },
  {
    title: "User Actions  (user selected)",
    tabs: "users",
    shortcuts: [
      { key: "s",  desc: "Cancel active Stripe subscription" },
    ],
  },
  {
    title: "Household Actions  (household selected)",
    tabs: "households",
    shortcuts: [
      { key: "a",  desc: "Open trial-adjust dialog (shift trial start date)" },
      { key: "d",  desc: "Delete selected household" },
      { key: "u",  desc: "List household members" },
    ],
  },
  {
    title: "System Commands",
    tabs: "all",
    shortcuts: [
      { key: "Ctrl+R",  desc: "Reload current view" },
      { key: "/firestore-ping",             desc: "Ping Firestore" },
      { key: "/firestore-list-collections", desc: "List Firestore collections" },
      { key: "/stripe-check-key",           desc: "Verify Stripe key" },
    ],
  },
];

/**
 * Return sections visible for a given tab index.
 * tabIndex 0 → Users, 1 → Households.
 */
export function getSectionsForTab(tabIndex: number): Section[] {
  const tabName = tabIndex === 0 ? "users" : "households";
  return SECTIONS.filter((s) => s.tabs === "all" || s.tabs === tabName);
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface HelpOverlayProps {
  /** Active tab index: 0 = Users, 1 = Households. Controls which sections are shown. */
  activeTab: number;
  onClose: () => void;
}

export function HelpOverlay({ activeTab, onClose }: HelpOverlayProps): React.JSX.Element {
  log.debug("HelpOverlay render", { activeTab });

  useInput((_input, _key) => {
    log.debug("HelpOverlay: key pressed, closing");
    onClose();
  });

  const tabLabel = activeTab === 0 ? "Users" : "Households";
  const sections = getSectionsForTab(activeTab);

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
      <Text bold color={GOLD}>
        Keyboard Shortcuts — Odin{"'"}s Spear  <Text color={DIM}>[{tabLabel} tab]</Text>
      </Text>

      {sections.map((section) => (
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
