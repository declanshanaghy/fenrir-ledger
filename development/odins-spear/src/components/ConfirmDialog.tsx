import React from "react";
import { Box, Text } from "ink";
import { log } from "@fenrir/logger";

const GOLD = "#c9920a";
const RED = "#ef4444";
const GRAY = "#6b6b80";

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * ConfirmDialog — destructive-action confirm stub
 * Full implementation comes in #1495
 */
export function ConfirmDialog({ message, onConfirm: _onConfirm, onCancel: _onCancel }: ConfirmDialogProps): React.JSX.Element {
  log.debug("ConfirmDialog render", { messageLength: message.length });
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
      <Text bold color={RED}>Confirm Action</Text>
      <Box height={1} />
      <Text color="#9b9baa">{message}</Text>
      <Box height={1} />
      <Box flexDirection="row" gap={3}>
        <Text color={RED} bold>[y] Confirm</Text>
        <Text color={GOLD} bold>[n] Cancel</Text>
      </Box>
      <Box height={1} />
      <Text color={GRAY} dimColor>(ConfirmDialog — full impl in #1495)</Text>
    </Box>
  );
}
