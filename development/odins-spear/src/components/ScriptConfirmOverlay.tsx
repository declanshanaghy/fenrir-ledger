import React from "react";
import { Box, Text, useInput } from "ink";
import { log } from "@fenrir/logger";
import type { MigrationScript } from "../lib/migrations.js";

// ─── Colors ──────────────────────────────────────────────────────────────────

const GOLD = "#c9920a";
const GRAY = "#6b6b80";
const GREEN = "#22c55e";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ScriptConfirmOverlayProps {
  script: MigrationScript;
  onConfirm: () => void;
  onCancel: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ScriptConfirmOverlay({
  script,
  onConfirm,
  onCancel,
}: ScriptConfirmOverlayProps): React.JSX.Element {
  log.debug("ScriptConfirmOverlay render", { name: script.name });

  useInput((_input, key) => {
    log.debug("ScriptConfirmOverlay useInput", {
      keyEscape: key.escape,
      keyReturn: key.return,
    });

    if (key.escape) {
      log.debug("ScriptConfirmOverlay: cancelled");
      onCancel();
      return;
    }

    if (key.return) {
      log.debug("ScriptConfirmOverlay: confirmed");
      onConfirm();
      return;
    }
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
      {/* Header */}
      <Text bold color={GOLD}>
        Run Migration Script
      </Text>

      <Box height={1} />

      {/* Script info */}
      <Box flexDirection="row" gap={1}>
        <Text color={GRAY}>Script:</Text>
        <Text color="#e5e5f0" bold>{script.filename}</Text>
      </Box>
      <Box flexDirection="row" gap={1}>
        <Text color={GRAY}>{"      "}</Text>
        <Text color={GRAY} dimColor>{script.desc}</Text>
      </Box>

      <Box height={1} />

      <Text color="#9b9baa">
        This will execute the migration against the configured Firestore database.
      </Text>
      <Text color={GRAY} dimColor>
        Scripts are trusted local code. Ensure you know what this script does before running.
      </Text>

      <Box height={1} />

      {/* Footer */}
      <Box flexDirection="row" gap={3}>
        <Text color={GREEN} bold>Enter to run</Text>
        <Text color={GOLD}>Esc to cancel</Text>
      </Box>
    </Box>
  );
}
