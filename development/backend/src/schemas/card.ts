/**
 * Shared Zod schemas for credit card data.
 *
 * Used by both the HTTP import route and WebSocket import handler.
 * Canonical source of truth for card validation.
 *
 * @see src/routes/import.ts
 * @see src/ws/handlers/import.ts
 */

import { z } from "zod";

/**
 * Zod schema for sign-up bonus details attached to a card.
 */
export const SignUpBonusSchema = z.object({
  type: z.enum(["points", "miles", "cashback"]),
  amount: z.number(),
  spendRequirement: z.number().int().min(0),
  deadline: z.string(),
  met: z.boolean(),
});

/**
 * Zod schema for a single extracted card.
 * Ported from the frontend route: development/frontend/src/app/api/sheets/import/route.ts
 */
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

/**
 * Zod schema for an array of extracted cards.
 */
export const CardsArraySchema = z.array(CardSchema);

/**
 * Zod schema for a fully hydrated imported card (with id, status, timestamps).
 */
export const ImportedCardSchema = CardSchema.extend({
  id: z.string().uuid(),
  status: z.literal("active"),
  createdAt: z.string(),
  updatedAt: z.string(),
});
