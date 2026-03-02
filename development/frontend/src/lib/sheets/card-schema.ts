/**
 * Zod schemas for validating LLM JSON output.
 *
 * Ported from development/backend/src/schemas/card.ts
 * without the .openapi() extensions.
 *
 * ImportResponseSchema validates the new wrapped format:
 * { cards: [...], sensitiveDataWarning: boolean }
 */

import { z } from "zod";

export const SignUpBonusSchema = z.object({
  type: z.enum(["points", "miles", "cashback"]),
  amount: z.number(),
  spendRequirement: z.number().int().min(0),
  deadline: z.string(),
  met: z.boolean(),
});

export const CardSchema = z.object({
  issuerId: z.string(),
  cardName: z.string(),
  openDate: z.string(),
  creditLimit: z.number().int().min(0),
  annualFee: z.number().int().min(0),
  annualFeeDate: z.string(),
  promoPeriodMonths: z.number().int().min(0),
  signUpBonus: SignUpBonusSchema.nullable(),
  notes: z.string(),
});

export const CardsArraySchema = z.array(CardSchema);

/** Wrapped response format: { cards: [...], sensitiveDataWarning: boolean } */
export const ImportResponseSchema = z.object({
  cards: CardsArraySchema,
  sensitiveDataWarning: z.boolean(),
});
