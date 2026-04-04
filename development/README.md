# Development — FiremanDecko's Forge

This directory contains implementation artifacts for the Fenrir Ledger project: the ordered task breakdown, QA handoff notes, deploy scripts, and the Next.js source tree.

---

## Getting Started

```bash
bash development/scripts/setup-local.sh
```

This single command sets up everything: Node deps, environment files, GKE auth, kubectl, and k9s. See the [full setup guide](docs/setup-guide.md) for details, prerequisites, and environment variables.

## Source Code

- [ledger/](ledger/) — Next.js project root. All `package.json`, `next.config.ts`, `app/`, and `components/` files live here. Deployed to GKE Autopilot via CI/CD on every push to `main`.
- [odins-throne/](odins-throne/) — Odin's Throne: agent monitor SPA (`index.html`) + monitor API. Deployed to `fenrir-monitor` namespace via `infrastructure/helm/odin-throne/`.
- [odins-spear/](odins-spear/) — Odin's Spear supplementary tooling.

### Key Source Directories

| Directory | Purpose |
|-----------|---------|
| `ledger/src/app/` | Next.js App Router pages and API routes |
| `ledger/src/components/` | React components: layout, dashboard, cards, sheets, entitlement, easter-eggs, shared, ui |
| `ledger/src/contexts/` | React contexts: AuthContext, EntitlementContext, RagnarokContext |
| `ledger/src/hooks/` | Custom hooks: useAuth, useEntitlement, useSheetImport, usePickerConfig, useDriveToken |
| `ledger/src/lib/` | Core libraries: types, storage, card-utils, auth, entitlement, stripe, google, sheets, llm, firebase, crypto |

## Docs

- [docs/setup-guide.md](docs/setup-guide.md) — Full setup guide: prerequisites, GKE cluster details, env vars, CI/CD pipeline, project structure.
- [docs/implementation-plan.md](docs/implementation-plan.md) — Ordered task breakdown for Sprint 1-2.
- [docs/security-review-report.md](docs/security-review-report.md) — Consolidated security review: OAuth PKCE, API routes, token handling.
- [docs/heimdall-static-review.md](docs/heimdall-static-review.md) — Heimdall static security analysis: Google API integration findings.
- [docs/browser-traffic-report.md](docs/browser-traffic-report.md) — Browser traffic inspection: secret hygiene validation.

## QA Handoffs

- [docs/qa-handoff.md](docs/qa-handoff.md) — QA handoff for issue #1259: MetadataLookupWarning fix in Odin's Spear ADC auth.
- [docs/qa-handoff-statusline.md](docs/qa-handoff-statusline.md) — Norse statusline script for Claude Code.
- [docs/qa-handoff-splash.md](docs/qa-handoff-splash.md) — Elder Futhark FENRIR splash screen.
- [docs/qa-handoff-palette.md](docs/qa-handoff-palette.md) — Terminal color palette config files.
- [docs/frontend-qa-handoff.md](docs/frontend-qa-handoff.md) — Feature flag registry + Patreon API route guards.
- [docs/QA-SPRINT-5.md](docs/QA-SPRINT-5.md) — Sprint 5 QA report: Google Sheets import + LCARS easter egg.
- [docs/LOKI-TEST-PLAN-anon-auth.md](docs/LOKI-TEST-PLAN-anon-auth.md) — Test plan: anonymous-first auth + cloud sync upsell.
- [docs/qa-handoff-agent-monitor.md](docs/qa-handoff-agent-monitor.md) — QA handoff: Agent Monitor SPA (issue #743).
- [docs/qa-handoff-umami-deployment.md](docs/qa-handoff-umami-deployment.md) — QA handoff: Umami analytics deployment (issue #781).
- [docs/github-workflows.md](docs/github-workflows.md) — CI/CD pipeline diagrams and Odin's Throne deploy monitor.

## Scripts

- [scripts/setup-local.sh](scripts/setup-local.sh) — Idempotent local dev setup: Node.js check, `npm ci`, `.env.local`, GKE auth + tools.
- [../scripts/gke-setup.sh](../scripts/gke-setup.sh) — GKE CLI setup: gcloud, kubectl, gke-gcloud-auth-plugin, k9s, cluster credentials.
