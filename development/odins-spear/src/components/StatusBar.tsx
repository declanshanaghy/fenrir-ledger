import React from "react";
import { Box, Text } from "ink";
import { log } from "@fenrir/logger";

const GREEN = "#22c55e";
const RED = "#ef4444";
const GRAY = "#6b6b80";

export interface ConnStatus {
  firestore: boolean;
  stripe: boolean;
}

export interface Counts {
  users: number;
  households: number;
}

interface StatusDotProps {
  connected: boolean;
  label: string;
}

function StatusDot({ connected, label }: StatusDotProps): React.JSX.Element {
  return (
    <Box flexDirection="row" gap={1}>
      <Text color={connected ? GREEN : RED}>{"\u25CF"}</Text>
      <Text color={GRAY}>{label}</Text>
    </Box>
  );
}

interface StatusBarProps {
  connStatus: ConnStatus;
  counts: Counts;
  activeTab: number;
}

/**
 * StatusBar — connection dots + item count
 * Matches HTML .statusbar layout
 */
export function StatusBar({ connStatus, counts, activeTab }: StatusBarProps): React.JSX.Element {
  log.debug("StatusBar render", { activeTab });
  const countLabel =
    activeTab === 0
      ? `${counts.households} household${counts.households !== 1 ? "s" : ""}`
      : `${counts.users} user${counts.users !== 1 ? "s" : ""}`;

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      paddingX={2}
      borderStyle="single"
      borderTop={true}
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      borderColor="#1e1e2e"
    >
      <Box flexDirection="row" gap={3}>
        <StatusDot connected={connStatus.firestore} label="Firestore" />
        <StatusDot connected={connStatus.stripe} label="Stripe" />
      </Box>
      <Text color={GRAY}>{countLabel}</Text>
    </Box>
  );
}
