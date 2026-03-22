/**
 * Extracts the Google Sheets spreadsheet ID from a URL.
 * Handles URLs like:
 *   https://docs.google.com/spreadsheets/d/SHEET_ID/edit
 *   https://docs.google.com/spreadsheets/d/SHEET_ID/edit#gid=0
 *   https://docs.google.com/spreadsheets/d/SHEET_ID
 */

import { log } from "@/lib/logger";

export function extractSheetId(url: string): string | null {
  log.debug("extractSheetId called", { url });
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("google.com")) {
      log.debug("extractSheetId returning", { sheetId: null, reason: "not google.com" });
      return null;
    }
    const match = parsed.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    const sheetId = match?.[1] ?? null;
    log.debug("extractSheetId returning", { sheetId });
    return sheetId;
  } catch {
    log.debug("extractSheetId returning", { sheetId: null, reason: "invalid URL" });
    return null;
  }
}

export function buildCsvExportUrl(sheetId: string): string {
  log.debug("buildCsvExportUrl called", { sheetId });
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  log.debug("buildCsvExportUrl returning", { csvUrl });
  return csvUrl;
}
