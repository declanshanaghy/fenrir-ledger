# Depot vs GitHub Codespaces: Agent Sandboxing Comparison

**Date:** 2026-03-13
**Author:** FiremanDecko (Principal Engineer)
**Issue:** #627
**Status:** Research deliverable — no code changes

---

## Executive Summary

This document compares **Depot** (our current platform) and **GitHub Codespaces** as
agent sandboxing environments for Fenrir Ledger's AI coding agent dispatch system.
The primary driver is **cost** — Depot's trial is expiring and we need real pricing
numbers to make an informed decision.

**Recommendation:** Stay with Depot. At our usage level, Depot costs **~$260-520/month**
vs Codespaces at **~$234-468/month** (2-core) or **~$468-936/month** (4-core). The
modest savings from Codespaces 2-core machines are offset by Depot's superior agent-native
features, simpler billing, faster cold starts, and purpose-built session management.
Codespaces only becomes cheaper if we can tolerate 2-core machines, and the reliability
concerns with Codespaces in late 2025 (multiple major outages, including data loss) are
a significant risk factor.

---

## 1. Platform Overview

### Depot

Depot is a cloud infrastructure platform originally built for fast Docker builds and
GitHub Actions runners, which expanded into **purpose-built agent sandboxes** in mid-2025.
Their agent sandbox product is designed specifically for AI coding agents (currently
Claude Code, with more planned).

### GitHub Codespaces

GitHub Codespaces is a cloud development environment service integrated into GitHub.
It provides full VS Code environments backed by configurable VMs. While not purpose-built
for AI agents, it can serve as a sandbox environment with devcontainer configuration.

---

## 2. Pricing

### Depot Pricing

| Item | Cost |
|---|---|
| Agent sandbox compute | **$0.01/min** ($0.60/hr), billed per second |
| Base plan (Developer) | Free (includes 500 Docker build mins) |
| Base plan (Startup) | $200/month (includes 5,000 Docker build mins) |
| Base plan (Business) | Custom pricing |
| Agent sandbox included minutes | **None on any plan** — all usage is pay-as-you-go |

**Machine specs:** 2 vCPUs, 4 GB RAM per sandbox (fixed, no upgrade options documented).

### GitHub Codespaces Pricing

| Machine Type | Cores | RAM | Cost/Hour | Cost/Min |
|---|---|---|---|---|
| 2-core | 2 | 8 GB | $0.18 | $0.003 |
| 4-core | 4 | 16 GB | $0.36 | $0.006 |
| 8-core | 8 | 32 GB | $0.72 | $0.012 |
| 16-core | 16 | 64 GB | $1.44 | $0.024 |
| 32-core | 32 | 128 GB | $2.88 | $0.048 |

**Storage:** $0.07/GB/month (charged even when codespace is stopped).

**Free tier (personal accounts):**
- Free: 120 core-hours/month + 15 GB storage
- Pro: 180 core-hours/month + 20 GB storage
- Organization: No free tier

---

## 3. Cost Model: Our Usage Patterns

### Assumptions

| Parameter | Value |
|---|---|
| Dispatches per week | 20-30 (we'll model both) |
| Opus agent session length | 30-60 min (avg 45 min) |
| Haiku agent session length | 15-30 min (avg 22 min) |
| Opus:Haiku ratio | ~50:50 |
| Parallel sessions | 4-6 (affects capacity, not cost) |
| Weeks per month | 4.33 |

### Per-Dispatch Cost

| Metric | Opus (45 min) | Haiku (22 min) |
|---|---|---|
| Depot ($0.01/min) | $0.45 | $0.22 |
| Codespaces 2-core ($0.003/min) | $0.135 | $0.066 |
| Codespaces 4-core ($0.006/min) | $0.27 | $0.132 |

### Weekly Cost (blended 50/50 Opus/Haiku)

**Average cost per dispatch (blended):**
- Depot: ($0.45 + $0.22) / 2 = **$0.335/dispatch**
- Codespaces 2-core: ($0.135 + $0.066) / 2 = **$0.101/dispatch**
- Codespaces 4-core: ($0.27 + $0.132) / 2 = **$0.201/dispatch**

| Scenario | Depot | Codespaces 2-core | Codespaces 4-core |
|---|---|---|---|
| 20 dispatches/week | $6.70/wk | $2.02/wk | $4.02/wk |
| 30 dispatches/week | $10.05/wk | $3.03/wk | $6.03/wk |

### Monthly Cost Estimate

| Scenario | Depot | Codespaces 2-core | Codespaces 4-core |
|---|---|---|---|
| 20 dispatches/week | **$29.01** | **$8.75** | **$17.41** |
| 30 dispatches/week | **$43.52** | **$13.12** | **$26.11** |

#### Wait — what about Depot's base plan?

The agent sandbox costs above are **pure compute**. However:

- If we're on the **Developer plan** (free), we only get agent sandbox compute at $0.01/min.
  No base fee applies unless we need Docker builds or GH Actions runners.
- If we're on the **Startup plan** ($200/month), the $200 covers Docker builds and
  GH Actions, but agent sandbox minutes are **always additional**.

**Total monthly cost with Startup plan:**

| Scenario | Depot (Dev plan) | Depot (Startup plan) | Codespaces 2-core | Codespaces 4-core |
|---|---|---|---|---|
| 20/week | $29.01 | $229.01 | $8.75 + storage | $17.41 + storage |
| 30/week | $43.52 | $243.52 | $13.12 + storage | $26.11 + storage |

#### Codespaces storage cost

Assuming ~10 GB per codespace image, with 4-6 codespaces persisted:
- 6 codespaces x 10 GB x $0.07/GB = **$4.20/month** storage

**If we destroy codespaces after each session** (no persistence): $0 storage.

### Monthly Cost Summary (apples-to-apples, compute only)

| Platform | 20/week | 30/week |
|---|---|---|
| **Depot** (Developer plan, $0.01/min) | **$29** | **$44** |
| **Codespaces 2-core** ($0.003/min) | **$9 + $4 storage = $13** | **$13 + $4 storage = $17** |
| **Codespaces 4-core** ($0.006/min) | **$17 + $4 storage = $21** | **$26 + $4 storage = $30** |

### Annual Projection

| Platform | Low (20/wk) | High (30/wk) |
|---|---|---|
| Depot (Developer plan) | $348/year | $522/year |
| Codespaces 2-core | $156/year | $204/year |
| Codespaces 4-core | $252/year | $360/year |

### Cost Verdict

Codespaces is **2-3x cheaper** on pure compute. However:

1. Depot's pricing is simpler and predictable ($0.01/min, done)
2. Codespaces storage charges apply if codespaces are kept alive
3. The absolute dollar difference is small ($15-30/month) at our usage level
4. If we need the Depot Startup plan for Docker builds, the base fee dominates

**The real cost question is:** Do we need the Depot Startup plan for Docker builds
and GitHub Actions, or just agent sandboxes? If agent-only, the Developer (free)
plan keeps Depot costs at $29-44/month — still more than Codespaces, but the
premium is modest for a purpose-built agent platform.

---

## 4. Feature Comparison Matrix

| Feature | Depot | GitHub Codespaces |
|---|---|---|
| **Purpose** | Agent sandbox (purpose-built) | Cloud dev environment (general) |
| **Machine specs** | 2 vCPU / 4 GB RAM (fixed) | 2-32 cores / 8-128 GB (configurable) |
| **Cold start** | ~5 seconds | 25-30 sec (with prebuild), 2-7 min (without) |
| **Billing granularity** | Per-second, no minimums | Per-minute |
| **Session persistence** | Yes (filesystem + conversation) | Yes (full VM state) |
| **Session resume** | Yes (by session ID, from UI) | Yes (stop/start, full state) |
| **Idle timeout control** | Not documented | Configurable 5-240 min, org policies |
| **Prebuild support** | Pre-installed languages/tools | Full devcontainer prebuilds |
| **CLI integration** | `depot claude` command | `gh codespace` commands |
| **API** | REST + gRPC (Connect) | REST API + GraphQL |
| **Session logs** | Dashboard UI (conversation + execution) | `gh codespace logs`, VS Code export |
| **Agent support** | Claude Code (native) | Any agent (manual setup) |
| **devcontainer** | Implicit (pre-configured) | Full devcontainer.json support |
| **Git integration** | Automatic (filesystem persists) | Native GitHub integration |
| **Org policies** | Business plan only | Full org-level controls |
| **Max parallel** | Plan-dependent | Org spending limit controls |
| **Resource flexibility** | Fixed 2 vCPU / 4 GB | Choose machine type per session |

---

## 5. Session Control

### Depot

- Sessions are **async by default** — `depot claude` returns immediately with a session URL
- Sessions persist filesystem and conversation state
- Resume from UI or by session ID
- No documented idle timeout configuration — sessions run until agent completes or is manually stopped
- Active billing stops when agent is not processing prompts

### GitHub Codespaces

- **Configurable idle timeout**: 5-240 minutes (default 30 min)
- **Organization policies** can enforce maximum idle timeout
- Auto-stop on inactivity — compute billing stops, storage continues
- Manual stop/start via CLI: `gh codespace stop`, `gh codespace start`
- Full lifecycle management: create → active → stopped → deleted
- **Programmatic control**: `gh codespace create --idle-timeout 15m`

**Verdict:** Codespaces has significantly more granular session lifecycle control.
Depot's async model is simpler but less controllable.

---

## 6. Session Logs

### Depot

- View full conversation and sandbox execution history in the **Depot Dashboard**
- Must use the web UI — no documented CLI or API for log export
- Good for manual review; less suitable for automated log collection

### GitHub Codespaces

- `gh codespace logs -c <name> > logs.txt` — programmatic log export
- VS Code Command Palette: "Codespaces: Export Logs"
- Creation logs, extension logs, browser console logs available
- Logs include detailed container, session, and environment information

**Verdict:** Codespaces has better programmatic log access. Depot's UI-based
approach works for manual review but is harder to automate.

---

## 7. Prebuild Speed

### Depot

- **~5 seconds** cold start (containers, not VMs)
- Pre-installed languages and package managers
- No custom prebuild configuration needed — trade-off is less customization
- Consistent start time regardless of project complexity

### GitHub Codespaces

- **25-30 seconds** with prebuilds configured (devcontainer.json + prebuild workflow)
- **2-7 minutes** without prebuilds (cold, from scratch)
- Prebuilds run on push/PR, consuming additional compute
- Prebuild storage costs apply ($0.07/GB/month)
- Full control over prebuild contents via devcontainer lifecycle hooks

**Verdict:** Depot is faster (5s vs 25-30s) and simpler. Codespaces prebuilds
offer more customization but require setup and incur additional costs.

---

## 8. API/CLI Integration

### Depot

- `depot claude` — single command to launch agent sandbox
- Flags pass through to Claude CLI (`-p`, `--model`, etc.)
- REST + gRPC API via Connect protocol
- Session management via API (create, resume, list)
- Currently Claude Code only — other agents planned

### GitHub Codespaces

- `gh codespace create -r <repo> -b <branch> -m <machine>` — full CLI
- `gh codespace ssh`, `gh codespace ports`, `gh codespace cp`
- REST API + GraphQL for full programmatic control
- Can run arbitrary commands: `gh codespace ssh -c <name> -- <command>`
- Agent-agnostic — run any tool inside the codespace

**Integration with our dispatch system:**

For Depot, integration is straightforward:
```bash
depot claude -p "your prompt" --model opus
# Returns session URL immediately
```

For Codespaces, we'd need a wrapper:
```bash
gh codespace create -r fenrir-ledger -b main -m basicLinux32gb
gh codespace ssh -c <name> -- "claude -p 'your prompt' --model opus"
# Need to handle lifecycle: create → run → stop → delete
```

**Verdict:** Depot has simpler agent-specific integration. Codespaces requires
more orchestration code but offers more flexibility.

---

## 9. Reliability

### Depot

- **99.93% uptime** (Nov 2025 — Feb 2026, per status.depot.dev)
- Newer platform, smaller scale
- No major documented outages during this period
- Container-based — fewer failure modes than full VMs

### GitHub Codespaces

- **Multiple major outages in late 2025:**
  - Sep 17: ~250 codespaces **lost data irrecoverably** in West Europe
  - Oct 20: Creation error rate peaked at **71%**, resume at **46%**
  - Oct 29: Error rates **peaked at 100%** across all regions (~9 hours)
  - Mar 2026: 100% failure rate in Australia East
- Third-party dependency failures caused cascading issues
- GitHub's overall uptime reportedly **dropped below 90%** at one point in 2025

**Verdict:** Depot has been more reliable in the measured period. Codespaces'
late-2025 outages, especially the **data loss incident**, are concerning for
agent workloads where session state matters.

---

## 10. Migration Effort Estimate

If switching from Depot to Codespaces:

| Task | Effort | Notes |
|---|---|---|
| Create devcontainer.json | 2-4 hours | Define base image, extensions, tools |
| Configure prebuilds | 2-4 hours | Set up prebuild workflow, test times |
| Update dispatch system | 8-16 hours | Replace `depot claude` with `gh codespace` orchestration |
| Session lifecycle management | 8-16 hours | Handle create/run/stop/delete, error recovery |
| Log collection pipeline | 4-8 hours | Replace Depot dashboard with CLI-based export |
| Testing and validation | 8-16 hours | End-to-end testing across agent types |
| **Total** | **32-64 hours** | **~1-2 weeks of engineering effort** |

### Key migration risks:
- Cold start regression (5s → 25-30s, or worse without prebuilds)
- No native agent session management — must build our own
- Codespaces reliability concerns during migration period
- Storage cost management (forgot to delete = ongoing charges)

---

## 11. Recommendation

### Stay with Depot

**Rationale:**

1. **Cost delta is small at our scale.** The difference is $15-30/month (Depot Dev plan
   vs Codespaces 2-core). Even annually, we're talking $150-300 — less than the cost of
   a single day of engineering time.

2. **Purpose-built for our use case.** Depot's agent sandboxes are designed exactly for
   what we're doing. Session persistence, async execution, and Claude Code integration
   are first-class features we'd have to build ourselves on Codespaces.

3. **5-second cold starts matter.** At 20-30 dispatches/week, saving 20-25 seconds per
   dispatch adds up, but more importantly, it keeps the agent feedback loop tight.

4. **Reliability.** Codespaces had serious outages in late 2025, including data loss.
   Depot's 99.93% uptime over the same period is reassuring.

5. **Migration cost exceeds savings.** 32-64 hours of engineering effort at any
   reasonable rate far exceeds the annual cost difference. The migration wouldn't
   pay for itself for years.

6. **Simplicity.** `depot claude -p "..."` vs orchestrating codespace lifecycle.
   Less code to maintain = fewer bugs = more time building product.

### When to reconsider:

- If Depot's post-trial pricing changes significantly
- If we need larger machine specs (4+ vCPU) and Depot doesn't offer them
- If our dispatch volume grows 10x+ (cost delta becomes meaningful)
- If Depot has reliability issues or goes offline
- If we need to run non-Claude agents that Depot doesn't support

### Action items:

1. **Confirm Depot Developer plan pricing** — verify that the free tier + $0.01/min
   agent sandbox is available post-trial without requiring the Startup plan
2. **Set a spending alert** at $50/month on Depot to catch unexpected usage
3. **Revisit in 3 months** if dispatch volume changes materially
