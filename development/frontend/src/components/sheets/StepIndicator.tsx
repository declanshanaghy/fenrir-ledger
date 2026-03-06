"use client";

/**
 * StepIndicator -- horizontal progress dots for the import wizard.
 *
 * 4 steps: Method -> Import -> Preview -> Confirm
 * Active dot is gold, completed dots are gold/50, future dots are muted.
 */

interface StepIndicatorProps {
  /** 0-based active step index (0 = Method, 1 = Import, 2 = Preview, 3 = Confirm). */
  activeStep: number;
}

const STEPS = ["Method", "Import", "Preview", "Confirm"] as const;

export function StepIndicator({ activeStep }: StepIndicatorProps) {
  return (
    <nav aria-label="Import progress" className="flex items-center justify-center gap-2 py-2">
      {STEPS.map((label, index) => {
        const isActive = index === activeStep;
        const isCompleted = index < activeStep;

        return (
          <div key={label} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div
                className={[
                  "h-2 w-2 rounded-full transition-colors",
                  isActive
                    ? "bg-gold"
                    : isCompleted
                      ? "bg-gold/50"
                      : "bg-muted",
                ].join(" ")}
                aria-current={isActive ? "step" : undefined}
              />
              <span
                className={[
                  "text-xs font-heading tracking-wide leading-none",
                  isActive
                    ? "text-gold"
                    : isCompleted
                      ? "text-gold/50"
                      : "text-muted-foreground",
                ].join(" ")}
              >
                {label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={[
                  "h-px w-6 mb-3",
                  isCompleted ? "bg-gold/30" : "bg-border",
                ].join(" ")}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
