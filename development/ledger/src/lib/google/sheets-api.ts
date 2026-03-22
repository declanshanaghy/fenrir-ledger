/**
 * Google Sheets API v4 Client — Fenrir Ledger
 *
 * Thin client that fetches sheet values via the Sheets API and converts
 * the JSON response to RFC 4180 CSV text.
 *
 * Used by Path B ("Browse the Archives") after the user selects a
 * spreadsheet from the Google Picker.
 */

// ── Error Types ─────────────────────────────────────────────────────────────

export type SheetsApiErrorCode =
  | "TOKEN_EXPIRED"
  | "ACCESS_DENIED"
  | "NOT_FOUND"
  | "NETWORK_ERROR"
  | "EMPTY_SHEET";

export class SheetsApiError extends Error {
  readonly code: SheetsApiErrorCode;

  constructor(code: SheetsApiErrorCode, message: string) {
    super(message);
    this.name = "SheetsApiError";
    this.code = code;
  }
}

// ── CSV Conversion ──────────────────────────────────────────────────────────

/**
 * Escapes a cell value for RFC 4180 CSV.
 * Wraps in double quotes if the value contains commas, newlines, or quotes.
 * Internal double quotes are escaped by doubling them.
 */
function escapeCell(value: string): string {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Converts a 2D string array (Sheets API response) to RFC 4180 CSV text.
 */
function valuesToCsv(values: string[][]): string {
  return values.map((row) => row.map(escapeCell).join(",")).join("\n");
}

// ── Public API ──────────────────────────────────────────────────────────────

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

/**
 * Fetches a Google Sheet's content via the Sheets API v4 and converts it to CSV.
 *
 * @param sheetId - The Google Sheets file ID (from Picker)
 * @param accessToken - OAuth2 access token with spreadsheets.readonly scope
 * @returns CSV text string
 * @throws SheetsApiError on failure
 */
export async function fetchSheetAsCSV(
  sheetId: string,
  accessToken: string
): Promise<string> {
  const url = `${SHEETS_API_BASE}/${encodeURIComponent(sheetId)}/values/A:ZZ?majorDimension=ROWS`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    throw new SheetsApiError(
      "NETWORK_ERROR",
      "Couldn't reach Google. Check your connection."
    );
  }

  if (!response.ok) {
    switch (response.status) {
      case 401:
        throw new SheetsApiError(
          "TOKEN_EXPIRED",
          "Your Google Drive access has expired. Please re-authorize."
        );
      case 403:
        throw new SheetsApiError(
          "ACCESS_DENIED",
          "You don't have access to this spreadsheet. Check your sharing settings."
        );
      case 404:
        throw new SheetsApiError(
          "NOT_FOUND",
          "Spreadsheet not found. It may have been deleted or moved."
        );
      default:
        throw new SheetsApiError(
          "NETWORK_ERROR",
          `Google Sheets API error (${response.status}). Please try again.`
        );
    }
  }

  const data = (await response.json()) as { values?: string[][] };

  if (!data.values || data.values.length === 0) {
    throw new SheetsApiError(
      "EMPTY_SHEET",
      "This spreadsheet appears to be empty. No data to import."
    );
  }

  return valuesToCsv(data.values);
}
