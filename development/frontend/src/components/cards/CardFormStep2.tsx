"use client";

/**
 * CardFormStep2 — wizard step 2 fields:
 *   Credit Limit + Annual Fee (amount + date) + Bonus Deadline + Notes
 *
 * Issue #1682: extracted from CardForm.tsx to reduce cyclomatic complexity.
 * Issue #1745: Annual fee amount moved here from Step 1.
 */

import { UseFormRegister, UseFormSetValue, FieldErrors } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { CardFormValues } from "./useCardForm";

interface CardFormStep2Props {
  register: UseFormRegister<CardFormValues>;
  setValue: UseFormSetValue<CardFormValues>;
  errors: FieldErrors<CardFormValues>;
  creditLimit: string | undefined;
}

export function CardFormStep2({
  register,
  setValue,
  errors,
  creditLimit,
}: CardFormStep2Props) {
  return (
    <div className="space-y-4">
      {/* Credit Limit */}
      <fieldset className="border border-border rounded-md p-4 space-y-4">
        <legend className="text-sm font-bold uppercase tracking-wider px-1.5">
          Card Details
        </legend>
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
              {Array.from({ length: 10 }, (_, i) => (i + 1) * 1000).map(
                (v) => (
                  <SelectItem key={v} value={String(v)}>
                    ${v.toLocaleString()}
                  </SelectItem>
                )
              )}
              {Array.from({ length: 18 }, (_, i) => 15000 + i * 5000).map(
                (v) => (
                  <SelectItem key={v} value={String(v)}>
                    ${v.toLocaleString()}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
          {errors.creditLimit && (
            <p className="text-base text-destructive">
              {errors.creditLimit.message}
            </p>
          )}
        </div>
      </fieldset>

      {/* Annual Fee Date + Bonus Deadline */}
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
              className="min-h-[44px]"
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
              className="min-h-[44px]"
              {...register("annualFeeDate")}
            />
          </div>
        </fieldset>

        <fieldset className="border border-border rounded-md p-4 space-y-4">
          <legend className="text-sm font-bold uppercase tracking-wider px-1.5">
            Sign-up Bonus
          </legend>
          <div className="space-y-1.5">
            <Label htmlFor="bonusDeadline">Bonus deadline</Label>
            <Input
              id="bonusDeadline"
              type="date"
              className="min-h-[44px]"
              {...register("bonusDeadline")}
            />
          </div>
        </fieldset>
      </div>

      {/* Notes */}
      <fieldset className="border border-border rounded-md p-4 space-y-4">
        <legend className="text-sm font-bold uppercase tracking-wider px-1.5">
          Notes
        </legend>
        <Textarea
          id="notes"
          placeholder="Any notes about this card..."
          rows={3}
          className="min-h-[44px]"
          {...register("notes")}
        />
      </fieldset>
    </div>
  );
}
