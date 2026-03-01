/**
 * WebSocket message types for the Fenrir Ledger backend.
 *
 * All messages are JSON-serialized objects with a `type` discriminator field.
 * Client messages flow browser -> backend.
 * Server messages flow backend -> browser.
 */

/** Messages sent from the client to the backend over WebSocket. */
export type ClientMessage =
  | { type: "import_start"; payload: { url: string } }
  | { type: "import_cancel" };

/** Phases the import pipeline passes through, emitted as import_phase events. */
export type ImportPhase = "fetching_sheet" | "extracting" | "validating" | "done";

/** Messages sent from the backend to the client over WebSocket. */
export type ServerMessage =
  | { type: "import_phase"; phase: ImportPhase }
  | { type: "import_progress"; rowsExtracted: number; totalRows: number }
  | { type: "import_complete"; cards: ImportedCard[] }
  | { type: "import_error"; code: ImportErrorCode; message: string };

/** Structured error codes for the import pipeline. */
export type ImportErrorCode =
  | "INVALID_URL"
  | "SHEET_NOT_PUBLIC"
  | "FETCH_ERROR"
  | "ANTHROPIC_ERROR"
  | "PARSE_ERROR"
  | "NO_CARDS_FOUND";

/**
 * A card extracted from a Google Sheet import.
 * Matches the frontend Card type minus householdId (which is assigned client-side).
 */
export interface ImportedCard {
  /** Unique identifier assigned by the backend (crypto.randomUUID). */
  id: string;

  /** Issuer identifier — matches a KNOWN_ISSUERS id or "other". */
  issuerId: string;

  /** Card product name (e.g., "Sapphire Preferred", "Gold Card"). */
  cardName: string;

  /** ISO 8601 date when the card was opened. Empty string if unknown. */
  openDate: string;

  /** Credit limit in cents. 0 if unknown. */
  creditLimit: number;

  /** Annual fee in cents. 0 if no fee or unknown. */
  annualFee: number;

  /** ISO 8601 date when the next annual fee is due. Empty string if unknown. */
  annualFeeDate: string;

  /** Promotional period in months. 0 if none. */
  promoPeriodMonths: number;

  /** Sign-up bonus details, or null if no bonus info. */
  signUpBonus: {
    type: "points" | "miles" | "cashback";
    amount: number;
    spendRequirement: number;
    deadline: string;
    met: boolean;
  } | null;

  /** Additional notes from the spreadsheet. Empty string if none. */
  notes: string;

  /** Card status — always "active" for newly imported cards. */
  status: "active";

  /** ISO 8601 timestamp when this card record was created. */
  createdAt: string;

  /** ISO 8601 timestamp when this card record was last updated. */
  updatedAt: string;
}
