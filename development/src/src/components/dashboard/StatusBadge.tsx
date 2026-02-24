/**
 * StatusBadge — renders a color-coded badge for a CardStatus value.
 * Colors follow the Fenrir Ledger Mermaid style guide palette.
 */

import { Badge } from "@/components/ui/badge";
import type { CardStatus } from "@/lib/types";
import { STATUS_LABELS, STATUS_TOOLTIPS } from "@/lib/constants";

interface StatusBadgeProps {
  status: CardStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = STATUS_LABELS[status] ?? status;
  const tooltip = STATUS_TOOLTIPS[status];

  return (
    <span title={tooltip}>
      <Badge
        variant={status}
        className={className}
        aria-label={`Card status: ${label}`}
      >
        {label}
      </Badge>
    </span>
  );
}
