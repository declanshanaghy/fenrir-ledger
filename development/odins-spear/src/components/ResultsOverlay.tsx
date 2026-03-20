import React from "react";
import { Box, Text } from "ink";
import { log } from "@fenrir/logger";

const GOLD = "#c9920a";
const GRAY = "#6b6b80";

interface ResultsOverlayProps {
  title: string;
  lines: string[];
}

/**
 * ResultsOverlay — scrollable output pane stub
 * Full implementation comes in #1495
 */
export function ResultsOverlay({ title, lines }: ResultsOverlayProps): React.JSX.Element {
  log.debug("ResultsOverlay render", { title, lineCount: lines.length });
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
      <Text bold color={GOLD}>{title}</Text>
      <Box height={1} />
      {lines.map((line, i) => (
        <Text key={i} color="#9b9baa">{line}</Text>
      ))}
      {lines.length === 0 && (
        <Text color={GRAY} dimColor>(no output)</Text>
      )}
      <Box height={1} />
      <Text color={GRAY} dimColor>Press Esc to close</Text>
    </Box>
  );
}
