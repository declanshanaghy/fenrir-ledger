import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { log } from "@fenrir/logger";

// ─── Colors ──────────────────────────────────────────────────────────────────

const GOLD = "#c9920a";
const RED = "#ef4444";
const GREEN = "#22c55e";
const GRAY = "#6b6b80";

const CONFIRM_WORD = "delete";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConfirmDialogProps {
  /** Name of the action, e.g. "redis-flush" */
  action: string;
  /** One-line description */
  desc: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ConfirmDialog({ action, desc, onConfirm, onCancel }: ConfirmDialogProps): React.JSX.Element {
  log.debug("ConfirmDialog render", { action, descLength: desc.length });

  const [typed, setTyped] = useState("");

  const isReady = typed === CONFIRM_WORD;

  useInput((_input, key) => {
    log.debug("ConfirmDialog useInput", { keyEscape: key.escape, keyReturn: key.return });

    if (key.escape) {
      log.debug("ConfirmDialog: escape pressed, cancelling");
      onCancel();
      return;
    }

    if (key.return) {
      if (isReady) {
        log.debug("ConfirmDialog: confirmed");
        onConfirm();
      } else {
        log.debug("ConfirmDialog: return pressed but typed word does not match", {
          typed,
          required: CONFIRM_WORD,
        });
      }
    }
  });

  const handleChange = (val: string): void => {
    log.debug("ConfirmDialog typed changed", { length: val.length });
    setTyped(val);
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={RED}
      paddingX={3}
      paddingY={1}
      marginX={4}
      marginY={1}
    >
      {/* Header */}
      <Text bold color={RED}>Destructive Action: {action}</Text>

      <Box height={1} />

      {/* Description */}
      <Text color="#9b9baa">{desc}</Text>

      <Box height={1} />

      {/* Confirmation input */}
      <Box flexDirection="row" gap={1}>
        <Text color={GRAY}>Type</Text>
        <Text color={RED} bold>"{CONFIRM_WORD}"</Text>
        <Text color={GRAY}>to confirm:</Text>
      </Box>

      <Box flexDirection="row" gap={1} marginTop={1}>
        <Text color={isReady ? GREEN : RED}>{">"}</Text>
        <TextInput
          value={typed}
          onChange={handleChange}
          placeholder={CONFIRM_WORD}
        />
      </Box>

      <Box height={1} />

      {/* Footer */}
      <Box flexDirection="row" gap={3}>
        <Text color={isReady ? GREEN : GRAY} bold={isReady}>
          {isReady ? "Enter to CONFIRM" : "type 'delete' then Enter"}
        </Text>
        <Text color={GOLD}>Esc to cancel</Text>
      </Box>
    </Box>
  );
}
