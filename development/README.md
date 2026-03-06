# Development — FiremanDecko's Forge

This directory contains implementation artifacts for the Fenrir Ledger project: the ordered task breakdown, QA handoff notes, deploy scripts, and the Next.js source tree.

---

## Implementation Docs

- [README.md](README.md) — This file. Index of all development artifacts.
- [implementation-plan.md](implementation-plan.md) — Ordered task breakdown for Sprint 1 (scaffold through setup script) and Sprint 2 (Saga Ledger theme, app shell, Easter eggs layer).
- [qa-handoff.md](qa-handoff.md) — Latest QA handoff: Import Wizard wireframe fixes (PR #136).

## Source Code

- [frontend/](frontend/) — Next.js project root. All `package.json`, `next.config.ts`, `app/`, and `components/` files live here. Vercel is configured with Root Directory set to `development/frontend/`.

### Key Source Directories

| Directory | Purpose |
|-----------|---------|
| `frontend/src/app/` | Next.js App Router pages and API routes |
| `frontend/src/components/` | React components: layout, dashboard, cards, sheets, entitlement, easter-eggs, shared, ui |
| `frontend/src/contexts/` | React contexts: AuthContext, EntitlementContext, RagnarokContext |
| `frontend/src/hooks/` | Custom hooks: useAuth, useEntitlement, useSheetImport, usePickerConfig, useDriveToken |
| `frontend/src/lib/` | Core libraries: types, storage, card-utils, auth, entitlement, stripe, google, sheets, llm, kv, crypto |

## Scripts

- [scripts/setup-local.sh](scripts/setup-local.sh) — Idempotent local dev setup script. Checks Node.js version, runs `npm ci`, copies `.env.example` to `.env.local` if absent, and prints next steps.
