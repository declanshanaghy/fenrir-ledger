"use client";

/**
 * CardForm — shared form for adding and editing credit cards.
 *
 * Used by both /cards/new and /cards/[id]/edit.
 * Uses react-hook-form + Zod for validation.
 * All money values are entered as dollars in the form but stored as cents.
 */

import { useState } from "react";
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

import type { Card, CardStatus } from "@/lib/types";
import { saveCard, deleteCard } from "@/lib/storage";
import { computeCardStatus, dollarsToCents, centsToDollars } from "@/lib/card-utils";
import { KNOWN_ISSUERS, DEFAULT_HOUSEHOLD_ID } from "@/lib/constants";

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
    promoPeriodMonths: z
      .string()
      .optional()
      .transform((v) => v ?? "")
      .refine(
        (v) => v === "" || (!isNaN(parseInt(v)) && parseInt(v) >= 0),
        "Must be a valid number of months"
      ),
    hasSignUpBonus: z.boolean().default(false),
    bonusType: z.enum(["points", "miles", "cashback"]).optional(),
    bonusAmount: z.string().optional().default(""),
    bonusSpendRequirement: z.string().optional().default(""),
    bonusDeadline: z.string().optional().default(""),
    bonusMet: z.boolean().default(false),
    status: z.enum(["active", "fee_approaching", "promo_expiring", "closed"]).optional(),
    notes: z.string().optional().default(""),
  })
  .refine(
    (data) => {
      if (data.hasSignUpBonus) {
        return !!data.bonusType && data.bonusDeadline !== "";
      }
      return true;
    },
    {
      message: "Bonus type and deadline are required when sign-up bonus is enabled",
      path: ["bonusType"],
    }
  );

type CardFormValues = z.infer<typeof cardFormSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

interface CardFormProps {
  /** If provided, the form is in edit mode with these initial values */
  initialValues?: Card;
}

export function CardForm({ initialValues }: CardFormProps) {
  const router = useRouter();
  const isEditMode = !!initialValues;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Map Card → form default values
  const defaultValues: Partial<CardFormValues> = initialValues
    ? {
        issuerId: initialValues.issuerId,
        cardName: initialValues.cardName,
        openDate: initialValues.openDate,
        creditLimit: centsToDollars(initialValues.creditLimit),
        annualFee: centsToDollars(initialValues.annualFee),
        annualFeeDate: initialValues.annualFeeDate ?? "",
        promoPeriodMonths: initialValues.promoPeriodMonths
          ? String(initialValues.promoPeriodMonths)
          : "",
        hasSignUpBonus: !!initialValues.signUpBonus,
        bonusType: initialValues.signUpBonus?.type ?? undefined,
        bonusAmount: initialValues.signUpBonus
          ? centsToDollars(initialValues.signUpBonus.amount)
          : "",
        bonusSpendRequirement: initialValues.signUpBonus
          ? centsToDollars(initialValues.signUpBonus.spendRequirement)
          : "",
        bonusDeadline: initialValues.signUpBonus?.deadline ?? "",
        bonusMet: initialValues.signUpBonus?.met ?? false,
        status: initialValues.status,
        notes: initialValues.notes ?? "",
      }
    : {
        hasSignUpBonus: false,
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
  });

  const hasSignUpBonus = watch("hasSignUpBonus");

  const onSubmit = (data: CardFormValues) => {
    setIsSubmitting(true);

    try {
      const now = new Date().toISOString();

      // Build the Card object
      const card: Card = {
        id: initialValues?.id ?? crypto.randomUUID(),
        householdId: initialValues?.householdId ?? DEFAULT_HOUSEHOLD_ID,
        issuerId: data.issuerId,
        cardName: data.cardName,
        openDate: data.openDate,
        creditLimit: dollarsToCents(data.creditLimit ?? ""),
        annualFee: dollarsToCents(data.annualFee ?? ""),
        annualFeeDate: data.annualFeeDate ?? "",
        promoPeriodMonths: data.promoPeriodMonths
          ? parseInt(data.promoPeriodMonths, 10)
          : 0,
        signUpBonus: data.hasSignUpBonus && data.bonusType
          ? {
              type: data.bonusType,
              amount: dollarsToCents(data.bonusAmount ?? ""),
              spendRequirement: dollarsToCents(data.bonusSpendRequirement ?? ""),
              deadline: data.bonusDeadline ?? "",
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
      router.push("/");
    } catch (err) {
      console.error("Failed to save card:", err);
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!initialValues?.id) return;
    deleteCard(initialValues.id);
    router.push("/");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* ── Basic Info ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Card Details</h2>

        {/* Issuer */}
        <div className="space-y-1.5">
          <Label htmlFor="issuerId">Issuer *</Label>
          <Select
            {...(defaultValues.issuerId !== undefined && { defaultValue: defaultValues.issuerId })}
            onValueChange={(v) => setValue("issuerId", v)}
          >
            <SelectTrigger id="issuerId">
              <SelectValue placeholder="Select issuer" />
            </SelectTrigger>
            <SelectContent>
              {KNOWN_ISSUERS.map((issuer) => (
                <SelectItem key={issuer.id} value={issuer.id}>
                  {issuer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.issuerId && (
            <p className="text-sm text-destructive">{errors.issuerId.message}</p>
          )}
        </div>

        {/* Card name */}
        <div className="space-y-1.5">
          <Label htmlFor="cardName">Card Name *</Label>
          <Input
            id="cardName"
            placeholder="e.g. Sapphire Preferred"
            {...register("cardName")}
          />
          {errors.cardName && (
            <p className="text-sm text-destructive">{errors.cardName.message}</p>
          )}
        </div>

        {/* Open date */}
        <div className="space-y-1.5">
          <Label htmlFor="openDate">Open Date *</Label>
          <Input id="openDate" type="date" {...register("openDate")} />
          {errors.openDate && (
            <p className="text-sm text-destructive">{errors.openDate.message}</p>
          )}
        </div>

        {/* Credit limit */}
        <div className="space-y-1.5">
          <Label htmlFor="creditLimit">Credit Limit ($)</Label>
          <Input
            id="creditLimit"
            type="number"
            min="0"
            step="1"
            placeholder="e.g. 5000"
            {...register("creditLimit")}
          />
          {errors.creditLimit && (
            <p className="text-sm text-destructive">
              {errors.creditLimit.message}
            </p>
          )}
        </div>
      </section>

      {/* ── Annual Fee ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Annual Fee</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Annual fee amount */}
          <div className="space-y-1.5">
            <Label htmlFor="annualFee">Annual Fee Amount ($)</Label>
            <Input
              id="annualFee"
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 95"
              {...register("annualFee")}
            />
            {errors.annualFee && (
              <p className="text-sm text-destructive">
                {errors.annualFee.message}
              </p>
            )}
          </div>

          {/* Annual fee date */}
          <div className="space-y-1.5">
            <Label htmlFor="annualFeeDate">Next Fee Due Date</Label>
            <Input id="annualFeeDate" type="date" {...register("annualFeeDate")} />
          </div>
        </div>

        {/* Promo period */}
        <div className="space-y-1.5">
          <Label htmlFor="promoPeriodMonths">Promo Period (months)</Label>
          <Input
            id="promoPeriodMonths"
            type="number"
            min="0"
            step="1"
            placeholder="e.g. 12"
            {...register("promoPeriodMonths")}
          />
        </div>
      </section>

      {/* ── Sign-Up Bonus ──────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id="hasSignUpBonus"
            checked={hasSignUpBonus}
            onCheckedChange={(checked) =>
              setValue("hasSignUpBonus", checked === true)
            }
          />
          <Label htmlFor="hasSignUpBonus" className="cursor-pointer">
            This card has a sign-up bonus
          </Label>
        </div>

        {hasSignUpBonus && (
          <div className="pl-6 space-y-4 border-l-2 border-muted">
            {/* Bonus type */}
            <div className="space-y-1.5">
              <Label htmlFor="bonusType">Bonus Type *</Label>
              <Select
                {...(defaultValues.bonusType !== undefined && { defaultValue: defaultValues.bonusType })}
                onValueChange={(v) =>
                  setValue(
                    "bonusType",
                    v as "points" | "miles" | "cashback"
                  )
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
              {errors.bonusType && (
                <p className="text-sm text-destructive">
                  {errors.bonusType.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Bonus amount */}
              <div className="space-y-1.5">
                <Label htmlFor="bonusAmount">Bonus Amount</Label>
                <Input
                  id="bonusAmount"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 60000"
                  {...register("bonusAmount")}
                />
              </div>

              {/* Spend requirement */}
              <div className="space-y-1.5">
                <Label htmlFor="bonusSpendRequirement">
                  Spend Requirement ($)
                </Label>
                <Input
                  id="bonusSpendRequirement"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 4000"
                  {...register("bonusSpendRequirement")}
                />
              </div>
            </div>

            {/* Deadline */}
            <div className="space-y-1.5">
              <Label htmlFor="bonusDeadline">Spend Deadline *</Label>
              <Input
                id="bonusDeadline"
                type="date"
                {...register("bonusDeadline")}
              />
            </div>

            {/* Bonus met */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="bonusMet"
                checked={watch("bonusMet")}
                onCheckedChange={(checked) =>
                  setValue("bonusMet", checked === true)
                }
              />
              <Label htmlFor="bonusMet" className="cursor-pointer">
                Spend requirement has been met
              </Label>
            </div>
          </div>
        )}
      </section>

      {/* ── Status (edit mode only) ────────────────────────────── */}
      {isEditMode && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Status</h2>
          <div className="space-y-1.5">
            <Label htmlFor="status">Card Status</Label>
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
            <p className="text-xs text-muted-foreground">
              Status is automatically computed from dates. Set to &quot;Closed&quot; to
              manually mark this card as closed.
            </p>
          </div>
        </section>
      )}

      {/* ── Notes ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Notes</h2>
        <Textarea
          id="notes"
          placeholder="Any notes about this card..."
          rows={3}
          {...register("notes")}
        />
      </section>

      {/* ── Actions ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Saving..."
              : isEditMode
              ? "Save changes"
              : "Add card"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/")}
          >
            Cancel
          </Button>
        </div>

        {/* Delete button — edit mode only */}
        {isEditMode && (
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
                  <strong>{initialValues?.cardName}</strong> from your portfolio.
                  This cannot be undone.
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
      </div>
    </form>
  );
}
