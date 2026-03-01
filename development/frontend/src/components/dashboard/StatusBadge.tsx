/**
 * StatusBadge — renders a color-coded badge for a CardStatus value.
 * Colors follow the Fenrir Ledger Mermaid style guide palette.
 *
 * Badge labels are Voice 1 (functional): plain English.
 * Tooltips are Voice 2 (atmospheric): Norse realm flavor from realm-utils.ts.
 */

import { Badge } from "@/components/ui/badge";
import type { CardStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/constants";
import { getRealmDescription } from "@/lib/realm-utils";

interface StatusBadgeProps {
  status: CardStatus;
  className?: string;
  /**
   * Loki Mode override label.
   * When present, this realm name is shown instead of the normal status label.
   * The badge variant (color) is preserved so the visual still makes sense.
   */
  lokiLabel?: string | undefined;
}

export function StatusBadge({ status, className, lokiLabel }: StatusBadgeProps) {
  const label = lokiLabel ?? (STATUS_LABELS[status] ?? status);
  // Tooltip is Voice 2 (atmospheric) — Norse realm description from realm-utils.ts
  const tooltip = getRealmDescription(status);

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
