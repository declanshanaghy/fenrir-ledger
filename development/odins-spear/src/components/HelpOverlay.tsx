import React from "react";
import { Box, Text } from "ink";
import { log } from "@fenrir/logger";

const GOLD = "#c9920a";
const GRAY = "#6b6b80";

const SHORTCUTS: [string, string][] = [
  ["Tab",      "Switch Users / Households"],
  ["Up/Down",  "Navigate list"],
  ["Enter",    "Select item"],
  ["Esc",      "Go back / close modal"],
  ["/",        "Command palette"],
  ["?",        "Show this help"],
  ["d",        "Delete selected item"],
  ["t",        "Update tier (users)"],
  ["s",        "Cancel subscription"],
  ["h",        "Go to household (users)"],
  ["q",        "Quit"],
];

/**
 * HelpOverlay — keyboard shortcut grid
 * Full content comes in #1495; this is the foundation placeholder
 */
export function HelpOverlay(): React.JSX.Element {
  log.debug("HelpOverlay render");
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
      <Text bold color={GOLD}>Keyboard Shortcuts</Text>
      <Box height={1} />
      {SHORTCUTS.map(([key, desc]) => (
        <Box key={key} flexDirection="row" gap={1}>
          <Box minWidth={12}>
            <Text color={GOLD} bold>{key}</Text>
          </Box>
          <Text color="#9b9baa">{desc}</Text>
        </Box>
      ))}
      <Box height={1} />
      <Text color={GRAY} dimColor>Press any key to close</Text>
    </Box>
  );
}
