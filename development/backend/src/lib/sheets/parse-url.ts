/**
 * Google Sheets URL parsing utilities.
 *
 * Ported from the frontend: development/frontend/src/lib/sheets/parse-url.ts
 * These are pure functions with no framework dependencies.
 */

/**
 * Extracts the Google Sheets spreadsheet ID from a URL.
 *
 * Handles URLs like:
 *   https://docs.google.com/spreadsheets/d/SHEET_ID/edit
 *   https://docs.google.com/spreadsheets/d/SHEET_ID/edit#gid=0
 *   https://docs.google.com/spreadsheets/d/SHEET_ID
 *
 * @param url - Full Google Sheets URL
 * @returns The spreadsheet ID, or null if the URL is not a valid Google Sheets link
 */
export function extractSheetId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("google.com")) return null;
    const match = parsed.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Builds the CSV export URL for a Google Sheet.
 *
 * @param sheetId - The spreadsheet ID extracted from extractSheetId()
 * @returns The direct CSV export URL
 */
export function buildCsvExportUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
}
