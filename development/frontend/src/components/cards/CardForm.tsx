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

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

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
    status: z.enum(["active", "fee_approaching", "promo_expiring", "closed", "bonus_open", "overdue"]).optional(),
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
  const { open: bearOpen, trigger: triggerBear, dismiss: dismissBear } = useGleipnirFragment4();

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
      setCurrentStep(2);
    }, scrollToFirstError)();
  };

  const onSubmit = (data: CardFormValues) => {
    setIsSubmitting(true);

    try {
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
      }


      router.push("/");
    } catch (err) {
      console.error("Failed to save card:", err);
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!initialValues?.id) return;
    // deleteCard now takes (householdId, cardId) — use the prop householdId
    deleteCard(householdId, initialValues.id);
    router.push("/");
  };

  /**
   * Closes the card — marks it status: "closed" with a closedAt timestamp.
   * The card moves to Valhalla and disappears from the active dashboard.
   * The record is preserved; it is NOT deleted.
   */
  const handleClose = () => {
    if (!initialValues?.id) return;
    closeCard(householdId, initialValues.id);
    router.push("/");
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
      {/* Step Indicator - only show in wizard mode (new card) */}
      {!isEditMode && (
        <div className="flex items-center justify-center gap-3 py-4">
          <div
            className={`w-2 h-2 rounded-full transition-colors ${
              currentStep === 1 ? 'bg-gold' : 'bg-muted-foreground'
            }`}
            aria-label="Step 1"
          />
          <div
            className={`w-2 h-2 rounded-full transition-colors ${
              currentStep === 2 ? 'bg-gold' : 'bg-muted-foreground'
            }`}
            aria-label="Step 2"
          />
        </div>
      )}

      {/* ── Step 1 or Edit Mode: Card Details ───────────────────────────── */}
      {(isEditMode || currentStep === 1) && (
        <fieldset className="border border-border rounded-md p-4 space-y-4">
          <legend className="text-sm font-bold uppercase tracking-wider px-1.5">Card Details</legend>

        {/* Issuer */}
        <div className="space-y-1.5">
          <Label htmlFor="issuerId">Issuer *</Label>
          <Select
            {...(defaultValues.issuerId !== undefined && { defaultValue: defaultValues.issuerId })}
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

        {/* Credit limit - only show in Step 2 or edit mode */}
        {(isEditMode || currentStep === 2) && (
          <div className="space-y-1.5">
            <Label htmlFor="creditLimit">Credit limit</Label>
            <Select
              {...(defaultValues.creditLimit ? { defaultValue: defaultValues.creditLimit } : {})}
              onValueChange={(v) => setValue("creditLimit", v)}
            >
              <SelectTrigger id="creditLimit">
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
        )}
        </fieldset>
      )}

      {/* ── Step 1/2 or Edit Mode: Annual Fee + Sign-up Bonus ─────────── */}
      {(isEditMode || currentStep === 1 || currentStep === 2) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Annual Fee */}
          <fieldset className="border border-border rounded-md p-4 space-y-4">
            <legend className="text-sm font-bold uppercase tracking-wider px-1.5">Annual Fee</legend>

            {/* Annual fee amount - only show in Step 1 or edit mode */}
            {(isEditMode || currentStep === 1) && (
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
            )}

            {/* Annual fee date - only show in Step 2 or edit mode */}
            {(isEditMode || currentStep === 2) && (
              <div className="space-y-1.5">
                <Label htmlFor="annualFeeDate">Annual fee date</Label>
                <Input id="annualFeeDate" type="date" {...register("annualFeeDate")} />
              </div>
            )}
          </fieldset>

          {/* Sign-up Bonus */}
          <fieldset className="border border-border rounded-md p-4 space-y-4">
            <legend className="text-sm font-bold uppercase tracking-wider px-1.5">Sign-up Bonus</legend>

          {/* Bonus type, amount, spend - only show in Step 1 or edit mode */}
          {(isEditMode || currentStep === 1) && (
          <>
          <div className="space-y-1.5">
            <Label htmlFor="bonusType">Bonus type</Label>
            <Select
              {...(defaultValues.bonusType !== undefined && { defaultValue: defaultValues.bonusType })}
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
              {...(defaultValues.bonusSpendRequirement
                ? { defaultValue: defaultValues.bonusSpendRequirement }
                : {})}
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
          </>
          )}

          {/* Bonus deadline and met - only show in Step 2 or edit mode */}
          {(isEditMode || currentStep === 2) && (
            <>
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
            </>
          )}
        </fieldset>

        </div>
      )}

      {/* ── Status (edit mode only) ────────────────────────────── */}
      {isEditMode && (
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
      )}

      {/* ── Notes (Step 2 or edit mode only) ─────────────────────────────────── */}
      {(isEditMode || currentStep === 2) && (
        <fieldset className="border border-border rounded-md p-4 space-y-4">
          <legend className="text-sm font-bold uppercase tracking-wider px-1.5">Notes</legend>
          <Textarea
            id="notes"
            placeholder="Any notes about this card..."
            rows={3}
            {...register("notes")}
          />
        </fieldset>
      )}

      {/* ── Actions ───────────────────────────────────────────── */}
      {/*
       * Button layout convention (design system):
       * Left  — destructive actions (Close Card, Delete) — edit mode only
       * Right — [Cancel] [Primary action] — always right-aligned
       * This matches the global form button rule: positive action far right,
       * Cancel immediately to its left, destructive actions isolated on left.
       */}
      <div className="flex items-center pt-2">
        {/* Left slot — destructive actions (edit mode only) */}
        <div className="flex gap-2">

        {/* Close Card + Delete buttons — edit mode only */}
        {isEditMode && initialValues?.status !== "closed" && (
          <div className="flex gap-2">
            {/* Close Card — sends card to Valhalla, record preserved */}
            <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  Close Card
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Close this card?</DialogTitle>
                  <DialogDescription>
                    <strong>{initialValues?.cardName}</strong> will be moved to
                    Closed Cards. Its record and rewards will be preserved.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setCloseDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button variant="default" onClick={handleClose}>
                    Close Card
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete card — hard delete, record gone forever */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="destructive" size="sm">
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
              <Button type="button" variant="destructive" size="sm">
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

        {/* Right slot — Cancel + primary action, always right-aligned */}
        <div className="flex gap-3 ml-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/")}
          >
            Cancel
          </Button>

          {/* Step 1 buttons in wizard mode */}
          {!isEditMode && currentStep === 1 && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleMoreDetails}
              >
                More Details
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                isLoading={isSubmitting}
                loadingText="Saving..."
              >
                Save Card
              </Button>
            </>
          )}

          {/* Step 2 or edit mode button */}
          {(isEditMode || currentStep === 2) && (
            <Button
              type="submit"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              loadingText="Saving..."
            >
              {isEditMode ? "Save changes" : "Save Card"}
            </Button>
          )}
        </div>
      </div>
    </form>
    <GleipnirBearSinews open={bearOpen} onClose={dismissBear} />
    </>
  );
}
