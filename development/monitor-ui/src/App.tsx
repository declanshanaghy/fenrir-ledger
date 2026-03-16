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
import { AgentProfileModal } from "./components/AgentProfileModal";
import { useTheme } from "./hooks/useTheme";
import {
  isPinned as checkIsPinned,
  pinSession,
  unpinSession,
  isCacheNearCap,
} from "./lib/localStorageLogs";
import type { CachedSessionMeta } from "./lib/localStorageLogs";

export function App() {
  const quote = useMemo(() => randomQuote(), []);
  const { theme } = useTheme();
  const [profileAgent, setProfileAgent] = useState<string | null>(null);
  const { jobs, handleMessage: handleJobsMessage, refreshCached } = useJobs();
  const {
    entries,
    activeSessionId,
    setActiveSessionId,
    clearEntries,
    handleMessage: handleLogMessage,
    replayFromCache,
    isTtlExpired,
    isNodeUnreachable,
    streamError,
  } = useLogStream();

  const prevSessionRef = useRef<string | null>(null);

  const [isFixture, setIsFixture] = useState(false);
  const [pinnedSessionId, setPinnedSessionId] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  // Sync pin state when active session changes
  useEffect(() => {
    if (activeSessionId) {
      setPinnedSessionId(checkIsPinned(activeSessionId) ? activeSessionId : null);
    } else {
      setPinnedSessionId(null);
    }
  }, [activeSessionId]);

  const isPinned = pinnedSessionId === activeSessionId && activeSessionId !== null;

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

      // Determine if this session is cached-only (no live pod)
      const selectedJob = jobs.find((j) => j.sessionId === sessionId);
      if (selectedJob?.status === "cached") {
        // Replay from localStorage — do NOT subscribe to server
        // Use setTimeout to let clearEntries flush before replay
        setTimeout(() => replayFromCache(sessionId), 0);
      } else {
        send({ type: "subscribe", sessionId });
      }
    },
    [send, setActiveSessionId, clearEntries, replayFromCache, jobs]
  );

  // Re-subscribe only on actual reconnect (wsState transitions to "open").
  // Skip re-subscribe if the session ended with a TTL-expired or node-unreachable
  // error — the pod is gone and retrying would just loop the same error again.
  // Also skip for cached sessions (no server pod).
  const isTtlExpiredRef = useRef(isTtlExpired);
  isTtlExpiredRef.current = isTtlExpired;
  const isNodeUnreachableRef = useRef(isNodeUnreachable);
  isNodeUnreachableRef.current = isNodeUnreachable;
  const prevWsState = useRef(wsState);
  const lastSubscribedRef = useRef<string | null>(null);
  useEffect(() => {
    const wasDisconnected = prevWsState.current !== "open";
    prevWsState.current = wsState;
    if (wsState === "open" && wasDisconnected && activeSessionId && !isTtlExpiredRef.current && !isNodeUnreachableRef.current) {
      // Skip re-subscribe for cached-only sessions
      const activeJob = jobs.find((j) => j.sessionId === activeSessionId);
      if (activeJob?.status === "cached") return;

      // On reconnect to the SAME session, clear entries first to avoid
      // duplicate log replay stacking on top of existing entries.
      if (lastSubscribedRef.current === activeSessionId) {
        clearEntries();
      }
      lastSubscribedRef.current = activeSessionId;
      send({ type: "subscribe", sessionId: activeSessionId });
    }
  }, [wsState, activeSessionId, send, clearEntries, jobs]);

  const activeJob = jobs.find((j) => j.sessionId === activeSessionId) || null;

  /** Toggle pin for the active session. */
  const handleTogglePin = useCallback(() => {
    if (!activeSessionId || !activeJob) return;

    if (isPinned) {
      // Unpin: remove from cache
      unpinSession(activeSessionId);
      setPinnedSessionId(null);
      refreshCached();
    } else {
      // Pin: save current log buffer to cache
      const meta: CachedSessionMeta = {
        sessionId: activeSessionId,
        name: activeJob.name,
        issueNumber: Number(activeJob.issue) || 0,
        agent: activeJob.agentKey ?? "unknown",
        step: Number(activeJob.step) || 1,
        startedAt: activeJob.startTime ? new Date(activeJob.startTime).toISOString() : null,
        completedAt: activeJob.completionTime ? new Date(activeJob.completionTime).toISOString() : null,
        issueTitle: activeJob.issueTitle,
        branchName: activeJob.branchName,
        pinnedAt: Date.now(),
      };
      const ok = pinSession(activeSessionId, meta);
      if (ok) {
        setPinnedSessionId(activeSessionId);
        refreshCached();
        if (isCacheNearCap()) {
          setStorageWarning("Odin\u2019s memory is nearly full \u2014 oldest pins will be evicted.");
          setTimeout(() => setStorageWarning(null), 5000);
        }
      }
    }
  }, [activeSessionId, activeJob, isPinned, refreshCached]);

  return (
    <ErrorBoundary>
      <ErrorBanner message={wsError} />
      {storageWarning && <ErrorBanner message={storageWarning} />}
      <div className="layout">
        <Sidebar
          jobs={jobs}
          activeSessionId={activeSessionId}
          quote={quote}
          onSelectSession={handleSelectSession}
          onAvatarClick={setProfileAgent}
          onOdinClick={() => setProfileAgent("odin")}
        />
        <ErrorBoundary>
          <LogViewer
            entries={entries}
            activeJob={activeJob}
            wsState={wsState}
            isFixture={isFixture}
            isTtlExpired={isTtlExpired}
            isNodeUnreachable={isNodeUnreachable}
            streamError={streamError}
            isPinned={isPinned}
            onTogglePin={handleTogglePin}
            onAvatarClick={setProfileAgent}
            onSetSpeed={(speed) => {
              if (activeSessionId) {
                send({ type: "set-speed", sessionId: activeSessionId, speed });
              }
            }}
          />
        </ErrorBoundary>
      </div>
      {profileAgent && (
        <AgentProfileModal
          agentKey={profileAgent}
          theme={theme}
          onClose={() => setProfileAgent(null)}
        />
      )}
    </ErrorBoundary>
  );
}
