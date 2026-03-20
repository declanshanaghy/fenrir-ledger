import React, { useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { log } from "@fenrir/logger";

// ─── Colors ──────────────────────────────────────────────────────────────────

const GOLD = "#c9920a";
const GRAY = "#6b6b80";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ResultsOverlayProps {
  title: string;
  lines: string[];
  onClose: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ResultsOverlay({ title, lines, onClose }: ResultsOverlayProps): React.JSX.Element {
  log.debug("ResultsOverlay render", { title, lineCount: lines.length });

  const { stdout } = useStdout();
  const termHeight = stdout?.rows ?? 24;
  // Reserve rows: 2 border + 1 title + 1 gap + 1 gap + 1 footer + 2 margin = 8
  const PAGE_SIZE = Math.max(4, termHeight - 8);

  const [offset, setOffset] = useState(0);

  const maxOffset = Math.max(0, lines.length - PAGE_SIZE);

  useInput((_input, key) => {
    log.debug("ResultsOverlay useInput", {
      keyEscape: key.escape,
      keyUpArrow: key.upArrow,
      keyDownArrow: key.downArrow,
      keyPageUp: key.pageUp,
      keyPageDown: key.pageDown,
    });

    if (key.escape) {
      log.debug("ResultsOverlay: escape pressed, closing");
      onClose();
      return;
    }

    if (key.upArrow) {
      setOffset((o) => {
        const next = Math.max(0, o - 1);
        log.debug("ResultsOverlay: scroll up", { offset: next });
        return next;
      });
      return;
    }

    if (key.downArrow) {
      setOffset((o) => {
        const next = Math.min(maxOffset, o + 1);
        log.debug("ResultsOverlay: scroll down", { offset: next });
        return next;
      });
      return;
    }

    if (key.pageUp) {
      setOffset((o) => {
        const next = Math.max(0, o - PAGE_SIZE);
        log.debug("ResultsOverlay: page up", { offset: next });
        return next;
      });
      return;
    }

    if (key.pageDown) {
      setOffset((o) => {
        const next = Math.min(maxOffset, o + PAGE_SIZE);
        log.debug("ResultsOverlay: page down", { offset: next });
        return next;
      });
      return;
    }
  });

  const visibleLines = lines.slice(offset, offset + PAGE_SIZE);
  const scrollInfo =
    lines.length > PAGE_SIZE
      ? ` [${offset + 1}–${Math.min(offset + PAGE_SIZE, lines.length)}/${lines.length}]`
      : "";

  log.debug("ResultsOverlay rendering", { visibleCount: visibleLines.length, offset, maxOffset });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={GOLD}
      paddingX={2}
      paddingY={1}
      marginX={4}
      marginY={1}
    >
      {/* Title bar */}
      <Box flexDirection="row" gap={1}>
        <Text bold color={GOLD}>{title}</Text>
        {scrollInfo ? <Text color={GRAY} dimColor>{scrollInfo}</Text> : null}
      </Box>

      <Box height={1} />

      {/* Content */}
      {visibleLines.length === 0 ? (
        <Text color={GRAY} dimColor>(no output)</Text>
      ) : (
        visibleLines.map((line, i) => (
          <Text key={offset + i} color="#9b9baa">{line}</Text>
        ))
      )}

      <Box height={1} />

      {/* Footer */}
      <Box flexDirection="row" gap={2}>
        <Text color={GRAY} dimColor>↑↓ scroll</Text>
        {lines.length > PAGE_SIZE && (
          <Text color={GRAY} dimColor>PgUp/PgDn page</Text>
        )}
        <Text color={GRAY} dimColor>Esc close</Text>
      </Box>
    </Box>
  );
}
