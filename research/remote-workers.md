# Remote Workers — Hybrid Orchestration

**Author:** FiremanDecko (Principal Engineer)
**Date:** 2026-03-04
**Status:** Research complete, no code written
**Decision:** Hybrid — Local Orchestrator + Remote Builders

---

## Chosen Architecture

Odin runs `/orchestrate` locally (lightweight coordination only). Heavy compute
(FiremanDecko builds, Loki QA) runs on GitHub Actions via `workflow_dispatch`.

```
Local (Odin's machine)              Remote (GitHub Actions)
+------------------+                +------------------------+
| /orchestrate     |  dispatch -->  | build-story job        |
| - parse spec     |                | - checkout branch      |
| - create tasks   |                | - claude -p (Decko)    |
| - monitor PRs    |  <-- results   | - commit, push, PR     |
| - approval gates |                +------------------------+
+------------------+                +------------------------+
                       dispatch --> | validate-story job     |
                                    | - claude -p (Loki)     |
                       <-- results  | - run tests, verdict   |
                                    +------------------------+
```

### Why Hybrid

- Odin keeps interactive approval gates (design sign-off, merge decisions)
- Heavy compute moves off local machine
- Orchestrator context is small (~coordination, not building)
- GitHub Actions provides free parallelism, secrets management, and logs

---

## Implementation Plan

### Phase 1: Single-Story Prototype

Create `.github/workflows/orchestrate-story.yml`:

```yaml
name: Build Story
on:
  workflow_dispatch:
    inputs:
      story_description:
        description: 'Story details and acceptance criteria'
        required: true
      branch_name:
        description: 'Branch to work on (e.g., feat/my-feature)'
        required: true
      agent_type:
        description: 'Agent to use (fireman-decko or loki)'
        required: true
        default: 'fireman-decko'
      model:
        description: 'Model to use'
        required: true
        default: 'claude-opus-4-6'

jobs:
  execute:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.branch_name }}

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: cd development/frontend && npm ci

      - name: Install Playwright browsers
        run: cd development/frontend && npx playwright install --with-deps chromium

      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            You are ${{ inputs.agent_type }}.
            Read .claude/agents/${{ inputs.agent_type }}.md for your role definition.
            Read CLAUDE.md for project rules.

            Working directory: ${{ github.workspace }}
            Branch: ${{ inputs.branch_name }}

            Task:
            ${{ inputs.story_description }}

            When done: commit, push, create PR if one doesn't exist.
          claude_args: >-
            --model ${{ inputs.model }}
            --max-turns 50
            --allowedTools Bash,Read,Write,Edit,Glob,Grep
```

### Phase 2: Build-Validate Cycle

Add a validation job that runs after the build:

```yaml
  validate:
    needs: execute
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.branch_name }}

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: cd development/frontend && npm ci
      - run: cd development/frontend && npx playwright install --with-deps chromium

      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            You are loki-qa-tester.
            Read .claude/agents/loki.md for your role definition.
            Validate the work on branch ${{ inputs.branch_name }}.
            Run: cd development/frontend && npm run build && npx tsc --noEmit
            Write Playwright tests for new functionality.
            Report: PASS or FAIL with specific issues.
          claude_args: "--model claude-sonnet-4-6 --max-turns 30"
```

### Phase 3: Local Orchestrator Integration

Update `/orchestrate` to dispatch remote jobs instead of spawning local subagents:

```bash
# Instead of Agent({ subagent_type: "fireman-decko-principal-engineer", ... })
gh workflow run orchestrate-story.yml \
  --field story_description="Implement: ..." \
  --field branch_name="feat/my-feature" \
  --field agent_type="fireman-decko" \
  --field model="claude-opus-4-6"

# Monitor
gh run watch <run-id> --exit-status
```

### Phase 4: Retry Loop

For fix loops, the orchestrator:
1. Detects Loki FAIL from the validate job output
2. Re-dispatches the build job with Loki's failure report appended to the prompt
3. Re-dispatches validation
4. Escalates after 3 retries

---

## Requirements

### GitHub Secrets Needed

| Secret | Purpose |
|--------|---------|
| `ANTHROPIC_API_KEY` | Claude API access for remote agents |

### Runner Capabilities

The `ubuntu-latest` runner includes:
- Node.js (via `actions/setup-node`)
- git (pre-installed)
- npm (via Node.js)
- Playwright browsers (via `npx playwright install`)

### What's Available After Checkout

All of these are in the repo and available after `actions/checkout`:
- `.claude/agents/*.md` — agent definitions
- `.claude/skills/*/SKILL.md` — skills
- `.claude/commands/*.md` — commands
- `CLAUDE.md` — project rules

---

## Cost Analysis

| Component | Cost |
|-----------|------|
| Opus 4.6 API (~200K input + 100K output) | ~$4.50/run |
| Sonnet 4.6 API (Loki, ~100K tokens) | ~$0.50/run |
| GH Actions (~30 min ubuntu-latest) | ~$0.24/run |
| **Total per story** | **~$5.25** |
| **Monthly (10 orchestrations, ~3 stories each)** | **~$160** |

Break-even vs Max $200: if Odin's interactive usage justifies Max $100,
remote orchestration at ~$160/month brings total to $260. However, remote
orchestration frees Odin's machine entirely during builds.

Batch API (50% discount on input tokens) could reduce to ~$3.50/story.

---

## Gaps and Open Questions

1. **Dynamic job creation**: Story count varies per orchestration. Matrix
   strategies or reusable workflows needed for N stories.
2. **Fix loop elegance**: GH Actions doesn't natively support "retry until
   pass" loops. Needs a wrapper workflow or composite action.
3. **Approval gates**: How does the remote builder pause for Odin's approval?
   Options: PR review required, manual workflow dispatch for next phase,
   or Slack notification with approval button.
4. **Context continuity**: Each GH Actions job is a fresh context. No session
   resume across jobs. The prompt must contain all necessary context.
5. **MCP servers**: Playwright MCP works if browsers are installed on the
   runner. Vercel MCP would need the Vercel token in secrets.

---

## Preferred Runtime: Sandbox Services (E2B, Daytona, etc.)

Instead of GitHub Actions runners or raw VMs, use ephemeral sandbox services
that spin up pre-configured dev environments on demand and tear down after use.

### Why Sandboxes

- **Instant startup**: Sub-second to seconds, vs 30-60s for GH Actions job queue
- **Pre-built environments**: Node.js, git, npm, Playwright pre-installed
- **True isolation**: Each worker gets a fresh filesystem, no cross-contamination
- **Pay-per-use**: Billed by execution time, scales to zero
- **Fire-and-forget**: Orchestrator dispatches, sandbox runs, results come back via git push

### Candidate Services

| Service | Runtime | Timeout | Pricing | Notes |
|---------|---------|---------|---------|-------|
| [E2B](https://e2b.dev) | Cloud VM sandbox | Configurable (hours) | ~$0.10/hr | Code interpreter focus, SDK for spawning |
| [Daytona](https://daytona.io) | Dev environment | No hard limit | Free tier + paid | Git-native, dev container spec support |
| [Gitpod](https://gitpod.io) | Cloud workspace | 24h | Free tier + $25/mo | Full IDE, but overkill for headless |
| [GitHub Codespaces](https://github.com/features/codespaces) | Cloud VM | 4h idle timeout | $0.18/hr (2-core) | Native GH integration, prebuilds |

### E2B Integration Sketch

E2B provides a TypeScript SDK for spawning sandboxes programmatically:

```typescript
import { Sandbox } from '@e2b/code-interpreter';

async function runWorker(story: Story, branch: string) {
  const sandbox = await Sandbox.create({
    template: 'node-20',  // or custom template with our deps
    timeout: 30 * 60,     // 30 minutes
  });

  // Clone repo, checkout branch, install deps
  await sandbox.commands.run(`
    git clone https://github.com/declanshanaghy/fenrir-ledger.git /workspace
    && cd /workspace && git checkout ${branch}
    && cd development/frontend && npm ci
  `);

  // Run Claude Code headlessly
  await sandbox.commands.run(`
    cd /workspace
    && ANTHROPIC_API_KEY=${apiKey} claude -p "${story.prompt}"
      --model claude-opus-4-6
      --max-turns 50
      --allowedTools Bash,Read,Write,Edit,Glob,Grep
  `);

  // Push results
  await sandbox.commands.run(`
    cd /workspace && git push origin ${branch}
  `);

  await sandbox.kill();
}
```

### Architecture with Sandboxes

```
Local (Odin)                    E2B / Sandbox Service
+-----------------+             +-------------------------+
| /orchestrate    |  spawn -->  | Sandbox 1 (Decko)       |
| - parse spec    |             | - clone, checkout       |
| - dispatch jobs |             | - claude -p (build)     |
| - monitor git   |  <-- push   | - commit, push          |
+-----------------+             +-------------------------+
                    spawn -->   | Sandbox 2 (Decko)       |
                                | - parallel story        |
                    <-- push    +-------------------------+
                    spawn -->   | Sandbox 3 (Loki)        |
                                | - validate, test        |
                    <-- push    +-------------------------+
```

### vs GitHub Actions

| Aspect | GH Actions | Sandbox (E2B) |
|--------|------------|---------------|
| Startup time | 30-60s | <5s |
| Max runtime | 6h | Configurable |
| Programmatic spawn | `gh workflow run` | SDK call |
| Cost (30 min) | ~$0.24 | ~$0.05 |
| Custom environment | Dockerfile or setup steps | Template or Dockerfile |
| Git integration | Native | Manual (clone/push) |
| Secrets | GH Secrets (built-in) | Passed via SDK |
| Retry loops | Awkward (YAML) | Code (trivial) |

**Sandboxes win on startup time, cost, and programmatic control.** GH Actions
wins on native git/PR integration and built-in secrets management.

### Recommended Path with Sandboxes

1. **Create an E2B template** with Node 20, git, npm, Playwright, Claude Code CLI
2. **Write a dispatcher** (~100 lines) that spawns sandboxes per story
3. **Orchestrator dispatches** via E2B SDK instead of `gh workflow run`
4. **Results flow back** via git push to story branches
5. **Orchestrator monitors** via `gh pr checks` and branch status

---

## Long-Term: Agent SDK

After the GH Actions hybrid is proven, consider migrating the orchestrator
itself to the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`):

- Full programmatic control (retry loops, conditionals, parallelism = code)
- Same tool layer as Claude Code
- Runs anywhere with Node.js
- ~200-400 lines of TypeScript
- Can run on Cloud Run (60-min timeout) or EC2 spot

Script location: `development/scripts/remote-orchestrate.ts`

---

## References

- [anthropics/claude-code-action@v1](https://github.com/anthropics/claude-code-action)
- [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)
- [Claude Code headless mode](https://code.claude.com/docs/en/headless)
- [Claude API Pricing](https://www.metacto.com/blogs/anthropic-api-pricing-a-full-breakdown-of-costs-and-integration)
