"use client";

/**
 * useJoinHouseholdPage — encapsulates all state, effects, and handlers for
 * the Join Household flow (/ledger/join).
 *
 * Extracted from page.tsx to reduce cyclomatic complexity.
 * Issue #1685
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ensureFreshToken } from "@/lib/auth/refresh-session";
import { getSession } from "@/lib/auth/session";
import { clearHouseholdLocalStorage, setStoredHouseholdId, getCards } from "@/lib/storage";
import { useEntitlement } from "@/hooks/useEntitlement";
import { clearEntitlementCache } from "@/lib/entitlement/cache";
import { clearTrialStatusCache } from "@/hooks/useTrialStatus";

// ---------------------------------------------------------------------------
// Types (re-exported so page.tsx and tests can import from one place)
// ---------------------------------------------------------------------------

export type ValidationStatus =
  | "idle"
  | "validating"
  | "valid"
  | "invalid"
  | "expired"
  | "full"
  | "already_member"
  | "network_error";

export type JoinStep =
  | "code"
  | "confirm"
  | "merging"
  | "success"
  | "merge_error"
  | "race_full";

export interface HouseholdPreview {
  householdId: string;
  householdName: string;
  memberCount: number;
  members: Array<{ displayName: string; email: string; role: string }>;
  userCardCount: number;
  /** Cards already in the target household — displayed in merge confirmation UI. */
  targetHouseholdCardCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CODE_LENGTH = 6;
export const SUCCESS_REDIRECT_DELAY_MS = 3000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface JoinHouseholdPageState {
  // Code input
  chars: string[];
  inputRefs: React.MutableRefObject<Array<HTMLInputElement | null>>;
  currentCode: string;
  isComplete: boolean;

  // Validation
  validationStatus: ValidationStatus;
  preview: HouseholdPreview | null;

  // Join flow
  step: JoinStep;
  cardsMerged: number;
  householdName: string;
  mergeError: string | null;

  // Derived UI flags
  isValidating: boolean;
  isError: boolean;
  isDisabled: boolean;

  // Handlers
  handleCharChange: (index: number, value: string) => void;
  handleBackspace: (index: number) => void;
  handlePaste: (text: string) => void;
  handleClearAndRetry: () => void;
  handleConfirmJoin: () => Promise<void>;
  setStep: React.Dispatch<React.SetStateAction<JoinStep>>;
}

export function useJoinHouseholdPage(): JoinHouseholdPageState {
  const router = useRouter();
  const { refreshEntitlement } = useEntitlement();

  // Code input state
  const [chars, setChars] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [validationStatus, setValidationStatus] =
    useState<ValidationStatus>("idle");
  const [preview, setPreview] = useState<HouseholdPreview | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>(
    Array(CODE_LENGTH).fill(null)
  );

  // Join flow state
  const [step, setStep] = useState<JoinStep>("code");
  const [cardsMerged, setCardsMerged] = useState(0);
  const [householdName, setHouseholdName] = useState("");
  const [mergeError, setMergeError] = useState<string | null>(null);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Auto-redirect after success
  useEffect(() => {
    if (step !== "success") return;
    const timer = setTimeout(
      () => router.push("/ledger"),
      SUCCESS_REDIRECT_DELAY_MS
    );
    return () => clearTimeout(timer);
  }, [step, router]);

  const currentCode = chars.join("");
  const isComplete = chars.every((c) => c.length === 1);

  // -------------------------------------------------------------------------
  // Validate invite code
  // -------------------------------------------------------------------------
  const validateCode = useCallback(async (code: string) => {
    if (code.length !== CODE_LENGTH) return;
    setValidationStatus("validating");
    try {
      const token = await ensureFreshToken();
      if (!token) {
        setValidationStatus("network_error");
        return;
      }
      const res = await fetch(
        `/api/household/invite/validate?code=${encodeURIComponent(code)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = (await res.json()) as HouseholdPreview;
        // Issue #1970: Thrall/trial users may have cards only in localStorage
        // (not yet synced to Firestore). Use the higher of the two counts so the
        // confirmation UI reflects cards that will actually be merged.
        const session = getSession();
        const soloHouseholdId = session?.user?.sub ?? "";
        const localCardCount = soloHouseholdId
          ? getCards(soloHouseholdId).length
          : 0;
        const effectiveCardCount = Math.max(data.userCardCount, localCardCount);
        setPreview({ ...data, userCardCount: effectiveCardCount });
        setValidationStatus("valid");
        return;
      }
      if (res.status === 404) {
        setValidationStatus("invalid");
      } else if (res.status === 410) {
        setValidationStatus("expired");
      } else if (res.status === 409) {
        const body = (await res.json()) as { error?: string };
        setValidationStatus(
          body.error === "already_in_household" ? "already_member" : "full"
        );
      } else {
        setValidationStatus("network_error");
      }
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch {
      setValidationStatus("network_error");
    }
  }, []);

  // -------------------------------------------------------------------------
  // Input handlers
  // -------------------------------------------------------------------------
  const handleCharChange = useCallback(
    (index: number, value: string) => {
      const next = [...chars];
      next[index] = value;
      setChars(next);
      setValidationStatus("idle");
      setPreview(null);

      if (value && index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      if (value && index === CODE_LENGTH - 1) {
        const code = next.join("");
        if (code.length === CODE_LENGTH) validateCode(code);
      }
    },
    [chars, validateCode]
  );

  const handleBackspace = useCallback(
    (index: number) => {
      const next = [...chars];
      if (next[index]) {
        next[index] = "";
        setChars(next);
      } else if (index > 0) {
        next[index - 1] = "";
        setChars(next);
        inputRefs.current[index - 1]?.focus();
      }
      setValidationStatus("idle");
      setPreview(null);
    },
    [chars]
  );

  const handlePaste = useCallback(
    (text: string) => {
      const clean = text.replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);
      if (clean.length === 0) return;
      const next = Array(CODE_LENGTH).fill("");
      for (let i = 0; i < clean.length; i++) next[i] = clean[i];
      setChars(next);
      setValidationStatus("idle");
      setPreview(null);
      const focusIdx = Math.min(clean.length, CODE_LENGTH - 1);
      inputRefs.current[focusIdx]?.focus();
      if (clean.length === CODE_LENGTH) validateCode(clean);
    },
    [validateCode]
  );

  const handleClearAndRetry = useCallback(() => {
    setChars(Array(CODE_LENGTH).fill(""));
    setValidationStatus("idle");
    setPreview(null);
    setTimeout(() => inputRefs.current[0]?.focus(), 50);
  }, []);

  // -------------------------------------------------------------------------
  // Merge execution
  // -------------------------------------------------------------------------
  const handleConfirmJoin = useCallback(async () => {
    if (!preview) return;
    setStep("merging");
    try {
      const token = await ensureFreshToken();
      if (!token) {
        setMergeError("Authentication error. Please sign in again.");
        setStep("merge_error");
        return;
      }
      const res = await fetch("/api/household/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ inviteCode: currentCode, confirm: true }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          householdId: string;
          householdName: string;
          movedCardCount: number;
        };
        setCardsMerged(data.movedCardCount);
        setHouseholdName(data.householdName);

        // Migrate localStorage: remove solo keys, store new householdId (#1796).
        // The user's solo householdId equals their Google sub (session.user.sub).
        // After joining, useCloudSync must use the new household's ID instead.
        const session = getSession();
        if (session?.user?.sub) {
          clearHouseholdLocalStorage(session.user.sub);
        }
        setStoredHouseholdId(data.householdId);

        // Issue #1971: await entitlement refresh so the cache has the joined
        // household's tier before navigation. If Odin's household is Karl, the
        // membership API auto-converts Freya's trial (markTrialConverted).
        // Clear both caches so EntitlementContext and TrialStatusContext both
        // reflect the new Karl tier with no trial flash on the /ledger redirect.
        clearEntitlementCache();
        await refreshEntitlement();
        clearTrialStatusCache();

        setStep("success");
      } else if (res.status === 409) {
        setStep("race_full");
      } else {
        setMergeError(
          "Merge failed. Your cards were not moved. Your solo household is intact."
        );
        setStep("merge_error");
      }
    } catch {
      setMergeError(
        "Connection error. Your cards were not moved. Please try again."
      );
      setStep("merge_error");
    }
  }, [preview, currentCode, refreshEntitlement]);

  // -------------------------------------------------------------------------
  // Derived UI flags
  // -------------------------------------------------------------------------
  const isValidating = validationStatus === "validating";
  const isError = [
    "invalid",
    "expired",
    "full",
    "network_error",
    "already_member",
  ].includes(validationStatus);
  const isDisabled = isValidating || step === "merging";

  return {
    chars,
    inputRefs,
    currentCode,
    isComplete,
    validationStatus,
    preview,
    step,
    cardsMerged,
    householdName,
    mergeError,
    isValidating,
    isError,
    isDisabled,
    handleCharChange,
    handleBackspace,
    handlePaste,
    handleClearAndRetry,
    handleConfirmJoin,
    setStep,
  };
}
