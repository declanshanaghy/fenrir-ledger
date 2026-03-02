import type { Card } from "@/lib/types";

export type SheetImportErrorCode =
  | "INVALID_URL"
  | "INVALID_CSV"
  | "SHEET_NOT_PUBLIC"
  | "NO_CARDS_FOUND"
  | "PARSE_ERROR"
  | "ANTHROPIC_ERROR"
  | "FETCH_ERROR";

export interface SheetImportError {
  code: SheetImportErrorCode;
  message: string;
}

export interface SheetImportSuccess {
  cards: Array<Omit<Card, "householdId">>;
  warning?: string;
  sensitiveDataWarning?: boolean;
}

export type SheetImportResponse = SheetImportSuccess | { error: SheetImportError };
