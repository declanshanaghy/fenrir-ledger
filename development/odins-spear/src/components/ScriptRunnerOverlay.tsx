import React, { useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { log } from "@fenrir/logger";
import type { MigrationScript } from "../lib/migrations.js";

// ─── Colors ──────────────────────────────────────────────────────────────────

const GOLD = "#c9920a";
const GRAY = "#6b6b80";
const GREEN = "#22c55e";
const RED = "#ef4444";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ScriptRunnerOverlayProps {
  script: MigrationScript;
  lines: string[];
  running: boolean;
  exitCode: number | null;
  onClose: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ScriptRunnerOverlay({
  script,
  lines,
  running,
  exitCode,
  onClose,
}: ScriptRunnerOverlayProps): React.JSX.Element {
  log.debug("ScriptRunnerOverlay render", {
    name: script.name,
    lineCount: lines.length,
    running,
    exitCode,
  });

  const { stdout } = useStdout();
  const termHeight = stdout?.rows ?? 24;
  // Reserve rows: 2 border + 1 title + 1 status + 2 gaps + 1 footer + 2 margin = 9
  const PAGE_SIZE = Math.max(4, termHeight - 9);

  const [offset, setOffset] = useState(0);
  const maxOffset = Math.max(0, lines.length - PAGE_SIZE);

  useInput((_input, key) => {
    log.debug("ScriptRunnerOverlay useInput", {
      keyEscape: key.escape,
      running,
    });

    if (key.escape && !running) {
      log.debug("ScriptRunnerOverlay: escape, closing");
      onClose();
      return;
    }

    if (key.upArrow) {
      setOffset((o) => Math.max(0, o - 1));
      return;
    }

    if (key.downArrow) {
      setOffset((o) => Math.min(maxOffset, o + 1));
      return;
    }

    if (key.pageUp) {
      setOffset((o) => Math.max(0, o - PAGE_SIZE));
      return;
    }

    if (key.pageDown) {
      setOffset((o) => Math.min(maxOffset, o + PAGE_SIZE));
      return;
    }
  });

  // Auto-follow tail while running
  const viewOffset = running ? maxOffset : offset;
  const visibleLines = lines.slice(viewOffset, viewOffset + PAGE_SIZE);
  const scrollInfo =
    lines.length > PAGE_SIZE
      ? ` [${viewOffset + 1}–${Math.min(viewOffset + PAGE_SIZE, lines.length)}/${lines.length}]`
      : "";

  const statusColor = running ? GOLD : exitCode === 0 ? GREEN : RED;
  const statusText = running
    ? "Running…"
    : exitCode === 0
      ? "Done — exit 0 (success)"
      : `Failed — exit ${exitCode ?? "?"}`;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={statusColor}
      paddingX={2}
      paddingY={1}
      marginX={4}
      marginY={1}
    >
      {/* Title */}
      <Box flexDirection="row" gap={1}>
        <Text bold color={GOLD}>{script.name}</Text>
        {scrollInfo ? <Text color={GRAY} dimColor>{scrollInfo}</Text> : null}
        <Box flexGrow={1} />
        <Text color={statusColor} bold>{statusText}</Text>
      </Box>

      <Box height={1} />

      {/* Output */}
      {visibleLines.length === 0 ? (
        <Text color={GRAY} dimColor>{running ? "Waiting for output…" : "(no output)"}</Text>
      ) : (
        visibleLines.map((line, i) => (
          <Text key={viewOffset + i} color="#9b9baa">{line}</Text>
        ))
      )}

      <Box height={1} />

      {/* Footer */}
      {running ? (
        <Text color={GRAY} dimColor>Running… please wait</Text>
      ) : (
        <Box flexDirection="row" gap={2}>
          <Text color={GRAY} dimColor>↑↓ scroll</Text>
          {lines.length > PAGE_SIZE && <Text color={GRAY} dimColor>PgUp/PgDn page</Text>}
          <Text color={GRAY} dimColor>Esc close</Text>
        </Box>
      )}
    </Box>
  );
}
