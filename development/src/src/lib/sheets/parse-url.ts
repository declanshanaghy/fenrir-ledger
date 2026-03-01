/**
 * Extracts the Google Sheets spreadsheet ID from a URL.
 * Handles URLs like:
 *   https://docs.google.com/spreadsheets/d/SHEET_ID/edit
 *   https://docs.google.com/spreadsheets/d/SHEET_ID/edit#gid=0
 *   https://docs.google.com/spreadsheets/d/SHEET_ID
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

export function buildCsvExportUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
}
