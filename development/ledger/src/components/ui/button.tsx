import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-base font-medium",
    "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    // Transition foundation for hover/active/loading feedback (Issue #150)
    "transition-[transform,filter,border-color,background-color,box-shadow,opacity,color] duration-150 ease-out",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-primary/60 hover:brightness-115 hover:shadow-[0_0_12px_hsl(var(--primary)/0.3)] active:scale-[0.97] active:brightness-90 disabled:opacity-50",
        destructive:
          "bg-destructive text-destructive-foreground border border-destructive/40 hover:brightness-115 hover:bg-destructive/90 hover:shadow-[0_0_8px_hsl(var(--destructive)/0.25)] active:scale-[0.97] active:brightness-90 disabled:opacity-50",
        outline:
          "[border-width:1.5px] border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-muted-foreground/50 active:scale-[0.97] active:brightness-90 disabled:opacity-50",
        secondary:
          "bg-secondary text-secondary-foreground [border-width:1.5px] border-secondary hover:bg-secondary/80 hover:brightness-110 active:scale-[0.97] active:brightness-90 disabled:opacity-50",
        ghost:
          "hover:bg-accent hover:text-accent-foreground active:scale-[0.97] active:brightness-90 disabled:opacity-50",
        link: "text-primary underline-offset-4 hover:underline disabled:opacity-50",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

/**
 * ButtonSpinner -- inline CSS spinner for loading state.
 * 14px circular border with one transparent side, 0.8s rotate.
 * aria-hidden: the loading text is the accessible indicator.
 */
function ButtonSpinner() {
  return <span className="btn-spinner" aria-hidden="true" />;
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** When true, renders a spinner + loadingText and disables the button. */
  isLoading?: boolean;
  /** Text to display while loading (e.g. "Redirecting...", "Saving..."). Defaults to "Loading...". */
  loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading = false,
      loadingText = "Loading...",
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || isLoading;

    // Loading state: spinner + contextual text, aria-busy for screen readers
    if (isLoading && !asChild) {
      return (
        <Comp
          className={cn(
            buttonVariants({ variant, size, className }),
            "opacity-70 cursor-not-allowed"
          )}
          ref={ref}
          disabled
          aria-busy="true"
          aria-disabled="true"
          {...props}
        >
          <ButtonSpinner />
          {loadingText}
        </Comp>
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
