import React, { useState, useEffect } from "react";
import { Box, useApp, useInput, useStdout } from "ink";
import { log } from "@fenrir/logger";
import { TopBar } from "./components/TopBar.js";
import { StatusBar } from "./components/StatusBar.js";
import { HelpOverlay } from "./components/HelpOverlay.js";
import { CommandPalette } from "./components/CommandPalette.js";
import { UsersTab } from "./tabs/UsersTab.js";
import { HouseholdsTab } from "./tabs/HouseholdsTab.js";
import { SelectionProvider } from "./context/SelectionContext.js";
import { pfProc } from "./lib/redis.js";
import type { ConnStatus, Counts } from "./components/StatusBar.js";

const TUI_TABS = ["Users", "Households"] as const;

// Module-level log handler — set by SpearApp on mount, cleared on unmount.
// Async callbacks (Redis, port-forward) that fire after render must use this
// instead of writing directly to stdout to avoid corrupting Ink's fullscreen buffer.
let _tuiLog: ((msg: string) => void) | null = null;

export function tuiLog(msg: string, _isError = false): void {
  if (_tuiLog) {
    _tuiLog(msg);
  }
  // After render, route through logger only — never write to stdout
  log.debug("tuiLog called", { messageLength: msg.length });
}

interface SpearAppProps {
  initialConnStatus: ConnStatus;
  initialCounts: Counts;
}

/**
 * SpearApp — root Ink component with tab router
 */
export function SpearApp({ initialConnStatus, initialCounts }: SpearAppProps): React.JSX.Element {
  log.debug("SpearApp render");
  const { exit } = useApp();
  const { stdout } = useStdout();

  const [activeTab, setActiveTab] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [cmdStatus, setCmdStatusMsg] = useState<string | null>(null);
  const [connState, setConnState] = useState<ConnStatus>(initialConnStatus);
  const [countState, setCountState] = useState<Counts>(initialCounts);

  // Register tuiLog handler so async callbacks route through React state
  useEffect(() => {
    log.debug("SpearApp: registering tuiLog handler");
    _tuiLog = (msg: string) => setCmdStatusMsg(String(msg).slice(0, 120));
    return () => {
      log.debug("SpearApp: clearing tuiLog handler");
      _tuiLog = null;
    };
  }, []);

  // Suppress unused-variable warnings for setters that will be wired up in later stories
  void setConnState;
  void setCountState;

  useInput((input, key) => {
    log.debug("useInput called", { input, keyEscape: key.escape, keyTab: key.tab, keyCtrl: key.ctrl });

    if (showPalette) {
      if (key.escape) {
        log.debug("SpearApp: closing palette");
        setShowPalette(false);
      }
      return;
    }

    if (showHelp) {
      log.debug("SpearApp: closing help");
      setShowHelp(false);
      return;
    }

    if (input === "q") {
      log.debug("SpearApp: quitting");
      if (pfProc) {
        try { pfProc.kill(); } catch { /* ignore */ }
      }
      exit();
      return;
    }

    if (input === "?") {
      log.debug("SpearApp: toggling help");
      setShowHelp((v) => !v);
      return;
    }

    if (input === "/") {
      log.debug("SpearApp: opening palette");
      setShowPalette(true);
      return;
    }

    if (key.tab) {
      const next = (activeTab + 1) % TUI_TABS.length;
      log.debug("SpearApp: switching tab", { from: activeTab, to: next });
      setActiveTab(next);
      return;
    }

    if (key.ctrl && input === "r") {
      log.debug("SpearApp: reload triggered");
      setCmdStatusMsg("Reload triggered\u2026");
      return;
    }
  });

  const termWidth = stdout?.columns ?? 80;
  const termHeight = stdout?.rows ?? 24;

  log.debug("SpearApp rendering layout", { termWidth, termHeight, activeTab, showHelp, showPalette });

  const mainContent = showHelp ? (
    <HelpOverlay />
  ) : showPalette ? (
    <CommandPalette />
  ) : activeTab === 0 ? (
    <UsersTab cmdStatus={cmdStatus} />
  ) : (
    <HouseholdsTab cmdStatus={cmdStatus} />
  );

  return (
    <SelectionProvider>
      <Box flexDirection="column" width={termWidth} height={termHeight}>
        <TopBar activeTab={activeTab} onTabSwitch={setActiveTab} />
        {mainContent}
        <StatusBar connStatus={connState} counts={countState} activeTab={activeTab} />
      </Box>
    </SelectionProvider>
  );
}
