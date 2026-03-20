import React, { useState, useCallback } from "react";
import { Box, useApp, useInput, useStdout } from "ink";
import { log } from "@fenrir/logger";
import { TopBar } from "./components/TopBar.js";
import { StatusBar } from "./components/StatusBar.js";
import { HelpOverlay } from "./components/HelpOverlay.js";
import { CommandPalette } from "./components/CommandPalette.js";
import { ResultsOverlay } from "./components/ResultsOverlay.js";
import { ConfirmDialog } from "./components/ConfirmDialog.js";
import { TrialInputDialog } from "./components/TrialInputDialog.js";
import { UsersTab } from "./tabs/UsersTab.js";
import { HouseholdsTab } from "./tabs/HouseholdsTab.js";
import { CardDrilldownView } from "./tabs/CardDrilldownView.js";
import { SelectionProvider, useSelection } from "./context/SelectionContext.js";
import type { PaletteCommand, CommandContext } from "./commands/registry.js";
import { getCommands } from "./commands/registry.js";
import type { ConnStatus, Counts } from "./components/StatusBar.js";

const TUI_TABS = ["Users", "Households"] as const;

// ─── Inner component (needs SelectionProvider in tree) ───────────────────────

interface SpearInnerProps {
  initialConnStatus: ConnStatus;
  initialCounts: Counts;
}

type OverlayMode =
  | { kind: "none" }
  | { kind: "help" }
  | { kind: "palette" }
  | { kind: "results"; title: string; lines: string[] }
  | { kind: "confirm"; cmd: PaletteCommand }
  | { kind: "trial-input"; cmd: PaletteCommand };

function SpearInner({ initialConnStatus, initialCounts }: SpearInnerProps): React.JSX.Element {
  log.debug("SpearInner render");
  const { exit } = useApp();
  const { stdout } = useStdout();
  const selection = useSelection();

  const [activeTab, setActiveTab] = useState(0);
  const [jumpHouseholdId, setJumpHouseholdId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<OverlayMode>({ kind: "none" });
  const [cmdStatus, setCmdStatusMsg] = useState<string | null>(null);
  const [connState, setConnState] = useState<ConnStatus>(initialConnStatus);
  const [countState, setCountState] = useState<Counts>(initialCounts);
  const [inputCaptured, setInputCaptured] = useState(false);
  const [cardDrilldown, setCardDrilldown] = useState<{
    householdId: string;
    filterUserId: string | null;
    breadcrumbFrom: string;
    ownerEmail: string;
  } | null>(null);

  // Suppress unused-variable warnings for setters wired in later stories
  void setConnState;
  void setCountState;

  // Build CommandContext from SelectionContext
  const cmdCtx: CommandContext = {
    selectedUserId: selection.selectedUserId,
    selectedHouseholdId: selection.selectedHouseholdId,
    selectedFp: selection.selectedFp,
    selectedSubId: selection.selectedSubId,
  };

  // ─── Overlay callbacks ─────────────────────────────────────────────────────

  const closeOverlay = useCallback(() => {
    log.debug("SpearInner: closeOverlay called");
    setOverlay({ kind: "none" });
  }, []);

  const openPalette = useCallback(() => {
    log.debug("SpearInner: opening palette");
    setOverlay({ kind: "palette" });
  }, []);

  const openHelp = useCallback(() => {
    log.debug("SpearInner: opening help");
    setOverlay({ kind: "help" });
  }, []);

  const handleReadResult = useCallback((title: string, lines: string[]) => {
    log.debug("SpearInner: handleReadResult called", { title, lineCount: lines.length });
    setOverlay({ kind: "results", title, lines });
  }, []);

  const handleDestructive = useCallback((cmd: PaletteCommand) => {
    log.debug("SpearInner: handleDestructive called", { name: cmd.name });
    setOverlay({ kind: "confirm", cmd });
  }, []);

  const handleTrialInput = useCallback((cmd: PaletteCommand) => {
    log.debug("SpearInner: handleTrialInput called", { name: cmd.name });
    setOverlay({ kind: "trial-input", cmd });
  }, []);

  const handleTrialInputConfirm = useCallback(async (cmd: PaletteCommand, dayInput: string) => {
    log.debug("SpearInner: handleTrialInputConfirm called", { name: cmd.name, dayInput });
    closeOverlay();
    try {
      const lines = await cmd.execute({ ...cmdCtx, input: dayInput });
      log.debug("SpearInner: handleTrialInputConfirm done", { lineCount: lines.length });
      setOverlay({ kind: "results", title: cmd.name, lines });
    } catch (err) {
      log.error("SpearInner: handleTrialInputConfirm error", err as Error);
      setOverlay({
        kind: "results",
        title: cmd.name,
        lines: [`ERROR: ${(err as Error).message ?? String(err)}`],
      });
    }
  }, [cmdCtx, closeOverlay]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirmExecute = useCallback(async (cmd: PaletteCommand) => {
    log.debug("SpearInner: handleConfirmExecute called", { name: cmd.name });
    closeOverlay();
    try {
      const lines = await cmd.execute(cmdCtx);
      log.debug("SpearInner: handleConfirmExecute done", { lineCount: lines.length });
      setOverlay({ kind: "results", title: cmd.name, lines });
    } catch (err) {
      log.error("SpearInner: handleConfirmExecute error", err as Error);
      setOverlay({
        kind: "results",
        title: cmd.name,
        lines: [`ERROR: ${(err as Error).message ?? String(err)}`],
      });
    }
  }, [cmdCtx, closeOverlay]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Global key handler (inactive when an overlay owns input) ─────────────

  useInput((input, key) => {
    log.debug("SpearInner useInput", {
      input,
      overlayKind: overlay.kind,
      keyEscape: key.escape,
      keyTab: key.tab,
      keyCtrl: key.ctrl,
    });

    // Overlays own their own input via useInput — we suppress global keys here
    if (overlay.kind !== "none") return;

    // A tab has captured input (e.g. tier prompt) — global keys must not fire
    if (inputCaptured) return;

    if (input === "q") {
      log.debug("SpearInner: quitting");
      exit();
      return;
    }

    if (input === "?") {
      openHelp();
      return;
    }

    if (input === "/") {
      openPalette();
      return;
    }

    if (key.tab) {
      const next = (activeTab + 1) % TUI_TABS.length;
      log.debug("SpearInner: switching tab", { from: activeTab, to: next });
      setActiveTab(next);
      return;
    }

    if (key.ctrl && input === "r") {
      log.debug("SpearInner: reload triggered");
      setCmdStatusMsg("Reload triggered\u2026");
      return;
    }
  });

  const termWidth = stdout?.columns ?? 80;
  const termHeight = stdout?.rows ?? 24;

  log.debug("SpearInner rendering layout", {
    termWidth,
    termHeight,
    activeTab,
    overlayKind: overlay.kind,
  });

  // ─── Overlay rendering ─────────────────────────────────────────────────────

  let mainContent: React.JSX.Element;
  if (overlay.kind === "help") {
    mainContent = <HelpOverlay activeTab={activeTab} onClose={closeOverlay} />;
  } else if (overlay.kind === "palette") {
    mainContent = (
      <CommandPalette
        ctx={cmdCtx}
        activeTab={activeTab}
        onClose={closeOverlay}
        onReadResult={handleReadResult}
        onDestructive={handleDestructive}
        onTrialInput={handleTrialInput}
      />
    );
  } else if (overlay.kind === "results") {
    mainContent = (
      <ResultsOverlay
        title={overlay.title}
        lines={overlay.lines}
        onClose={closeOverlay}
      />
    );
  } else if (overlay.kind === "trial-input") {
    mainContent = (
      <TrialInputDialog
        action={overlay.cmd.name}
        onConfirm={(dayInput) => { void handleTrialInputConfirm(overlay.cmd, dayInput); }}
        onCancel={() => {
          closeOverlay();
          setCmdStatusMsg("Cancelled");
        }}
      />
    );
  } else if (overlay.kind === "confirm") {
    mainContent = (
      <ConfirmDialog
        action={overlay.cmd.name}
        desc={overlay.cmd.desc}
        onConfirm={() => { void handleConfirmExecute(overlay.cmd); }}
        onCancel={closeOverlay}
      />
    );
  } else if (cardDrilldown) {
    mainContent = (
      <CardDrilldownView
        householdId={cardDrilldown.householdId}
        filterUserId={cardDrilldown.filterUserId}
        breadcrumbFrom={cardDrilldown.breadcrumbFrom}
        ownerEmail={cardDrilldown.ownerEmail}
        onBack={() => setCardDrilldown(null)}
        onInputCapture={setInputCaptured}
        cmdStatus={cmdStatus}
      />
    );
  } else if (activeTab === 0) {
    mainContent = (
      <UsersTab
        cmdStatus={cmdStatus}
        onInputCapture={setInputCaptured}
        onJumpToHousehold={(householdId) => { setJumpHouseholdId(householdId); setActiveTab(1); }}
        onCardsView={(householdId, filterUserId, ownerEmail) => {
          setCardDrilldown({ householdId, filterUserId, breadcrumbFrom: ownerEmail, ownerEmail });
        }}
        onTrialAdjust={() => {
          const cmd = getCommands().find((c) => c.name === "trial-adjust");
          if (cmd) handleTrialInput(cmd);
        }}
      />
    );
  } else {
    mainContent = (
      <HouseholdsTab
        cmdStatus={cmdStatus}
        initialHouseholdId={jumpHouseholdId}
        onCardsView={(householdId, householdName) => {
          setCardDrilldown({ householdId, filterUserId: null, breadcrumbFrom: householdName, ownerEmail: householdName });
        }}
      />
    );
  }

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight}>
      <TopBar activeTab={activeTab} onTabSwitch={setActiveTab} />
      {mainContent}
      <StatusBar connStatus={connState} counts={countState} activeTab={activeTab} />
    </Box>
  );
}

// ─── Public root component ────────────────────────────────────────────────────

interface SpearAppProps {
  initialConnStatus: ConnStatus;
  initialCounts: Counts;
}

/**
 * SpearApp — root Ink component with tab router and overlay system.
 */
export function SpearApp({ initialConnStatus, initialCounts }: SpearAppProps): React.JSX.Element {
  log.debug("SpearApp render");
  return (
    <SelectionProvider>
      <SpearInner
        initialConnStatus={initialConnStatus}
        initialCounts={initialCounts}
      />
    </SelectionProvider>
  );
}
