---
name: depot-logs
description: "View Depot sandbox session logs. Use when the user says 'depot logs', 'session log', 'show depot output', 'what did the agent do', or wants to inspect a Depot sandbox session's tool calls, errors, or full output."
---

# Depot Logs — View Depot Sandbox Session Logs

Download and display logs from Depot remote sandbox sessions. Useful for
debugging agent failures, auditing what an agent did, and checking for errors.

## Usage

```
/depot-logs <session-id-or-url> [--errors|--tools|--raw|--critique]
```

## Modes

| Flag | Output |
|------|--------|
| *(default)* | Full log: assistant messages + tool calls + tool outputs. Errors highlighted with `!!!`. |
| `--errors` | Only lines containing error/fatal/failed/denied |
| `--tools` | Tool calls with full input and output (verbose) |
| `--raw` | Raw JSONL for piping to `jq` |
| `--critique` | Full log + deviation analysis comparing agent actions against instructions |

## How to execute this skill

### Default mode (and --errors, --tools, --raw)

Run the script. It saves to `tmp/depot-logs/<session>.log` and cats the output:

```bash
bash .claude/scripts/depot-session-log.sh <session-id> [--errors|--tools|--raw]
```

That's it. The script handles everything — saving the file and printing the output.

### --critique mode

When the user passes `--critique`, perform ALL of the default mode steps above,
then perform a deviation analysis:

1. **Extract the system prompt** — the instructions the agent was given. Run:
   ```bash
   bash .claude/scripts/depot-session-log.sh <session-id> --raw 2>/dev/null \
     | head -1 | jq -r '.message.content' > tmp/depot-logs/<session>.prompt.txt
   ```
2. **Read the prompt file** with the Read tool.
3. **Read the agent prompt template** from `.claude/skills/fire-next-up/SKILL.md`
   to understand the expected steps for this agent type.
4. **Compare the agent's actual actions** (from the log) against the instructions
   (from the prompt). Check for ANY deviation, no matter how small:

   - Did the agent follow the numbered steps in order?
   - Did the agent skip any step?
   - Did the agent take actions NOT listed in its steps?
   - Did the agent add unsolicited messages, summaries, or status declarations?
   - Did the agent declare the issue "resolved", "fixed", or "done"?
   - Did the agent use correct commit message format (`Ref #N` not `Fixes #N`)?
   - Did the agent create the PR when instructed (or skip it)?
   - Did the agent post the handoff comment in the exact format specified?
   - Did the agent use absolute paths and `cd <REPO_ROOT>` prefix?
   - Did the agent run verification steps (tsc, next build) as instructed?
   - Did the agent read CLAUDE.md and its persona file as instructed?
   - Any other divergence from the literal instructions?

5. **Output a deviation report** as a table after the full log:

   ```
   ## Deviation Report — <session-id>

   | # | Severity | Step | Expected | Actual | Impact |
   |---|----------|------|----------|--------|--------|
   | 1 | HIGH | — | No resolution claims | Agent declared "Issue #N resolved" | Misleading status |
   | 2 | LOW | 1 | Read CLAUDE.md | Skipped | May miss project rules |
   | ... | ... | ... | ... | ... | ... |

   **Verdict:** N deviation(s) found. [CLEAN / NEEDS REFINEMENT]

   Suggested prompt changes:
   - <specific wording change to prevent deviation #1>
   - <specific wording change to prevent deviation #2>
   ```

   Severity levels:
   - **HIGH** — Agent took an unauthorized action, skipped a critical step, or
     produced incorrect output (wrong commit format, missing PR, resolution claim)
   - **MEDIUM** — Agent deviated from prescribed order or format but the outcome
     was still correct
   - **LOW** — Minor style or ordering issue with no functional impact

6. **Save the critique** to `tmp/depot-logs/<session>.critique.md`

## How It Works

1. Searches `~/.claude/projects/<project>/` for JSONL files containing the session
2. Filters to small files (<200 lines) since Depot sessions are compact vs local conversations
3. If not found locally, uses `depot claude --wait --resume` to trigger download
4. Parses the JSONL with `jq` in the requested mode
5. Writes output to `tmp/depot-logs/<session>.log`
6. Prints the log to stdout and shows the file path

## Limitations

- Session must have been downloaded via `--wait --resume` at some point, or the
  script triggers a download (which may take a moment)
- The search heuristic uses file size to distinguish Depot sessions from local
  conversations — sessions over 200 lines are skipped
