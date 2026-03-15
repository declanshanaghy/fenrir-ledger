import { useEffect, useRef, useCallback, useState } from "react";
import type { ServerMessage, ClientMessage } from "../lib/types";

type WsState = "connecting" | "open" | "closed" | "error";

const MAX_RECONNECT = 10;
const BASE_DELAY_MS = 1000;

export function useWebSocket(onMessage: (msg: ServerMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const [state, setState] = useState<WsState>("connecting");
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) return;

    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/ws`);
    wsRef.current = ws;
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
      wsRef.current = null;
      setState("closed");
      scheduleReconnect();
    });

    ws.addEventListener("error", () => {
      setState("error");
      setError("WebSocket connection lost \u2014 reconnecting\u2026");
    });
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectCount.current >= MAX_RECONNECT) {
      setError(`WebSocket failed after ${MAX_RECONNECT} attempts. Reload to retry.`);
      return;
    }
    const delay = Math.min(BASE_DELAY_MS * 2 ** reconnectCount.current, 30000);
    reconnectCount.current++;
    reconnectTimer.current = setTimeout(() => {
      reconnectTimer.current = null;
      connect();
    }, delay);
  }, [connect]);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { state, error, send };
}
