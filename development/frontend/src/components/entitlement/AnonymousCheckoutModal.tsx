"use client";

/**
 * AnonymousCheckoutModal -- Fenrir Ledger
 *
 * Modal dialog for collecting an email address from anonymous users
 * before redirecting them to Stripe Checkout.
 *
 * Only shown to anonymous (not-signed-in) users. Authenticated users
 * bypass this entirely (their Google email is used automatically).
 *
 * Wireframe reference: ux/wireframes/stripe-direct/anonymous-checkout.html
 *
 * Flow:
 *   1. Anonymous user clicks any Stripe subscribe CTA
 *   2. This modal opens with an email input
 *   3. User enters email + submits
 *   4. POST /api/stripe/checkout with { email }
 *   5. Redirect to Stripe Checkout URL
 *
 * @module entitlement/AnonymousCheckoutModal
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEntitlement } from "@/hooks/useEntitlement";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AnonymousCheckoutModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when the modal is dismissed */
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Email validation
// ---------------------------------------------------------------------------

/** Basic email format validation regex */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates an email address format.
 *
 * @param email - The email string to validate
 * @returns Error message or null if valid
 */
function validateEmail(email: string): string | null {
  if (!email.trim()) {
    return "Please enter your email address.";
  }
  if (!EMAIL_REGEX.test(email.trim())) {
    return "Please enter a valid email address.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Email collection modal for anonymous Stripe Checkout.
 *
 * Shared by all subscribe CTAs -- StripeSettings, SealedRuneModal, UpsellBanner.
 * After email submission, redirects to Stripe Checkout.
 *
 * @param props - Open state and dismiss callback
 */
export function AnonymousCheckoutModal({
  open,
  onDismiss,
}: AnonymousCheckoutModalProps) {
  const { subscribeStripe } = useEntitlement();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the email input when the modal opens
  useEffect(() => {
    if (open) {
      // Small delay to allow dialog animation
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setEmail("");
      setError(null);
      setIsSubmitting(false);
      setApiError(null);
    }
  }, [open]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Validate email
      const validationError = validateEmail(email);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      setApiError(null);
      setIsSubmitting(true);

      try {
        await subscribeStripe(email.trim());
        // If subscribeStripe succeeds, user is redirected (no further code runs)
      } catch {
        setApiError("Something went wrong. Please try again.");
        setIsSubmitting(false);
      }
    },
    [email, subscribeStripe],
  );

  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEmail(e.target.value);
      // Clear errors when user starts typing
      if (error) setError(null);
      if (apiError) setApiError(null);
    },
    [error, apiError],
  );

  const handleBlur = useCallback(() => {
    if (email.trim()) {
      const validationError = validateEmail(email);
      if (validationError) {
        setError(validationError);
      }
    }
  }, [email]);

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !isSubmitting) {
          onDismiss();
        }
      }}
    >
      <DialogContent
        className="w-[92vw] max-w-[400px] max-h-[90vh] overflow-y-auto border-2 border-gold/40 bg-background p-0 gap-0"
        aria-labelledby="anonymous-checkout-heading"
        aria-describedby="anonymous-checkout-desc"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <DialogTitle
            id="anonymous-checkout-heading"
            className="font-heading text-[15px] font-bold text-saga"
          >
            Enter your email
          </DialogTitle>
        </div>

        {/* Body */}
        <div className="px-5 py-5 flex flex-col gap-4">
          {/* Atmospheric line -- hidden on mobile */}
          <p
            className="hidden sm:block text-[11px] italic text-rune/60 font-body leading-relaxed"
            aria-hidden="true"
          >
            Name yourself, and the bond is forged.
          </p>

          {/* Functional description */}
          <p
            id="anonymous-checkout-desc"
            className="text-[13px] text-saga/90 leading-relaxed font-body"
          >
            {isSubmitting
              ? "Creating your checkout session..."
              : "We need your email to create your subscription. You will be redirected to Stripe to complete payment."}
          </p>

          {/* Email form */}
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="checkout-email"
                className="text-xs font-heading font-bold text-saga"
              >
                Email address
              </label>
              <input
                ref={inputRef}
                id="checkout-email"
                type="email"
                name="email"
                value={email}
                onChange={handleEmailChange}
                onBlur={handleBlur}
                placeholder="you@example.com"
                autoComplete="email"
                required
                disabled={isSubmitting}
                aria-invalid={!!error || !!apiError}
                aria-describedby={
                  error
                    ? "checkout-email-error"
                    : apiError
                      ? "checkout-api-error"
                      : "checkout-email-hint"
                }
                className={[
                  "w-full px-3 py-2.5 text-[16px] sm:text-sm font-body",
                  "border bg-background text-saga placeholder:text-rune/40",
                  "focus:outline-none focus:ring-1 focus:ring-gold/50 focus:border-gold/50",
                  "min-h-[44px]",
                  isSubmitting ? "opacity-60 cursor-not-allowed" : "",
                  error || apiError ? "border-destructive border-2" : "border-border",
                ].join(" ")}
              />

              {/* Hint text */}
              {!error && !apiError && (
                <p
                  id="checkout-email-hint"
                  className="text-[11px] text-rune/60 font-body"
                >
                  This email will be used for your Stripe account and receipts.
                </p>
              )}

              {/* Validation error */}
              {error && (
                <p
                  id="checkout-email-error"
                  className="text-[11px] font-bold text-destructive font-body"
                  role="alert"
                >
                  {error}
                </p>
              )}

              {/* API error */}
              {apiError && (
                <p
                  id="checkout-api-error"
                  className="text-[11px] font-bold text-destructive font-body"
                  role="alert"
                >
                  {apiError}
                </p>
              )}
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[44px] text-sm font-heading font-bold tracking-wide bg-gold text-primary-foreground hover:bg-gold-bright border-2 border-gold disabled:opacity-50 disabled:cursor-not-allowed"
              aria-disabled={isSubmitting}
            >
              {isSubmitting ? "Redirecting to Stripe..." : "Continue to checkout"}
            </Button>

            {/* Loading indicator */}
            {isSubmitting && (
              <p
                className="text-xs text-center text-rune/70 font-body"
                aria-live="polite"
              >
                Creating checkout session...
              </p>
            )}
          </form>

          {/* Privacy note */}
          <p className="text-[10px] text-center text-rune/50 leading-relaxed font-body">
            Your email is shared with Stripe for billing only.
            We do not send marketing emails.
          </p>

          {/* Sign in instead */}
          <p className="text-[11px] text-center font-body">
            <span className="text-rune/70">Have a Google account? </span>
            <a
              href="/sign-in"
              className="text-gold underline hover:text-gold-bright transition-colors"
            >
              Sign in instead
            </a>
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex justify-center">
          <button
            type="button"
            onClick={onDismiss}
            disabled={isSubmitting}
            className="text-[13px] text-rune underline cursor-pointer min-h-[44px] inline-flex items-center px-4 font-body hover:text-saga transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
