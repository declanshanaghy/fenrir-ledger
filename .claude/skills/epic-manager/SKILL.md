---
name: epic-manager
description: >
  Monitor epic progress and dispatch next ready stories. Reads tmp/epics/<N>.yml,
  cross-references live GitHub issue states and active GKE K8s jobs, prints a
  wave-by-wave dashboard, and identifies what's ready to dispatch next.
  Use when the user says 'epic status', 'epic manager', 'what's next in epic',
  '/epic-manager <N>', or provides a root issue number to track.
---

# Epic Manager

Monitor an epic's dependency graph against live GitHub + K8s state and prepare
the next wave of stories for dispatch.

## Input

```
/epic-manager <root-issue-number> [--dispatch]
/epic-manager <root-issue-number> --add <N> --blocked-by <N>[,N...] [--wave <N>] [--parallel-with <N>[,N...]] [--note "..."]
```

| Arg | Required | Description |
|-----|----------|-------------|
| `<N>` | Yes | Root issue number — reads `tmp/epics/<N>.yml` |
| `--dispatch` | No | Print ready `/dispatch` commands after the dashboard |
| `--add <N>` | No | Add issue #N to the graph (title fetched from GitHub) |
| `--blocked-by <N>[,N...]` | With `--add` | Comma-separated blockers for the new story |
| `--wave <N>` | No | Override auto-computed wave (default: max blocker wave + 1) |
| `--parallel-with <N>[,N...]` | No | Peers in the same wave (bidirectional update) |
| `--note "..."` | No | Optional note text for the new story |

## Help

If no issue number is provided, or `--help` / `-h` is passed, **display this help
text directly** (do NOT run the script):

```
/epic-manager — Epic dependency graph tracker + dispatch advisor

USAGE
  /epic-manager <N>                          Show dashboard for epic #N
  /epic-manager <N> --dispatch               Dashboard + copy-paste dispatch commands
  /epic-manager <N> --json                   Machine-readable JSON output
  /epic-manager <N> --add <M> --blocked-by <X>[,Y]   Add story #M to epic graph

DASHBOARD EXAMPLES
  /epic-manager 1386                         Live status of epic #1386
  /epic-manager 1386 --dispatch              Dashboard + ready dispatch commands

ADD STORY EXAMPLES
  /epic-manager 1386 --add 1507 --blocked-by 1495
  /epic-manager 1386 --add 1508 --blocked-by 1495 --parallel-with 1507
  /epic-manager 1386 --add 1509 --blocked-by 1495 --wave 3 --note "Extra context"

ADD FLAGS
  --add <N>              Issue number to insert into the graph
  --blocked-by <N>[,N]   Comma-separated blockers (must close before this starts)
  --parallel-with <N>[,N] Peers in the same wave (bidirectional link)
  --wave <N>             Override wave (default: max blocker wave + 1)
  --note "..."           Optional note stored in the YAML

DASHBOARD ICONS
  ✅  done      — GitHub issue is CLOSED
  🔄  running   — Active K8s job found for this issue
  🟢  ready     — All blockers closed, not yet running
  🔴  blocked   — One or more blockers still OPEN
  ⚠️   duplicate — duplicate_of is set; close manually before dispatching

EPIC FILE
  Reads/writes tmp/epics/<root-issue>.yml
  Auto-migrates legacy .json files to .yml on first run.
```

## Speed Rules (UNBREAKABLE)

1. **One tool call.** Run the MJS script directly — no pre-fetching, no narration between calls.
2. **Never re-fetch what the script already fetches.** The script queries GitHub and K8s itself.
3. **If the epic file is missing**, tell Odin to run `/plan-w-team` or check the issue number.
4. **If no issue number or `--help`**, display the Help section above — do NOT run the script.

## Execution

```bash
node .claude/skills/epic-manager/epic-manager.mjs <N> [--dispatch]
```

That is the entire execution. No other tool calls needed unless the output requires
follow-up action (e.g., closing a duplicate, dispatching a ready story).

## What the Script Does

### Phase 1 — Load epic graph
Reads `tmp/epics/<N>.yml`. Fails with a clear message if missing.

### Phase 2 — GitHub state sync
For every issue number in the graph (stories + their blockers), calls:
```
gh issue view <N> --json number,state,title
```
Results are keyed by issue number. State is `OPEN` or `CLOSED`.

### Phase 3 — K8s job sync
Queries active GKE jobs in `fenrir-agents` namespace:
```
kubectl get jobs -n fenrir-agents -o json
```
Extracts issue numbers from:
- `fenrir.dev/session-id` label (format: `issue-<N>-step<S>-<agent>-<uuid>`)
- Job name (format: `agent-issue-<N>-step<S>-<agent>-<uuid>`)

Only jobs with `status.active > 0` are counted as running (completed/failed are ignored).

### Phase 4 — Status computation
Each story gets one of these statuses (in priority order):

| Status | Condition |
|--------|-----------|
| `done` | GitHub state = CLOSED |
| `running` | Active K8s job found for this issue |
| `blocked` | One or more `blocked_by` issues are still OPEN |
| `duplicate` | Story has `duplicate_of` set — needs manual close |
| `ready` | None of the above — all blockers closed, not running |

### Phase 5 — Dashboard output
Wave-by-wave table with icons:

```
══════════════════════════════════════════════════════════════════════════
  EPIC #1386 — Odin's Spear TUI
══════════════════════════════════════════════════════════════════════════

✅ Wave 0
    ✅ #1386   [DONE     ]  Odin's Spear TUI: foundation — Ink setup…

   Wave 1
    🟢 #1496   [READY    ]  Odin's Spear: extract into standalone package…

   Wave 2
    🔴 #1495   [BLOCKED  ]  Odin's Spear: command & help subsystem…  ← blocked by #1496
    ⚠️  #1390   [DUPLICATE]  Odin's Spear TUI: command palette…        ← duplicate of #1495

   Wave 3  (parallel)
    🔴 #1387   [BLOCKED  ]  Odin's Spear TUI: Users tab…               ← blocked by #1496, #1495
    🔴 #1388   [BLOCKED  ]  Odin's Spear TUI: Households tab…          ← blocked by #1496, #1495

   Wave 4  (parallel)
    🔴 #1389   [BLOCKED  ]  Odin's Spear TUI: Card drill-down view…    ← blocked by #1387
    🔴 #1472   [BLOCKED  ]  Odin's Spear — trial manipulation…         ← blocked by #1495

──────────────────────────────────────────────────────────────────────────
  1 done  |  0 running  |  1 ready  |  5 blocked  |  1 duplicate
──────────────────────────────────────────────────────────────────────────

  ▶  Next to dispatch (1 issue):

    /dispatch #1496   — Odin's Spear: extract into standalone package…

  ⚠️  Duplicate stories detected — close before dispatching:
    #1390 — Odin's Spear TUI: command palette + confirmation dialogs
    gh issue close 1390 --comment "Superseded by #1495"
```

## After the Dashboard

**Always use `AskUserQuestion` when asking Odin anything.** Never output a question as
plain text and wait — use the `AskUserQuestion` tool so Odin gets a proper prompt.

Read the output and:

1. **If duplicates are flagged** — use `AskUserQuestion` to confirm closing them. Options:
   "Close duplicates", "Skip". If confirmed, close with the suggested `gh issue close`
   command, then re-run.
2. **If stories are ready** — use `AskUserQuestion`: *"Wave N is unblocked. Dispatch?"*
   Options: "Dispatch #X", "Dispatch all in parallel", "Skip". Then invoke `/dispatch`
   or `/fire-next-up #X #Y` accordingly.
3. **If nothing is ready and nothing is running** — use `AskUserQuestion` to flag the
   stall. Options: "Re-check", "Close epic".
4. **If epic is complete** — congratulate, update the epic file `state` fields, and HKR.

## Epic File Format

The epic file `tmp/epics/<N>.yml` must match this schema:

```yaml
epic:
  number: 1386
  title: "Odin's Spear TUI"
  description: "..."

stories:
  - number: 1386
    title: "Odin's Spear TUI: foundation — Ink setup, auto-startup, tab shell"
    state: closed
    wave: 0
    blocks: [1496]
    blocked_by: []
    parallel_with: []
    duplicate_of: null
    note: "DONE — produces development/frontend/scripts/odins-spear.mjs"
  - number: 1496
    title: "Odin's Spear: extract into standalone package"
    state: open
    wave: 1
    blocks: [1495, 1387, 1388]
    blocked_by: [1386]
    parallel_with: []
    duplicate_of: null
    note: ""
```

> **Note:** `state` in the YAML is the initial/authored state. The script ignores it and
> always uses live GitHub state. It is kept for human reference only.

## Rules

1. **Always run the script** — never manually reconstruct the dashboard from memory.
2. **K8s query is best-effort** — if `kubectl` is unavailable (e.g., no cluster access),
   the script continues without K8s data and marks K8s status as unknown.
3. **Never dispatch without showing the dashboard first** — Odin must see the state before
   agents are spawned.
4. **Duplicate check is mandatory** — if `--dispatch` is passed, warn about duplicates
   before printing dispatch commands.
5. **Epic file is the graph source of truth** — GitHub/K8s are for live state only.
   Dependencies (`blocked_by`, `blocks`, `wave`) come from the YAML file.
