"use client";

/**
 * useCardForm — extracted hook for CardForm state and handlers.
 *
 * Encapsulates:
 *  - react-hook-form setup + Zod schema
 *  - wizard step navigation (currentStep, direction, goToStep)
 *  - date-derivation effect (annualFeeDate, bonusDeadline)
 *  - onSubmit handler (entitlement check, card construction, save, analytics, milestone)
 *  - handleDelete / handleClose handlers
 *  - scrollToFirstError helper
 *
 * Issue #1682: extracted to reduce CardForm cyclomatic complexity from 49 → <15
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { toast } from "sonner";

import type { Card, CardStatus } from "@/lib/types";
import { saveCard, deleteCard, closeCard, getCards } from "@/lib/storage";
import { checkMilestone } from "@/lib/milestone-utils";
import { canAddCard } from "@/lib/entitlement/card-limit";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import {
  computeCardStatus,
  dollarsToCents,
  centsToDollars,
  generateId,
  isoToLocalDateString,
  localDateStringToIso,
} from "@/lib/card-utils";
import { useGleipnirFragment4 } from "@/components/cards/GleipnirBearSinews";
import { track } from "@/lib/analytics/track";

// ─── Zod validation schema ────────────────────────────────────────────────────

export const cardFormSchema = z.object({
  issuerId: z.string().min(1, "Issuer is required"),
  cardName: z.string().min(1, "Card name is required").max(100),
  openDate: z.string().min(1, "Open date is required"),
  creditLimit: z
    .string()
    .optional()
    .transform((v) => v ?? "")
    .refine(
      (v) => v === "" || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0),
      "Must be a valid dollar amount"
    ),
  annualFee: z
    .string()
    .optional()
    .transform((v) => v ?? "")
    .refine(
      (v) => v === "" || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0),
      "Must be a valid dollar amount"
    ),
  annualFeeDate: z.string().optional().default(""),
  bonusType: z.enum(["points", "miles", "cashback"]).optional(),
  bonusAmount: z.string().optional().default(""),
  bonusSpendRequirement: z.string().optional().default(""),
  bonusDeadline: z.string().optional().default(""),
  amountSpent: z
    .string()
    .optional()
    .transform((v) => v ?? "")
    .refine(
      (v) => v === "" || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0),
      "Must be a valid dollar amount"
    ),
  status: z
    .enum([
      "active",
      "fee_approaching",
      "promo_expiring",
      "closed",
      "bonus_open",
      "overdue",
      "graduated",
    ])
    .optional(),
  notes: z.string().optional().default(""),
});

export type CardFormValues = z.infer<typeof cardFormSchema>;

// ─── Default-value builder ────────────────────────────────────────────────────

function buildDefaultValues(initialValues?: Card): Partial<CardFormValues> {
  const todayStr = new Date().toISOString().split("T")[0] ?? "";

  const feeDateDefault = (() => {
    const d = new Date(todayStr + "T00:00:00");
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split("T")[0] ?? "";
  })();

  const deadlineDefault = (() => {
    const d = new Date(todayStr + "T00:00:00");
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().split("T")[0] ?? "";
  })();

  if (!initialValues) {
    return {
      openDate: todayStr,
      annualFeeDate: feeDateDefault,
      bonusDeadline: deadlineDefault,
      amountSpent: "",
      notes: "",
    };
  }

  return {
    issuerId: initialValues.issuerId,
    cardName: initialValues.cardName,
    openDate:
      isoToLocalDateString(initialValues.openDate) ||
      initialValues.openDate ||
      "",
    creditLimit: centsToDollars(initialValues.creditLimit),
    annualFee: centsToDollars(initialValues.annualFee),
    annualFeeDate:
      isoToLocalDateString(initialValues.annualFeeDate) ||
      initialValues.annualFeeDate ||
      "",
    ...(initialValues.signUpBonus
      ? { bonusType: initialValues.signUpBonus.type }
      : {}),
    bonusAmount: initialValues.signUpBonus
      ? initialValues.signUpBonus.type === "cashback"
        ? centsToDollars(initialValues.signUpBonus.amount)
        : String(initialValues.signUpBonus.amount)
      : "",
    bonusSpendRequirement: initialValues.signUpBonus
      ? centsToDollars(initialValues.signUpBonus.spendRequirement)
      : "",
    bonusDeadline: initialValues.signUpBonus?.deadline
      ? isoToLocalDateString(initialValues.signUpBonus.deadline) ||
        initialValues.signUpBonus.deadline
      : "",
    amountSpent: centsToDollars(initialValues.amountSpent ?? 0),
    status: initialValues.status,
    notes: initialValues.notes ?? "",
  };
}

// ─── onSubmit helpers ─────────────────────────────────────────────────────────

/** Builds the signUpBonus payload from form data, or null if no bonus type selected. */
function buildSignUpBonus(data: CardFormValues): import("@/lib/types").Card["signUpBonus"] {
  if (!data.bonusType) return null;
  const spendRequirementCents = dollarsToCents(data.bonusSpendRequirement ?? "");
  const amountSpentCents = dollarsToCents(data.amountSpent ?? "");
  const bonusDeadlineIso =
    localDateStringToIso(data.bonusDeadline ?? "") || data.bonusDeadline || "";
  return {
    type: data.bonusType,
    amount:
      data.bonusType === "cashback"
        ? dollarsToCents(data.bonusAmount ?? "")
        : Math.round(parseFloat(data.bonusAmount ?? "") || 0),
    spendRequirement: spendRequirementCents,
    deadline: bonusDeadlineIso,
    met: spendRequirementCents > 0 && amountSpentCents >= spendRequirementCents,
  };
}

/** Increments the card save counter in localStorage and triggers the easter egg at save #7. */
function trackCardSaveCount(triggerBear: () => void): void {
  const SAVE_COUNT_KEY = "fenrir:card-save-count";
  const prevCount = parseInt(localStorage.getItem(SAVE_COUNT_KEY) || "0", 10);
  const newCount = prevCount + 1;
  localStorage.setItem(SAVE_COUNT_KEY, String(newCount));
  if (newCount === 7) triggerBear();
}

/**
 * Builds the full Card object from validated form data.
 * Centralizes all date conversion and null-coalescing so callers stay simple.
 */
function buildCardPayload(
  data: CardFormValues,
  initialValues: Card | undefined,
  householdId: string,
  now: string,
): Card {
  const openDateIso = localDateStringToIso(data.openDate) || data.openDate;
  const annualFeeDateIso =
    localDateStringToIso(data.annualFeeDate ?? "") || data.annualFeeDate || "";
  return {
    id: initialValues?.id ?? generateId(),
    householdId: initialValues?.householdId ?? householdId,
    issuerId: data.issuerId,
    cardName: data.cardName,
    openDate: openDateIso,
    creditLimit: dollarsToCents(data.creditLimit ?? ""),
    annualFee: dollarsToCents(data.annualFee ?? ""),
    annualFeeDate: annualFeeDateIso,
    promoPeriodMonths: 0,
    amountSpent: dollarsToCents(data.amountSpent ?? ""),
    signUpBonus: buildSignUpBonus(data),
    status: (data.status === "closed" ? "closed" : "active") as CardStatus,
    notes: data.notes ?? "",
    createdAt: initialValues?.createdAt ?? now,
    updatedAt: now,
  };
}

/** Shows a milestone toast when the new card count hits a tracked threshold. No-op otherwise. */
function maybeShowMilestoneToast(cardHouseholdId: string): void {
  const activeCards = getCards(cardHouseholdId);
  const milestone = checkMilestone(activeCards.length);
  if (milestone) {
    toast(milestone.message, { duration: 5000, className: "milestone-toast" });
  }
}

// ─── Derived date auto-fill (Step 1 wizard submit with no Step 2 data) ───────

function applyWizardStep1Defaults(data: CardFormValues): void {
  if (!data.openDate) return;

  if (!data.annualFeeDate) {
    const openDateObj = new Date(data.openDate + "T00:00:00");
    const feeDate = new Date(openDateObj);
    feeDate.setFullYear(feeDate.getFullYear() + 1);
    data.annualFeeDate = feeDate.toISOString().split("T")[0] ?? "";
  }

  if (!data.bonusDeadline) {
    const openDateObj = new Date(data.openDate + "T00:00:00");
    const deadline = new Date(openDateObj);
    deadline.setDate(deadline.getDate() + 90);
    data.bonusDeadline = deadline.toISOString().split("T")[0] ?? "";
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseCardFormOptions {
  initialValues?: Card;
  householdId: string;
}

export function useCardForm({ initialValues, householdId }: UseCardFormOptions) {
  const router = useRouter();
  const isEditMode = !!initialValues;

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [direction, setDirection] = useState<1 | -1>(1);

  const { open: bearOpen, trigger: triggerBear, dismiss: dismissBear } =
    useGleipnirFragment4();
  const { tier } = useEntitlement();
  const { status: trialStatus } = useTrialStatus();
  const isTrialActive = trialStatus === "active";

  const defaultValues = buildDefaultValues(initialValues);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CardFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(cardFormSchema as any),
    defaultValues,
    shouldFocusError: false,
  });

  const openDate = watch("openDate");
  const issuerId = watch("issuerId");
  const creditLimit = watch("creditLimit");
  const bonusType = watch("bonusType");
  const bonusSpendRequirement = watch("bonusSpendRequirement");
  const amountSpent = watch("amountSpent");

  // Auto-derive annualFeeDate + bonusDeadline when openDate changes
  const prevOpenDate = useRef<string>(defaultValues.openDate ?? "");
  useEffect(() => {
    if (!openDate || openDate === prevOpenDate.current) return;
    prevOpenDate.current = openDate;

    const base = new Date(openDate + "T00:00:00");
    if (isNaN(base.getTime())) return;

    const feeDate = new Date(base);
    feeDate.setFullYear(feeDate.getFullYear() + 1);
    setValue("annualFeeDate", feeDate.toISOString().split("T")[0] ?? "");

    const deadline = new Date(base);
    deadline.setMonth(deadline.getMonth() + 3);
    setValue("bonusDeadline", deadline.toISOString().split("T")[0] ?? "");
  }, [openDate, setValue]);

  const goToStep = useCallback(
    (target: 1 | 2) => {
      setDirection(target > currentStep ? 1 : -1);
      setCurrentStep(target);
    },
    [currentStep]
  );

  // Team norm: scroll the first invalid field into view on validation failure.
  const scrollToFirstError = (errs: Record<string, unknown>) => {
    const elements = Object.keys(errs)
      .map((key) => document.getElementById(key))
      .filter((el): el is HTMLElement => el !== null)
      .sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1
      );
    if (elements.length > 0) {
      elements[0]!.scrollIntoView({ behavior: "smooth", block: "center" });
      elements[0]!.focus();
    }
  };

  const handleMoreDetails = () => {
    handleSubmit(() => {
      goToStep(2);
    }, scrollToFirstError)();
  };

  const onSubmit = (data: CardFormValues) => {
    setIsSubmitting(true);

    try {
      if (!isEditMode) {
        const existingCards = getCards(householdId);
        const activeCardCount = existingCards.filter(
          (c) => c.status !== "closed" && c.status !== "graduated"
        ).length;
        const limitCheck = canAddCard(tier, activeCardCount, isTrialActive);
        if (!limitCheck.allowed) {
          toast.error(limitCheck.reason || "Unable to add card at this time");
          setIsSubmitting(false);
          return;
        }
      }

      const now = new Date().toISOString();

      if (!isEditMode && currentStep === 1) {
        applyWizardStep1Defaults(data);
      }

      const card = buildCardPayload(data, initialValues, householdId, now);
      card.status = computeCardStatus(card);
      saveCard(card);
      track("card-save", { method: "manual" });
      trackCardSaveCount(triggerBear);

      if (!isEditMode) {
        maybeShowMilestoneToast(card.householdId);
      }

      router.push("/ledger");
    } catch (err) {
      console.error("Failed to save card:", err);
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!initialValues?.id) return;
    deleteCard(householdId, initialValues.id);
    router.push("/ledger");
  };

  const handleClose = (markBonusMet?: boolean) => {
    if (!initialValues?.id) return;
    closeCard(
      householdId,
      initialValues.id,
      markBonusMet ? { markBonusMet: true } : undefined
    );
    router.push("/ledger");
  };

  return {
    // form
    register,
    handleSubmit,
    watch,
    setValue,
    errors,
    defaultValues,
    // watched fields
    openDate,
    issuerId,
    creditLimit,
    bonusType,
    bonusSpendRequirement,
    amountSpent,
    // wizard
    currentStep,
    direction,
    goToStep,
    handleMoreDetails,
    // handlers
    onSubmit,
    handleDelete,
    handleClose,
    scrollToFirstError,
    // dialog state
    deleteDialogOpen,
    setDeleteDialogOpen,
    closeDialogOpen,
    setCloseDialogOpen,
    // misc
    isEditMode,
    isSubmitting,
    // gleipnir
    bearOpen,
    dismissBear,
  };
}
