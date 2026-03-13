# Depot vs GitHub Codespaces vs AWS: Agent Sandboxing Comparison

**Date:** 2026-03-13 (revised)
**Author:** FiremanDecko (Principal Engineer)
**Issue:** #627
**Status:** Research deliverable — no code changes
**Revision:** v2 — corrected usage volume (150-300 dispatches/week), added AWS options

---

## Executive Summary

This document compares **five platforms** for Fenrir Ledger's AI coding agent dispatch
sandboxes: **Depot** (current), **GitHub Codespaces**, **AWS EC2** (on-demand + spot),
**AWS ECS Fargate**, and **AWS EKS**.

At our corrected usage volume of **150-300 dispatches/week**, cost differences are
significant:

| Platform | Monthly (150/wk) | Monthly (300/wk) |
|---|---|---|
| Depot ($0.01/min) | **$217** | **$435** |
| Codespaces 2-core | **$66 + $4** | **$131 + $4** |
| Codespaces 4-core | **$131 + $4** | **$261 + $4** |
| EC2 Spot (t3.medium) | **$14** | **$29** |
| EC2 On-Demand (t3.medium) | **$46** | **$91** |
| ECS Fargate (1 vCPU / 4 GB) | **$38** | **$76** |
| EKS (t3.medium spot + control plane) | **$87** | **$102** |

**Recommendation:** Migrate to **EC2 Spot instances** with pre-baked AMIs. At our volume,
EC2 Spot saves **$188-406/month** vs Depot ($2,256-4,872/year). The migration effort
(~40-60 hours) pays for itself within 2-3 months. ECS Fargate is the runner-up if we
want managed containers without instance management.

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

### AWS EC2

Amazon EC2 provides virtual servers with full OS control. Instances can be launched
on-demand or as spot instances (up to 90% discount). Pre-baked AMIs allow fast boot
with our entire toolchain pre-installed.

### AWS ECS Fargate

ECS Fargate runs containers without managing servers. Tasks are defined as container
images with CPU/memory allocations. Pay only for vCPU and memory consumed per second.
No cluster management required.

### AWS EKS

EKS provides managed Kubernetes. Agent sandboxes run as pods on auto-scaling node
groups. Maximum control and flexibility but highest ops overhead.

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

### AWS EC2 Pricing (us-east-1)

| Instance | vCPU | RAM | On-Demand/hr | Spot/hr (typical) |
|---|---|---|---|---|
| t3.medium | 2 | 4 GB | $0.042 | ~$0.013 |
| t3.large | 2 | 8 GB | $0.083 | ~$0.025 |
| m6i.large | 2 | 8 GB | $0.096 | ~$0.029 |

**Additional costs:**
- EBS storage: ~$0.08/GB/month (gp3). 20 GB AMI = $1.60/month
- Data transfer out: first 100 GB/month free, then $0.09/GB
- AMI storage: negligible (~$0.05/GB/month for snapshots)

### AWS ECS Fargate Pricing (us-east-1)

| Resource | Per-second rate | Per-hour rate |
|---|---|---|
| vCPU | $0.00001417 | $0.051 |
| Memory (GB) | $0.00000156 | $0.0056 |

**Example: 1 vCPU / 4 GB task:**
- Per hour: $0.051 + (4 x $0.0056) = **$0.073/hr**

**Example: 2 vCPU / 4 GB task:**
- Per hour: $0.102 + (4 x $0.0056) = **$0.124/hr**

### AWS EKS Pricing

| Component | Cost |
|---|---|
| EKS control plane | $0.10/hr ($73/month) |
| Worker nodes | EC2 pricing (on-demand or spot) |
| Fargate pods on EKS | Fargate pricing + 20% premium |

---

## 3. Cost Model: Our Usage Patterns

### Assumptions (REVISED)

| Parameter | Value |
|---|---|
| **Dispatches per week** | **150-300** (10+ per session, multiple sessions/day) |
| Opus agent session length | 30-60 min (avg 45 min) |
| Haiku agent session length | 15-30 min (avg 22 min) |
| Opus:Haiku ratio | ~50:50 |
| Parallel sessions | 4-6 (affects capacity, not per-dispatch cost) |
| Weeks per month | 4.33 |

**Note:** Previous estimate of 20-30 dispatches/week was incorrect by ~10x.
Actual usage: 10+ agents dispatched per 40-minute session, 30-50 dispatches on heavy days.

### Per-Dispatch Cost

**Average session time (blended 50/50 Opus/Haiku):** (45 + 22) / 2 = **33.5 min** (~0.558 hr)

| Platform | Per-Dispatch Cost | Rate |
|---|---|---|
| Depot | **$0.335** | $0.01/min x 33.5 min |
| Codespaces 2-core | **$0.101** | $0.003/min x 33.5 min |
| Codespaces 4-core | **$0.201** | $0.006/min x 33.5 min |
| EC2 Spot (t3.medium) | **$0.007** | $0.013/hr x 0.558 hr |
| EC2 On-Demand (t3.medium) | **$0.023** | $0.042/hr x 0.558 hr |
| ECS Fargate (2 vCPU / 4 GB) | **$0.069** | $0.124/hr x 0.558 hr |

### Monthly Cost Estimate

| Platform | 150/week ($) | 300/week ($) |
|---|---|---|
| **Depot** (Dev plan, $0.01/min) | **$217** | **$435** |
| **Codespaces 2-core** + storage | **$70** | **$135** |
| **Codespaces 4-core** + storage | **$135** | **$265** |
| **EC2 Spot** (t3.medium) + EBS | **$14** | **$29** |
| **EC2 On-Demand** (t3.medium) + EBS | **$46** | **$91** |
| **ECS Fargate** (2 vCPU / 4 GB) | **$47** | **$93** |
| **EKS** (spot nodes + control plane) | **$87** | **$102** |

*EKS cost includes the fixed $73/month control plane fee, which dominates at lower volumes.*

### Annual Projection

| Platform | Low (150/wk) | High (300/wk) |
|---|---|---|
| Depot (Developer plan) | $2,604/year | $5,220/year |
| Codespaces 2-core | $840/year | $1,620/year |
| Codespaces 4-core | $1,620/year | $3,180/year |
| EC2 Spot (t3.medium) | $168/year | $348/year |
| EC2 On-Demand (t3.medium) | $552/year | $1,092/year |
| ECS Fargate (2 vCPU / 4 GB) | $564/year | $1,116/year |
| EKS (spot + control plane) | $1,044/year | $1,224/year |

### Cost Verdict

At 150-300 dispatches/week, the cost differences are **material**:

1. **EC2 Spot is 15-30x cheaper than Depot** ($14-29/mo vs $217-435/mo)
2. **EC2 On-Demand is 5-7x cheaper than Depot** ($46-91/mo vs $217-435/mo)
3. **ECS Fargate is 5x cheaper than Depot** ($47-93/mo vs $217-435/mo)
4. **Codespaces 2-core is 3x cheaper than Depot** ($70-135/mo vs $217-435/mo)
5. **EKS is 2-4x cheaper than Depot** but the control plane fee reduces the advantage

Annual savings vs Depot range from **$1,764 (Codespaces)** to **$4,872 (EC2 Spot)**
at high volume. These are no longer negligible.

---

## 4. AWS Option Details

### 4.1 EC2 — On-Demand and Spot Instances

#### How it works

Each agent dispatch launches an EC2 instance from a pre-baked AMI. The instance runs
Claude Code, executes the task, pushes results, and terminates. Spot instances offer
the same compute at 60-70% discount, with the risk of interruption (2-minute warning).

#### Pre-baked AMI Strategy

Build a custom AMI with:
- Ubuntu 22.04 or Amazon Linux 2023
- Node.js (our project version)
- Claude Code CLI (pre-installed, pre-authenticated via instance role or env vars)
- git, gh CLI, jq, standard build tools
- Project dependencies pre-installed (`npm ci` baked into AMI)
- Our repo cloned at a known state

**AMI rebuild frequency:** On each dependency change or weekly, via a CI pipeline.
Build time: ~10-15 minutes. Can be automated with Packer or EC2 Image Builder.

#### Session Lifecycle

1. **Launch:** `aws ec2 run-instances --image-id ami-xxx --instance-type t3.medium --spot`
2. **Bootstrap:** Instance starts (~30-60s from AMI), pulls latest code, runs agent
3. **Execute:** Claude Code runs the task (15-60 min)
4. **Collect:** Agent pushes commits/PRs; logs written to CloudWatch or S3
5. **Terminate:** Instance self-terminates or is terminated by orchestrator

#### Log/Transcript Retrieval

- CloudWatch Logs agent on AMI streams stdout/stderr in real time
- Alternatively, write transcript to S3 bucket on completion
- CloudWatch Log Insights for querying across dispatches

#### Cold Start Time

| Scenario | Time |
|---|---|
| From AMI (on-demand) | 30-60 seconds |
| From AMI (spot) | 30-90 seconds (+ spot fulfillment) |
| With warm pool (standby instances) | 5-15 seconds |

A warm pool of 2-3 standby instances eliminates cold start but adds ~$2-6/day cost.

#### Setup Effort

| Task | Hours |
|---|---|
| AMI creation with Packer | 4-8 |
| Launch/terminate orchestration script | 8-12 |
| CloudWatch/S3 log pipeline | 4-6 |
| IAM roles and security groups | 2-4 |
| Spot interruption handling | 4-6 |
| Testing and validation | 8-12 |
| **Total** | **30-48 hours** |

#### Ongoing Ops Overhead

- AMI rebuilds: ~2 hrs/month (mostly automated)
- Spot availability monitoring: minimal (SNS alerts)
- Cost monitoring: CloudWatch billing alarms
- Security patching: quarterly AMI rebuild
- **Estimated:** 2-4 hours/month

#### Pros

- Cheapest option, especially with spot pricing
- Full OS control — install anything
- Simple mental model: launch instance, run agent, terminate
- Spot interruption risk is low for 15-60 min tasks (historical rate <5%)

#### Cons

- Must build orchestration (launch, monitor, terminate, retry)
- AMI maintenance burden
- Spot can be interrupted (need retry logic)
- No built-in session persistence (must build if needed)
- Cold start slower than Depot (30-60s vs 5s)

---

### 4.2 ECS Fargate — Containerized Agent Sandboxes

#### How it works

Each agent dispatch runs as a Fargate task. A Docker image contains our toolchain and
Claude Code. Tasks are defined in a task definition with CPU/memory allocations.
ECS manages placement — no EC2 instances to manage.

#### Container Image Strategy

Build a Docker image with:
```dockerfile
FROM node:20-slim
RUN npm install -g @anthropic-ai/claude-code
RUN apt-get update && apt-get install -y git gh jq
COPY . /workspace
RUN cd /workspace && npm ci
```

**Image rebuild:** On each dependency change, via ECR + CI pipeline.
Build time: ~5-10 minutes. Push to ECR (~$0.10/GB/month storage).

#### Session Lifecycle

1. **Launch:** `aws ecs run-task --task-definition agent-sandbox --launch-type FARGATE`
2. **Execute:** Container starts (~15-30s), runs Claude Code
3. **Collect:** Logs stream to CloudWatch automatically
4. **Terminate:** Task exits naturally; ECS cleans up

#### Log/Transcript Retrieval

- CloudWatch Logs integration is built-in (awslogs driver)
- Real-time streaming via `aws logs tail`
- Log retention policies configurable (7-365 days)

#### Cold Start Time

| Scenario | Time |
|---|---|
| Image cached on host | 10-20 seconds |
| Image pull required | 30-60 seconds |
| With provisioned capacity | 5-15 seconds |

#### Setup Effort

| Task | Hours |
|---|---|
| Dockerfile + ECR setup | 4-6 |
| ECS task definition + cluster | 4-6 |
| VPC/networking/security groups | 4-6 |
| Orchestration script (run-task) | 6-10 |
| CloudWatch log configuration | 2-4 |
| Testing and validation | 8-12 |
| **Total** | **28-44 hours** |

#### Ongoing Ops Overhead

- Image rebuilds: ~1 hr/month (automated via CI)
- Monitoring: CloudWatch dashboards + alarms
- No instance management (Fargate handles it)
- **Estimated:** 1-3 hours/month

#### Pros

- No instance management — true serverless containers
- Built-in CloudWatch logging
- Simple scaling — just run more tasks
- Pay-per-second billing, no idle waste
- Task definitions are versioned and auditable

#### Cons

- Slightly more expensive than EC2 spot ($0.124/hr vs $0.013/hr)
- 4 vCPU / 30 GB max per task (sufficient for our needs)
- No persistent filesystem between tasks (use EFS if needed, adds cost)
- Container image size affects cold start
- Less OS-level control than EC2

---

### 4.3 EKS — Kubernetes-Managed Agent Pods

#### How it works

Agent sandboxes run as Kubernetes pods on an EKS cluster. Node groups auto-scale
based on pending pods. Karpenter or Cluster Autoscaler manages capacity.

#### Pod Specification

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: agent-dispatch-123
spec:
  template:
    spec:
      containers:
      - name: claude-agent
        image: <ecr-repo>/agent-sandbox:latest
        resources:
          requests:
            cpu: "2"
            memory: "4Gi"
      restartPolicy: Never
  backoffLimit: 1
```

#### Session Lifecycle

1. **Launch:** `kubectl apply -f dispatch-job.yaml` (or via Kubernetes API)
2. **Schedule:** Karpenter provisions a spot node if needed (~30-90s)
3. **Execute:** Pod runs Claude Code
4. **Collect:** Logs via `kubectl logs` or FluentBit → CloudWatch
5. **Cleanup:** Job TTL controller deletes completed jobs

#### Log/Transcript Retrieval

- `kubectl logs job/agent-dispatch-123`
- FluentBit DaemonSet → CloudWatch Logs (recommended for persistence)
- Or Loki/Grafana for self-hosted log aggregation

#### Cold Start Time

| Scenario | Time |
|---|---|
| Node available, image cached | 5-15 seconds |
| Node available, image pull | 15-30 seconds |
| New node provisioning (Karpenter) | 60-120 seconds |

#### Setup Effort

| Task | Hours |
|---|---|
| EKS cluster creation (eksctl/terraform) | 8-12 |
| Karpenter/autoscaler setup | 6-10 |
| Docker image + ECR | 4-6 |
| Job template + orchestration | 8-12 |
| Networking (VPC, security groups, IAM) | 6-8 |
| Logging (FluentBit + CloudWatch) | 4-6 |
| Monitoring (Prometheus/Grafana or CloudWatch) | 4-8 |
| Testing and validation | 8-12 |
| **Total** | **48-74 hours** |

#### Ongoing Ops Overhead

- Kubernetes version upgrades: quarterly, 4-8 hrs each
- Node group maintenance: 2-4 hrs/month
- Monitoring and alerting: 2-4 hrs/month
- Security patching: 2-4 hrs/month
- **Estimated:** 8-16 hours/month

#### Pros

- Maximum control and flexibility
- Excellent auto-scaling with Karpenter
- Spot instance support on worker nodes
- Rich ecosystem (monitoring, logging, networking)
- Can run any container workload

#### Cons

- **$73/month fixed cost** for EKS control plane (regardless of usage)
- Highest ops overhead of all options (8-16 hrs/month)
- Kubernetes expertise required
- Over-engineered for our current scale (150-300 dispatches/week)
- Complex networking and IAM setup

---

## 5. Feature Comparison Matrix (All 5 Platforms)

| Feature | Depot | Codespaces | EC2 | ECS Fargate | EKS |
|---|---|---|---|---|---|
| **Purpose** | Agent sandbox | Cloud dev env | General compute | Containers | Container orchestration |
| **Machine specs** | 2 vCPU / 4 GB | 2-32 cores | Any instance type | Up to 4 vCPU / 30 GB | Any (node-based) |
| **Cold start** | ~5 sec | 25-30 sec (prebuild) | 30-60 sec (AMI) | 10-30 sec | 5-120 sec (varies) |
| **Billing** | Per-second | Per-minute | Per-second | Per-second | Per-second + $73/mo |
| **Per-dispatch (blended)** | $0.335 | $0.101-0.201 | $0.007-0.023 | $0.069 | $0.007 + fixed |
| **Monthly (150/wk)** | $217 | $70-135 | $14-46 | $47 | $87 |
| **Monthly (300/wk)** | $435 | $135-265 | $29-91 | $93 | $102 |
| **Setup effort** | 0 hrs (current) | 32-64 hrs | 30-48 hrs | 28-44 hrs | 48-74 hrs |
| **Ops overhead** | 0 hrs/mo | 1-2 hrs/mo | 2-4 hrs/mo | 1-3 hrs/mo | 8-16 hrs/mo |
| **Session persistence** | Yes (built-in) | Yes (VM state) | No (must build) | No (ephemeral) | No (ephemeral) |
| **Session resume** | Yes (session ID) | Yes (stop/start) | No | No | No |
| **Log retrieval** | Dashboard UI | CLI + API | CloudWatch/S3 | CloudWatch (built-in) | kubectl + FluentBit |
| **Claude Code install** | Native | Manual (devcontainer) | Pre-baked AMI | Docker image | Docker image |
| **Prebuild/image** | Implicit | devcontainer prebuilds | Packer AMI | Docker + ECR | Docker + ECR |
| **Agent support** | Claude Code only | Any | Any | Any | Any |
| **Idle timeout** | Auto (agent-driven) | Configurable | Must build | Task-driven (auto) | Job TTL |
| **Spot/preemptible** | No | No | Yes (60-70% savings) | No (Fargate Spot exists but limited) | Yes (node level) |

---

## 6. Session Control (Depot vs Codespaces — unchanged)

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
- Full lifecycle management: create -> active -> stopped -> deleted
- **Programmatic control**: `gh codespace create --idle-timeout 15m`

**Verdict:** Codespaces has more granular session lifecycle control. AWS options (EC2,
ECS, EKS) offer full programmatic control but require building the lifecycle management.

---

## 7. Session Logs

### Depot

- View full conversation and sandbox execution history in the **Depot Dashboard**
- Must use the web UI — no documented CLI or API for log export
- Good for manual review; less suitable for automated log collection

### GitHub Codespaces

- `gh codespace logs -c <name> > logs.txt` — programmatic log export
- VS Code Command Palette: "Codespaces: Export Logs"
- Logs include detailed container, session, and environment information

### AWS Options

- **EC2:** CloudWatch Logs agent streams stdout/stderr; query with Log Insights
- **ECS Fargate:** Built-in CloudWatch integration via awslogs driver; easiest AWS logging
- **EKS:** FluentBit DaemonSet to CloudWatch or self-hosted Loki; most flexible

**Verdict:** ECS Fargate has the best out-of-box logging among AWS options. Depot's
UI works for manual review. Codespaces offers good CLI access. EC2 and EKS require
more setup.

---

## 8. Prebuild Speed

### Depot

- **~5 seconds** cold start (containers, not VMs)
- Pre-installed languages and package managers
- No custom prebuild configuration needed
- Consistent start time regardless of project complexity

### GitHub Codespaces

- **25-30 seconds** with prebuilds configured
- **2-7 minutes** without prebuilds (cold, from scratch)
- Prebuilds run on push/PR, consuming additional compute
- Prebuild storage costs apply ($0.07/GB/month)

### EC2 (AMI)

- **30-60 seconds** from pre-baked AMI
- **5-15 seconds** with warm pool (standby instances)
- AMI rebuild: ~10-15 min via Packer, automated in CI
- Full toolchain pre-installed — no runtime setup needed

### ECS Fargate (Docker)

- **10-20 seconds** with cached image
- **30-60 seconds** on image pull
- Image rebuild: ~5-10 min via CI, push to ECR
- Container starts and runs agent immediately

### EKS (Kubernetes)

- **5-15 seconds** if node available and image cached
- **60-120 seconds** if new node provisioning required (Karpenter)
- Same Docker images as ECS; managed via ECR

**Verdict:** Depot wins on cold start (5s). EC2 warm pool comes close (5-15s). ECS
Fargate is competitive (10-20s cached). Codespaces is slowest (25-30s).

---

## 9. API/CLI Integration

### Depot

```bash
depot claude -p "your prompt" --model opus
# Returns session URL immediately
```

### GitHub Codespaces

```bash
gh codespace create -r fenrir-ledger -b main -m basicLinux32gb
gh codespace ssh -c <name> -- "claude -p 'your prompt' --model opus"
# Need to handle lifecycle: create -> run -> stop -> delete
```

### EC2

```bash
INSTANCE_ID=$(aws ec2 run-instances --image-id ami-xxx \
  --instance-type t3.medium --instance-market-options '{"MarketType":"spot"}' \
  --user-data file://agent-bootstrap.sh \
  --query 'Instances[0].InstanceId' --output text)
# Bootstrap script runs Claude Code, pushes results, self-terminates
```

### ECS Fargate

```bash
aws ecs run-task --cluster agent-cluster \
  --task-definition agent-sandbox:latest \
  --launch-type FARGATE \
  --overrides '{"containerOverrides":[{"name":"claude-agent","command":["claude","-p","your prompt"]}]}'
```

### EKS

```bash
kubectl create job agent-123 --image=<ecr>/agent-sandbox:latest \
  -- claude -p "your prompt" --model opus
```

**Verdict:** Depot is simplest (1 command). AWS options require orchestration but offer
more control. ECS and EKS have clean APIs for task/job submission.

---

## 10. Reliability

### Depot

- **99.93% uptime** (Nov 2025 - Feb 2026, per status.depot.dev)
- Newer platform, smaller scale
- Container-based — fewer failure modes than full VMs

### GitHub Codespaces

- **Multiple major outages in late 2025:**
  - Sep 17: ~250 codespaces **lost data irrecoverably** in West Europe
  - Oct 20: Creation error rate peaked at **71%**, resume at **46%**
  - Oct 29: Error rates **peaked at 100%** across all regions (~9 hours)
  - Mar 2026: 100% failure rate in Australia East
- GitHub's overall uptime dropped below 90% at one point in 2025

### AWS

- EC2: **99.99% SLA** (single AZ), 99.5% SLA (per-instance)
- ECS Fargate: **99.99% SLA**
- EKS: **99.95% SLA** (control plane)
- AWS has the longest reliability track record of all options
- Multi-AZ deployment possible for additional resilience

**Verdict:** AWS services have the strongest SLAs and reliability track record. Depot
has been reliable in our measurement period. Codespaces' outage history is concerning.

---

## 11. Migration Effort Comparison

| Platform | Setup Hours | Monthly Ops Hours | Break-even vs Depot (150/wk) | Break-even vs Depot (300/wk) |
|---|---|---|---|---|
| Codespaces | 32-64 | 1-2 | ~3-4 months | ~2 months |
| EC2 Spot | 30-48 | 2-4 | ~1-2 months | ~1 month |
| EC2 On-Demand | 30-48 | 2-4 | ~2-3 months | ~1-2 months |
| ECS Fargate | 28-44 | 1-3 | ~2-3 months | ~1-2 months |
| EKS | 48-74 | 8-16 | ~6-12 months* | ~4-6 months* |

*EKS break-even is longer due to high ongoing ops overhead (valued at $50-100/hr engineering time).

---

## 12. Recommendation

### Migrate to EC2 Spot Instances

**Rationale:**

1. **Cost savings are now material.** At 150-300 dispatches/week, EC2 Spot saves
   **$188-406/month** vs Depot ($2,256-4,872/year). This is no longer $15-30/month —
   it's real money.

2. **Migration pays for itself quickly.** 30-48 hours of setup at any reasonable
   engineering rate is recouped within 1-3 months of savings. The previous "migration
   cost exceeds savings" argument was based on 10x lower volume.

3. **Spot interruption risk is manageable.** For 15-60 minute tasks, spot interruption
   rates are historically <5%. We can add on-demand fallback for the rare interruption
   case (still 5x cheaper than Depot).

4. **Full control.** We own the AMI, the orchestration, and the infrastructure. No
   vendor lock-in to Depot's proprietary sandbox platform.

5. **Proven infrastructure.** EC2 has 99.99% SLA and 18+ years of track record.

### Runner-up: ECS Fargate

If we want managed containers (no instance management, built-in logging, simpler ops):

- Monthly cost: $47-93 (still 3-5x cheaper than Depot)
- Lower ops burden than EC2 (1-3 hrs/month vs 2-4)
- Better logging out of the box
- Trade-off: ~3-4x more expensive than EC2 Spot

### What we lose by leaving Depot

- **5-second cold starts** (EC2 is 30-60s, though warm pool mitigates this)
- **Built-in session persistence and resume** (must build if needed)
- **`depot claude` simplicity** (must build orchestration)
- **Depot Dashboard** for session review (replaced by CloudWatch)

These are real trade-offs, but at our volume the $200-400/month savings justify the
additional engineering investment.

### Not recommended

- **GitHub Codespaces:** Cheaper than Depot but more expensive than AWS. Reliability
  concerns (late-2025 outages, data loss). No compelling advantage over AWS options.
- **EKS:** Over-engineered for our scale. $73/month control plane fee + 8-16 hrs/month
  ops overhead. Only justified if we grow to 1,000+ dispatches/week or need multi-tenant
  isolation.

### Action Items

1. **Build proof-of-concept** with EC2 Spot: AMI creation, launch/terminate script,
   CloudWatch logging. Estimate: 2-3 days.
2. **Test spot availability** in us-east-1 for t3.medium over a 2-week period.
3. **Build on-demand fallback** for spot interruption cases.
4. **Keep Depot running** during migration (no disruption to current workflow).
5. **Set a 30-day migration timeline** with parallel running during validation.
6. **Revisit ECS Fargate** if ops burden of EC2 proves higher than estimated.
