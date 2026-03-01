/**
 * Anthropic prompt builder for credit card data extraction.
 *
 * Ported from the frontend: development/src/src/lib/sheets/prompt.ts
 * The KNOWN_ISSUERS array is inlined here because the backend does not
 * have access to @/lib/constants.
 */

/** Maximum CSV length before truncation. */
export const CSV_TRUNCATION_LIMIT = 100_000;

/**
 * Known card issuers — inlined from the frontend constants.ts.
 * Keep in sync with development/src/src/lib/constants.ts KNOWN_ISSUERS.
 */
const KNOWN_ISSUERS = [
  { id: "amex", name: "American Express" },
  { id: "bank_of_america", name: "Bank of America" },
  { id: "barclays", name: "Barclays" },
  { id: "capital_one", name: "Capital One" },
  { id: "chase", name: "Chase" },
  { id: "citibank", name: "Citibank" },
  { id: "discover", name: "Discover" },
  { id: "hsbc", name: "HSBC" },
  { id: "us_bank", name: "US Bank" },
  { id: "wells_fargo", name: "Wells Fargo" },
  { id: "other", name: "Other" },
] as const;

/**
 * Builds the extraction prompt for the Anthropic Claude Haiku model.
 *
 * The prompt instructs the model to parse CSV data from a credit card
 * spreadsheet and return a JSON array of card objects with specific fields.
 *
 * @param csv - Raw CSV text from a Google Sheets export
 * @returns The full prompt string to send to the Anthropic API
 */
export function buildExtractionPrompt(csv: string): string {
  const issuerList = KNOWN_ISSUERS.map((i) => `${i.id}: ${i.name}`).join(", ");

  return `You are a data extraction assistant. Parse the following CSV data from a credit card spreadsheet and extract card information.

Return ONLY a valid JSON array of objects. No markdown, no explanation, just the JSON array.

Each object must have these exact fields:
- issuerId: string — match to one of these known issuers: ${issuerList}. Use "other" if no match.
- cardName: string — the card product name (e.g., "Sapphire Preferred", "Gold Card")
- openDate: string — ISO 8601 date when the card was opened (e.g., "2024-01-15T00:00:00.000Z"). Use "" if unknown.
- creditLimit: number — credit limit in cents (multiply dollars by 100). Use 0 if unknown.
- annualFee: number — annual fee in cents (multiply dollars by 100). Use 0 if no fee or unknown.
- annualFeeDate: string — ISO 8601 date when the next annual fee is due. Use "" if unknown or no fee.
- promoPeriodMonths: number — promotional period in months. Use 0 if none.
- signUpBonus: object or null — if sign-up bonus info exists: { type: "points"|"miles"|"cashback", amount: number, spendRequirement: number (in cents), deadline: string (ISO 8601), met: boolean }. Use null if no bonus info.
- notes: string — any additional notes or info from the spreadsheet. Use "" if none.

Important:
- All money values must be in CENTS (integer). If the CSV shows "$95", that's 9500 cents.
- Dates must be full ISO 8601 UTC timestamps ending in "T00:00:00.000Z"
- If a row clearly isn't a credit card (headers, totals, notes), skip it.
- Return an empty array [] if no cards can be extracted.

CSV data:
${csv}`;
}
