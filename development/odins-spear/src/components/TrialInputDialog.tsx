import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { log } from "@fenrir/logger";

// ─── Colors ───────────────────────────────────────────────────────────────────

const GOLD = "#c9920a";
const GRAY = "#6b6b80";
const GREEN = "#22c55e";
const RED = "#ef4444";
const DIM = "#3b3b4f";

// ─── Validation ───────────────────────────────────────────────────────────────

function isValidDayInput(input: string): boolean {
  const n = parseInt(input, 10);
  return !isNaN(n) && n !== 0;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrialInputDialogProps {
  /** Name of the action, e.g. "trial-adjust" */
  action: string;
  onConfirm: (dayInput: string) => void;
  onCancel: () => void;
  /** True while the command is executing — disables confirm, shows spinner */
  executing?: boolean;
  /** Inline error message to show when execution failed */
  error?: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TrialInputDialog({
  action,
  onConfirm,
  onCancel,
  executing = false,
  error = null,
}: TrialInputDialogProps): React.JSX.Element {
  log.debug("TrialInputDialog render", { action, executing });

  const [dayInput, setDayInput] = useState("");
  const valid = isValidDayInput(dayInput);

  useInput((_input, key) => {
    log.debug("TrialInputDialog useInput", { keyEscape: key.escape, keyReturn: key.return });

    if (key.escape) {
      if (!executing) {
        log.debug("TrialInputDialog: escape pressed, cancelling");
        onCancel();
      }
      return;
    }

    if (key.return) {
      if (executing) {
        log.debug("TrialInputDialog: return pressed while executing — ignoring");
        return;
      }
      if (valid) {
        log.debug("TrialInputDialog: confirmed with input", { dayInput });
        onConfirm(dayInput);
      } else {
        log.debug("TrialInputDialog: return pressed but input is not valid", { dayInput });
      }
    }
  });

  const handleChange = (val: string): void => {
    log.debug("TrialInputDialog input changed", { length: val.length });
    setDayInput(val);
  };

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
      <Text bold color={GOLD}>Trial Adjust: {action}</Text>

      <Box height={1} />

      {/* Instruction */}
      <Text color="#9b9baa">
        Enter day offset to shift the trial start date.
      </Text>
      <Text color={GRAY} dimColor>
        +N ages the trial by N days (fewer remaining).
      </Text>
      <Text color={GRAY} dimColor>
        -N restores N days (more remaining).
      </Text>

      <Box height={1} />

      {/* Input */}
      <Box flexDirection="row" gap={1}>
        <Text color={valid ? GREEN : RED}>{">"}</Text>
        <TextInput
          value={dayInput}
          onChange={handleChange}
          placeholder="+5 or -3"
        />
      </Box>

      {dayInput.length > 0 && !valid ? (
        <Text color={RED}>Enter a non-zero integer (e.g. +5 or -3)</Text>
      ) : null}

      {/* Inline error (shown when command failed — dialog stays open) */}
      {error ? (
        <Box marginTop={1}>
          <Text color={RED} bold>Error: </Text>
          <Text color={RED}>{error}</Text>
        </Box>
      ) : null}

      <Box height={1} />

      {/* Footer */}
      <Box flexDirection="row" gap={3}>
        {executing ? (
          <Text color={GREEN}>Executing…</Text>
        ) : (
          <Text color={valid ? GREEN : DIM} bold={valid}>
            {valid ? "Enter to apply" : "type a non-zero integer"}
          </Text>
        )}
        {!executing && <Text color={GOLD}>Esc to cancel</Text>}
      </Box>
    </Box>
  );
}
