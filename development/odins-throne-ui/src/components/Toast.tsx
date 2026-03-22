import { useEffect, useState } from "react";

interface Props {
  message: string;
  onDismiss: () => void;
  /** Auto-dismiss delay in ms. Default: 4000 */
  duration?: number;
}

/**
 * Toast — lightweight auto-dismissing notification.
 * No external library. Simple React state + CSS animation.
 * Themed via CSS tokens (--gold, --void, --error-strong, etc.).
 */
export function Toast({ message, onDismiss, duration = 4000 }: Props) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), duration - 400);
    const dismissTimer = setTimeout(onDismiss, duration);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(dismissTimer);
    };
  }, [duration, onDismiss]);

  return (
    <div
      className={`toast${exiting ? " toast--exit" : ""}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="toast-rune" aria-hidden="true">⚔️</span>
      <span className="toast-message">{message}</span>
      <button
        className="toast-close"
        onClick={() => { setExiting(true); setTimeout(onDismiss, 400); }}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}
