/**
 * Zod schemas for validating LLM JSON output.
 *
 * Ported from development/backend/src/schemas/card.ts
 * without the .openapi() extensions.
 *
 * ImportResponseSchema validates the new wrapped format:
 * { cards: [...], sensitiveDataWarning: boolean }
 *
 * Field constraints are intentionally strict to reduce the blast radius of
 * any prompt injection that escapes the structural delimiter defense:
 * - String fields have max-length caps
 * - Numeric fields have upper bounds reflecting real-world credit card limits
 * - Date strings are validated against the ISO 8601 UTC pattern
 */

import { z } from "zod";

/**
 * ISO 8601 UTC timestamp pattern: YYYY-MM-DDTHH:MM:SS.sssZ
 * Accepts either empty string (unknown date) or a valid UTC timestamp.
 */
const ISO_DATE_OR_EMPTY = z
  .string()
  .refine(
    (val) => val === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(val),
    { message: "Must be an ISO 8601 UTC timestamp (YYYY-MM-DDTHH:MM:SS.sssZ) or empty string" },
  );

export const SignUpBonusSchema = z.object({
  type: z.enum(["points", "miles", "cashback"]),
  /** Reward amount: points, miles, or cashback in cents. Cap at 10,000,000. */
  amount: z.number().int().min(0).max(10_000_000),
  /** Minimum spend in cents. Cap at $10,000,000 (1,000,000,000 cents). */
  spendRequirement: z.number().int().min(0).max(1_000_000_000),
  deadline: ISO_DATE_OR_EMPTY,
  met: z.boolean(),
});

export const CardSchema = z.object({
  /** Known issuer ID or "other". Max 50 chars to prevent oversized strings. */
  issuerId: z.string().max(50),
  /** Card product name. Max 200 chars. */
  cardName: z.string().max(200),
  openDate: ISO_DATE_OR_EMPTY,
  /** Credit limit in cents. Cap at $1,000,000 (100,000,000 cents). */
  creditLimit: z.number().int().min(0).max(100_000_000),
  /** Annual fee in cents. Cap at $10,000 (1,000,000 cents). */
  annualFee: z.number().int().min(0).max(1_000_000),
  annualFeeDate: ISO_DATE_OR_EMPTY,
  /** Promo period in months. Cap at 120 months (10 years). */
  promoPeriodMonths: z.number().int().min(0).max(120),
  signUpBonus: SignUpBonusSchema.nullable(),
  /** Free-form notes. Max 1000 chars to limit injection payload size. */
  notes: z.string().max(1000),
});

export const CardsArraySchema = z.array(CardSchema);

/** Wrapped response format: { cards: [...], sensitiveDataWarning: boolean } */
export const ImportResponseSchema = z.object({
  cards: CardsArraySchema,
  sensitiveDataWarning: z.boolean(),
});
