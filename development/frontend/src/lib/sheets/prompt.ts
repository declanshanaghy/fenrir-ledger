import { KNOWN_ISSUERS } from "@/lib/constants";

const CSV_TRUNCATION_LIMIT = 100_000;

export { CSV_TRUNCATION_LIMIT };

export function buildExtractionPrompt(csv: string): string {
  const issuerList = KNOWN_ISSUERS.map(i => `${i.id}: ${i.name}`).join(", ");

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
