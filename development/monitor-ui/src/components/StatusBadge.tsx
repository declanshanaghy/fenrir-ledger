interface Props {
  state: "connecting" | "open" | "closed" | "error";
}

export function StatusBadge({ state }: Props) {
  return <span className={`ws-badge ${state}`}>{state}</span>;
}
