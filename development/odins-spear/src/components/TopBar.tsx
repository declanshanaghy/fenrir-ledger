import React from "react";
import { Box, Text } from "ink";
import { log } from "@fenrir/logger";

const TUI_TABS = ["Users", "Households"];
const GOLD = "#c9920a";
const GRAY = "#6b6b80";

interface TopBarProps {
  activeTab: number;
  onTabSwitch: (tab: number) => void;
}

/**
 * TopBar — brand + tab buttons + shortcut hints
 * Matches HTML .topbar layout
 */
export function TopBar({ activeTab, onTabSwitch: _onTabSwitch }: TopBarProps): React.JSX.Element {
  log.debug("TopBar render", { activeTab });
  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      paddingX={2}
      borderStyle="single"
      borderBottom={true}
      borderTop={false}
      borderLeft={false}
      borderRight={false}
      borderColor="#1e1e2e"
    >
      {/* Left: brand + tabs */}
      <Box flexDirection="row" gap={2}>
        <Text bold color={GOLD}>{"ODIN'S SPEAR \u26A1"}</Text>
        <Box flexDirection="row" gap={1}>
          {TUI_TABS.map((tab, i) => (
            <Box
              key={tab}
              paddingX={1}
              backgroundColor={activeTab === i ? GOLD : undefined}
            >
              <Text
                bold={activeTab === i}
                color={activeTab === i ? "#000000" : "#9b9baa"}
              >
                {tab}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
      {/* Right: shortcut hints */}
      <Box flexDirection="row" gap={3}>
        <Text color={GRAY}>{"["}</Text>
        <Text color={GOLD}>{"/"}</Text>
        <Text color={GRAY}>{"] Command  ["}</Text>
        <Text color={GOLD}>{"^R"}</Text>
        <Text color={GRAY}>{"] Reload  ["}</Text>
        <Text color={GOLD}>{"?"}</Text>
        <Text color={GRAY}>{"] Help"}</Text>
      </Box>
    </Box>
  );
}
