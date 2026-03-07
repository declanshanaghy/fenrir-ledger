import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2.5 py-0.5 text-sm font-mono font-semibold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary hover:brightness-110",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-realm-muspel/20 text-realm-muspel border-realm-muspel/30",
        outline:
          "border-border text-foreground",

        // ── Fenrir Ledger — Norse realm status variants ──────────────────
        // Colors follow design/theme-system.md status palette.
        // Labels (Active / Fee Approaching / etc.) are Wave 2 — see design/implementation-brief.md Story 3.
        active:
          "border-transparent bg-realm-asgard/20 text-realm-asgard border-realm-asgard/25",
        fee_approaching:
          "border-transparent bg-realm-muspel/20 text-realm-muspel border-realm-muspel/30 animate-muspel-pulse",
        promo_expiring:
          "border-transparent bg-realm-hati/20 text-realm-hati border-realm-hati/25",
        closed:
          "border-transparent bg-realm-hel/10 text-realm-hel border-realm-hel/20",
        bonus_open:
          "border-transparent bg-realm-alfheim/20 text-realm-alfheim border-realm-alfheim/25",
        overdue:
          "border-transparent bg-realm-niflheim/20 text-realm-niflheim border-realm-niflheim/30 animate-muspel-pulse",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
