# Development — FiremanDecko's Forge

This directory contains implementation artifacts for the Fenrir Ledger project: the ordered task breakdown, QA handoff notes, deploy scripts, and the Next.js source tree.

---

## Implementation Docs

- [implementation-plan.md](implementation-plan.md) — Ordered task breakdown for Sprint 1 (scaffold through setup script) and Sprint 2 (Saga Ledger theme, app shell, Easter eggs layer).
- [qa-handoff.md](qa-handoff.md) — Handoff to Loki for Sprint 1 and Sprint 2: files created, deploy steps, test focus areas, and known limitations per sprint.

## Source Code

- [src/](src/) — Next.js project root. All `package.json`, `next.config.ts`, `app/`, and `components/` files live here. Vercel is configured with Root Directory set to `development/src/`.

## Scripts

- [scripts/setup-local.sh](scripts/setup-local.sh) — Idempotent local dev setup script. Checks Node.js version, runs `npm ci`, copies `.env.example` to `.env.local` if absent, and prints next steps.
