---
description: Start, stop, restart, check status of, or tail logs for the Fenrir Ledger local dev environment.
---

Manage the Fenrir Ledger local development environment.

One script handles everything: Stripe webhook forwarding + secret injection + `vercel dev`.

```
.claude/scripts/services.sh <action>
```

| Action | Effect |
|--------|--------|
| `start` | Start Stripe webhook forwarding + frontend (`vercel dev`) |
| `stop` | Stop everything, restore original webhook secret |
| `restart` | Stop then start |
| `status` | Show status of all services |
| `logs` | Tail frontend log |
| `stripe-logs` | Tail Stripe webhook log |

## What `start` does

1. Starts `stripe listen` to forward Stripe events to localhost
2. Captures the ephemeral webhook signing secret from Stripe CLI
3. Injects it into `.env.local` (backs up the original)
4. Starts `vercel dev` with the correct secret already in place

## What `stop` does

1. Stops Stripe CLI
2. Restores the original `STRIPE_WEBHOOK_SECRET` in `.env.local`
3. Stops the ledger server

## When to use this

- **After significant structural changes** (deleting files, changing middleware, removing packages) -- HMR cannot always recover; restart to get a clean compile.
- **404 on `/` from a running server** -- almost always a stale HMR state; restart fixes it.
- **Before running Playwright tests** -- confirm `status` is running first.
- **After `npm install` / `npm uninstall`** -- restart so the new module graph is picked up.

## Environment overrides (for worktrees)

| Variable | Default | Purpose |
|---|---|---|
| `FENRIR_LEDGER_PORT` | `9653` | Port the dev server listens on |
| `FENRIR_LEDGER_DIR` | Auto-detected `development/ledger/` | Path to the Next.js project root |

Backward-compatible aliases (deprecated): `FENRIR_PORT`, `FENRIR_DEV_DIR`.

## Log files

- Frontend: `<FRONTEND_DIR>/logs/ledger-server.log`
- Stripe: `<FRONTEND_DIR>/logs/stripe-listen.log`

## Prerequisites

- Stripe CLI: `brew install stripe/stripe-cli/stripe`
- `STRIPE_SECRET_KEY` in `.env.local` (run `npx vercel env pull .env.local --environment=development`)

## Notes

- `vercel dev` runs from the repo root because the Vercel project has `Root Directory = development/ledger/`.
- The scripts use `lsof -sTCP:LISTEN` to find only the listening server process.
- `nohup` is used so the server survives the shell session that spawned it.
