# Fenrir Ledger — Import Wizard Copywriting

## Norse Terminology Reference

The Import Wizard uses Norse-accurate terminology consistent with the Saga Ledger aesthetic.
The Norse were primarily an oral culture — written communication relied on runes carved into
wood, stone, or metal. Scroll and parchment metaphors are historically inaccurate and must
not be used.

### Terminology Mapping

| Context | Correct Copy | Deprecated (do not use) |
|---|---|---|
| URL import method card title | "Share a Rune Tablet" | ~~"Share a Scroll"~~ |
| URL import dialog heading | "Share a Rune Tablet" | ~~"Share a Scroll"~~ |
| Picker loading text | "Reading the rune-stones from your archives..." | ~~"Fetching the sacred scrolls from your archives..."~~ |
| Picker error fallback copy | "Try using Share a Rune Tablet or Upload CSV instead." | ~~"Try using Share a Scroll or Upload CSV instead."~~ |
| Generic written records | "tablet", "carving", "inscription", "rune-stone" | ~~"scroll"~~, ~~"parchment"~~ |
| Sacred/reverent records | "sacred inscriptions", "carved records" | ~~"sacred scrolls"~~ |

### Method Card Copy

#### Path A — URL Import
- **Title:** Share a Rune Tablet
- **Subtitle:** Google Sheets URL
- **Description:** Paste a link to a publicly shared spreadsheet.

#### Path B — Google Drive Picker
- **Title:** Browse the Archives
- **Subtitle:** Google Drive Picker
- **Description:** Select a spreadsheet from your Drive.

#### Path C — CSV Upload
- **Title:** Deliver a Rune-Stone
- **Subtitle:** CSV File Upload
- **Description:** Upload a CSV file exported from any spreadsheet.

### Loading States

| Import path | Loading copy |
|---|---|
| Google Picker | "Reading the rune-stones from your archives..." |
| CSV upload | "Reading the inscriptions from your rune-stone..." |
| URL (default) | "Reading the runes from your spreadsheet..." |

### Success State

> The runes have been inscribed in the ledger. Your cards have been added to the household.
