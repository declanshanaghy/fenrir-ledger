import React from "react";
import { Box, Text } from "ink";
import { log } from "@fenrir/logger";

const GRAY = "#6b6b80";

interface UsersTabProps {
  cmdStatus: string | null;
}

/**
 * UsersTab — Users master-detail panel
 * Left panel ~34 cols, right panel flex-grow
 * Real user list comes in #1387
 */
export function UsersTab({ cmdStatus }: UsersTabProps): React.JSX.Element {
  log.debug("UsersTab render");
  return (
    <Box flexDirection="row" flexGrow={1}>
      {/* Left panel */}
      <Box
        flexDirection="column"
        width={34}
        borderStyle="single"
        borderRight={true}
        borderLeft={false}
        borderTop={false}
        borderBottom={false}
        borderColor="#1e1e2e"
      >
        {/* Search placeholder */}
        <Box
          paddingX={1}
          paddingY={0}
          borderStyle="single"
          borderBottom={true}
          borderTop={false}
          borderLeft={false}
          borderRight={false}
          borderColor="#1e1e2e"
        >
          <Text color={GRAY}>{"Search\u2026 (/ for commands)"}</Text>
        </Box>
        {/* List placeholder */}
        <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
          <Text color={GRAY} dimColor>{"\u2014 Users list coming in"}</Text>
          <Text color={GRAY} dimColor>{"  #1387 \u2014"}</Text>
        </Box>
      </Box>
      {/* Right panel */}
      <Box
        flexDirection="column"
        flexGrow={1}
        alignItems="center"
        justifyContent="center"
        paddingX={2}
      >
        <Text color="#8a6408" bold>{"\u16C5"}</Text>
        <Box height={1} />
        <Text color={GRAY}>Select a user from the list</Text>
        <Text color="#3b3b4f" dimColor>Use arrow keys to navigate</Text>
        {cmdStatus ? (
          <Box marginTop={1}>
            <Text color="#9b9baa">{cmdStatus}</Text>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
