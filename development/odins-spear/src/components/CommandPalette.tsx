import React from "react";
import { Box, Text } from "ink";
import { log } from "@fenrir/logger";

const GOLD = "#c9920a";
const GRAY = "#6b6b80";

/**
 * CommandPaletteOverlay — placeholder stub
 * Full implementation comes in #1495
 */
export function CommandPalette(): React.JSX.Element {
  log.debug("CommandPalette render");
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
      <Text color={GRAY}>{"Type a command\u2026"}</Text>
      <Box height={1} />
      <Text color="#3b3b4f" dimColor>(Command palette — full impl in #1495)</Text>
      <Box height={1} />
      <Text color={GRAY} dimColor>Press Esc to close</Text>
    </Box>
  );
}
