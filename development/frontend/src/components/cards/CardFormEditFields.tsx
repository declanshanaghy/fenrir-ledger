"use client";

/**
 * CardFormEditFields — all form fields for edit mode (single page, no animation).
 *
 * Edit mode shows Card Details + Annual Fee (with date) + Sign-up Bonus (all fields)
 * + Status + Notes on one page.
 *
 * Issue #1682: extracted from CardForm.tsx to reduce cyclomatic complexity.
 */

import { UseFormRegister, UseFormSetValue, FieldErrors } from "react-hook-form";

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

import { KNOWN_ISSUERS } from "@/lib/constants";
import { getIssuerRune } from "@/lib/issuer-utils";
import type { CardFormValues } from "./useCardForm";

interface CardFormEditFieldsProps {
  register: UseFormRegister<CardFormValues>;
  setValue: UseFormSetValue<CardFormValues>;
  errors: FieldErrors<CardFormValues>;
  issuerId: string | undefined;
  bonusType: string | undefined;
  bonusSpendRequirement: string | undefined;
  bonusMet: boolean;
  defaultStatus?: CardFormValues["status"];
}

export function CardFormEditFields({
  register,
  setValue,
  errors,
  issuerId,
  bonusType,
  bonusSpendRequirement,
  bonusMet,
  defaultStatus,
}: CardFormEditFieldsProps) {
  return (
    <>
      {/* Card Details */}
      <fieldset className="border border-border rounded-md p-4 space-y-4">
        <legend className="text-sm font-bold uppercase tracking-wider px-1.5">
          Card Details
        </legend>

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
                    {rune ? `${rune} ` : ""}
                    {issuer.name}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {errors.issuerId && (
            <p className="text-base text-destructive">
              {errors.issuerId.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cardName">Card name *</Label>
          <Input
            id="cardName"
            placeholder="e.g. Sapphire Preferred"
            aria-required="true"
            {...register("cardName")}
          />
          {errors.cardName && (
            <p className="text-base text-destructive">
              {errors.cardName.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="openDate">Date opened *</Label>
          <Input
            id="openDate"
            type="date"
            aria-required="true"
            {...register("openDate")}
          />
          {errors.openDate && (
            <p className="text-base text-destructive">
              {errors.openDate.message}
            </p>
          )}
        </div>
      </fieldset>

      {/* Annual Fee + Sign-up Bonus */}
      <div className="flex flex-col md:grid md:grid-cols-2 gap-4">
        <fieldset className="border border-border rounded-md p-4 space-y-4">
          <legend className="text-sm font-bold uppercase tracking-wider px-1.5">
            Annual Fee
          </legend>
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
            <Input
              id="annualFeeDate"
              type="date"
              {...register("annualFeeDate")}
            />
          </div>
        </fieldset>

        <fieldset className="border border-border rounded-md p-4 space-y-4">
          <legend className="text-sm font-bold uppercase tracking-wider px-1.5">
            Sign-up Bonus
          </legend>

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
              checked={bonusMet}
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
        <legend className="text-sm font-bold uppercase tracking-wider px-1.5">
          Status
        </legend>
        <div className="space-y-1.5">
          <Label htmlFor="status">Card status</Label>
          <Select
            {...(defaultStatus !== undefined && { defaultValue: defaultStatus })}
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
        <legend className="text-sm font-bold uppercase tracking-wider px-1.5">
          Notes
        </legend>
        <Textarea
          id="notes"
          placeholder="Any notes about this card..."
          rows={3}
          {...register("notes")}
        />
      </fieldset>
    </>
  );
}
