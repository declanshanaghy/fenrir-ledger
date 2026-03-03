# Backlog: Import Support for XLS, XLSX, and TSV Files

## Problem Statement

Path C ("Deliver a Rune-Stone") currently accepts only `.csv` files. Users who track cards in Excel (`.xls`/`.xlsx`) or export tab-separated data (`.tsv`) must manually convert to CSV before importing. This adds friction for exactly the power users we want — churners with established spreadsheets who shouldn't need to know what CSV means.

## Desired Outcome

The CsvUpload component (Path C) accepts `.xls`, `.xlsx`, and `.tsv` files in addition to `.csv`. All formats converge on the same LLM extraction pipeline — the user experience after file selection is identical regardless of format.

## Formats

| Format | Extension | Type | Parsing Approach |
|--------|-----------|------|------------------|
| TSV | `.tsv` | Text (tab-separated) | Trivial — read as UTF-8 text, pass directly to LLM (already handles tab separators) |
| XLSX | `.xlsx` | Binary (ZIP+XML) | Send as base64 to API route, pass to Anthropic API as document attachment |
| XLS | `.xls` | Binary (BIFF) | Send as base64 to API route, pass to Anthropic API as document attachment |

## Implementation Notes

### TSV (low effort)
- Add `.tsv` to the `accept` attribute on the file input
- Add `.tsv` to the extension validation in `processFile()`
- No other changes needed — the rest of the pipeline treats the text as opaque content for LLM extraction

### XLS/XLSX (medium effort — two approaches)

#### Preferred: Send binary to LLM directly (no new dependencies)
Claude's API supports document/file inputs. Instead of converting to CSV client-side, send the binary file to the API route and let Claude read it natively:

1. **CsvUpload.tsx**: Read `.xls`/`.xlsx` files as base64 (`FileReader.readAsDataURL`)
2. **useSheetImport.ts**: Add a new `submitFile(base64, filename)` method alongside `submitCsv`
3. **API route**: Accept `{ file: "<base64>", filename: "cards.xlsx" }` as a third body variant
4. **extract-cards.ts**: When given a file, send it to the Anthropic API as a `document` content block (base64 source) instead of embedding CSV text in the prompt
5. No new npm dependencies — Claude handles the binary parsing

Benefits: zero client-side dependencies, Claude understands spreadsheet structure (headers, formatting, cell types) better than a CSV conversion would preserve.

#### Fallback: Client-side conversion with SheetJS
If the LLM document approach has issues (file size limits, extraction quality):
- Install `xlsx` (SheetJS Community Edition) — ~500KB client-side
- Convert to CSV in `processFile()` before submission
- No hook/API/pipeline changes needed

### Format-Aware LLM Prompt
The LLM extraction prompt (`extract-cards.ts`) must be told what file format it's receiving so it can parse appropriately. The UI should propagate the chosen format through the full pipeline:

1. **CsvUpload.tsx**: Detect the file extension at selection/drop time
2. **useSheetImport.ts**: Include `format: "csv" | "tsv" | "xls" | "xlsx"` in the submission payload
3. **API route**: Pass `format` through to the extraction function
4. **extract-cards.ts**: Include the format in the system/user prompt so Claude knows whether it's reading CSV text, TSV text, or a binary spreadsheet document attachment — e.g. "The user has uploaded an .xlsx spreadsheet. Extract credit card data from it."

This ensures Claude doesn't have to guess the format from content alone, which improves extraction reliability especially for edge cases (TSV with commas in fields, multi-sheet workbooks, etc.).

### Shared
- Update the CsvUpload UI copy — currently says "Deliver a Rune-Stone" with CSV-specific instructions
- Update the file input `accept` attribute: `.csv,.tsv,.xls,.xlsx`
- Update the drop zone text to mention supported formats
- Update the 1 MB size limit — XLS/XLSX files can be larger than CSV equivalents; consider 5 MB for binary formats
- Update the loading step copy for non-CSV formats (currently says "Reading the inscriptions from your rune-stone...")
- Remove the existing "Excel files are not supported" error messages in CsvUpload.tsx

### What does NOT change
- Preview, dedup, and confirm steps — unchanged
- Google Sheets URL import (Path A) — unchanged
- Google Drive Picker import (Path B) — unchanged

## Acceptance Criteria

- [ ] `.tsv` files can be dropped or selected and import successfully
- [ ] `.xlsx` files can be dropped or selected and import successfully
- [ ] `.xls` files can be dropped or selected and import successfully
- [ ] Error messages for unsupported formats still appear (e.g., `.numbers`, `.pdf`)
- [ ] The "Excel files are not supported" error is removed
- [ ] Existing `.csv` import path is unaffected (regression test)
- [ ] File size limit accommodates binary formats (suggest 5 MB)
- [ ] Multi-sheet workbooks: Claude extracts from all visible sheets (or first sheet with a note)

## Priority

Medium — unblocks Excel users, low risk.

## Dependencies

- Preferred approach: none (Anthropic API document support)
- Fallback approach: `xlsx` npm package (SheetJS Community Edition, Apache-2.0 license)
