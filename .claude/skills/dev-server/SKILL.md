---
name: dev-server
description: "Start, stop, restart, check status of, or tail logs for the Fenrir Ledger local dev environment."
---

# Dev Server — Local Development Environment Manager

Manages all local development services for Fenrir Ledger.

## Usage

```
/dev-server                         # Show status of all services
/dev-server start                   # Start all services
/dev-server stop                    # Stop all services
/dev-server restart                 # Restart all services
/dev-server <service> start         # Start a specific service
/dev-server <service> stop          # Stop a specific service
/dev-server <service> logs          # Tail a specific service's logs
/dev-server odins-throne start      # Start monitor-api + monitor-ui
/dev-server odins-throne restart    # Restart monitor-api + monitor-ui
```

## Services

| Service | Alias | Port | Description |
|---------|-------|------|-------------|
| `app` | — | 9653 (WOLF) | Next.js dev server via `vercel dev` |
| `stripe` | — | — | Stripe CLI webhook forwarding to app |
| `monitor-api` | `odins-throne` | 3001 | Hono API/WebSocket server (K8s jobs, log streaming) |
| `monitor-ui` | `odins-throne` | 3002 | Vite React UI (Odin's Throne — Hlidskjalf) |
| `proxy` | — | 8001 | kubectl proxy for GKE cluster access |

**`odins-throne`** is a convenience alias that controls both `monitor-api` and `monitor-ui` together.

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
| `odins-throne <action>` | Run `<action>` on `monitor-api` + `monitor-ui` |
| `monitor <action>` | Same as `odins-throne` |
| `<service> <action>` | Run `<action>` on that service only |
| `logs` | Run `logs` on app (default) |
| `<service> logs` | Tail that service's log |

### Execute

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
SCRIPT_DIR="$REPO_ROOT/.claude/skills/dev-server/scripts"

# Single service
bash "$SCRIPT_DIR/<service>.sh" <action>

# odins-throne (both monitor services)
bash "$SCRIPT_DIR/monitor-api.sh" <action>
bash "$SCRIPT_DIR/monitor-ui.sh" <action>

# All services (start order)
for svc in stripe app monitor-api monitor-ui proxy; do
  bash "$SCRIPT_DIR/$svc.sh" <action>
done
```

### Report

Show a status table after any action:

```
Service         Port   Status
───────         ────   ──────
app             9653   running (pid 12345)
stripe          —      running (pid 12346)
odins-throne    3001   running (pid 12347)  ← monitor-api
                3002   running (pid 12348)  ← monitor-ui
proxy           8001   not running
```

## Notes

- `monitor-api` requires `tsx` (runs `development/monitor/` via `tsx watch`)
- `monitor-ui` requires `vite` (runs `development/monitor-ui/` Vite dev server with HMR)
- `proxy` requires `kubectl` configured for the GKE cluster
- `stripe` requires Stripe CLI (`brew install stripe/stripe-cli/stripe`)
- Open http://localhost:3002/ for the UI (Vite proxies API/WS to monitor-api on 3001)
