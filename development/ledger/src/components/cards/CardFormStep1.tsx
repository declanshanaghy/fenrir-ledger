"use client";

/**
 * CardFormStep1 — wizard step 1 fields:
 *   Card Details (issuer, name, open date) + Sign-up Bonus (full width)
 *
 * Issue #1682: extracted from CardForm.tsx to reduce cyclomatic complexity.
 * Issue #1745: removed Annual Fee (moved to Step 2), added amountSpent,
 *   replaced bonusMet checkbox with computed read-only indicator,
 *   Sign-up Bonus section now full width.
 */

import { UseFormRegister, UseFormSetValue, FieldErrors } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { KNOWN_ISSUERS } from "@/lib/constants";
import { IssuerLogo } from "@/components/shared/IssuerLogo";
import type { CardFormValues } from "./useCardForm";

interface CardFormStep1Props {
  register: UseFormRegister<CardFormValues>;
  setValue: UseFormSetValue<CardFormValues>;
  errors: FieldErrors<CardFormValues>;
  issuerId: string | undefined;
  bonusType: string | undefined;
  bonusSpendRequirement: string | undefined;
  amountSpent: string | undefined;
}

export function CardFormStep1({
  register,
  setValue,
  errors,
  issuerId,
  bonusType,
  bonusSpendRequirement,
  amountSpent,
}: CardFormStep1Props) {
  const spendReqNum = bonusSpendRequirement ? parseFloat(bonusSpendRequirement) : 0;
  const amountSpentNum = amountSpent ? parseFloat(amountSpent) : 0;
  const minimumSpendMet = spendReqNum > 0 && amountSpentNum >= spendReqNum;

  return (
    <div className="space-y-4">
      {/* Card Details */}
      <fieldset className="border border-border rounded-md p-4 space-y-4">
        <legend className="text-sm font-bold uppercase tracking-wider px-1.5">
          Card Details
        </legend>

        {/* Issuer */}
        <div className="space-y-1.5">
          <Label htmlFor="issuerId">Issuer *</Label>
          <Select
            value={issuerId ?? ""}
            onValueChange={(v) => setValue("issuerId", v)}
          >
            <SelectTrigger
              id="issuerId"
              aria-required="true"
              className="min-h-[44px]"
            >
              <SelectValue placeholder="Select issuer" />
            </SelectTrigger>
            <SelectContent>
              {KNOWN_ISSUERS.map((issuer) => (
                <SelectItem key={issuer.id} value={issuer.id}>
                  <IssuerLogo issuerId={issuer.id} showLabel />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.issuerId && (
            <p className="text-base text-destructive">
              {errors.issuerId.message}
            </p>
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
            <p className="text-base text-destructive">
              {errors.cardName.message}
            </p>
          )}
        </div>

        {/* Open date */}
        <div className="space-y-1.5">
          <Label htmlFor="openDate">Date opened *</Label>
          <Input
            id="openDate"
            type="date"
            aria-required="true"
            className="min-h-[44px]"
            {...register("openDate")}
          />
          {errors.openDate && (
            <p className="text-base text-destructive">
              {errors.openDate.message}
            </p>
          )}
        </div>
      </fieldset>

      {/* Sign-up Bonus — full width */}
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
            <SelectTrigger id="bonusType" className="min-h-[44px]">
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
            className="min-h-[44px]"
            {...register("bonusAmount")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bonusSpendRequirement">Minimum spend</Label>
          <Select
            value={bonusSpendRequirement ?? ""}
            onValueChange={(v) => setValue("bonusSpendRequirement", v)}
          >
            <SelectTrigger id="bonusSpendRequirement" className="min-h-[44px]">
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
          <Label htmlFor="amountSpent">Amount spent</Label>
          <Input
            id="amountSpent"
            type="number"
            min="0"
            step="1"
            placeholder="e.g. 1500"
            className="min-h-[44px]"
            {...register("amountSpent")}
          />
          {errors.amountSpent && (
            <p className="text-base text-destructive">
              {errors.amountSpent.message}
            </p>
          )}
        </div>

        {/* Computed read-only indicator */}
        {spendReqNum > 0 && (
          <p
            aria-live="polite"
            className={`text-sm font-medium ${
              minimumSpendMet
                ? "text-green-600 dark:text-green-400"
                : "text-muted-foreground"
            }`}
          >
            {minimumSpendMet
              ? "✓ Minimum spend met"
              : "Minimum spend not yet met"}
          </p>
        )}
      </fieldset>
    </div>
  );
}
