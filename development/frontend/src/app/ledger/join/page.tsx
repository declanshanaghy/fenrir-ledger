"use client";

/**
 * Join Household Page — /ledger/join
 *
 * Two-step join flow:
 *   Step 1: Enter 6-char invite code → validate → show household preview
 *   Step 2: Merge confirmation → confirm → execute → success
 *
 * Code entry uses 6 individual char inputs (auto-advance, paste-aware, a11y).
 * All validation states are handled: valid, invalid, expired, full, network error.
 * Merge uses POST /api/household/join with Firestore transaction (idempotent).
 *
 * Animations respect prefers-reduced-motion.
 *
 * Issue #1123 — household invite code flow
 */

import {
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { useRouter } from "next/navigation";
import { ensureFreshToken } from "@/lib/auth/refresh-session";
import { log } from "@/lib/logger";
import CodeCharInput from "@/components/household/CodeCharInput";
import type { CodeCharInputHandle } from "@/components/household/CodeCharInput";

// ─── Types ─────────────────────────────────────────────────────────────────────

type ValidationState =
  | "idle"
  | "loading"
  | "valid"
  | "invalid"
  | "expired"
  | "full"
  | "network_error";

type MergeStep = "confirm" | "merging" | "success" | "error" | "race_full";

interface HouseholdPreview {
  householdId: string;
  householdName: string;
  memberCount: number;
  members: Array<{ displayName: string; email: string; role: string }>;
  userCardCount: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatCardCount(n: number): string {
  return `${n} card${n !== 1 ? "s" : ""}`;
}

// ─── JoinHouseholdPage ─────────────────────────────────────────────────────────

type JoinStep = "enter_code" | "merge_confirm";

export default function JoinHouseholdPage() {
  const router = useRouter();

  // Code entry state
  const [chars, setChars] = useState<string[]>(["", "", "", "", "", ""]);
  const [validationState, setValidationState] = useState<ValidationState>("idle");
  const [shakeError, setShakeError] = useState(false);
  const [preview, setPreview] = useState<HouseholdPreview | null>(null);

  // Join flow step
  const [step, setStep] = useState<JoinStep>("enter_code");

  // Merge state
  const [mergeStep, setMergeStep] = useState<MergeStep>("confirm");
  const [mergedCardCount, setMergedCardCount] = useState(0);
  const [mergeHouseholdName, setMergeHouseholdName] = useState("");

  // Refs for char inputs
  const inputRefs = useRef<Array<CodeCharInputHandle | null>>(
    Array.from({ length: 6 }, () => null)
  );
  const continueRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const code = chars.join("").toUpperCase();
  const isCodeComplete = code.length === 6 && chars.every((c) => c !== "");

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Auto-validate when 6th char is entered
  useEffect(() => {
    if (isCodeComplete && validationState === "idle") {
      void validateCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCodeComplete, chars]);

  // Focus Continue button on valid code
  useEffect(() => {
    if (validationState === "valid") {
      continueRef.current?.focus();
    }
  }, [validationState]);

  // Focus Confirm button when on merge confirm screen
  useEffect(() => {
    if (step === "merge_confirm") {
      confirmRef.current?.focus();
    }
  }, [step]);

  // Trigger error shake animation
  const triggerShake = useCallback(() => {
    setShakeError(true);
    // Focus first char input after shake
    setTimeout(() => {
      setShakeError(false);
      inputRefs.current[0]?.focus();
    }, 300);
  }, []);

  const validateCode = useCallback(async () => {
    setValidationState("loading");
    try {
      const token = await ensureFreshToken();
      if (!token) {
        setValidationState("network_error");
        return;
      }
      const res = await fetch(
        `/api/household/invite/validate?code=${encodeURIComponent(code)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
        }
      );

      if (res.status === 200) {
        const data = (await res.json()) as HouseholdPreview;
        setPreview(data);
        setValidationState("valid");
        return;
      }
      if (res.status === 404) {
        setValidationState("invalid");
        triggerShake();
        return;
      }
      if (res.status === 410) {
        setValidationState("expired");
        triggerShake();
        return;
      }
      if (res.status === 409) {
        setValidationState("full");
        triggerShake();
        return;
      }
      setValidationState("network_error");
    } catch (err) {
      log.error("JoinHouseholdPage: validate failed", { error: String(err) });
      setValidationState("network_error");
    }
  }, [code, triggerShake]);

  const clearCode = useCallback(() => {
    setChars(["", "", "", "", "", ""]);
    setValidationState("idle");
    setPreview(null);
    setTimeout(() => inputRefs.current[0]?.focus(), 10);
  }, []);

  const handleCharChange = useCallback((index: number, value: string) => {
    setChars((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    // Any change resets validation (unless loading)
    setValidationState((prev) =>
      prev === "loading" ? "loading" : "idle"
    );
    setPreview(null);
  }, []);

  const handleAdvance = useCallback((index: number) => {
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleRetreat = useCallback((index: number) => {
    if (index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, []);

  // Paste handler on the fieldset
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLFieldSetElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (pasted.length !== 6) return;
      const next = pasted.split("").slice(0, 6);
      setChars(next);
      setValidationState("idle");
      setPreview(null);
      // Trigger validation after paste
      setTimeout(() => {
        void validateCode();
      }, 50);
    },
    [validateCode]
  );

  const handleContinue = useCallback(() => {
    setStep("merge_confirm");
  }, []);

  const handleJoinConfirm = useCallback(async () => {
    setMergeStep("merging");
    setMergeHouseholdName(preview?.householdName ?? "");
    try {
      const token = await ensureFreshToken();
      if (!token) {
        setMergeStep("error");
        return;
      }
      const res = await fetch("/api/household/join", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inviteCode: code, confirm: true }),
      });

      if (res.status === 200) {
        const data = (await res.json()) as {
          movedCardCount: number;
          householdName: string;
        };
        setMergedCardCount(data.movedCardCount);
        setMergeHouseholdName(data.householdName);
        setMergeStep("success");
        // Auto-redirect after 3s
        setTimeout(() => router.push("/ledger"), 3000);
        return;
      }
      if (res.status === 409) {
        setMergeStep("race_full");
        return;
      }
      setMergeStep("error");
    } catch (err) {
      log.error("JoinHouseholdPage: join failed", { error: String(err) });
      setMergeStep("error");
    }
  }, [code, preview, router]);

  // ─── Render: merge confirmation step ───────────────────────────────────────

  if (step === "merge_confirm") {
    return (
      <MergeConfirmationScreen
        preview={preview!}
        mergeStep={mergeStep}
        mergedCardCount={mergedCardCount}
        mergeHouseholdName={mergeHouseholdName}
        confirmRef={confirmRef}
        onConfirm={handleJoinConfirm}
        onCancel={() => {
          setStep("enter_code");
          setMergeStep("confirm");
        }}
        onGoToDashboard={() => router.push("/ledger")}
        onBackToSettings={() => router.push("/ledger/settings")}
      />
    );
  }

  // ─── Render: code entry step ────────────────────────────────────────────────

  const charState = (i: number): "idle" | "filled" | "active" | "error" => {
    if (validationState === "invalid" || validationState === "expired" || validationState === "full") {
      return "error";
    }
    const val = chars[i] ?? "";
    if (val) return "filled";
    // Active = first empty slot
    const firstEmpty = chars.findIndex((c) => c === "");
    if (i === firstEmpty) return "active";
    return "idle";
  };

  const isDisabled = validationState === "loading";

  return (
    <div className="px-6 py-6 max-w-5xl">
      <header className="mb-6 border-b border-border pb-4">
        <button
          type="button"
          onClick={() => router.push("/ledger/settings")}
          className="text-[13px] text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Back to Settings"
        >
          ‹ Settings
        </button>
        <h1 className="font-display text-2xl text-gold tracking-wide mb-1">
          Join a Household
        </h1>
        <p className="text-sm text-muted-foreground mt-2 font-body italic">
          Enter the 6-character invite code from the household owner.
        </p>
      </header>

      <div className="max-w-[440px]">
        {/* Code input fieldset */}
        <form
          aria-busy={isDisabled}
          onSubmit={(e) => e.preventDefault()}
        >
          <fieldset
            className="border-0 p-0 flex flex-col gap-4"
            onPaste={handlePaste}
          >
            <legend className="sr-only">Invite code (6 characters)</legend>

            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
                Invite Code
              </label>
              <div
                className={[
                  "flex gap-1.5 justify-start",
                  shakeError
                    ? "motion-safe:animate-[shake_150ms_ease-out]"
                    : "",
                ].join(" ")}
                role="group"
                aria-label="Enter 6-character invite code"
              >
                {chars.map((char, i) => (
                  <CodeCharInput
                    key={i}
                    ref={(el) => {
                      inputRefs.current[i] = el;
                    }}
                    index={i}
                    value={char}
                    state={charState(i)}
                    disabled={isDisabled}
                    onChange={handleCharChange}
                    onAdvance={handleAdvance}
                    onRetreat={handleRetreat}
                  />
                ))}
              </div>
            </div>

            {/* Validation feedback */}
            {validationState === "loading" && (
              <p className="text-[12px] text-muted-foreground" aria-live="polite">
                Checking…
              </p>
            )}

            {validationState === "invalid" && (
              <ValidationMessage type="error">
                <strong>Invalid invite code.</strong>
                <br />
                Check the code with your household owner and try again.
              </ValidationMessage>
            )}

            {validationState === "expired" && (
              <ValidationMessage type="error">
                <strong>This invite code has expired.</strong>
                <br />
                Ask the household owner to generate a new code.
              </ValidationMessage>
            )}

            {validationState === "full" && (
              <ValidationMessage type="error">
                <strong>Household is full (3/3 members).</strong>
                <br />
                This household cannot accept new members. Ask the owner if a spot will
                open.
              </ValidationMessage>
            )}

            {validationState === "network_error" && (
              <ValidationMessage type="error">
                <strong>Connection error.</strong>
                <br />
                Check your connection and try again.
              </ValidationMessage>
            )}

            {validationState === "valid" && preview && (
              <>
                <ValidationMessage type="success">
                  ✓ Valid invite code for <strong>{preview.householdName}</strong>
                </ValidationMessage>

                {/* Household preview */}
                <div className="border border-border p-3 flex flex-col gap-2 motion-safe:animate-[fadeSlideIn_300ms_cubic-bezier(0.16,1,0.3,1)]">
                  <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
                    You will join
                  </div>
                  <div className="text-base font-bold text-foreground">
                    {preview.householdName}
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    Current members ({preview.memberCount}/3):
                    <div className="flex flex-wrap gap-1 mt-1">
                      {preview.members.map((m) => (
                        <span
                          key={m.email}
                          className="inline-flex items-center gap-1 border border-border px-2 py-0.5 text-[11px]"
                        >
                          <span className="w-4 h-4 border border-border flex items-center justify-center text-[9px] font-bold">
                            {m.displayName[0]?.toUpperCase()}
                          </span>
                          {m.displayName}
                          {m.role === "owner" && (
                            <span className="text-[9px] text-muted-foreground">(Owner)</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Action button */}
            {validationState === "idle" || validationState === "loading" ? (
              <button
                type="button"
                disabled={!isCodeComplete || isDisabled}
                className="w-full min-h-[44px] border-2 border-gold/60 text-gold font-bold hover:bg-gold/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={isDisabled ? "Checking invite code…" : "Join Household"}
                aria-busy={isDisabled}
              >
                {isDisabled ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner /> Checking…
                  </span>
                ) : (
                  "Join Household"
                )}
              </button>
            ) : validationState === "valid" ? (
              <button
                ref={continueRef}
                type="button"
                onClick={handleContinue}
                className="w-full min-h-[44px] border-2 border-gold/60 text-gold font-bold hover:bg-gold/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Continue →
              </button>
            ) : (
              <button
                type="button"
                onClick={clearCode}
                className="w-full min-h-[44px] border-2 border-gold/60 text-gold font-bold hover:bg-gold/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {validationState === "invalid"
                  ? "Try Again"
                  : validationState === "expired"
                    ? "Try a New Code"
                    : validationState === "full"
                      ? "Try a Different Code"
                      : "Retry"}
              </button>
            )}
          </fieldset>
        </form>
      </div>
    </div>
  );
}

// ─── Merge Confirmation Screen ─────────────────────────────────────────────────

interface MergeConfirmationScreenProps {
  preview: HouseholdPreview;
  mergeStep: MergeStep;
  mergedCardCount: number;
  mergeHouseholdName: string;
  confirmRef: React.RefObject<HTMLButtonElement | null>;
  onConfirm: () => void;
  onCancel: () => void;
  onGoToDashboard: () => void;
  onBackToSettings: () => void;
}

function MergeConfirmationScreen({
  preview,
  mergeStep,
  mergedCardCount,
  mergeHouseholdName,
  confirmRef,
  onConfirm,
  onCancel,
  onGoToDashboard,
  onBackToSettings,
}: MergeConfirmationScreenProps) {
  const hasCards = preview.userCardCount > 0;
  const cardCount = preview.userCardCount;

  // Success state
  if (mergeStep === "success") {
    return (
      <div className="px-6 py-6 max-w-[440px]">
        <div className="border border-border p-6">
          <header className="text-center border-b border-border pb-4 mb-6">
            <h1 className="font-display text-xl text-gold tracking-wide">
              Welcome to the Household!
            </h1>
          </header>
          <div
            className="flex flex-col items-center gap-4 text-center motion-safe:animate-[sagaEnter_300ms_cubic-bezier(0.16,1,0.3,1)]"
            aria-live="polite"
          >
            <div className="text-5xl" aria-hidden="true">⚔</div>
            <div className="text-xl font-bold text-foreground">
              You&apos;ve joined {mergeHouseholdName}
            </div>
            {mergedCardCount > 0 ? (
              <>
                <div className="text-[13px] text-muted-foreground leading-relaxed">
                  Your cards have been merged. You now share this household with your
                  new members.
                </div>
                <div className="border border-border p-3 w-full">
                  <div className="text-[11px] uppercase tracking-[0.05em] text-muted-foreground mb-1">
                    Cards merged
                  </div>
                  <div className="text-[18px] font-bold text-foreground">
                    {formatCardCount(mergedCardCount)}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-[13px] text-muted-foreground leading-relaxed">
                You now share this household. Start adding cards to build your ledger
                together.
              </div>
            )}
            <button
              type="button"
              onClick={onGoToDashboard}
              autoFocus
              className="w-full min-h-[44px] border-2 border-gold/60 text-gold font-bold hover:bg-gold/10 transition-colors mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Go to Dashboard
            </button>
            <p className="text-[11px] text-muted-foreground italic">
              Redirecting automatically in 3 seconds…
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Merging in progress
  if (mergeStep === "merging") {
    return (
      <div className="px-6 py-6 max-w-[440px]">
        <div className="border border-border p-6">
          <header className="border-b border-border pb-4 mb-6 text-center">
            <h1 className="font-display text-xl text-gold tracking-wide">Merging…</h1>
          </header>
          <div
            className="flex flex-col items-center gap-5 py-8 text-center"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="text-4xl" aria-hidden="true">⚔</div>
            <div className="text-base font-bold text-foreground">Merging your cards…</div>
            <div className="text-[12px] text-muted-foreground leading-relaxed">
              Moving your cards to {preview.householdName}.
              <br />
              Please don&apos;t close this screen.
            </div>
            {/* Indeterminate progress bar */}
            <div
              role="progressbar"
              aria-label="Merge progress"
              className="w-48 h-1 border border-border overflow-hidden"
            >
              <div className="h-full bg-gold/60 motion-safe:animate-[indeterminate_1.5s_ease-in-out_infinite]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Race condition — became full
  if (mergeStep === "race_full") {
    return (
      <div className="px-6 py-6 max-w-[440px]">
        <header className="mb-6 border-b border-border pb-4">
          <h1 className="font-display text-2xl text-gold tracking-wide">
            Household Full
          </h1>
        </header>
        <div
          className="border border-dashed border-amber-500/50 p-4 flex gap-3 mb-4"
          role="alert"
        >
          <span className="text-xl flex-shrink-0" aria-hidden="true">⚔</span>
          <div className="text-[12px] text-foreground/90 leading-relaxed">
            <strong>Household is now full.</strong>
            <br />
            Another member joined {preview.householdName} while you were confirming.
            Your cards were not moved.
          </div>
        </div>
        <button
          type="button"
          onClick={onBackToSettings}
          className="w-full min-h-[44px] border border-border text-[13px] hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Back to Settings
        </button>
      </div>
    );
  }

  // Merge error
  if (mergeStep === "error") {
    return (
      <div className="px-6 py-6 max-w-[440px]">
        <header className="mb-6 border-b border-border pb-4">
          <h1 className="font-display text-2xl text-gold tracking-wide">
            Merge Failed
          </h1>
        </header>
        <div
          className="border border-dashed border-red-500/50 p-4 flex gap-3 mb-4"
          role="alert"
        >
          <span className="text-xl flex-shrink-0" aria-hidden="true">✕</span>
          <div className="text-[12px] text-foreground/90 leading-relaxed">
            <strong>Merge failed.</strong>
            <br />
            Your cards were not moved. Your solo household is intact. Please try again.
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full min-h-[44px] border-2 border-gold/60 text-gold font-bold hover:bg-gold/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full min-h-[44px] border border-border text-[13px] hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Confirm state (default)
  return (
    <div className="px-6 py-6 max-w-[440px]">
      <header className="mb-6 border-b border-border pb-4">
        <button
          type="button"
          onClick={onCancel}
          className="text-[13px] text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Back to code entry"
        >
          ‹ Back
        </button>
        <h1 className="font-display text-2xl text-gold tracking-wide">
          Confirm Merge
        </h1>
      </header>

      {/* Merge flow diagram */}
      <div className="border border-border p-4 flex flex-col gap-3 items-center mb-4">
        <div className="border border-dashed border-border p-3 w-full text-center">
          <div className="text-[10px] uppercase tracking-[0.05em] text-muted-foreground mb-1">
            Your current household
          </div>
          <div className="text-[14px] font-bold text-foreground">
            Solo — You
          </div>
          {hasCards && (
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {formatCardCount(cardCount)} · will be deleted after merge
            </div>
          )}
        </div>
        <div className="text-xl text-muted-foreground" aria-hidden="true">
          ↓ merge into ↓
        </div>
        <div className="border border-border p-3 w-full text-center">
          <div className="text-[10px] uppercase tracking-[0.05em] text-muted-foreground mb-1">
            Joining household
          </div>
          <div className="text-[14px] font-bold text-foreground">
            {preview.householdName}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {preview.memberCount} existing member{preview.memberCount !== 1 ? "s" : ""} ·{" "}
            {3 - preview.memberCount} spot{3 - preview.memberCount !== 1 ? "s" : ""} remaining
          </div>
        </div>
      </div>

      {/* Card list (when user has cards) */}
      {hasCards && (
        <div className="border border-border p-3 mb-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground mb-2">
            Your {formatCardCount(cardCount)} will be moved
          </div>
          <ul aria-label="Cards that will be merged" className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
            {/* We show a summary since we don't load individual cards here */}
            <li className="border border-border px-2.5 py-1.5 text-[12px] text-foreground/90">
              {formatCardCount(cardCount)} from your solo household
            </li>
          </ul>
        </div>
      )}

      {/* Destructive warning (when user has cards) */}
      {hasCards && (
        <div
          className="border border-dashed border-amber-500/50 p-3 flex gap-2.5 mb-4"
          role="alert"
        >
          <span className="text-base flex-shrink-0" aria-hidden="true">⚠</span>
          <div className="text-[12px] text-foreground/90 leading-relaxed">
            Your solo household will be <strong>permanently deleted</strong> after the
            merge. This cannot be undone.
          </div>
        </div>
      )}

      {/* No cards message */}
      {!hasCards && (
        <div className="border border-dashed border-border p-3 text-[12px] text-center text-muted-foreground mb-4">
          You have no existing cards to merge. You&apos;ll start fresh in the new
          household.
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <button
          ref={confirmRef}
          type="button"
          onClick={onConfirm}
          className="w-full min-h-[44px] border-2 border-gold/60 text-gold font-bold hover:bg-gold/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={
            hasCards
              ? `Merge ${formatCardCount(cardCount)} and join ${preview.householdName}`
              : `Join ${preview.householdName}`
          }
        >
          {hasCards
            ? `Merge ${formatCardCount(cardCount)} & Join Household`
            : "Join Household"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full min-h-[44px] border border-border text-[13px] hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {hasCards ? "Cancel — Stay Solo" : "Cancel"}
        </button>
      </div>
    </div>
  );
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

function ValidationMessage({
  type,
  children,
}: {
  type: "success" | "error";
  children: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className={[
        "flex items-start gap-2 p-3 border text-[12px]",
        type === "error"
          ? "border-dashed border-red-500/50 text-foreground/90"
          : "border-border text-foreground/90",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full motion-safe:animate-spin"
      aria-hidden="true"
    />
  );
}
