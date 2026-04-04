import React, { useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { log } from "@fenrir/logger";
import type { MigrationScript } from "../lib/migrations.js";

// ─── Colors ──────────────────────────────────────────────────────────────────

const GOLD = "#c9920a";
const GRAY = "#6b6b80";
const DIM = "#3b3b4f";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ScriptBrowserOverlayProps {
  scripts: MigrationScript[];
  onSelect: (script: MigrationScript) => void;
  onClose: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ScriptBrowserOverlay({
  scripts,
  onSelect,
  onClose,
}: ScriptBrowserOverlayProps): React.JSX.Element {
  log.debug("ScriptBrowserOverlay render", { count: scripts.length });

  const { stdout } = useStdout();
  const termHeight = stdout?.rows ?? 24;
  const PAGE_SIZE = Math.max(4, termHeight - 10);

  const [cursor, setCursor] = useState(0);

  useInput((_input, key) => {
    log.debug("ScriptBrowserOverlay useInput", {
      keyEscape: key.escape,
      keyReturn: key.return,
      keyUpArrow: key.upArrow,
      keyDownArrow: key.downArrow,
    });

    if (key.escape) {
      log.debug("ScriptBrowserOverlay: escape, closing");
      onClose();
      return;
    }

    if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1));
      return;
    }

    if (key.downArrow) {
      setCursor((c) => Math.min(scripts.length - 1, c + 1));
      return;
    }

    if (key.return) {
      const selected = scripts[cursor];
      if (selected) {
        log.debug("ScriptBrowserOverlay: selected", { name: selected.name });
        onSelect(selected);
      }
      return;
    }
  });

  const offset = Math.max(0, cursor - PAGE_SIZE + 1);
  const visible = scripts.slice(offset, offset + PAGE_SIZE);

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
      {/* Header */}
      <Text bold color={GOLD}>
        Migration Scripts
      </Text>

      <Box height={1} />

      {scripts.length === 0 ? (
        <Text color={GRAY} dimColor>
          No migration scripts found in migrations/
        </Text>
      ) : (
        visible.map((script, i) => {
          const idx = offset + i;
          const isActive = idx === cursor;
          return (
            <Box key={script.filename} flexDirection="row" gap={1}>
              <Text color={isActive ? GOLD : DIM}>{isActive ? "▶" : " "}</Text>
              <Box flexDirection="column">
                <Text bold={isActive} color={isActive ? GOLD : "#e5e5f0"}>
                  {script.name}
                </Text>
                <Text color={GRAY} dimColor>
                  {"  "}
                  {script.desc}
                </Text>
              </Box>
            </Box>
          );
        })
      )}

      <Box height={1} />

      {/* Footer */}
      <Box flexDirection="row" gap={3}>
        <Text color={GRAY} dimColor>↑↓ navigate</Text>
        <Text color={GRAY} dimColor>Enter select</Text>
        <Text color={GRAY} dimColor>Esc close</Text>
      </Box>
    </Box>
  );
}
