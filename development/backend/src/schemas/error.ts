/**
 * Shared Zod schemas for error responses.
 *
 * Used by OpenAPI route definitions to document structured error payloads.
 */

import { z } from "zod";

/**
 * All known import error codes.
 * Matches the ImportErrorCode type in src/types/messages.ts.
 */
export const ImportErrorCodeSchema = z.enum([
  "INVALID_URL",
  "SHEET_NOT_PUBLIC",
  "FETCH_ERROR",
  "ANTHROPIC_ERROR",
  "PARSE_ERROR",
  "NO_CARDS_FOUND",
]);

/**
 * Structured error response schema.
 * All error responses from the API follow this shape.
 */
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: ImportErrorCodeSchema,
    message: z.string(),
  }),
});
