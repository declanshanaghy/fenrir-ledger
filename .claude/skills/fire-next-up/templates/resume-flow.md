# Resume Flow (`--resume #N`)

When a chain is interrupted (session ended, agent failed, context lost), use `--resume #N` to pick up where it left off.

## Detection Steps

1. **Fetch issue details** to determine the chain type:
   ```bash
   gh issue view <N> --json number,title,body,labels
   ```

2. **Find the existing branch** by looking for the issue number:
   ```bash
   git branch -r | grep "issue-<N>"
   ```
   If no branch exists, the chain never started — run a fresh chain instead (same as `/fire-next-up #N`).

3. **Read issue comments** to determine which agents have completed their handoffs:
   ```bash
   gh issue view <N> --comments
   ```

   Look for handoff comment headers to identify completed steps:

   | Comment header | Agent completed | Next agent |
   |----------------|-----------------|------------|
   | `## Luna → FiremanDecko Handoff` | Luna | FiremanDecko |
   | `## FiremanDecko → Loki Handoff` | FiremanDecko | Loki |
   | `## Heimdall → Loki Handoff` | Heimdall | Loki |
   | `## Loki QA Verdict` | Loki (chain complete) | — |
   | `## Freya Handoff` | Freya (research) | Orchestrator Review |
   | `## FiremanDecko Handoff` (no `→ Loki`) | FiremanDecko (research) | Orchestrator Review |

   The **last handoff comment** tells you exactly where the chain stopped and who's next.

4. **Check if a PR already exists** for the branch:
   ```bash
   gh pr list --head "<BRANCH>" --json number,state
   ```
   If a PR exists and Loki's verdict comment is present → chain is complete.

5. **Determine the next step:**
   - No handoff comments → Step 1 agent failed before completing. Re-run Step 1.
   - `Luna → FiremanDecko Handoff` exists but no further → spawn FiremanDecko.
   - `FiremanDecko → Loki Handoff` or `Heimdall → Loki Handoff` exists but no verdict → spawn Loki.
   - `Loki QA Verdict` exists → check CI status (see Step 5b below).
   - `Freya Handoff` or `FiremanDecko Handoff` (without `→ Loki`) on a research issue → **Research Review** (see Step 5c below).

5b. **If Loki QA Verdict exists — check CI before declaring complete:**

   A Loki verdict does NOT mean the chain is complete. CI must also be green.

   ```bash
   PR_NUM=$(gh pr list --head "<BRANCH>" --json number --jq '.[0].number')
   gh pr checks "$PR_NUM" 2>&1
   ```

   | Condition | Action |
   |-----------|--------|
   | CI green + verdict PASS + merged | Chain is complete. Move to **Done**. Tell the user. |
   | CI green + verdict PASS + not merged | **Orchestrator merges** (see below). Then move to **Done**. |
   | **CI failing + verdict PASS or FAIL** | **Bounce back to Loki** — read `templates/loki-bounce-back.md`. |
   | Verdict FAIL (regardless of CI) | Chain is blocked. Report to user: needs manual intervention or re-dispatch. |

5c. **If research handoff exists — run Research Review:**

   Research chains have no Loki step. When the agent's handoff is found:

   1. Check if the PR is merged: `gh pr list --state merged --head "<BRANCH>" --json number`
   2. If merged, read the deliverable file(s) from the PR's changed files.
   3. Present findings to Odin using the Research Review format from SKILL.md.
   4. Execute Odin's decision (plan it / shelve it / drop it).

   Do NOT spawn any agents — the orchestrator handles this step directly.

---

## Orchestrator Merge

When Loki's verdict is PASS and CI is green, the **orchestrator** (not Loki) merges:

```bash
# 1. Check for needs-review label (Odin's veto)
gh issue view <NUMBER> --json labels --jq '[.labels[].name] | any(. == "needs-review")'
# 2. Check mergeable
gh pr view <PR_NUMBER> --json mergeable --jq '.mergeable'
# 3. If both clear, merge
gh pr merge <PR_NUMBER> --squash --delete-branch
```

After a successful merge, move the issue to **Done** on the project board:
```bash
ITEM_ID=$(gh project item-list 1 --owner declanshanaghy --format json --limit 200 \
  | jq -r '.items[] | select(.content.number == <NUMBER>) | .id')
gh project item-edit \
  --project-id "PVT_kwHOAAW5PM4BQ7LP" \
  --id "$ITEM_ID" \
  --field-id "PVTSSF_lAHOAAW5PM4BQ7LPzg-54RA" \
  --single-select-option-id "98236657"
```

## CI Failure Bounce-Back

When Loki posted a verdict but CI is still failing, the chain is NOT complete.
The orchestrator must:

1. **Gather CI failure details** — run `gh run view <RUN_ID> --log-failed` and
   extract the specific test failures (file names, line numbers, error messages,
   expected vs actual values).
2. **Read the failing test files** locally to understand what they test.
3. **Build a detailed bounce-back prompt** using `templates/loki-bounce-back.md`.
   Include ALL of the following in the prompt:
   - The exact error output from CI (copy-paste the failure lines)
   - Which test files are failing and at which line numbers
   - The expected vs actual values from each assertion
   - Any context about what changed
   - Whether the fix should be in the test or in the code
4. **Spawn a new Loki session** on the same branch with the bounce-back prompt.
5. Report a **step transition** showing the bounce-back.

## Resume Execution

Once the next agent is identified:

1. Report to the user what was detected:
   ```
   **Resuming #<N>**: <title>
   **Chain:** <full chain>
   **Completed:** Step 1 (<AgentName>) — found `<commit prefix>` commits
   **Resuming at:** Step <X>/<Total> — spawning <NextAgentName>
   ```

2. Spawn the next agent using the appropriate template from `templates/`, on the **existing branch**.

3. Continue normal chain execution.

## Fallback

If no handoff comments exist (agent forgot to comment), inspect commits:
```bash
git log origin/main..origin/<BRANCH> --oneline
```
Use commit prefixes (`design:`, `fix:`, `security:`, `test:`) as a secondary signal.

## Edge Cases

- **Branch exists but no commits beyond main** — the previous agent failed before committing. Re-run that step (same agent, same branch).
- **Multiple agents' commits exist but chain isn't complete** — skip to the next incomplete step.
- **PR exists but CI failed** — bounce back to Loki with CI failure details.
- **Issue is closed** — tell the user the issue is already closed. Do not spawn agents.
