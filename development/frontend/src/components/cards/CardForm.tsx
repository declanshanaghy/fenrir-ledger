"use client";

/**
 * CardForm — shared form for adding and editing credit cards.
 *
 * Used by both /cards/new and /cards/[id]/edit.
 * Uses react-hook-form + Zod for validation.
 * All money values are entered as dollars in the form but stored as cents.
 *
 * Sprint 3.1: householdId is now a required prop derived from the authenticated
 * session. The form no longer uses the hardcoded DEFAULT_HOUSEHOLD_ID constant.
 *
 * Issue #188: Refactored into 2-step wizard for new cards.
 * Edit mode bypasses wizard and shows all fields on single page.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { toast } from "sonner";

import type { Card, CardStatus } from "@/lib/types";
import { saveCard, deleteCard, closeCard, getCards } from "@/lib/storage";
import { checkMilestone } from "@/lib/milestone-utils";
import { LS_TRIAL_START_TOAST_SHOWN, computeFingerprint } from "@/lib/trial-utils";
import { clearTrialStatusCache } from "@/hooks/useTrialStatus";
import { ensureFreshToken } from "@/lib/auth/refresh-session";
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
import { KNOWN_ISSUERS } from "@/lib/constants";
import { getIssuerRune } from "@/lib/issuer-utils";
import { GleipnirBearSinews, useGleipnirFragment4 } from "@/components/cards/GleipnirBearSinews";
import { track } from "@/lib/analytics/track";

// ─── Zod validation schema ────────────────────────────────────────────────────

const cardFormSchema = z
  .object({
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
    bonusMet: z.boolean().default(false),
    status: z.enum(["active", "fee_approaching", "promo_expiring", "closed", "bonus_open", "overdue", "graduated"]).optional(),
    notes: z.string().optional().default(""),
  });

type CardFormValues = z.infer<typeof cardFormSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

interface CardFormProps {
  /** If provided, the form is in edit mode with these initial values */
  initialValues?: Card;
  /**
   * The authenticated user's household ID (Google sub claim).
   * Required for all storage operations — must be derived from the session
   * by the parent page and passed down.
   */
  householdId: string;
}

export function CardForm({ initialValues, householdId }: CardFormProps) {
  const router = useRouter();
  const isEditMode = !!initialValues;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  /** Direction: 1 = forward (step 1 → 2), -1 = backward (step 2 → 1) */
  const [direction, setDirection] = useState<1 | -1>(1);
  const prefersReducedMotion = useReducedMotion();
  const { open: bearOpen, trigger: triggerBear, dismiss: dismissBear } = useGleipnirFragment4();
  const { tier } = useEntitlement();
  const { status: trialStatus } = useTrialStatus();
  const isTrialActive = trialStatus === "active";

  // Step transition animation variants (directional slide)
  const STEP_TRANSITION_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
  const stepVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? "100%" : "-100%",
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir < 0 ? "30%" : "-30%",
      opacity: 0,
    }),
  };
  const stepTransition = prefersReducedMotion
    ? { duration: 0 }
    : {
        x: { duration: 0.25, ease: STEP_TRANSITION_EASE },
        opacity: { duration: 0.2 },
      };

  /** Navigate to a specific step, tracking direction for animation */
  const goToStep = useCallback((target: 1 | 2) => {
    setDirection(target > currentStep ? 1 : -1);
    setCurrentStep(target);
  }, [currentStep]);

  // Precompute today + derived defaults (used for new cards)
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

  // Map Card → form default values.
  // Date fields stored as UTC ISO are converted to local YYYY-MM-DD for
  // <input type="date"> display via isoToLocalDateString().
  const defaultValues: Partial<CardFormValues> = initialValues
    ? {
        issuerId: initialValues.issuerId,
        cardName: initialValues.cardName,
        openDate: isoToLocalDateString(initialValues.openDate) || initialValues.openDate || "",
        creditLimit: centsToDollars(initialValues.creditLimit),
        annualFee: centsToDollars(initialValues.annualFee),
        annualFeeDate: isoToLocalDateString(initialValues.annualFeeDate) || initialValues.annualFeeDate || "",
        ...(initialValues.signUpBonus ? { bonusType: initialValues.signUpBonus.type } : {}),
        bonusAmount: initialValues.signUpBonus
          ? centsToDollars(initialValues.signUpBonus.amount)
          : "",
        bonusSpendRequirement: initialValues.signUpBonus
          ? centsToDollars(initialValues.signUpBonus.spendRequirement)
          : "",
        bonusDeadline: initialValues.signUpBonus?.deadline
          ? (isoToLocalDateString(initialValues.signUpBonus.deadline) || initialValues.signUpBonus.deadline)
          : "",
        bonusMet: initialValues.signUpBonus?.met ?? false,
        status: initialValues.status,
        notes: initialValues.notes ?? "",
      }
    : {
        openDate: todayStr,
        annualFeeDate: feeDateDefault,
        bonusDeadline: deadlineDefault,
        bonusMet: false,
        notes: "",
      };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CardFormValues>({
    resolver: zodResolver(cardFormSchema),
    defaultValues,
    shouldFocusError: false, // We handle scroll+focus manually via scrollToFirstError
  });

  const openDate = watch("openDate");
  const issuerId = watch("issuerId");
  const creditLimit = watch("creditLimit");
  const bonusType = watch("bonusType");
  const bonusSpendRequirement = watch("bonusSpendRequirement");

  // When openDate changes (user edits it), auto-derive annualFeeDate and bonusDeadline.
  // Skip on initial render so stored values aren't clobbered in edit mode.
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

  // Handler for "More Details" button - validates Step 1 fields and advances to Step 2
  const handleMoreDetails = () => {
    handleSubmit(() => {
      goToStep(2);
    }, scrollToFirstError)();
  };

  const onSubmit = (data: CardFormValues) => {
    setIsSubmitting(true);

    try {
      // Check card limit for new cards (issue #643)
      if (!isEditMode) {
        const existingCards = getCards(householdId);
        const activeCardCount = existingCards.filter(c => c.status !== "closed" && c.status !== "graduated").length;
        const limitCheck = canAddCard(tier, activeCardCount, isTrialActive);

        if (!limitCheck.allowed) {
          toast.error(limitCheck.reason || "Unable to add card at this time");
          setIsSubmitting(false);
          return;
        }
      }

      const now = new Date().toISOString();

      // Auto-calculate derived fields when saving from Step 1 (wizard mode only)
      if (!isEditMode && currentStep === 1) {
        // Annual Fee Date = Open Date + 1 year
        if (!data.annualFeeDate && data.openDate) {
          const openDateObj = new Date(data.openDate + "T00:00:00");
          const feeDate = new Date(openDateObj);
          feeDate.setFullYear(feeDate.getFullYear() + 1);
          data.annualFeeDate = feeDate.toISOString().split("T")[0] ?? "";
        }

        // Bonus Deadline = Open Date + 90 days (standard signup bonus window)
        if (!data.bonusDeadline && data.openDate) {
          const openDateObj = new Date(data.openDate + "T00:00:00");
          const deadline = new Date(openDateObj);
          deadline.setDate(deadline.getDate() + 90);
          data.bonusDeadline = deadline.toISOString().split("T")[0] ?? "";
        }

        // Bonus Met defaults to false (already handled by default values)
      }

      // Convert local YYYY-MM-DD strings from date pickers to UTC ISO strings.
      // localDateStringToIso() treats the picker value as a local-timezone date
      // and converts to a full UTC ISO 8601 timestamp.
      const openDateIso = localDateStringToIso(data.openDate) || data.openDate;
      const annualFeeDateIso = localDateStringToIso(data.annualFeeDate ?? "") || data.annualFeeDate || "";
      const bonusDeadlineIso = localDateStringToIso(data.bonusDeadline ?? "") || data.bonusDeadline || "";

      // Build the Card object. householdId comes from the authenticated session
      // (passed as a prop), not from a hardcoded constant.
      const card: Card = {
        id: initialValues?.id ?? generateId(),
        householdId: initialValues?.householdId ?? householdId,
        issuerId: data.issuerId,
        cardName: data.cardName,
        openDate: openDateIso,
        creditLimit: dollarsToCents(data.creditLimit ?? ""),
        annualFee: dollarsToCents(data.annualFee ?? ""),
        annualFeeDate: annualFeeDateIso,
        promoPeriodMonths: 0,
        signUpBonus: data.bonusType
          ? {
              type: data.bonusType,
              amount: dollarsToCents(data.bonusAmount ?? ""),
              spendRequirement: dollarsToCents(data.bonusSpendRequirement ?? ""),
              deadline: bonusDeadlineIso,
              met: data.bonusMet ?? false,
            }
          : null,
        // Initial status — will be recomputed below via computeCardStatus
        // Set "closed" first so computeCardStatus can short-circuit on it
        status: (data.status === "closed" ? "closed" : "active") as CardStatus,
        notes: data.notes ?? "",
        createdAt: initialValues?.createdAt ?? now,
        updatedAt: now,
      };

      // Recompute status from dates (preserves "closed" if explicitly set)
      card.status = computeCardStatus(card);

      saveCard(card);
      track("card-save", { method: "manual" });

      // Gleipnir Fragment 4 — Bear Sinews: triggers on the 7th card save
      const SAVE_COUNT_KEY = "fenrir:card-save-count";
      const prevCount = parseInt(localStorage.getItem(SAVE_COUNT_KEY) || "0", 10);
      const newCount = prevCount + 1;
      localStorage.setItem(SAVE_COUNT_KEY, String(newCount));
      if (newCount === 7) {
        triggerBear();
      }

      // Milestone toast — only on new card creation (not edit)
      if (!isEditMode) {
        const activeCards = getCards(card.householdId);
        const milestone = checkMilestone(activeCards.length);
        if (milestone) {
          toast(milestone.message, {
            duration: 5000,
            className: "milestone-toast",
          });
        }

        // Trial start toast — fires once on first card creation (Issue #621)
        const toastShown = localStorage.getItem(LS_TRIAL_START_TOAST_SHOWN);
        if (!toastShown) {
          localStorage.setItem(LS_TRIAL_START_TOAST_SHOWN, "true");

          // Initialize trial via API (idempotent — safe to call multiple times)
          void (async () => {
            try {
              const token = await ensureFreshToken();
              const fingerprint = await computeFingerprint();
              if (token && fingerprint) {
                await fetch("/api/trial/init", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ fingerprint }),
                });
                // Clear trial status cache so badge picks up new state
                clearTrialStatusCache();
              }
            } catch {
              // Trial init is best-effort — don't block card creation
            }
          })();

          toast("Your 30-day trial has begun — explore all features", {
            duration: 8000,
          });
        }
      }


      router.push("/ledger");
    } catch (err) {
      console.error("Failed to save card:", err);
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!initialValues?.id) return;
    // deleteCard now takes (householdId, cardId) — use the prop householdId
    deleteCard(householdId, initialValues.id);
    router.push("/ledger");
  };

  /**
   * Closes the card — marks it status: "closed" with a closedAt timestamp.
   * The card moves to Valhalla and disappears from the active dashboard.
   * The record is preserved; it is NOT deleted.
   *
   * @param markBonusMet - if true, sets signUpBonus.met = true before closing
   */
  const handleClose = (markBonusMet?: boolean) => {
    if (!initialValues?.id) return;
    closeCard(householdId, initialValues.id, markBonusMet ? { markBonusMet: true } : undefined);
    router.push("/ledger");
  };

  // Team norm: on validation failure, scroll the first invalid field into view.
  // Each form field must have an id matching its react-hook-form field name.
  // See memory/team-norms.md for the full pattern.
  const scrollToFirstError = (errs: Record<string, unknown>) => {
    const elements = Object.keys(errs)
      .map((key) => document.getElementById(key))
      .filter((el): el is HTMLElement => el !== null)
      .sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      );
    if (elements.length > 0) {
      elements[0]!.scrollIntoView({ behavior: "smooth", block: "center" });
      elements[0]!.focus();
    }
  };

  return (
    <>
    <form onSubmit={handleSubmit(onSubmit, scrollToFirstError)} className="space-y-4">
      {/* Step Indicator — accessible tablist with animated dots */}
      {!isEditMode && (
        <nav role="tablist" aria-label="Card creation progress">
          <div className="flex items-center justify-center gap-4 py-4">
            {([
              { step: 1 as const, title: "Card and Bonus Details" },
              { step: 2 as const, title: "Additional Information" },
            ]).map(({ step, title }) => {
              const isActive = currentStep === step;
              return (
                <button
                  key={step}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Step ${step} of 2: ${title}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => {
                    if (step === 2 && currentStep === 1) {
                      handleMoreDetails();
                    } else if (step === 1 && currentStep === 2) {
                      goToStep(1);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight" && step === 1) {
                      e.preventDefault();
                      handleMoreDetails();
                    } else if (e.key === "ArrowLeft" && step === 2) {
                      e.preventDefault();
                      goToStep(1);
                    }
                  }}
                  className="relative w-11 h-11 flex items-center justify-center cursor-pointer focus:outline-none group"
                >
                  <motion.div
                    className={`w-2.5 h-2.5 rounded-full border-2 ${
                      isActive
                        ? "bg-gold border-gold"
                        : "bg-transparent border-muted-foreground"
                    }`}
                    animate={{
                      scale: isActive ? [1, 0.9, 1.2, 1] : 1,
                    }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0 }
                        : {
                            scale: {
                              duration: 0.3,
                              ease: STEP_TRANSITION_EASE,
                              times: [0, 0.3, 0.6, 1],
                            },
                          }
                    }
                  />
                  <span className="absolute inset-0 rounded-full group-focus-visible:ring-2 group-focus-visible:ring-gold/40 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background" />
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* ── Wizard mode: animated step content ────────────────────────── */}
      {!isEditMode && (
        <div className="overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            {currentStep === 1 && (
              <motion.div
                key="wizard-step-1"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={stepTransition}
                className="space-y-4"
              >
                {/* Card Details */}
                <fieldset className="border border-border rounded-md p-4 space-y-4">
                  <legend className="text-sm font-bold uppercase tracking-wider px-1.5">Card Details</legend>

                  {/* Issuer */}
                  <div className="space-y-1.5">
                    <Label htmlFor="issuerId">Issuer *</Label>
                    <Select
                      value={issuerId ?? ""}
                      onValueChange={(v) => setValue("issuerId", v)}
                    >
                      <SelectTrigger id="issuerId" aria-required="true" className="min-h-[44px]">
                        <SelectValue placeholder="Select issuer" />
                      </SelectTrigger>
                      <SelectContent>
                        {KNOWN_ISSUERS.map((issuer) => {
                          const rune = getIssuerRune(issuer.id);
                          return (
                            <SelectItem key={issuer.id} value={issuer.id}>
                              {rune ? `${rune} ` : ""}{issuer.name}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {errors.issuerId && (
                      <p className="text-base text-destructive">{errors.issuerId.message}</p>
                    )}
                  </div>

                  {/* Card name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="cardName">Card name *</Label>
                    <Input
                      id="cardName"
                      placeholder="e.g. Sapphire Preferred"
                      aria-required="true"
                      className="min-h-[44px]"
                      {...register("cardName")}
                    />
                    {errors.cardName && (
                      <p className="text-base text-destructive">{errors.cardName.message}</p>
                    )}
                  </div>

                  {/* Open date */}
                  <div className="space-y-1.5">
                    <Label htmlFor="openDate">Date opened *</Label>
                    <Input id="openDate" type="date" aria-required="true" className="min-h-[44px]" {...register("openDate")} />
                    {errors.openDate && (
                      <p className="text-base text-destructive">{errors.openDate.message}</p>
                    )}
                  </div>
                </fieldset>

                {/* Annual Fee + Sign-up Bonus (Step 1) */}
                <div className="flex flex-col md:grid md:grid-cols-2 gap-4">
                  <fieldset className="border border-border rounded-md p-4 space-y-4">
                    <legend className="text-sm font-bold uppercase tracking-wider px-1.5">Annual Fee</legend>
                    <div className="space-y-1.5">
                      <Label htmlFor="annualFee">Annual fee</Label>
                      <Input
                        id="annualFee"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g. 95"
                        className="min-h-[44px]"
                        {...register("annualFee")}
                      />
                      {errors.annualFee && (
                        <p className="text-base text-destructive">
                          {errors.annualFee.message}
                        </p>
                      )}
                    </div>
                  </fieldset>

                  <fieldset className="border border-border rounded-md p-4 space-y-4">
                    <legend className="text-sm font-bold uppercase tracking-wider px-1.5">Sign-up Bonus</legend>

                    <div className="space-y-1.5">
                      <Label htmlFor="bonusType">Bonus type</Label>
                      <Select
                        value={bonusType ?? ""}
                        onValueChange={(v) =>
                          setValue("bonusType", v as "points" | "miles" | "cashback")
                        }
                      >
                        <SelectTrigger id="bonusType">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="points">Points</SelectItem>
                          <SelectItem value="miles">Miles</SelectItem>
                          <SelectItem value="cashback">Cashback ($)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="bonusAmount">Bonus amount</Label>
                      <Input
                        id="bonusAmount"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g. 60000"
                        {...register("bonusAmount")}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="bonusSpendRequirement">Minimum spend</Label>
                      <Select
                        value={bonusSpendRequirement ?? ""}
                        onValueChange={(v) => setValue("bonusSpendRequirement", v)}
                      >
                        <SelectTrigger id="bonusSpendRequirement">
                          <SelectValue placeholder="Select amount" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="100">$100</SelectItem>
                          <SelectItem value="500">$500</SelectItem>
                          <SelectItem value="1000">$1,000</SelectItem>
                          <SelectItem value="2000">$2,000</SelectItem>
                          <SelectItem value="3000">$3,000</SelectItem>
                          <SelectItem value="4000">$4,000</SelectItem>
                          <SelectItem value="5000">$5,000</SelectItem>
                          <SelectItem value="6000">$6,000</SelectItem>
                          <SelectItem value="7000">$7,000</SelectItem>
                          <SelectItem value="8000">$8,000</SelectItem>
                          <SelectItem value="9000">$9,000</SelectItem>
                          <SelectItem value="10000">$10,000</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </fieldset>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="wizard-step-2"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={stepTransition}
                className="space-y-4"
              >
                {/* Credit Limit */}
                <fieldset className="border border-border rounded-md p-4 space-y-4">
                  <legend className="text-sm font-bold uppercase tracking-wider px-1.5">Card Details</legend>
                  <div className="space-y-1.5">
                    <Label htmlFor="creditLimit">Credit limit</Label>
                    <Select
                      value={creditLimit ?? ""}
                      onValueChange={(v) => setValue("creditLimit", v)}
                    >
                      <SelectTrigger id="creditLimit" className="min-h-[44px]">
                        <SelectValue placeholder="Select limit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Not set</SelectItem>
                        {Array.from({ length: 10 }, (_, i) => (i + 1) * 1000).map((v) => (
                          <SelectItem key={v} value={String(v)}>${v.toLocaleString()}</SelectItem>
                        ))}
                        {Array.from({ length: 18 }, (_, i) => 15000 + i * 5000).map((v) => (
                          <SelectItem key={v} value={String(v)}>${v.toLocaleString()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.creditLimit && (
                      <p className="text-base text-destructive">
                        {errors.creditLimit.message}
                      </p>
                    )}
                  </div>
                </fieldset>

                {/* Annual Fee Date + Bonus Deadline / Met */}
                <div className="flex flex-col md:grid md:grid-cols-2 gap-4">
                  <fieldset className="border border-border rounded-md p-4 space-y-4">
                    <legend className="text-sm font-bold uppercase tracking-wider px-1.5">Annual Fee</legend>
                    <div className="space-y-1.5">
                      <Label htmlFor="annualFeeDate">Annual fee date</Label>
                      <Input id="annualFeeDate" type="date" className="min-h-[44px]" {...register("annualFeeDate")} />
                    </div>
                  </fieldset>

                  <fieldset className="border border-border rounded-md p-4 space-y-4">
                    <legend className="text-sm font-bold uppercase tracking-wider px-1.5">Sign-up Bonus</legend>
                    <div className="space-y-1.5">
                      <Label htmlFor="bonusDeadline">Bonus deadline</Label>
                      <Input
                        id="bonusDeadline"
                        type="date"
                        className="min-h-[44px]"
                        {...register("bonusDeadline")}
                      />
                    </div>
                    <div className="flex items-center gap-2 min-h-[44px]">
                      <Checkbox
                        id="bonusMet"
                        checked={watch("bonusMet")}
                        onCheckedChange={(checked) =>
                          setValue("bonusMet", checked === true)
                        }
                      />
                      <Label htmlFor="bonusMet" className="cursor-pointer">
                        Minimum spend met
                      </Label>
                    </div>
                  </fieldset>
                </div>

                {/* Notes */}
                <fieldset className="border border-border rounded-md p-4 space-y-4">
                  <legend className="text-sm font-bold uppercase tracking-wider px-1.5">Notes</legend>
                  <Textarea
                    id="notes"
                    placeholder="Any notes about this card..."
                    rows={3}
                    className="min-h-[44px]"
                    {...register("notes")}
                  />
                </fieldset>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Edit mode: all fields on one page (no animation) ─────────── */}
      {isEditMode && (
        <>
          <fieldset className="border border-border rounded-md p-4 space-y-4">
            <legend className="text-sm font-bold uppercase tracking-wider px-1.5">Card Details</legend>

            {/* Issuer */}
            <div className="space-y-1.5">
              <Label htmlFor="issuerId">Issuer *</Label>
              <Select
                value={issuerId ?? ""}
                onValueChange={(v) => setValue("issuerId", v)}
              >
                <SelectTrigger id="issuerId" aria-required="true">
                  <SelectValue placeholder="Select issuer" />
                </SelectTrigger>
                <SelectContent>
                  {KNOWN_ISSUERS.map((issuer) => {
                    const rune = getIssuerRune(issuer.id);
                    return (
                      <SelectItem key={issuer.id} value={issuer.id}>
                        {rune ? `${rune} ` : ""}{issuer.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {errors.issuerId && (
                <p className="text-base text-destructive">{errors.issuerId.message}</p>
              )}
            </div>

            {/* Card name */}
            <div className="space-y-1.5">
              <Label htmlFor="cardName">Card name *</Label>
              <Input
                id="cardName"
                placeholder="e.g. Sapphire Preferred"
                aria-required="true"
                {...register("cardName")}
              />
              {errors.cardName && (
                <p className="text-base text-destructive">{errors.cardName.message}</p>
              )}
            </div>

            {/* Open date */}
            <div className="space-y-1.5">
              <Label htmlFor="openDate">Date opened *</Label>
              <Input id="openDate" type="date" aria-required="true" {...register("openDate")} />
              {errors.openDate && (
                <p className="text-base text-destructive">{errors.openDate.message}</p>
              )}
            </div>
          </fieldset>

          {/* Annual Fee + Sign-up Bonus */}
          <div className="flex flex-col md:grid md:grid-cols-2 gap-4">
            <fieldset className="border border-border rounded-md p-4 space-y-4">
              <legend className="text-sm font-bold uppercase tracking-wider px-1.5">Annual Fee</legend>
              <div className="space-y-1.5">
                <Label htmlFor="annualFee">Annual fee</Label>
                <Input
                  id="annualFee"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 95"
                  {...register("annualFee")}
                />
                {errors.annualFee && (
                  <p className="text-base text-destructive">
                    {errors.annualFee.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="annualFeeDate">Annual fee date</Label>
                <Input id="annualFeeDate" type="date" {...register("annualFeeDate")} />
              </div>
            </fieldset>

            <fieldset className="border border-border rounded-md p-4 space-y-4">
              <legend className="text-sm font-bold uppercase tracking-wider px-1.5">Sign-up Bonus</legend>
              <div className="space-y-1.5">
                <Label htmlFor="bonusType">Bonus type</Label>
                <Select
                  value={bonusType ?? ""}
                  onValueChange={(v) =>
                    setValue("bonusType", v as "points" | "miles" | "cashback")
                  }
                >
                  <SelectTrigger id="bonusType">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="points">Points</SelectItem>
                    <SelectItem value="miles">Miles</SelectItem>
                    <SelectItem value="cashback">Cashback ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bonusAmount">Bonus amount</Label>
                <Input
                  id="bonusAmount"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 60000"
                  {...register("bonusAmount")}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bonusSpendRequirement">Minimum spend</Label>
                <Select
                  value={bonusSpendRequirement ?? ""}
                  onValueChange={(v) => setValue("bonusSpendRequirement", v)}
                >
                  <SelectTrigger id="bonusSpendRequirement">
                    <SelectValue placeholder="Select amount" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100">$100</SelectItem>
                    <SelectItem value="500">$500</SelectItem>
                    <SelectItem value="1000">$1,000</SelectItem>
                    <SelectItem value="2000">$2,000</SelectItem>
                    <SelectItem value="3000">$3,000</SelectItem>
                    <SelectItem value="4000">$4,000</SelectItem>
                    <SelectItem value="5000">$5,000</SelectItem>
                    <SelectItem value="6000">$6,000</SelectItem>
                    <SelectItem value="7000">$7,000</SelectItem>
                    <SelectItem value="8000">$8,000</SelectItem>
                    <SelectItem value="9000">$9,000</SelectItem>
                    <SelectItem value="10000">$10,000</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bonusDeadline">Bonus deadline</Label>
                <Input
                  id="bonusDeadline"
                  type="date"
                  {...register("bonusDeadline")}
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="bonusMet"
                  checked={watch("bonusMet")}
                  onCheckedChange={(checked) =>
                    setValue("bonusMet", checked === true)
                  }
                />
                <Label htmlFor="bonusMet" className="cursor-pointer">
                  Minimum spend met
                </Label>
              </div>
            </fieldset>
          </div>

          {/* Status */}
          <fieldset className="border border-border rounded-md p-4 space-y-4">
            <legend className="text-sm font-bold uppercase tracking-wider px-1.5">Status</legend>
            <div className="space-y-1.5">
              <Label htmlFor="status">Card status</Label>
              <Select
                {...(defaultValues.status !== undefined && { defaultValue: defaultValues.status })}
                onValueChange={(v) =>
                  setValue(
                    "status",
                    v as "active" | "fee_approaching" | "promo_expiring" | "closed"
                  )
                }
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Status is computed automatically" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="fee_approaching">Fee Approaching</SelectItem>
                  <SelectItem value="promo_expiring">Promo Expiring</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Status is automatically computed from dates. Set to &quot;Closed&quot; to
                manually mark this card as closed.
              </p>
            </div>
          </fieldset>

          {/* Notes */}
          <fieldset className="border border-border rounded-md p-4 space-y-4">
            <legend className="text-sm font-bold uppercase tracking-wider px-1.5">Notes</legend>
            <Textarea
              id="notes"
              placeholder="Any notes about this card..."
              rows={3}
              {...register("notes")}
            />
          </fieldset>
        </>
      )}

      {/* ── Actions ───────────────────────────────────────────── */}
      {/*
       * Button layout convention (design system):
       * Left  — destructive actions (Close Card, Delete) — edit mode only
       * Right — [Cancel] [Primary action] — always right-aligned
       * This matches the global form button rule: positive action far right,
       * Cancel immediately to its left, destructive actions isolated on left.
       *
       * Mobile (375px): buttons stack vertically via flex-col / md:flex-row.
       */}
      <div className="flex flex-col gap-3 pt-2 md:flex-row md:items-center">
        {/* Left slot — destructive actions (edit mode only) */}
        <div className="flex gap-2">

        {/* Close Card + Delete buttons — edit mode only */}
        {isEditMode && initialValues?.status !== "closed" && (
          <div className="flex gap-2">
            {/* Close Card — sends card to Valhalla, record preserved */}
            <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="min-h-[44px]">
                  Close Card
                </Button>
              </DialogTrigger>
              <DialogContent>
                {/* If card has an unmet sign-up bonus, prompt about minimum spend */}
                {initialValues?.signUpBonus && !initialValues.signUpBonus.met ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Has the minimum spend been met?</DialogTitle>
                      <DialogDescription>
                        <strong>{initialValues?.cardName}</strong> has a sign-up bonus
                        that hasn&apos;t been marked as met. Has the minimum spend
                        requirement been met?
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        variant="outline"
                        onClick={() => setCloseDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="default"
                        onClick={() => handleClose(false)}
                      >
                        No, close card
                      </Button>
                      <Button
                        variant="default"
                        onClick={() => handleClose(true)}
                      >
                        Yes, mark as met
                      </Button>
                    </DialogFooter>
                  </>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle>Close this card?</DialogTitle>
                      <DialogDescription>
                        <strong>{initialValues?.cardName}</strong> will be moved to
                        Valhalla. Its record and rewards will be preserved.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setCloseDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button variant="default" onClick={() => handleClose()}>
                        Close Card
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>

            {/* Delete card — hard delete, record gone forever */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="destructive" size="sm" className="min-h-[44px]">
                  Delete card
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete this card?</DialogTitle>
                  <DialogDescription>
                    This will permanently remove{" "}
                    <strong>{initialValues?.cardName}</strong> from your
                    portfolio. This cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleDelete}>
                    Delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* Delete-only button for already-closed cards */}
        {isEditMode && initialValues?.status === "closed" && (
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="destructive" size="sm" className="min-h-[44px]">
                Delete card
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete this card?</DialogTitle>
                <DialogDescription>
                  This will permanently remove{" "}
                  <strong>{initialValues?.cardName}</strong> from your
                  portfolio. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        </div>{/* /left slot */}

        {/* Right slot — Cancel + primary action */}
        <div className="flex flex-col gap-2 md:flex-row md:gap-3 md:ml-auto">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            onClick={() => router.push("/ledger")}
          >
            Cancel
          </Button>

          {/* Step 1 buttons in wizard mode */}
          {!isEditMode && currentStep === 1 && (
            <>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                onClick={handleMoreDetails}
              >
                More Details
              </Button>
              <Button
                type="submit"
                className="min-h-[44px]"
                disabled={isSubmitting}
                isLoading={isSubmitting}
                loadingText="Saving..."
              >
                Save Card
              </Button>
            </>
          )}

          {/* Step 2 buttons in wizard mode */}
          {!isEditMode && currentStep === 2 && (
            <>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => goToStep(1)}
              >
                Back
              </Button>
              <Button
                type="submit"
                className="min-h-[44px]"
                disabled={isSubmitting}
                isLoading={isSubmitting}
                loadingText="Saving..."
              >
                Save Card
              </Button>
            </>
          )}

          {/* Edit mode button */}
          {isEditMode && (
            <Button
              type="submit"
              className="min-h-[44px]"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              loadingText="Saving..."
            >
              Save changes
            </Button>
          )}
        </div>
      </div>
    </form>
    <GleipnirBearSinews open={bearOpen} onClose={dismissBear} />
    </>
  );
}
