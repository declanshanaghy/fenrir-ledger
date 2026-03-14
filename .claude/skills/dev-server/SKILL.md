---
name: dev-server
description: "Start, stop, restart, check status of, or tail logs for the Fenrir Ledger local dev environment."
---

# Dev Server — Local Development Environment Manager

Manages all local development services for Fenrir Ledger.

## Usage

```
/dev-server                    # Show status of all services
/dev-server start              # Start all services
/dev-server stop               # Stop all services
/dev-server restart             # Restart all services
/dev-server <service> start    # Start a specific service
/dev-server <service> stop     # Stop a specific service
/dev-server <service> logs     # Tail a specific service's logs
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| `app` | 9653 (WOLF) | Next.js dev server via `vercel dev` |
| `stripe` | — | Stripe CLI webhook forwarding to app |
| `odin` | 8316 (Hlidskjalf) | Agent report viewer — serves `tmp/agent-logs/` |
| `proxy` | 8001 | kubectl proxy for GKE cluster access |

## Scripts

Each service has its own management script in `scripts/`:

```bash
SCRIPT_DIR="$(git rev-parse --show-toplevel)/.claude/skills/dev-server/scripts"
bash "$SCRIPT_DIR/<service>.sh" <action>
```

Actions: `start`, `stop`, `status`, `logs`

## Instructions

### Parse the command

| Input | Action |
|-------|--------|
| (no args) or `status` | Run `status` on ALL services |
| `start` | Run `start` on ALL services |
| `stop` | Run `stop` on ALL services |
| `restart` | Run `stop` then `start` on ALL |
| `<service> <action>` | Run `<action>` on that service only |
| `logs` | Run `logs` on app (default) |
| `<service> logs` | Tail that service's log |

### Execute

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
SCRIPT_DIR="$REPO_ROOT/.claude/skills/dev-server/scripts"

# Single service
bash "$SCRIPT_DIR/<service>.sh" <action>

# All services (start order: stripe → app → odin → proxy)
for svc in stripe app odin proxy; do
  bash "$SCRIPT_DIR/$svc.sh" <action>
done
```

### Report

Show a status table after any action:

```
Service    Port   Status
───────    ────   ──────
app        9653   running (pid 12345)
stripe     —      running (pid 12346)
odin       8316   running (pid 12347)
proxy      8001   not running
```

## Notes

- `odin` requires `npx http-server` (installed via npm)
- `proxy` requires `kubectl` configured for the GKE cluster
- `stripe` requires Stripe CLI (`brew install stripe/stripe-cli/stripe`)
- The old `services.sh` script is deprecated — this SKILL replaces it
