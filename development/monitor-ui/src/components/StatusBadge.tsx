import { useCallback, useEffect, useId, useRef, useState } from "react";

interface Props {
  state: "connecting" | "open" | "closed" | "error";
}

const STATE_COLORS: Record<Props["state"], string> = {
  open: "#22c55e",
  connecting: "#eab308",
  closed: "#6b7280",
  error: "#ef4444",
};

const WOLF_VOICE: Record<Props["state"], string> = {
  open: "The thread holds. Fenrir watches.",
  connecting: "The Norns weave. Hold fast.",
  closed: "The chain is broken. Fenrir stirs.",
  error: "The chain is broken. Fenrir stirs.",
};

const ARIA_LABEL: Record<Props["state"], string> = {
  open: "WebSocket connected — the thread holds",
  connecting: "WebSocket reconnecting — the Norns weave",
  closed: "WebSocket closed — the chain is broken",
  error: "WebSocket error — the chain is broken",
};

/** role per state: status for ok/in-progress, alert for broken */
function roleForState(state: Props["state"]): "status" | "alert" {
  return state === "closed" || state === "error" ? "alert" : "status";
}

/** Plug/connection SVG icon — filled circle with signal arcs, coloured by WS state */
function WssIcon({ color }: { color: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* plug body */}
      <rect x="6" y="8" width="4" height="5" rx="1" fill={color} />
      {/* left pin */}
      <rect x="5" y="6" width="1.5" height="3" rx="0.5" fill={color} />
      {/* right pin */}
      <rect x="9.5" y="6" width="1.5" height="3" rx="0.5" fill={color} />
      {/* plug head */}
      <rect x="4.5" y="3" width="7" height="4" rx="1.5" fill={color} />
      {/* signal arc — outer */}
      <path
        d="M2.5 2.5 C2.5 2.5 1 4.5 1 8 C1 11.5 2.5 13.5 2.5 13.5"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {/* signal arc — inner */}
      <path
        d="M13.5 2.5 C13.5 2.5 15 4.5 15 8 C15 11.5 13.5 13.5 13.5 13.5"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
    </svg>
  );
}

export function StatusBadge({ state }: Props) {
  const color = STATE_COLORS[state];
  const tooltipId = useId();
  const [visible, setVisible] = useState(false);

  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (showTimerRef.current !== null) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    clearTimers();
    setVisible(false);
  }, [clearTimers]);

  // Dismiss tooltip when state changes (e.g. ws reconnects mid-hover)
  useEffect(() => {
    hide();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const handleMouseEnter = useCallback(() => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    showTimerRef.current = setTimeout(() => {
      showTimerRef.current = null;
      show();
    }, 300);
  }, [show]);

  const handleMouseLeave = useCallback(() => {
    if (showTimerRef.current !== null) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      hide();
    }, 100);
  }, [hide]);

  const handleFocus = useCallback(() => {
    clearTimers();
    show();
  }, [clearTimers, show]);

  const handleBlur = useCallback(() => {
    hide();
  }, [hide]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && visible) {
        e.preventDefault();
        hide();
      }
    },
    [visible, hide]
  );

  // Mobile: tap to show for 3s, tap again to dismiss
  const handleClick = useCallback(() => {
    if (visible) {
      if (mobileDismissRef.current !== null) {
        clearTimeout(mobileDismissRef.current);
        mobileDismissRef.current = null;
      }
      setVisible(false);
    } else {
      setVisible(true);
      mobileDismissRef.current = setTimeout(() => {
        mobileDismissRef.current = null;
        setVisible(false);
      }, 3000);
    }
  }, [visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      if (mobileDismissRef.current !== null) {
        clearTimeout(mobileDismissRef.current);
      }
    };
  }, [clearTimers]);

  const role = roleForState(state);
  const ariaLive = role === "alert" ? "assertive" : "polite";

  return (
    <span className="wss-tooltip-wrapper">
      <span
        className={`ws-badge ws-badge-icon ${state}`}
        aria-label={ARIA_LABEL[state]}
        aria-describedby={tooltipId}
        aria-live={ariaLive}
        role={role}
        tabIndex={0}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
      >
        <WssIcon color={color} />
      </span>
      <span
        id={tooltipId}
        role="tooltip"
        className={`wss-tooltip${visible ? " wss-tooltip--visible" : ""}`}
      >
        {WOLF_VOICE[state]}
      </span>
    </span>
  );
}
