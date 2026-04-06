import { useEffect, useRef, useCallback, useState } from "react";
import type { ServerMessage, ClientMessage } from "../lib/types";

type WsState = "connecting" | "open" | "closed" | "error";

const MAX_RECONNECT = 10;
const BASE_DELAY_MS = 1000;

export function useWebSocket(onMessage: (msg: ServerMessage) => void, namespace = "fenrir-agents") {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  // Track the namespace the current WS connection was opened with
  const connectedNamespaceRef = useRef<string | null>(null);

  const [state, setState] = useState<WsState>("connecting");
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback((ns: string) => {
    // If already connected to the right namespace, skip
    if (
      connectedNamespaceRef.current === ns &&
      (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING)
    ) return;

    // Close existing connection when switching namespaces
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent scheduleReconnect
      wsRef.current.close();
      wsRef.current = null;
      connectedNamespaceRef.current = null;
    }

    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/ws?namespace=${encodeURIComponent(ns)}`);
    wsRef.current = ws;
    connectedNamespaceRef.current = ns;
    setState("connecting");

    ws.addEventListener("open", () => {
      setError(null);
      reconnectCount.current = 0;
      setState("open");
    });

    ws.addEventListener("message", (ev) => {
      try {
        const msg = JSON.parse(ev.data) as ServerMessage;
        onMessageRef.current(msg);
      } catch { /* ignore */ }
    });

    ws.addEventListener("close", () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
        connectedNamespaceRef.current = null;
      }
      setState("closed");
      scheduleReconnect();
    });

    ws.addEventListener("error", () => {
      setState("error");
      setError("WebSocket connection lost — reconnecting…");
    });
  }, []);

  // Keep a stable ref to the current namespace so scheduleReconnect can use it
  const namespaceRef = useRef(namespace);
  namespaceRef.current = namespace;

  const scheduleReconnect = useCallback(() => {
    if (reconnectCount.current >= MAX_RECONNECT) {
      setError(`WebSocket failed after ${MAX_RECONNECT} attempts. Reload to retry.`);
      return;
    }
    const delay = Math.min(BASE_DELAY_MS * 2 ** reconnectCount.current, 30000);
    reconnectCount.current++;
    reconnectTimer.current = setTimeout(() => {
      reconnectTimer.current = null;
      connect(namespaceRef.current);
    }, delay);
  }, [connect]);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Connect on mount and reconnect when namespace changes
  useEffect(() => {
    reconnectCount.current = 0;
    connect(namespace);
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
        connectedNamespaceRef.current = null;
      }
    };
  }, [connect, namespace]);

  return { state, error, send };
}
