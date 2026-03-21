"use client";

/**
 * Join Household page — /ledger/join
 *
 * Two-step flow:
 *   Step 1 (code):    Enter 6-char invite code → validate → show preview
 *   Step 2 (confirm): Review cards to merge → confirm → execute merge → success
 *
 * Routing: full page within LedgerShell (shares nav). Max-width centered card.
 *
 * @see ux/wireframes/household/join-household.html
 * @see ux/wireframes/household/merge-confirmation.html
 * Issue #1123
 */

import { useRouter } from "next/navigation";
import { CodeCharInput } from "@/components/household/CodeCharInput";
import {
  useJoinHouseholdPage,
  CODE_LENGTH,
  type HouseholdPreview,
  type ValidationStatus,
} from "./useJoinHouseholdPage";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_MEMBERS = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getValidationMessage(
  status: ValidationStatus,
  preview: HouseholdPreview | null
) {
  switch (status) {
    case "invalid":
      return {
        icon: "✕",
        text: (
          <>
            <strong>Invalid invite code.</strong>
            <br />
            Check the code with your household owner and try again.
          </>
        ),
        action: "Try Again",
      };
    case "expired":
      return {
        icon: "⏱",
        text: (
          <>
            <strong>This invite code has expired.</strong>
            <br />
            Ask the household owner to generate a new code.
          </>
        ),
        action: "Try a New Code",
      };
    case "full":
      return {
        icon: "⚔",
        text: (
          <>
            <strong>
              Household is full ({MAX_MEMBERS}/{MAX_MEMBERS} members).
            </strong>
            <br />
            This household cannot accept new members. Ask the owner if a spot
            will open.
          </>
        ),
        action: "Try a Different Code",
      };
    case "already_member":
      return {
        icon: "⚔",
        text: (
          <>
            <strong>You&rsquo;re already in a household.</strong>
            <br />
            You must leave your current household before joining another (coming
            soon).
          </>
        ),
        action: null,
      };
    case "network_error":
      return {
        icon: "✕",
        text: (
          <>
            <strong>Connection error.</strong>
            <br />
            Could not reach the server. Please try again.
          </>
        ),
        action: "Retry",
      };
    case "valid":
      return {
        icon: "✓",
        text: (
          <>
            Valid invite code for <strong>{preview?.householdName}</strong>
          </>
        ),
        action: null,
      };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function JoinHouseholdPage() {
  const router = useRouter();
  const {
    chars,
    inputRefs,
    validationStatus,
    preview,
    step,
    cardsMerged,
    householdName,
    mergeError,
    isValidating,
    isError,
    isDisabled,
    isComplete,
    handleCharChange,
    handleBackspace,
    handlePaste,
    handleClearAndRetry,
    handleConfirmJoin,
    setStep,
  } = useJoinHouseholdPage();

  const validationMsg = getValidationMessage(validationStatus, preview);

  // ---------------------------------------------------------------------------
  // Success screen
  // ---------------------------------------------------------------------------
  if (step === "success") {
    const memberList =
      preview?.members.map((m) => m.displayName).join(" and ") ?? "";
    return (
      <div className="px-4 py-8 flex justify-center">
        <div className="w-full max-w-[480px] flex flex-col items-center gap-6 text-center">
          <p className="text-sm font-heading font-bold uppercase tracking-widest text-muted-foreground">
            Welcome to the Household!
          </p>
          <span className="text-5xl" aria-hidden="true">
            ⚔
          </span>
          <h1 className="text-xl font-heading font-bold text-foreground">
            You&rsquo;ve joined {householdName}
          </h1>
          {cardsMerged > 0 ? (
            <>
              <p className="text-sm text-muted-foreground font-body">
                Your cards have been merged. You now share this household with{" "}
                {memberList}.
              </p>
              <div className="border border-border px-6 py-3 w-full">
                <p className="text-xs uppercase tracking-widest font-heading text-muted-foreground mb-1">
                  Cards merged
                </p>
                <p className="text-2xl font-bold font-heading text-foreground">
                  {cardsMerged} card{cardsMerged !== 1 ? "s" : ""}
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground font-body">
              You now share this household with {memberList}. Start adding cards
              to build your ledger together.
            </p>
          )}
          <button
            type="button"
            onClick={() => router.push("/ledger")}
            className="w-full min-h-[44px] px-5 py-3 border-2 border-border text-sm font-heading font-bold text-foreground hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Go to Dashboard
          </button>
          <p className="text-xs text-muted-foreground font-body">
            Redirecting automatically in 3 seconds…
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Race condition: household became full
  // ---------------------------------------------------------------------------
  if (step === "race_full") {
    return (
      <div className="px-4 py-8 flex justify-center">
        <div className="w-full max-w-[480px] flex flex-col gap-4">
          <h1 className="text-xl font-heading font-bold text-foreground">
            Household Full
          </h1>
          <div
            className="border border-dashed border-destructive p-4 flex gap-3"
            role="alert"
          >
            <span className="text-xl flex-shrink-0" aria-hidden="true">
              ⚔
            </span>
            <div className="text-sm font-body text-foreground">
              <strong>Household is now full.</strong>
              <br />
              Another member joined {preview?.householdName} while you were
              confirming. Your cards were not moved.
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/ledger/settings")}
            className="w-full min-h-[44px] px-5 py-2 border border-border text-sm font-heading text-foreground hover:bg-muted/30 transition-colors"
          >
            Back to Settings
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Merge error
  // ---------------------------------------------------------------------------
  if (step === "merge_error") {
    return (
      <div className="px-4 py-8 flex justify-center">
        <div className="w-full max-w-[480px] flex flex-col gap-4">
          <h1 className="text-xl font-heading font-bold text-foreground">
            Merge Failed
          </h1>
          <div
            className="border border-dashed border-destructive p-4 flex gap-3"
            role="alert"
          >
            <span className="text-xl flex-shrink-0" aria-hidden="true">
              ✕
            </span>
            <div className="text-sm font-body text-foreground">
              {mergeError ??
                "Merge failed. Your cards were not moved. Please try again."}
            </div>
          </div>
          <button
            type="button"
            onClick={handleConfirmJoin}
            className="w-full min-h-[44px] px-5 py-2 border-2 border-border text-sm font-heading font-bold text-foreground hover:bg-muted/30 transition-colors"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => setStep("confirm")}
            className="w-full min-h-[44px] px-5 py-2 border border-border text-sm font-heading text-foreground hover:bg-muted/30 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Merging in progress (blocking)
  // ---------------------------------------------------------------------------
  if (step === "merging") {
    return (
      <div className="px-4 py-8 flex justify-center">
        <div className="w-full max-w-[480px] flex flex-col items-center gap-6 text-center py-16">
          <span className="text-5xl" aria-hidden="true">
            ⚔
          </span>
          <h2 className="text-lg font-heading font-bold text-foreground">
            Merging your cards…
          </h2>
          <p className="text-sm text-muted-foreground font-body">
            Moving your cards to {preview?.householdName ?? "the household"}.
            <br />
            Please don&rsquo;t close this screen.
          </p>
          <div
            className="w-48 h-1 border border-border overflow-hidden"
            role="progressbar"
            aria-label="Merge progress"
            aria-busy="true"
          >
            <div
              className="h-full bg-foreground/40 animate-[progress_1.5s_ease-in-out_infinite]"
              style={{ width: "60%" }}
            />
          </div>
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            Merging your cards, please wait.
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Merge confirmation (step 2)
  // ---------------------------------------------------------------------------
  if (step === "confirm" && preview) {
    const hasCards = preview.userCardCount > 0;
    const cardCountLabel = `${preview.userCardCount} card${preview.userCardCount !== 1 ? "s" : ""}`;

    return (
      <div className="px-4 py-8 flex justify-center">
        <div className="w-full max-w-[480px] flex flex-col gap-5">
          <header>
            <h1 className="text-xl font-heading font-bold text-foreground border-b border-border pb-3">
              Confirm: Merge Cards &amp; Join Household
            </h1>
          </header>

          {/* Merge diagram */}
          <div className="border border-border p-4 flex flex-col gap-3 items-center">
            <div className="border border-dashed border-border p-3 w-full text-center">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-heading mb-1">
                Your current household
              </p>
              <p className="text-sm font-bold font-heading text-foreground">
                {hasCards ? `Solo · ${cardCountLabel}` : "Solo · No cards"}
              </p>
              {hasCards && (
                <p className="text-xs text-muted-foreground font-body mt-0.5">
                  will be deleted after merge
                </p>
              )}
            </div>
            <p
              className="text-lg font-heading text-muted-foreground"
              aria-hidden="true"
            >
              ↓ merge into ↓
            </p>
            <div className="border border-border p-3 w-full text-center">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-heading mb-1">
                Joining household
              </p>
              <p className="text-sm font-bold font-heading text-foreground">
                {preview.householdName}
              </p>
              <p className="text-xs text-muted-foreground font-body mt-0.5">
                {preview.memberCount} existing member
                {preview.memberCount !== 1 ? "s" : ""} ·{" "}
                {MAX_MEMBERS - preview.memberCount} spot remaining
              </p>
            </div>
          </div>

          {hasCards ? (
            <>
              <div className="border border-border p-3 flex flex-col gap-2">
                <p className="text-xs font-heading font-bold uppercase tracking-widest text-muted-foreground">
                  Your {preview.userCardCount} card
                  {preview.userCardCount !== 1 ? "s" : ""} will be moved
                </p>
                <p className="text-xs text-muted-foreground font-body italic">
                  All {preview.userCardCount} card
                  {preview.userCardCount !== 1 ? "s" : ""} from your solo
                  household will be transferred.
                </p>
              </div>
              <div
                className="border border-dashed border-border p-3 flex gap-3"
                role="alert"
              >
                <span
                  className="text-lg flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                >
                  ⚠
                </span>
                <p className="text-xs text-foreground font-body leading-relaxed">
                  Your solo household will be{" "}
                  <strong>permanently deleted</strong> after the merge. This
                  cannot be undone.
                </p>
              </div>
            </>
          ) : (
            <div className="border border-dashed border-border p-3 text-xs text-center text-muted-foreground font-body">
              You have no existing cards to merge. You&rsquo;ll start fresh in
              the new household.
            </div>
          )}

          <button
            type="button"
            onClick={handleConfirmJoin}
            className="w-full min-h-[44px] px-5 py-3 border-2 border-border text-sm font-heading font-bold text-foreground hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={
              hasCards
                ? `Merge ${preview.userCardCount} card${preview.userCardCount !== 1 ? "s" : ""} and join ${preview.householdName}`
                : `Join ${preview.householdName}`
            }
          >
            {hasCards
              ? `Merge ${cardCountLabel} & Join Household`
              : "Join Household"}
          </button>
          <button
            type="button"
            onClick={() => setStep("code")}
            className="w-full min-h-[44px] px-5 py-2 border border-border text-sm font-heading text-foreground hover:bg-muted/30 transition-colors"
          >
            Cancel — Stay Solo
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Code entry (step 1 — default)
  // ---------------------------------------------------------------------------
  return (
    <div className="px-4 py-8 flex justify-center">
      <div className="w-full max-w-[480px] flex flex-col gap-6">
        <header className="border-b border-border pb-4">
          <h1 className="text-xl font-heading font-bold text-foreground">
            Join a Household
          </h1>
          <p className="text-sm text-muted-foreground font-body mt-1">
            Enter the 6-character invite code from the household owner.
          </p>
        </header>

        <fieldset aria-busy={isValidating}>
          <legend className="sr-only">Invite code (6 characters)</legend>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-heading font-bold uppercase tracking-[0.08em] text-foreground">
              Invite Code
            </p>
            <div
              className="flex gap-1.5 sm:gap-2 justify-center"
              role="group"
              aria-label="6-character invite code"
            >
              {chars.map((char, i) => (
                <CodeCharInput
                  key={i}
                  index={i}
                  value={char}
                  disabled={isDisabled}
                  hasError={isError && validationStatus !== "already_member"}
                  onChange={handleCharChange}
                  onBackspace={handleBackspace}
                  onPaste={handlePaste}
                  ref={(el) => {
                    inputRefs.current[i] = el;
                  }}
                />
              ))}
            </div>
          </div>
        </fieldset>

        {validationMsg && (
          <div
            role="alert"
            aria-live="assertive"
            className={[
              "flex items-start gap-2 p-3 border text-sm font-body",
              validationStatus === "valid"
                ? "border-border"
                : "border-dashed border-destructive",
            ].join(" ")}
          >
            <span
              className="text-base flex-shrink-0 mt-0.5"
              aria-hidden="true"
            >
              {validationMsg.icon}
            </span>
            <div className="text-foreground">{validationMsg.text}</div>
          </div>
        )}

        {validationStatus === "valid" && preview && (
          <div className="border border-border p-4 flex flex-col gap-3">
            <p className="text-xs font-heading font-bold uppercase tracking-widest text-muted-foreground">
              You will join
            </p>
            <p className="text-base font-heading font-bold text-foreground">
              {preview.householdName}
            </p>
            <div className="text-xs text-muted-foreground font-body">
              Current members ({preview.memberCount}/{MAX_MEMBERS}):
              <div className="flex flex-wrap gap-1 mt-1">
                {preview.members.map((m) => (
                  <span
                    key={m.email}
                    className="inline-flex items-center gap-1 border border-border px-2 py-1 text-[11px] font-body text-foreground"
                  >
                    <span
                      className="w-4 h-4 border border-border text-[9px] font-bold flex items-center justify-center"
                      aria-hidden="true"
                    >
                      {m.displayName.charAt(0).toUpperCase()}
                    </span>
                    {m.displayName}
                    {m.role === "owner" ? " (Owner)" : ""}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {validationStatus === "valid" ? (
          <button
            type="button"
            onClick={() => setStep("confirm")}
            className="w-full min-h-[44px] px-5 py-3 border-2 border-border text-sm font-heading font-bold text-foreground hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            autoFocus
          >
            Continue →
          </button>
        ) : isError && validationStatus !== "already_member" ? (
          <button
            type="button"
            onClick={handleClearAndRetry}
            className="w-full min-h-[44px] px-5 py-3 border-2 border-border text-sm font-heading font-bold text-foreground hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {validationMsg?.action ?? "Try Again"}
          </button>
        ) : validationStatus === "already_member" ? (
          <button
            type="button"
            onClick={() => router.push("/ledger/settings")}
            className="w-full min-h-[44px] px-5 py-2 border border-border text-sm font-heading text-foreground hover:bg-muted/30 transition-colors"
          >
            Back to Settings
          </button>
        ) : (
          <button
            type="button"
            disabled={!isComplete || isValidating}
            className="w-full min-h-[44px] px-5 py-3 border-2 border-border text-sm font-heading font-bold text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            aria-label={
              isValidating ? "Checking invite code…" : "Join Household"
            }
            aria-busy={isValidating}
          >
            {isValidating ? (
              <span className="flex items-center justify-center gap-2">
                <span
                  className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
                Checking…
              </span>
            ) : (
              "Join Household"
            )}
          </button>
        )}
      </div>
    </div>
  );
}
