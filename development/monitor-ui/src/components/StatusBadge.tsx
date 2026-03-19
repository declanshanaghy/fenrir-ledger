interface Props {
  state: "connecting" | "open" | "closed" | "error";
}

const STATE_COLORS: Record<Props["state"], string> = {
  open: "#22c55e",
  connecting: "#eab308",
  closed: "#6b7280",
  error: "#ef4444",
};

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
  return (
    <span
      className={`ws-badge-icon ${state}`}
      title={`WebSocket: ${state}`}
      aria-label={`WebSocket: ${state}`}
      role="status"
    >
      <WssIcon color={color} />
    </span>
  );
}
