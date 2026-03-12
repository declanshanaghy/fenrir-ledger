"use client";

/**
 * StatusBadge — renders a color-coded badge for a CardStatus value
 * with a rich tooltip overlay (label, meaning, Norse flavor).
 *
 * Badge labels are Voice 1 (functional): plain English.
 * Tooltip content follows the Two-Voice Rule (copywriting.md):
 *   - Label (bold): status name
 *   - Meaning (normal): plain English explanation (Voice 1)
 *   - Flavor (italic): Norse atmospheric line (Voice 2)
 *
 * Desktop: tooltip on hover (200ms open delay, 100ms close delay).
 * Mobile: tap badge to toggle, tap outside to dismiss.
 * Keyboard: tooltip shows on focus, Escape to dismiss.
 * WCAG 2.1 AA: role="tooltip" on content, aria-describedby on trigger.
 *
 * Interaction spec: ux/wireframes/chrome/dashboard-tab-headers-interaction-spec.md § 3
 */

import { useCallback, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CardStatus } from "@/lib/types";
import { STATUS_LABELS, TOOLTIP_CONTENT } from "@/lib/constants";

interface StatusBadgeProps {
  status: CardStatus;
  className?: string;
  /**
   * Loki Mode override label.
   * When present, this realm name is shown instead of the normal status label.
   * The badge variant (color) is preserved so the visual still makes sense.
   */
  lokiLabel?: string | undefined;
  /**
   * When false, the tooltip is suppressed.
   * Used in tab headers/summaries where tooltips are not shown.
   * @default true
   */
  showTooltip?: boolean;
}

export function StatusBadge({
  status,
  className,
  lokiLabel,
  showTooltip = true,
}: StatusBadgeProps) {
  const label = lokiLabel ?? (STATUS_LABELS[status] ?? status);
  const tooltipId = useId();
  const content = TOOLTIP_CONTENT[status];

  // Controlled open state for mobile tap-to-toggle behavior.
  // On desktop, Radix handles hover/focus natively via delayDuration/skipDelayDuration.
  const [open, setOpen] = useState(false);

  const handleTap = useCallback(
    (e: React.PointerEvent) => {
      // Only intercept touch events for tap-to-toggle.
      // Mouse/pen events are handled by Radix hover behavior.
      if (e.pointerType !== "touch") return;
      e.preventDefault();
      setOpen((prev) => !prev);
    },
    []
  );

  // Without tooltip: plain badge (used in tab headers/summaries)
  if (!showTooltip) {
    return (
      <Badge
        variant={status}
        className={className}
        aria-label={`Card status: ${label}`}
      >
        {label}
      </Badge>
    );
  }

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={100}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <span
            onPointerDown={handleTap}
            aria-describedby={tooltipId}
            className="inline-flex"
          >
            <Badge
              variant={status}
              className={className}
              aria-label={`Card status: ${label}`}
            >
              {label}
            </Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent
          id={tooltipId}
          role="tooltip"
          side="bottom"
          align="center"
          avoidCollisions
          sideOffset={6}
          className="max-w-xs space-y-1 px-3 py-2"
        >
          <p className="font-semibold text-sm">{content.label}</p>
          <p className="text-sm text-popover-foreground">{content.meaning}</p>
          <p className="text-sm italic text-muted-foreground">
            {content.flavor}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
