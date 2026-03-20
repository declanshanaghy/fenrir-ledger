import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { log } from "@fenrir/logger";
import {
  filterCommandsForTab,
  isAvailable,
  type PaletteCommand,
  type CommandContext,
} from "../commands/registry.js";

// ─── Colors ──────────────────────────────────────────────────────────────────

const GOLD = "#c9920a";
const GRAY = "#6b6b80";
const DIM = "#3b3b4f";
const RED = "#ef4444";
const GREEN = "#22c55e";

const SUBSYSTEM_COLOR: Record<string, string> = {
  firestore: "#3b82f6",
  stripe: "#8b5cf6",
  system: GOLD,
  trial: "#22c55e",
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CommandPaletteProps {
  ctx: CommandContext;
  /** Active tab index: 0 = Users, 1 = Households. Filters command list to relevant commands. */
  activeTab: number;
  onClose: () => void;
  onReadResult: (title: string, lines: string[]) => void;
  onDestructive: (cmd: PaletteCommand) => void;
  onTrialInput: (cmd: PaletteCommand) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

const MAX_VISIBLE = 12;

export function CommandPalette({
  ctx,
  activeTab,
  onClose,
  onReadResult,
  onDestructive,
  onTrialInput,
}: CommandPaletteProps): React.JSX.Element {
  log.debug("CommandPalette render", { activeTab });

  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter to tab-relevant commands; fall back to all if query bypasses tab filter
  const allMatches = query.length > 0
    ? filterCommandsForTab(query, activeTab)
    : filterCommandsForTab("", activeTab);
  // Stable per-render so hooks are unconditional
  const visibleStart = Math.max(0, cursor - MAX_VISIBLE + 1);
  const visible = allMatches.slice(visibleStart, visibleStart + MAX_VISIBLE);

  const handleSelect = useCallback(
    async (cmd: PaletteCommand) => {
      log.debug("CommandPalette handleSelect called", {
        name: cmd.name,
        destructive: cmd.destructive,
        available: isAvailable(cmd, ctx),
      });

      if (!isAvailable(cmd, ctx)) {
        log.debug("CommandPalette handleSelect: command not available");
        setError(`"${cmd.name}" requires ${cmd.requiresContext ?? "unknown"} context`);
        return;
      }

      if (cmd.destructive) {
        log.debug("CommandPalette handleSelect: routing to destructive confirm");
        onDestructive(cmd);
        return;
      }

      if (cmd.needsInput) {
        log.debug("CommandPalette handleSelect: routing to trial input dialog");
        onTrialInput(cmd);
        return;
      }

      setExecuting(true);
      setError(null);
      try {
        log.debug("CommandPalette handleSelect: executing read command", { name: cmd.name });
        const lines = await cmd.execute(ctx);
        log.debug("CommandPalette handleSelect: execution done", { lineCount: lines.length });
        onReadResult(cmd.name, lines);
      } catch (err) {
        const msg = (err as Error).message ?? String(err);
        log.error("CommandPalette handleSelect: execution error", err as Error);
        setError(msg);
        setExecuting(false);
      }
    },
    [ctx, onDestructive, onReadResult]
  );

  useInput((_input, key) => {
    log.debug("CommandPalette useInput", { keyEscape: key.escape, keyUpArrow: key.upArrow, keyDownArrow: key.downArrow, keyReturn: key.return });

    if (key.escape) {
      log.debug("CommandPalette: escape pressed, closing");
      onClose();
      return;
    }

    if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1));
      return;
    }

    if (key.downArrow) {
      setCursor((c) => Math.min(allMatches.length - 1, c + 1));
      return;
    }

    if (key.return && !executing) {
      const selected = allMatches[cursor];
      if (selected) {
        void handleSelect(selected);
      }
    }
  });

  // Reset cursor when query changes
  const handleQueryChange = (val: string): void => {
    log.debug("CommandPalette query changed", { length: val.length });
    setQuery(val);
    setCursor(0);
    setError(null);
  };

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
      {/* Header */}
      <Box flexDirection="row" gap={1}>
        <Text color={GOLD} bold>{">"}</Text>
        <TextInput
          value={query}
          onChange={handleQueryChange}
          placeholder="type to filter commands…"
        />
      </Box>

      <Box height={1} />

      {/* Results list */}
      {allMatches.length === 0 ? (
        <Text color={DIM} dimColor>no matching commands</Text>
      ) : (
        visible.map((cmd, i) => {
          const absoluteIdx = visibleStart + i;
          const isCursor = absoluteIdx === cursor;
          const available = isAvailable(cmd, ctx);
          const subsysColor = SUBSYSTEM_COLOR[cmd.subsystem] ?? GOLD;

          return (
            <Box key={cmd.name} flexDirection="row" gap={1}>
              <Text color={isCursor ? GOLD : DIM}>{isCursor ? ">" : " "}</Text>
              <Box minWidth={22}>
                <Text
                  color={available ? (isCursor ? GOLD : "#e5e5f0") : GRAY}
                  bold={isCursor}
                  dimColor={!available}
                >
                  {cmd.name}
                </Text>
              </Box>
              <Box minWidth={10}>
                <Text color={subsysColor} dimColor={!available}>
                  [{cmd.subsystem}]
                </Text>
              </Box>
              <Text color={available ? "#9b9baa" : DIM} dimColor={!available}>
                {cmd.desc}
                {cmd.destructive ? (
                  <Text color={RED}> !</Text>
                ) : null}
                {!available && cmd.requiresContext ? (
                  <Text color={GRAY}> (needs {cmd.requiresContext})</Text>
                ) : null}
              </Text>
            </Box>
          );
        })
      )}

      <Box height={1} />

      {/* Status / error row */}
      {error ? (
        <Text color={RED}>{error}</Text>
      ) : executing ? (
        <Text color={GREEN}>executing…</Text>
      ) : (
        <Box flexDirection="row" gap={2}>
          <Text color={GRAY} dimColor>↑↓ navigate</Text>
          <Text color={GRAY} dimColor>Enter select</Text>
          <Text color={GRAY} dimColor>Esc close</Text>
          <Text color={GRAY} dimColor>
            {allMatches.length}/{filterCommandsForTab("", activeTab).length} commands
          </Text>
        </Box>
      )}
    </Box>
  );
}
