# Development — FiremanDecko's Forge

This directory contains implementation artifacts for the Fenrir Ledger project: the ordered task breakdown, QA handoff notes, deploy scripts, and the Next.js source tree.

---

## Getting Started

```bash
bash development/scripts/setup-local.sh
```

This single command sets up everything: Node deps, environment files, GKE auth, kubectl, and k9s. See the [full setup guide](docs/setup-guide.md) for details, prerequisites, and environment variables.

## Source Code

- [frontend/](frontend/) — Next.js project root. All `package.json`, `next.config.ts`, `app/`, and `components/` files live here. Deployed to GKE Autopilot via CI/CD on every push to `main`.

### Key Source Directories

| Directory | Purpose |
|-----------|---------|
| `frontend/src/app/` | Next.js App Router pages and API routes |
| `frontend/src/components/` | React components: layout, dashboard, cards, sheets, entitlement, easter-eggs, shared, ui |
| `frontend/src/contexts/` | React contexts: AuthContext, EntitlementContext, RagnarokContext |
| `frontend/src/hooks/` | Custom hooks: useAuth, useEntitlement, useSheetImport, usePickerConfig, useDriveToken |
| `frontend/src/lib/` | Core libraries: types, storage, card-utils, auth, entitlement, stripe, google, sheets, llm, kv, crypto |

## Docs

- [docs/setup-guide.md](docs/setup-guide.md) — Full setup guide: prerequisites, GKE cluster details, env vars, CI/CD pipeline, project structure.
- [implementation-plan.md](implementation-plan.md) — Ordered task breakdown for Sprint 1-2.

## Scripts

- [scripts/setup-local.sh](scripts/setup-local.sh) — Idempotent local dev setup: Node.js check, `npm ci`, `.env.local`, GKE auth + tools.
- [../scripts/gke-setup.sh](../scripts/gke-setup.sh) — GKE CLI setup: gcloud, kubectl, gke-gcloud-auth-plugin, k9s, cluster credentials.
