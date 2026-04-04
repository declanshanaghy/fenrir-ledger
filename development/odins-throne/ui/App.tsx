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
import { RagnarokDialog } from "./components/RagnarokDialog";
import { Toast } from "./components/Toast";
import { CardPanel } from "./components/CardPanel";
import { useTheme } from "./hooks/useTheme";
import {
  isPinned as checkIsPinned,
  pinSession,
  unpinSession,
  isCacheNearCap,
  appendLogLine,
  migrateRemoveDuplicateLogs,
  evictExpiredLogs,
} from "./lib/localStorageLogs";
import type { CachedSessionMeta } from "./lib/localStorageLogs";

export function App() {
  const quote = useMemo(() => randomQuote(), []);
  const { theme } = useTheme();
  const [profileAgent, setProfileAgent] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ sessionId: string; jobTitle: string } | null>(null);
  const { jobs, handleMessage: handleJobsMessage, refreshCached } = useJobs();
  const {
    entries,
    activeSessionId,
    setActiveSessionId,
    clearEntries,
    handleMessage: handleLogMessage,
    replayFromCache,
    replayFromTempLog,
    setLiveSkipCount,
    isTtlExpired,
    isNodeUnreachable,
    streamError,
    replayedFromCache,
    isConnecting,
    isPodStarting,
    showPodStartTimeout,
  } = useLogStream();

  // Tracks the sessionId we currently have an active WS subscription for.
  // Distinct from activeSessionId (display state) — this is the wire-protocol state.
  const subscribedSessionRef = useRef<string | null>(null);
  // Sessions we kept subscribed in the background for caching after navigation
  const backgroundSubsRef = useRef<Set<string>>(new Set());

  // Migrate existing duplicate log: entries for pinned sessions on mount
  // and evict non-pinned temp logs older than the 1-hour TTL
  useEffect(() => {
    migrateRemoveDuplicateLogs();
    evictExpiredLogs();
  }, []);

  const [isFixture, setIsFixture] = useState(false);
  const [pinnedSessionId, setPinnedSessionId] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);
  const [terminatingSessionIds, setTerminatingSessionIds] = useState<Set<string>>(new Set());

  // Sync pin state when active session changes
  useEffect(() => {
    if (activeSessionId) {
      setPinnedSessionId(checkIsPinned(activeSessionId) ? activeSessionId : null);
    } else {
      setPinnedSessionId(null);
    }
  }, [activeSessionId]);

  const isPinned = pinnedSessionId === activeSessionId && activeSessionId !== null;

  // Set of all pinned sessionIds (for sidebar display across all jobs)
  const pinnedSessionIds = useMemo(
    () => new Set(jobs.filter((j) => checkIsPinned(j.sessionId)).map((j) => j.sessionId)),
    [jobs]
  );

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
        } else if ("sessionId" in msg && backgroundSubsRef.current.has(msg.sessionId)) {
          // Background pinned session: persist log lines to cache, clean up on end
          if (msg.type === "log-line") {
            appendLogLine(msg.sessionId, msg.line);
          } else if (msg.type === "stream-end") {
            backgroundSubsRef.current.delete(msg.sessionId);
          }
        }
      }
    },
    [handleJobsMessage, handleLogMessage, activeSessionId]
  );

  const { state: wsState, error: wsError, send } = useWebSocket(onMessage);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      const currentSub = subscribedSessionRef.current;

      // Unsubscribe / move to background for the current active subscription
      if (currentSub !== null && currentSub !== sessionId) {
        if (checkIsPinned(currentSub)) {
          // Keep subscription alive so background caching continues
          backgroundSubsRef.current.add(currentSub);
        } else {
          send({ type: "unsubscribe", sessionId: currentSub });
          backgroundSubsRef.current.delete(currentSub);
        }
      }

      setActiveSessionId(sessionId);
      setIsFixture(false);
      clearEntries();

      // Determine if this session is cached-only (pinned, no live pod)
      const selectedJob = jobs.find((j) => j.sessionId === sessionId);
      if (selectedJob?.status === "cached") {
        // Replay from pinned localStorage cache — do NOT subscribe to server
        subscribedSessionRef.current = null;
        // Use setTimeout to let clearEntries flush before replay
        setTimeout(() => replayFromCache(sessionId), 0);
      } else if (currentSub === sessionId) {
        // Revisiting the session we're already subscribed to (e.g. user clicks
        // the same session again). Replay temp log for instant display — the live
        // stream is still active and will continue from where it left off.
        const cachedLineCount = replayFromTempLog(sessionId);
        if (cachedLineCount > 0) {
          setLiveSkipCount(cachedLineCount);
        }
        // subscribedSessionRef stays the same — still subscribed
      } else {
        // New session: load from temp log for instant display, then subscribe
        const cachedLineCount = replayFromTempLog(sessionId);
        subscribedSessionRef.current = sessionId;
        if (cachedLineCount > 0) {
          // Tell handleMessage to skip the first N live lines (server re-streams
          // from beginning, these are duplicates of what we just showed from cache)
          setLiveSkipCount(cachedLineCount);
        }
        send({ type: "subscribe", sessionId });
      }
    },
    [send, setActiveSessionId, clearEntries, replayFromCache, replayFromTempLog, setLiveSkipCount, jobs]
  );

  // Send unsubscribe when App unmounts (e.g. browser navigation away from the SPA).
  // Also covers backgroundSubsRef sessions so the server cleans up cleanly.
  useEffect(() => {
    return () => {
      if (subscribedSessionRef.current) {
        send({ type: "unsubscribe", sessionId: subscribedSessionRef.current });
      }
      for (const sessionId of backgroundSubsRef.current) {
        send({ type: "unsubscribe", sessionId });
      }
    };
  }, [send]);

  // Re-subscribe only on actual reconnect (wsState transitions to "open").
  // Skip re-subscribe if the session ended with a TTL-expired or node-unreachable
  // error — the pod is gone and retrying would just loop the same error again.
  // Also skip for cached sessions (no server pod).
  const isTtlExpiredRef = useRef(isTtlExpired);
  isTtlExpiredRef.current = isTtlExpired;
  const isNodeUnreachableRef = useRef(isNodeUnreachable);
  isNodeUnreachableRef.current = isNodeUnreachable;
  const prevWsState = useRef(wsState);
  useEffect(() => {
    const wasDisconnected = prevWsState.current !== "open";
    prevWsState.current = wsState;
    if (wsState === "open" && wasDisconnected && activeSessionId && !isTtlExpiredRef.current && !isNodeUnreachableRef.current) {
      // Skip re-subscribe for cached-only sessions
      const activeJob = jobs.find((j) => j.sessionId === activeSessionId);
      if (activeJob?.status === "cached") return;

      // On reconnect: clear stale entries, replay temp log for instant display,
      // then re-subscribe. Set skip count so duplicates from re-stream are ignored.
      clearEntries();
      const cachedLineCount = replayFromTempLog(activeSessionId);
      if (cachedLineCount > 0) {
        setLiveSkipCount(cachedLineCount);
      }
      subscribedSessionRef.current = activeSessionId;
      send({ type: "subscribe", sessionId: activeSessionId });
    }
  }, [wsState, activeSessionId, send, clearEntries, replayFromTempLog, setLiveSkipCount, jobs]);

  // Auto-retry subscribe when pod is starting up (HTTP 400 returned by kubectl logs).
  // Retries every 4 seconds. Clears when logs start flowing or after 2-minute timeout.
  const podStartBeginRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isPodStarting || !activeSessionId) {
      podStartBeginRef.current = null;
      return;
    }
    if (podStartBeginRef.current === null) {
      podStartBeginRef.current = Date.now();
    }
    const intervalId = setInterval(() => {
      const elapsed = Date.now() - (podStartBeginRef.current ?? Date.now());
      if (elapsed >= 120_000) {
        clearInterval(intervalId);
        showPodStartTimeout();
        return;
      }
      send({ type: "subscribe", sessionId: activeSessionId });
    }, 4000);
    return () => clearInterval(intervalId);
  }, [isPodStarting, activeSessionId, send, showPodStartTimeout]);

  const activeJob = jobs.find((j) => j.sessionId === activeSessionId) || null;

  /** Toggle pin for any session by sessionId. Used by both header and sidebar. */
  const handleTogglePinForSession = useCallback(
    (sessionId: string) => {
      const job = jobs.find((j) => j.sessionId === sessionId);
      if (!job) return;

      if (checkIsPinned(sessionId)) {
        // Unpin: remove from cache
        unpinSession(sessionId);
        if (sessionId === activeSessionId) setPinnedSessionId(null);
        // If we had a background subscription for this session, clean it up
        if (backgroundSubsRef.current.has(sessionId)) {
          send({ type: "unsubscribe", sessionId });
          backgroundSubsRef.current.delete(sessionId);
        }
        refreshCached();
      } else {
        // Pin: save log buffer to cache
        const meta: CachedSessionMeta = {
          sessionId,
          name: job.name,
          issueNumber: Number(job.issue) || 0,
          agent: job.agentKey ?? "unknown",
          step: Number(job.step) || 1,
          startedAt: job.startTime ? new Date(job.startTime).toISOString() : null,
          completedAt: job.completionTime ? new Date(job.completionTime).toISOString() : null,
          issueTitle: job.issueTitle,
          branchName: job.branchName,
          pinnedAt: Date.now(),
        };
        const ok = pinSession(sessionId, meta);
        if (ok) {
          if (sessionId === activeSessionId) setPinnedSessionId(sessionId);
          refreshCached();
          if (isCacheNearCap()) {
            setStorageWarning("Odin\u2019s memory is nearly full \u2014 oldest pins will be evicted.");
            setTimeout(() => setStorageWarning(null), 5000);
          }
        }
      }
    },
    [jobs, activeSessionId, refreshCached, send]
  );

  /** Toggle pin for the currently active session (header shortcut). */
  const handleTogglePin = useCallback(() => {
    if (!activeSessionId) return;
    handleTogglePinForSession(activeSessionId);
  }, [activeSessionId, handleTogglePinForSession]);

  /** Open Ragnarök confirmation dialog for a running job. */
  const handleOpenCancelDialog = useCallback(
    (sessionId: string) => {
      const job = jobs.find((j) => j.sessionId === sessionId);
      if (!job || job.status !== "running") return;
      const jobTitle = job.issueTitle
        ? `#${job.issue} \u2013 ${job.issueTitle}`
        : `#${job.issue} \u2013 ${job.agentName} Step ${job.step}`;
      setCancelTarget({ sessionId, jobTitle });
    },
    [jobs]
  );

  /** Confirmed: call DELETE /api/jobs/:sessionId to kill the K8s job. */
  const handleConfirmCancel = useCallback(async () => {
    if (!cancelTarget) return;
    const res = await fetch(`/api/jobs/${encodeURIComponent(cancelTarget.sessionId)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    const { sessionId } = cancelTarget;
    setCancelTarget(null);
    // Flash the card as terminating, then clear after 3s
    setTerminatingSessionIds((prev) => new Set(prev).add(sessionId));
    setTimeout(() => {
      setTerminatingSessionIds((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }, 3000);
    // Show toast confirmation
    setToast({ message: `Ragnarok unleashed — ${sessionId} terminated`, id: Date.now() });
  }, [cancelTarget]);

  return (
    <ErrorBoundary>
      <ErrorBanner message={wsError} />
      {storageWarning && <ErrorBanner message={storageWarning} />}
      <div className="layout">
        <Sidebar
          jobs={jobs}
          activeSessionId={activeSessionId}
          quote={quote}
          wsState={wsState}
          onSelectSession={handleSelectSession}
          onAvatarClick={setProfileAgent}
          onOdinClick={() => setProfileAgent("odin")}
          onTogglePinSession={handleTogglePinForSession}
          pinnedSessionIds={pinnedSessionIds}
          onCancelJob={handleOpenCancelDialog}
          terminatingSessionIds={terminatingSessionIds}
        />
        <ErrorBoundary>
          <LogViewer
            entries={entries}
            activeJob={activeJob}
            isFixture={isFixture}
            isTtlExpired={isTtlExpired}
            isNodeUnreachable={isNodeUnreachable}
            streamError={streamError}
            isPinned={isPinned}
            onTogglePin={handleTogglePin}
            onAvatarClick={setProfileAgent}
            replayedFromCache={replayedFromCache}
            isConnecting={isConnecting}
            isPodStarting={isPodStarting}
            onCancelJob={handleOpenCancelDialog}
            onSetSpeed={(speed) => {
              if (activeSessionId) {
                send({ type: "set-speed", sessionId: activeSessionId, speed });
              }
            }}
          />
        </ErrorBoundary>
        <ErrorBoundary>
          <CardPanel />
        </ErrorBoundary>
      </div>
      {profileAgent && (
        <AgentProfileModal
          agentKey={profileAgent}
          theme={theme}
          onClose={() => setProfileAgent(null)}
        />
      )}
      {cancelTarget && (
        <RagnarokDialog
          sessionId={cancelTarget.sessionId}
          jobTitle={cancelTarget.jobTitle}
          onConfirm={handleConfirmCancel}
          onCancel={() => setCancelTarget(null)}
        />
      )}
      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          onDismiss={() => setToast(null)}
        />
      )}
    </ErrorBoundary>
  );
}
