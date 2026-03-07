# Report Templates

## Dispatch Summary

After spawning Step 1, report:

```
## Dispatch Summary

| Field | Value |
|-------|-------|
| **Issue** | #<NUMBER>: <TITLE> |
| **Type** | <type label> |
| **Priority** | <priority label> |
| **Chain** | <Agent1> → <Agent2> [→ <Agent3>] |
| **Branch** | `<BRANCH>` |
| **Step** | 1/<TOTAL> — <AgentName> |
| **Session** | `<SESSION_ID>` |
| **Depot** | [View session](https://depot.dev/orgs/pqtm7s538l/claude/<SESSION_ID>) |
| **Issue** | [#<NUMBER>](https://github.com/declanshanaghy/fenrir-ledger/issues/<NUMBER>) |
| **Mode** | Remote (Depot) / Local (worktree) |
| **Spawned** | <UTC timestamp> |

**Remaining Up Next items:**
| # | Title | Priority | Type | Chain |
|---|-------|----------|------|-------|
| ... | ... | ... | ... | ... |
```

## Step Transition

After each chain step completes, report:

```
## Step Transition — #<NUMBER>

| Field | Value |
|-------|-------|
| **Completed** | Step <N>/<TOTAL> — <AgentName> |
| **Session** | [<PREV_SESSION_ID>](https://depot.dev/orgs/pqtm7s538l/claude/<PREV_SESSION_ID>) |
| **Commits** | <N> commits on `<BRANCH>` |
| **Handoff** | <Found / Missing> |
| **Next** | Step <N+1>/<TOTAL> — <NextAgentName> |
| **New Session** | [<NEW_SESSION_ID>](https://depot.dev/orgs/pqtm7s538l/claude/<NEW_SESSION_ID>) |
| **Spawned** | <UTC timestamp> |
```

## Chain Complete

After the final step, report:

```
## Chain Complete — #<NUMBER>

| Field | Value |
|-------|-------|
| **Issue** | #<NUMBER>: <TITLE> |
| **Chain** | <Agent1> → <Agent2> [→ <Agent3>] — ALL DONE |
| **Branch** | `<BRANCH>` |
| **PR** | [#<PR_NUMBER>](<PR_URL>) |
| **Verdict** | PASS / FAIL |
| **Total commits** | <N> |
| **Duration** | ~<minutes> min (first spawn to PR) |

### Session History
| Step | Agent | Session | Status |
|------|-------|---------|--------|
| 1 | <Agent1> | [<SID>](https://depot.dev/orgs/pqtm7s538l/claude/<SID>) | Complete |
| 2 | <Agent2> | [<SID>](https://depot.dev/orgs/pqtm7s538l/claude/<SID>) | Complete |
```
