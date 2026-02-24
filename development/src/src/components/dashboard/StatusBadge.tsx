/**
 * StatusBadge — renders a color-coded badge for a CardStatus value.
 * Colors follow the Fenrir Ledger Mermaid style guide palette.
 */

import { Badge } from "@/components/ui/badge";
import type { CardStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/constants";

interface StatusBadgeProps {
  status: CardStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = STATUS_LABELS[status] ?? status;

  return (
    <Badge variant={status} className={className}>
      {label}
    </Badge>
  );
}
