import { useCallback, useEffect, useMemo, useRef } from "react";

import type { ServerMessage } from "./lib/types";
import { randomQuote } from "./lib/constants";
import { useWebSocket } from "./hooks/useWebSocket";
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
  } = useLogStream();

  const prevSessionRef = useRef<string | null>(null);

  const onMessage = useCallback(
    (msg: ServerMessage) => {
      handleJobsMessage(msg);
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
      clearEntries();
      send({ type: "subscribe", sessionId });
    },
    [send, setActiveSessionId, clearEntries]
  );

  // Re-subscribe only on actual reconnect (wsState transitions to "open")
  const prevWsState = useRef(wsState);
  useEffect(() => {
    const wasDisconnected = prevWsState.current !== "open";
    prevWsState.current = wsState;
    if (wsState === "open" && wasDisconnected && activeSessionId) {
      send({ type: "subscribe", sessionId: activeSessionId });
    }
  }, [wsState, activeSessionId, send]);

  const activeJob = jobs.find((j) => j.sessionId === activeSessionId) || null;

  return (
    <>
      <ErrorBanner message={wsError} />
      <div className="layout">
        <Sidebar
          jobs={jobs}
          activeSessionId={activeSessionId}
          quote={quote}
          onSelectSession={handleSelectSession}
        />
        <LogViewer entries={entries} activeJob={activeJob} wsState={wsState} />
      </div>
    </>
  );
}
