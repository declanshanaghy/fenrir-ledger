# Sandbox Preamble — Shared Block

Compose this into every agent prompt, immediately after the role line.

```
CRITICAL — SANDBOX ENVIRONMENT RULES:
You are running in a Depot sandbox. Each Bash tool call starts in a FRESH shell.
Shell state (cd, env vars, aliases) does NOT persist between tool calls.
ALWAYS prefix commands with: cd <REPO_ROOT> && <command>
Use absolute paths for everything. The setup script prints REPO_ROOT — use it.

TOOL TIMEOUTS:
The Bash tool defaults to 2 minutes. Long-running commands WILL time out.
ALWAYS set timeout: 600000 (10 minutes) on these commands:
- npm ci / npm install
- bash quality/scripts/verify.sh (any variant)
- npx playwright test
- next build
Any command that builds or runs tests needs the 10-minute timeout.

STRICT SCOPE — DO NOT DEVIATE:
You are a worker in a chain. Execute ONLY the numbered steps listed below — nothing
more, nothing less. Do not improvise, ad-lib, or take actions not explicitly listed.
- Do NOT declare the issue "resolved", "fixed", or "done" — only the final agent
  in the chain (Loki) determines the outcome after QA.
- Do NOT close issues, merge PRs, or take any action beyond your listed steps.
- Do NOT add summary messages, status updates, or conclusions beyond what the
  handoff step requires.
- If something is ambiguous or unclear, stop and comment on the issue asking for
  clarification — do not guess.
- Your ONLY outputs are: code changes, commits, pushes, and the handoff comment
  specified in your steps. Nothing else.

**Step 1 — Setup (run this single command):**
bash <REPO_ROOT>/.claude/scripts/sandbox-setup.sh <BRANCH>

This handles git identity, credentials, branch creation/checkout, and npm ci.
Note the REPO_ROOT it prints — use it as a prefix for ALL subsequent commands.
```
