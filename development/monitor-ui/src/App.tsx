import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ServerMessage } from "./lib/types";
import { randomQuote } from "./lib/constants";
import { useWebSocket } from "./hooks/useWebSocket";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useJobs } from "./hooks/useJobs";
import { useLogStream } from "./hooks/useLogStream";
import { ErrorBanner } from "./components/ErrorBanner";
import { Sidebar } from "./components/Sidebar";
import { LogViewer } from "./components/LogViewer";

export function App() {
  const quote = useMemo(() => randomQuote(), []);
  const { jobs, handleMessage: handleJobsMessage } = useJobs();
  const {
    entries,
    activeSessionId,
    setActiveSessionId,
    clearEntries,
    handleMessage: handleLogMessage,
    terminalError,
  } = useLogStream();

  const prevSessionRef = useRef<string | null>(null);

  const [isFixture, setIsFixture] = useState(false);

  const onMessage = useCallback(
    (msg: ServerMessage) => {
      handleJobsMessage(msg);
      if (msg.type === "fixture-start" && "sessionId" in msg && msg.sessionId === activeSessionId) {
        setIsFixture(true);
      }
      if (msg.type === "stream-end" && "sessionId" in msg && msg.sessionId === activeSessionId) {
        setIsFixture(false);
      }
      if (
        msg.type === "log-line" ||
        msg.type === "stream-error" ||
        msg.type === "stream-end" ||
        msg.type === "verdict"
      ) {
        if ("sessionId" in msg && msg.sessionId === activeSessionId) {
          handleLogMessage(msg);
        }
      }
    },
    [handleJobsMessage, handleLogMessage, activeSessionId]
  );

  const { state: wsState, error: wsError, send } = useWebSocket(onMessage);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      // Unsubscribe from previous
      if (prevSessionRef.current && prevSessionRef.current !== sessionId) {
        send({ type: "unsubscribe", sessionId: prevSessionRef.current });
      }
      prevSessionRef.current = sessionId;
      setActiveSessionId(sessionId);
      setIsFixture(false);
      clearEntries();
      send({ type: "subscribe", sessionId });
    },
    [send, setActiveSessionId, clearEntries]
  );

  // Re-subscribe only on actual reconnect (wsState transitions to "open"),
  // but never re-subscribe to a session that has a terminal error.
  const prevWsState = useRef(wsState);
  useEffect(() => {
    const wasDisconnected = prevWsState.current !== "open";
    prevWsState.current = wsState;
    if (wsState === "open" && wasDisconnected && activeSessionId) {
      // Skip re-subscribe if this session has already hit a fatal error
      if (terminalError?.sessionId === activeSessionId) return;
      send({ type: "subscribe", sessionId: activeSessionId });
    }
  }, [wsState, activeSessionId, send, terminalError]);

  const activeJob = jobs.find((j) => j.sessionId === activeSessionId) || null;

  return (
    <ErrorBoundary>
      <ErrorBanner message={wsError} />
      <div className="layout">
        <Sidebar
          jobs={jobs}
          activeSessionId={activeSessionId}
          quote={quote}
          onSelectSession={handleSelectSession}
        />
        <ErrorBoundary>
          <LogViewer
            entries={entries}
            activeJob={activeJob}
            wsState={wsState}
            isFixture={isFixture}
            terminalError={terminalError}
            onSetSpeed={(speed) => {
              if (activeSessionId) {
                send({ type: "set-speed", sessionId: activeSessionId, speed });
              }
            }}
          />
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
}
