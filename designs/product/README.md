# Designs / Product

Product-level design artifacts for Fenrir Ledger. For the active backlog, see GitHub Issues on the project board.

## Index

### Backlog Items

| File | Status | Priority | Summary |
|------|--------|----------|---------|
| [backlog/backend-websocket-investigation.md](backlog/backend-websocket-investigation.md) | **Done** (Sprint 5) | — | WebSocket/backend architecture investigation; resolved, no standalone backend deployed |
| [backlog/bank-glyphs-norse-issuer-logos.md](backlog/bank-glyphs-norse-issuer-logos.md) | **Shipped** (PR #237) | P2-High | Norse-themed inline SVG issuer logos for all 10 known issuers + fallback |
| [backlog/claude-terminal-skin.md](backlog/claude-terminal-skin.md) | Pending | P3-Low | Claude Code terminal skin with Norse statusline, splash screen, and color palette |
| [backlog/idp-testing-alternative.md](backlog/idp-testing-alternative.md) | Pending | P2-Medium | Evaluate Clerk as alternative IDP for testing and production; GA prerequisite |
| [backlog/import-workflow-v2.md](backlog/import-workflow-v2.md) | **Shipped** (Sprint 5) | P1 | Three-path import workflow (Share URL, Google Picker, CSV Upload) with safety guardrails and LLM prompt hardening |
| [backlog/import-xls-xlsx-tsv-formats.md](backlog/import-xls-xlsx-tsv-formats.md) | Pending | P2-Medium | Extend CSV upload (Path C) to accept .xls, .xlsx, and .tsv files |
| [backlog/marketing-campaign-plan.md](backlog/marketing-campaign-plan.md) | Pending | P2-High | SEO and organic marketing campaign targeting credit card churning community |
| [backlog/norse-oral-culture-copy-fix.md](backlog/norse-oral-culture-copy-fix.md) | Pending | P3-Medium | Replace scroll/parchment metaphors with Norse-accurate rune/carving terminology in import wizard copy |
| [backlog/security-review-google-sheets-api.md](backlog/security-review-google-sheets-api.md) | Partially Done | P1-High | Security review of Google API integrations; initial reports filed, checklist items remain open |

## Notes

- Shipped items are kept for historical context and traceability to implementation decisions.
- Active work is tracked on the GitHub project board. These markdown files capture the original brief and acceptance criteria.
- For UX wireframes and interaction specs, see [`designs/ux-design/`](../ux-design/).
- For architecture decision records, see [`designs/architecture/`](../architecture/).
