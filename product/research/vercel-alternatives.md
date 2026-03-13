# Vercel Alternatives for Hosting — Cost Analysis

**Issue:** #656
**Date:** 2026-03-13
**Author:** FiremanDecko (Principal Engineer)

---

## Executive Summary

At our deployment volume (2,000-6,000 deploys/month), **Cloudflare Pages + Workers** is the clear winner on cost, offering 5,000 builds/month on the $5/mo Workers Paid plan with unlimited bandwidth, unlimited preview deployments, and full Next.js support via OpenNext. For a project with low traffic and extreme deployment frequency driven by CI/CD agents, Cloudflare's pricing model is structurally superior to Vercel's.

**Runner-up:** If we proceed with AWS infrastructure for agent sandboxes (#627), **Coolify on a Hetzner/AWS VPS** ($4-10/mo) gives us unlimited deploys at a fixed cost and complete infrastructure ownership.

**Current Vercel cost is manageable** (~$20-40/mo on Pro), but we're burning through the 6,000/day deployment limit during peak sessions. The risk isn't today's bill — it's that Vercel's model charges for everything *around* deployments (functions, bandwidth, build time) and those costs grow unpredictably.

Migration effort is explicitly **trivial** — agents rewrite platform-specific config in minutes.

---

## Current Vercel Cost Analysis

### What We're On: Pro Plan ($20/mo per deploying seat)

| Resource | Included (Pro) | Overage Rate |
|---|---|---|
| Base cost | $20/mo per deploying seat | — |
| Monthly credit | $20 (applied to overages) | — |
| Deployments/day | 6,000 | Hard limit |
| Concurrent builds | 12 | — |
| Fast Data Transfer | 1 TB/mo | $0.15/GB |
| Edge Requests | 10M/mo | — |
| Serverless Invocations | 1M/mo | $0.60/M |
| Serverless CPU | 16 CPU-hrs/mo | $0.128/CPU-hr |
| Serverless Memory | 1,440 GB-hrs/mo | $0.0106/GB-hr |
| Function Duration | 40 hrs/mo | $5/hr |
| Build time | 45 min max per build | — |

### Cost at Our Volume

**At 2,000 deploys/month (~67/day):**
- Base: $20/mo (1 seat)
- Well within 6,000/day limit
- Low traffic = minimal function/bandwidth overages
- **Estimated: $20-25/mo**

**At 6,000 deploys/month (~200/day):**
- Base: $20/mo (1 seat)
- Still within 6,000/day limit on most days
- Peak sessions (50 deploys/hr for several hours) could hit the daily cap
- Function invocations from preview deploys being tested: potential overages
- **Estimated: $25-40/mo**

**Risk scenario — 50 deploys/hr sustained:**
- 50 deploys/hr x 8 hrs = 400 deploys/day — well within 6,000/day
- BUT: each deploy that runs SSR burns serverless compute
- If preview deploys receive automated testing hits, function costs accumulate
- Vercel's spend management default cap: $200/mo

### Vercel's Hidden Cost: Complexity

The real problem isn't the dollar amount today — it's the pricing model's unpredictability. Every dimension (CPU, memory, invocations, bandwidth, edge requests) is metered separately with different units and rates. At scale, this creates billing surprises.

---

## Platform-by-Platform Breakdown

### 1. Cloudflare Pages + Workers

**Pricing Model:** Flat fee + usage-based functions

| Item | Free | Pro ($5/mo Workers Paid) |
|---|---|---|
| Monthly builds | 500 | 5,000 |
| Concurrent builds | 1 | 5 |
| Bandwidth | Unlimited | Unlimited |
| Preview deploys | Unlimited | Unlimited |
| Custom domains | 100/project | 100/project |
| Workers requests | 100K/day | 10M/mo included |
| Workers overage | — | $0.30/M requests |
| KV operations | — | Included |

**Next.js Support:**
- Full support via **OpenNext** adapter (recommended over deprecated @cloudflare/next-on-pages)
- App Router, SSR, ISR, Image Optimization all supported
- Runs on Workers runtime (V8 isolates), not Node.js — some edge cases may differ
- Worker size limit: 10 MiB on paid plan (sufficient for most apps)

**Deployment Speed:**
- Build times comparable to Vercel for cached builds
- Edge deployment is near-instant globally (300+ edge locations)
- Cold starts: near-zero (V8 isolates vs Lambda containers)
- Sub-50ms global latency consistently

**Cost at Our Volume:**

| Scenario | Monthly Cost |
|---|---|
| 2,000 deploys/mo | **$5** (within 5,000 build limit) |
| 6,000 deploys/mo | **$5 + overage builds** — need Business plan ($20/mo, 20,000 builds) or split across projects |

**Limitations:**
- OpenNext is community-maintained, not Cloudflare-official
- Worker size limit (10 MiB) could be constraining for large apps
- Some Node.js APIs not available in Workers runtime
- Build timeout: 20 minutes (vs Vercel's 45 min)

**Verdict:** Best cost-to-feature ratio for our use case. The $5/mo plan covers 2,000 deploys easily. At 6,000, we'd need the Business plan at ~$20/mo — still competitive.

---

### 2. Netlify

**Pricing Model:** Credit-based (new as of Sep 2025)

| Item | Free | Pro ($20/mo) |
|---|---|---|
| Credits included | 500 | 5,000 |
| Cost per production deploy | 15 credits | 15 credits |
| Preview deploys | Free | Free |
| Bandwidth | 10 credits/GB | 10 credits/GB |
| Web requests | 3 credits/10K | 3 credits/10K |
| Concurrent builds | 1 | 1 (+$40/additional) |
| Functions | 125K invocations | Included in credits |

**Next.js Support:**
- Full SSR via Netlify Next.js Runtime
- App Router supported
- Some features lag behind Vercel's first-party support

**Deployment Speed:**
- Slower builds than Vercel (no aggressive caching by default)
- 1 concurrent build on Pro (bottleneck at 50 deploys/hr)
- Adding concurrent builds costs $40/each

**Cost at Our Volume:**

| Scenario | Calculation | Monthly Cost |
|---|---|---|
| 2,000 deploys/mo | Only ~333 production deploys fit in 5,000 credits (333 x 15 = 4,995). Remaining deploys must be previews (free) or buy more credits. | **$20 + credit packs** |
| 6,000 deploys/mo | If most are preview deploys (free), cost stays low. If production: 6,000 x 15 = 90,000 credits needed — far beyond included 5,000. | **$20 + significant credit overage** |

**Critical Issue:** At 15 credits per production deploy, the Pro plan's 5,000 credits only cover **333 production deploys/month**. Our volume would require massive credit purchases unless we ensure most deploys are preview (branch) deploys, which are free.

**Verdict:** The credit system punishes high-frequency production deployments. Preview deploys are free, which helps if our workflow is PR-based. But the 1 concurrent build limit at $40/additional is a dealbreaker for 50 deploys/hr throughput.

---

### 3. AWS Amplify

**Pricing Model:** Pure pay-per-use

| Item | Free Tier | Paid Rate |
|---|---|---|
| Build minutes | 1,000/mo | $0.01/min |
| Data served | 15 GB/mo | $0.15/GB |
| Data stored | 5 GB/mo | $0.023/GB/mo |
| SSR requests | 500K/mo | $0.30/M |
| SSR compute | 100 GB-hrs/mo | $0.20/GB-hr |

**Next.js Support:**
- Next.js 12-15 fully supported (App Router, SSR, ISR, Image Optimization)
- Amplify Hosting compute manages SSR automatically
- Native AWS integration

**Deployment Speed:**
- Slower than Vercel/Cloudflare (2-5 min typical for Next.js)
- No public benchmarks for edge latency
- Preview deployments supported per PR

**Cost at Our Volume:**

Assuming ~5 min average build time:

| Scenario | Build Cost | Hosting | Total |
|---|---|---|---|
| 2,000 deploys/mo | 10,000 min - 1,000 free = 9,000 x $0.01 = $90 | ~$5 | **~$95/mo** |
| 6,000 deploys/mo | 30,000 min - 1,000 free = 29,000 x $0.01 = $290 | ~$5 | **~$295/mo** |

**Advantage:** If we're already on AWS for agent sandboxes (#627), co-locating reduces operational complexity. Direct VPC access, shared IAM, unified billing.

**Verdict:** Pure pay-per-build-minute pricing is expensive at our deployment volume. The build cost alone exceeds every other option. Only makes sense if AWS ecosystem integration is a hard requirement.

---

### 4. Self-Hosted: Coolify on VPS

**Pricing Model:** Fixed VPS cost, zero per-deploy cost

| Component | Cost |
|---|---|
| Coolify | Free (self-hosted) |
| Hetzner CX22 (2 vCPU, 4GB RAM) | ~$4.50/mo |
| Hetzner CX32 (4 vCPU, 8GB RAM) | ~$7.50/mo |
| Domain + SSL | Free (Let's Encrypt) |
| Bandwidth (20 TB included) | $0 at our traffic |

**Features:**
- Git push triggers (GitHub webhook integration)
- Preview deployments per PR
- Automatic SSL via Let's Encrypt
- Docker-based deployments
- Web dashboard for management
- Auto-detected Next.js builds

**Deployment Speed:**
- Build on the VPS itself — depends on VPS specs
- 4GB RAM VPS: ~3-8 min for Next.js build
- No global CDN by default (add Cloudflare CDN for free)
- Zero cold starts (always-on container)

**Cost at Our Volume:**

| Scenario | Monthly Cost |
|---|---|
| 2,000 deploys/mo | **$4.50-7.50** (VPS only) |
| 6,000 deploys/mo | **$4.50-7.50** (VPS only — unlimited deploys) |

**Limitations:**
- Self-managed infrastructure (updates, security, monitoring)
- Build queue limited by VPS CPU — 50 deploys/hr would queue up
- No built-in global CDN (pair with Cloudflare free tier)
- Single point of failure without HA setup
- Preview deploys work but less polished than Vercel's UX

**Verdict:** Lowest possible cost. Zero marginal cost per deploy. The trade-off is operational overhead, but for a project where agents handle deploys (not humans), the UX trade-off is irrelevant. Build queue congestion at peak is the real concern — mitigated by a beefier VPS ($7-15/mo).

---

### 5. Self-Hosted: CapRover on VPS

Similar to Coolify but older and more established:

| Aspect | Details |
|---|---|
| Cost | Same as Coolify (VPS cost only: $4-10/mo) |
| Next.js support | Via Docker, any Node.js app works |
| Preview deploys | Manual setup required (less automated than Coolify) |
| SSL | Let's Encrypt automatic |
| Scaling | Docker Swarm for multi-server |

**Verdict:** Viable but Coolify is more modern and has better Next.js auto-detection. CapRover requires more manual configuration for preview deploys.

---

### 6. Railway

**Pricing Model:** Subscription + resource usage

| Plan | Base Cost | Included Credit | Resource Pricing |
|---|---|---|---|
| Hobby | $5/mo | $5 usage | vCPU: $0.000231/min, RAM: $0.000231/GB/min |
| Pro | $20/mo/seat | $20 usage | Same rates, priority support |

**Next.js Support:**
- Full support (runs as Docker container or Nixpack)
- SSR, API routes, all features work
- No edge runtime — runs in specific region

**Deployment Speed:**
- Fast builds with Nixpacks
- No global CDN (single-region deployment)
- Zero-downtime deploys included

**Cost at Our Volume:**

A typical Next.js app uses ~0.5 vCPU and 512MB RAM when idle:
- Always-on cost: ~$5-8/mo for the container
- Deploys trigger rebuilds but don't incur per-deploy charges
- Total: **$5-15/mo** depending on traffic

| Scenario | Monthly Cost |
|---|---|
| 2,000 deploys/mo | **$5-10** (Hobby) |
| 6,000 deploys/mo | **$5-10** (Hobby, same cost — unlimited deploys) |

**Limitations:**
- No built-in preview deploys per PR (workaround: create ephemeral services)
- Single-region deployment (no edge)
- No permanent free tier (trial only)
- Limited build concurrency

**Verdict:** Good value for always-on apps. No per-deploy charges. But lack of native preview deployments is a significant gap for our PR-driven workflow.

---

### 7. Render

**Pricing Model:** Service-based billing

| Tier | Cost | Specs |
|---|---|---|
| Free (static) | $0 | 100GB bandwidth, 500 build min |
| Starter (web service) | $7/mo | 0.5 CPU, 512MB RAM |
| Standard | $25/mo | 1 CPU, 2GB RAM |

**Next.js Support:**
- Full SSR support as web service
- Static export on free tier
- PR preview environments (Professional plan required)

**Deployment Speed:**
- Reasonable build times
- Prorated by the second (pay only for uptime)
- Preview environments billed same as production

**Cost at Our Volume:**

| Scenario | Monthly Cost |
|---|---|
| 2,000 deploys/mo | **$7/mo** (Starter — unlimited deploys) |
| 6,000 deploys/mo | **$7/mo** (Starter — unlimited deploys) |

**Limitations:**
- Preview environments only on Professional workspace plan
- Preview environments billed at same rate as production services
- Each preview = separate billable service while running
- Single region (no edge)

**Verdict:** Simple pricing, but preview environment costs add up quickly if every PR spins up a $7/mo service. At 10+ concurrent PRs, preview costs alone could exceed $70/mo.

---

## Cost Comparison Table

### At 2,000 Deploys/Month

| Platform | Base Cost | Deploy Cost | Hosting/Compute | Total Est. | Notes |
|---|---|---|---|---|---|
| **Cloudflare Pages** | $5 | $0 (within 5K limit) | $0 | **$5/mo** | Best value |
| **Coolify (Hetzner)** | $4.50-7.50 | $0 | Included | **$5-8/mo** | Self-managed |
| **Railway** | $5 | $0 | ~$5-8 | **$5-10/mo** | No preview deploys |
| **Render** | $7 | $0 | Included | **$7/mo** | Limited previews |
| **Vercel Pro** | $20 | $0 | ~$0-5 overage | **$20-25/mo** | Best DX |
| **Netlify Pro** | $20 | 15 credits each | Shared credits | **$20-40/mo** | Credit burn risk |
| **AWS Amplify** | $0 | $0.01/build-min | ~$5 hosting | **~$95/mo** | Build minutes expensive |

### At 6,000 Deploys/Month

| Platform | Base Cost | Deploy Cost | Hosting/Compute | Total Est. | Notes |
|---|---|---|---|---|---|
| **Cloudflare Business** | $20 | $0 (within 20K limit) | $0 | **$20/mo** | Scales cleanly |
| **Coolify (Hetzner)** | $7.50-15 | $0 | Included | **$8-15/mo** | Upgrade VPS for build throughput |
| **Railway** | $5 | $0 | ~$5-8 | **$5-10/mo** | No preview deploys |
| **Render** | $7 | $0 | Included | **$7/mo** | Preview costs extra |
| **Vercel Pro** | $20 | $0 | ~$5-20 overage | **$25-40/mo** | Function overages likely |
| **Netlify Pro** | $20 | Credit overages | $$ | **$40-80+/mo** | Production deploy credits burn fast |
| **AWS Amplify** | $0 | $290 build min | ~$5 hosting | **~$295/mo** | Prohibitively expensive |

---

## Feature Parity Matrix

| Feature | Vercel | Cloudflare Pages | Netlify | AWS Amplify | Coolify | Railway | Render |
|---|---|---|---|---|---|---|---|
| Preview deploys per PR | Yes (best-in-class) | Yes | Yes | Yes | Yes | No (workaround) | Yes (paid plan) |
| Custom domains | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| SSL/TLS | Auto | Auto | Auto | Auto | Auto (LE) | Auto | Auto |
| Serverless functions | Yes | Yes (Workers) | Yes | Yes (Lambda) | No (container) | No (container) | No (container) |
| Edge functions | Yes | Yes (native) | Yes | No | No | No | No |
| SSR (Next.js) | Yes (native) | Yes (OpenNext) | Yes (Runtime) | Yes (native) | Yes (Docker) | Yes (Docker) | Yes (Docker) |
| ISR | Yes | Yes (OpenNext) | Yes | Yes | Manual | Manual | Manual |
| Image optimization | Yes | Yes (OpenNext) | Yes | Yes | Manual | Manual | Manual |
| Global CDN | Yes | Yes (300+ PoPs) | Yes | Yes (CloudFront) | No (add CF free) | No | No |
| Env variables | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Build concurrency | 12 (Pro) | 5 (Pro) | 1 (+$40 each) | Parallel | 1 (VPS CPU) | 1 | 1 |
| Deployment speed | ~30-90s | ~30-120s | ~60-180s | ~120-300s | ~180-480s | ~60-180s | ~60-180s |

---

## Deployment Speed Comparison

| Platform | Cold Build | Cached Build | Edge Propagation | Push-to-Live |
|---|---|---|---|---|
| Vercel | ~60-90s | ~30-45s | Instant (edge) | ~30-90s |
| Cloudflare Pages | ~60-120s | ~30-60s | Instant (300+ PoPs) | ~30-120s |
| Netlify | ~90-180s | ~60-120s | ~30s (CDN) | ~60-180s |
| AWS Amplify | ~120-300s | ~90-180s | ~30s (CloudFront) | ~120-300s |
| Coolify (VPS) | ~180-480s | ~120-240s | N/A (origin only) | ~120-480s |
| Railway | ~60-120s | ~45-90s | N/A (single region) | ~60-120s |
| Render | ~60-120s | ~45-90s | N/A (single region) | ~60-120s |

---

## Recommendation

### Primary: Cloudflare Pages + Workers ($5-20/mo)

**Why:**
1. **Cost structure matches our usage pattern.** We have extreme deployment frequency but low traffic. Cloudflare charges for builds (capped generously) and bandwidth (unlimited). This is the inverse of Vercel, which gives generous builds but meters runtime.
2. **$5/mo covers 5,000 builds.** Our typical 2,000-3,000 deploys/month fit comfortably. At peak (6,000), the Business plan at $20/mo provides 20,000 builds.
3. **Unlimited bandwidth and preview deployments.** No surprise bills from automated testing hitting preview URLs.
4. **Best edge performance.** 300+ PoPs, sub-50ms global latency, near-zero cold starts.
5. **Full Next.js support via OpenNext.** App Router, SSR, ISR, Image Optimization all work.

**Risks:**
- OpenNext is community-maintained — breaking changes possible on Next.js major upgrades
- Worker size limit (10 MiB) needs monitoring
- 20-minute build timeout (vs 45 min on Vercel) — currently not an issue for us

### Secondary: Coolify on VPS ($5-15/mo)

**Why consider:**
- Zero marginal cost per deploy — unlimited at fixed VPS price
- Full infrastructure ownership
- If we're on AWS for sandboxes (#627), we could run Coolify on the same infrastructure
- No vendor lock-in whatsoever

**When to choose this instead:**
- If Cloudflare's OpenNext adapter proves unreliable
- If we want to co-locate everything on AWS infrastructure
- If we need to run background jobs or non-HTTP services alongside the app

### Not Recommended

| Platform | Reason |
|---|---|
| **Vercel (current)** | Works fine today but pricing model doesn't reward our deployment pattern. We're paying for DX that agents don't need. |
| **Netlify** | Credit-based pricing actively penalizes high-frequency deploys. 15 credits per production build burns through allowance in 333 deploys. |
| **AWS Amplify** | $0.01/build-minute makes it the most expensive option at $95-295/mo. Only justified if deep AWS integration is required. |
| **Railway** | Good value but no native preview deploys — a hard requirement for our PR-driven workflow. |
| **Render** | Preview environments cost as much as production services — expensive at our PR volume. |

### Migration Note

Migration effort from Vercel to any of these platforms is **trivial**. The codebase uses standard Next.js patterns. An agent can:
- Add the OpenNext adapter for Cloudflare (~5 min)
- Write a Dockerfile for Coolify/Railway/Render (~5 min)
- Configure Amplify's `amplify.yml` (~5 min)
- Update CI/CD and environment variables (~10 min)

Total migration time: **under 30 minutes** with agent assistance.

---

## Decision Matrix (Weighted)

| Criteria (Weight) | Vercel | Cloudflare | Netlify | Amplify | Coolify | Railway | Render |
|---|---|---|---|---|---|---|---|
| Cost at volume (40%) | 6 | **10** | 4 | 2 | **9** | 8 | 7 |
| Deploy speed (20%) | **9** | **9** | 6 | 4 | 5 | 7 | 7 |
| Feature parity (20%) | **10** | 8 | 8 | 7 | 5 | 5 | 6 |
| Operational simplicity (10%) | **10** | 8 | 8 | 6 | 4 | 8 | 8 |
| Scalability (10%) | 9 | **10** | 7 | 8 | 4 | 6 | 6 |
| **Weighted Total** | **8.2** | **9.2** | **6.2** | **4.6** | **6.2** | **6.8** | **6.8** |

**Winner: Cloudflare Pages + Workers**

---

## Part 2: Unified Platform Deep Dive — AWS EKS vs Google GKE

**Issue:** #673 (extends #656, couples with #627)
**Date:** 2026-03-13
**Author:** FiremanDecko (Principal Engineer)

### Context

The research above focused on **app hosting** alternatives to Vercel. This section extends
that analysis to evaluate **unified platforms** that can serve both the Next.js app AND
agent sandbox execution on the same infrastructure. This couples the Vercel alternatives
question (#656) with the Depot alternatives question (#627) — one platform to rule them all.

**Odin's direction:** AWS native, full migration, preview deploys not important.

### Workload Parameters

| Workload | Spec | Pattern |
|---|---|---|
| **App hosting** | 1 Next.js container, 0.5 vCPU / 512 MB RAM | Always-on, low traffic (<1K visits/day) |
| **Agent sandboxes** | 0-8 concurrent pods, 2 vCPU / 4 GB RAM each | Bursty, 10-60 min lifetime |
| **Deployments** | 2,000-6,000/month (app), dozens/day (agents) | CI/CD driven |
| **Preview deploys** | Deprioritized | Not required |

---

### 8. AWS EKS Deep Dive

#### Control Plane Cost

The EKS control plane is a **fixed, unavoidable cost**:

| Item | Rate | Monthly |
|---|---|---|
| Control plane (standard support, first 14 months) | $0.10/hr | **$73/mo** |
| Control plane (extended support, after 14 months) | $0.60/hr | **$438/mo** |

**Critical:** You MUST upgrade Kubernetes versions within 14 months or the control plane
cost jumps 6x. This is a day-2 operational burden.

#### Compute Options for Worker Nodes

**Option A: Managed Node Groups (EC2)**

| Instance | vCPU | RAM | On-Demand/hr | Monthly (730 hrs) | Spot (~60-70% off) |
|---|---|---|---|---|---|
| t3.medium | 2 | 4 GB | $0.0416 | $30.37 | ~$10-12 |
| t3.large | 2 | 8 GB | $0.0832 | $60.74 | ~$20-25 |
| t3.xlarge | 4 | 16 GB | $0.1664 | $121.47 | ~$40-50 |

For our workload (1 app pod at 0.5 vCPU/512 MB + up to 8 agent pods at 2 vCPU/4 GB):
- **Peak demand:** 16.5 vCPU / 32.5 GB RAM (app + 8 agents)
- **Idle demand:** 0.5 vCPU / 512 MB (app only)

This extreme burstiness makes fixed node groups wasteful. You'd need 4-5 t3.xlarge nodes
to handle peak but they'd sit idle 90%+ of the time.

**Option B: Fargate (Serverless Pods)**

| Resource | Rate (us-east-1) | Per Pod Spec |
|---|---|---|
| vCPU | $0.04048/vCPU-hr | — |
| Memory | $0.004445/GB-hr | — |
| **App pod** (0.5 vCPU / 512 MB) | — | $0.0225/hr = **$16.41/mo** |
| **Agent pod** (2 vCPU / 4 GB) | — | $0.0988/hr |

Agent pod cost calculation:
- 2 vCPU x $0.04048 = $0.08096/hr
- 4 GB x $0.004445 = $0.01778/hr
- Total: $0.0988/hr per agent pod

Fargate Spot (up to 70% discount, 2-minute interruption warning):
- Agent pod on Spot: ~$0.030/hr (estimated)

**Option C: Karpenter (Recommended for EKS)**

Karpenter provisions EC2 instances directly (bypassing ASGs), picks optimal instance types,
and consolidates aggressively. Key advantages for our use case:
- Provisions nodes in ~45-60 seconds (vs 3-4 min for Cluster Autoscaler)
- Automatically selects Spot instances when available
- Consolidates when agent pods finish, terminating idle nodes
- No pre-configured node groups needed

#### Networking Costs

| Component | Rate | Monthly Est. |
|---|---|---|
| **NAT Gateway** | $0.045/hr + $0.045/GB processed | $32.85/mo + data |
| **ALB** | $0.0225/hr + $0.008/LCU-hr | ~$20-25/mo |
| **Data transfer (internet)** | $0.09/GB out | Minimal at our traffic |
| **Cross-AZ traffic** | $0.01/GB | Minimal |

**NAT Gateway warning:** This is the hidden cost killer. Every pod pulling images, calling
external APIs, or downloading dependencies goes through NAT. At $32.85/mo minimum (even
with zero data!), plus $0.045/GB, this adds up fast. For a low-traffic app, NAT costs
can exceed compute costs.

**Mitigation:** Use VPC endpoints for ECR, S3, and other AWS services to avoid NAT for
AWS-internal traffic. Consider NAT instances (t3.nano at $3.80/mo) instead of managed NAT
Gateway for non-production workloads.

#### Storage & Registry

| Component | Rate | Monthly Est. |
|---|---|---|
| ECR storage | $0.10/GB/mo | ~$1-2 (few images) |
| ECR transfer (same region) | Free | $0 |
| EBS (if needed) | $0.08/GB/mo | ~$1-2 |

#### EKS Add-ons

CoreDNS, kube-proxy, and VPC CNI are included at no extra cost. CloudWatch logging
and Container Insights add ~$5-15/mo depending on log volume.

#### Total EKS Cost Estimate

**Scenario A: EKS + Fargate (simplest)**

| Line Item | Idle | With 4 Agents (avg) | With 8 Agents (peak) |
|---|---|---|---|
| Control plane | $73 | $73 | $73 |
| App pod (Fargate) | $16.41 | $16.41 | $16.41 |
| Agent pods (Fargate) | $0 | varies | varies |
| NAT Gateway | $32.85 | $33-35 | $33-35 |
| ALB | $20-25 | $20-25 | $20-25 |
| ECR + storage | $2-3 | $2-3 | $2-3 |
| **Subtotal (fixed)** | **~$145-150/mo** | — | — |

Agent pod variable cost (Fargate on-demand):
- 4 agents x 30 min avg x 20 days/mo = 40 pod-hours/mo
- 40 x $0.0988 = **$3.95/mo**
- With Spot: 40 x $0.030 = **$1.20/mo**

**Total EKS + Fargate: ~$147-155/mo** (agent costs are negligible)

The fixed infrastructure (control plane + NAT + ALB) dominates. Agent compute is <3% of total.

**Scenario B: EKS + Karpenter (EC2 nodes)**

| Line Item | Monthly |
|---|---|
| Control plane | $73 |
| App node (t3.small Spot, always-on) | ~$5-7 |
| Agent nodes (t3.xlarge Spot, bursty) | ~$3-8 (varies) |
| NAT Gateway | $32.85 |
| ALB | $20-25 |
| ECR + storage | $2-3 |
| **Total** | **~$136-150/mo** |

Karpenter's advantage: it can schedule the app pod on a tiny Spot instance and only
provision larger nodes when agent pods arrive, then terminate them when done.

---

### 9. Google GKE Deep Dive

#### Cluster Management Fee

| Mode | Rate | Monthly | Free Tier |
|---|---|---|---|
| **Autopilot** | $0.10/hr (included in pod pricing) | ~$73 | **$74.40/mo free credit** |
| **Standard (zonal)** | $0.10/hr | ~$73 | **$74.40/mo free credit** |
| **Standard (regional)** | $0.10/hr | ~$73 | No free credit |

**Key insight:** Google provides $74.40/mo in free credits per billing account for one
Autopilot or zonal Standard cluster. This effectively makes the cluster management fee
**$0/mo** for a single cluster. This alone saves $73/mo vs EKS.

#### GKE Autopilot (Recommended Mode)

Autopilot is fully managed — Google handles nodes, scaling, security patches, and upgrades.
You only specify pod resource requests.

| Resource | Rate (us-central1) | Notes |
|---|---|---|
| vCPU | $0.0445/vCPU-hr | Per pod request |
| Memory | $0.0049225/GB-hr | Per pod request |
| Ephemeral storage | $0.0000548/GB-hr | Minimal |
| **System overhead per pod** | +180m CPU, +512 Mi memory | Auto-added, billed |

**App pod cost** (0.5 vCPU / 512 MB + system overhead = 0.68 vCPU / 1.0 GB):
- vCPU: 0.68 x $0.0445 = $0.03026/hr
- Memory: 1.0 x $0.0049225 = $0.0049/hr
- Total: $0.03516/hr = **$25.67/mo**

**Agent pod cost** (2 vCPU / 4 GB + system overhead = 2.18 vCPU / 4.5 GB):
- vCPU: 2.18 x $0.0445 = $0.09701/hr
- Memory: 4.5 x $0.0049225 = $0.02215/hr
- Total: $0.11916/hr per agent pod

**Spot pods** (60-91% discount):
- Agent pod on Spot: ~$0.024-0.048/hr (estimated at 60-80% off)

#### GKE Standard Mode (Alternative)

In Standard mode, you manage node pools and pay for Compute Engine VMs:

| Node Type | vCPU | RAM | On-Demand/hr | Monthly |
|---|---|---|---|---|
| e2-medium | 1 (shared) | 4 GB | $0.0335 | $24.46 |
| e2-standard-2 | 2 | 8 GB | $0.0670 | $48.92 |
| e2-standard-4 | 4 | 16 GB | $0.1340 | $97.82 |

Same burstiness problem as EKS managed nodes — you'd overprovision for peak and waste
money during idle. Autopilot solves this natively.

#### Networking Costs

| Component | Rate | Monthly Est. |
|---|---|---|
| **Cloud NAT** | ~$0.045/hr + $0.045/GB | ~$32.85/mo + data |
| **GKE Gateway / Ingress** | Based on forwarding rules | ~$18-25/mo |
| **External IP** | $0.004/hr (static) | ~$2.92/mo |
| **Network egress** | $0.085-0.12/GB (tiered) | Minimal at our traffic |

**Cloud NAT note:** Same cost structure as AWS NAT Gateway. However, GKE Autopilot pods
with direct internet access may not require Cloud NAT depending on configuration. Private
clusters (recommended) do need Cloud NAT for outbound internet.

#### Storage & Registry

| Component | Rate | Monthly Est. |
|---|---|---|
| Artifact Registry storage | $0.10/GB/mo | ~$1-2 |
| Artifact Registry transfer (same region) | Free | $0 |
| Persistent disks (if needed) | $0.040/GB/mo (standard) | ~$1-2 |

#### Total GKE Cost Estimate

**Scenario: GKE Autopilot (recommended)**

| Line Item | Monthly |
|---|---|
| Cluster management fee | **$0** (covered by $74.40 free credit) |
| App pod (always-on) | $25.67 |
| Agent pods (Spot, variable) | ~$1-4 |
| Cloud NAT | $32.85 |
| Ingress / Gateway | $18-25 |
| Artifact Registry | $1-2 |
| **Total** | **~$79-90/mo** |

Agent pod variable cost (Spot):
- 4 agents x 30 min avg x 20 days/mo = 40 pod-hours/mo
- 40 x $0.036 (Spot est.) = **$1.44/mo**

**Total GKE Autopilot: ~$79-90/mo**

---

### 10. Simpler AWS Alternatives (Sanity Check)

#### ECS Fargate (No Kubernetes)

ECS Fargate uses the same Fargate compute pricing as EKS Fargate, but **without the
$73/mo EKS control plane fee**. The ECS control plane is free.

| Line Item | Monthly |
|---|---|
| Control plane | **$0** (ECS control plane is free) |
| App task (Fargate, 0.5 vCPU / 512 MB) | $16.41 |
| Agent tasks (Fargate Spot, variable) | ~$1-4 |
| NAT Gateway | $32.85 |
| ALB | $20-25 |
| ECR + storage | $2-3 |
| **Total** | **~$73-80/mo** |

**What you lose vs EKS:**
- No Kubernetes API — can't use kubectl, Helm charts, or K8s ecosystem tools
- No pod-level networking (task-level only)
- No Karpenter (ECS has its own capacity providers, but less flexible)
- Vendor lock-in to AWS ECS API

**What you gain:**
- $73/mo savings (no control plane fee)
- Simpler operational model — fewer moving parts
- Native AWS integration (same IAM, VPC, CloudWatch)
- ECS Service Connect for service mesh
- Faster to set up — no K8s expertise required

**ECS verdict:** For our workload, ECS Fargate delivers nearly identical functionality
at $73/mo less than EKS. The K8s ecosystem tools we'd lose aren't critical for a
single-app + sandbox workload.

#### AWS App Runner (Simplest Option)

App Runner is a fully managed service — no VPC, no NAT, no load balancer to configure.
It handles everything.

| Component | Rate | Notes |
|---|---|---|
| Provisioned memory (paused) | $0.007/GB-hr | Billed when scaled to 0 active |
| Active vCPU | $0.064/vCPU-hr | When handling requests |
| Active memory | $0.007/GB-hr | When handling requests |
| Automatic deployments | $1/app/mo | Fixed |
| Build minutes | $0.005/min | Source-based only |

**App hosting cost** (0.5 vCPU / 512 MB, low traffic — mostly paused):
- Provisioned (idle): 0.5 GB x $0.007 x 730 hrs = $2.56/mo (memory only while paused)
- Active (handling requests): ~10% of time = $0.064 x 0.5 x 73 hrs = $2.34/mo (CPU)
- Memory (active): $0.007 x 0.5 x 73 = $0.26/mo
- Total: **~$5-7/mo**

**Limitations for our use case:**
- **Cannot run agent sandboxes.** App Runner only handles HTTP request/response workloads.
  Agent sandboxes are long-running (10-60 min) compute jobs, not HTTP services.
- No VPC access by default (can be configured but adds NAT costs)
- Limited to 25 concurrent instances per service
- No support for Kubernetes Jobs or batch workloads

**App Runner verdict:** Excellent for the app hosting component ($5-7/mo vs $16-25
on Fargate/GKE), but **cannot replace the agent sandbox requirement**. Would need to be
paired with ECS Fargate or another compute service for agent pods.

#### Hybrid: App Runner (app) + ECS Fargate (agents)

| Line Item | Monthly |
|---|---|
| App Runner (app hosting) | $5-7 |
| ECS Fargate (agent tasks, Spot) | $1-4 |
| NAT Gateway (for ECS agents) | $32.85 |
| Auto deployments | $1 |
| ECR | $1-2 |
| **Total** | **~$41-47/mo** |

This hybrid eliminates the ALB cost (App Runner handles ingress internally) and reduces
app compute cost, but still requires NAT Gateway for agent pods.

**NAT Gateway elimination option:** If agent pods don't need outbound internet (they pull
from ECR via VPC endpoint, and communicate with the app via internal networking), you
could potentially drop NAT Gateway entirely, bringing the total to **~$8-14/mo**.

---

### 11. Unified Architecture

#### Kubernetes-Based Architecture (EKS or GKE)

```
                         ┌─────────────────────────────────────────┐
                         │              CDN Layer                   │
                         │    (CloudFront / Cloud CDN / Cloudflare) │
                         └──────────────────┬──────────────────────┘
                                            │
                         ┌──────────────────┴──────────────────────┐
                         │         Ingress Controller / Gateway     │
                         │      (ALB Ingress / GKE Gateway API)     │
                         │           SSL Termination (ACM / GCM)    │
                         └──────────────────┬──────────────────────┘
                                            │
              ┌─────────────────────────────┼─────────────────────────────┐
              │                    K8s Cluster                             │
              │                                                           │
              │  ┌─────────────────────┐  ┌─────────────────────────────┐ │
              │  │  namespace: app      │  │  namespace: sandboxes       │ │
              │  │                      │  │                             │ │
              │  │  ┌────────────────┐  │  │  ┌───────────┐ ┌─────────┐ │ │
              │  │  │ Deployment:    │  │  │  │ Job:      │ │ Job:    │ │ │
              │  │  │ fenrir-web     │  │  │  │ agent-a   │ │ agent-b │ │ │
              │  │  │ replicas: 1    │  │  │  │ 2cpu/4GB  │ │ 2cpu/4G │ │ │
              │  │  │ 0.5cpu/512MB   │  │  │  │ ttl: 60m  │ │ ttl:60m │ │ │
              │  │  └────────────────┘  │  │  └───────────┘ └─────────┘ │ │
              │  │  ┌────────────────┐  │  │  ┌───────────┐             │ │
              │  │  │ Service:       │  │  │  │ Job:      │  ... up to  │ │
              │  │  │ fenrir-web-svc │  │  │  │ agent-c   │  8 concurrent│ │
              │  │  │ ClusterIP      │  │  │  │ 2cpu/4GB  │             │ │
              │  │  └────────────────┘  │  │  └───────────┘             │ │
              │  └─────────────────────┘  └─────────────────────────────┘ │
              │                                                           │
              │  ┌──────────────────────────────────────────────────────┐ │
              │  │  Scaling:                                             │ │
              │  │  - App: HPA (min 1, max 3)                           │ │
              │  │  - Agents: K8s Jobs, auto-cleanup via ttlAfterFinished│ │
              │  │  - Nodes: Karpenter (EKS) / Autopilot (GKE)         │ │
              │  └──────────────────────────────────────────────────────┘ │
              └───────────────────────────────────────────────────────────┘
                                            │
              ┌─────────────────────────────┼─────────────────────────────┐
              │                     CI/CD Pipeline                         │
              │  GitHub Actions → Build Image → Push ECR/GAR → Apply K8s  │
              │                                                           │
              │  App Deploy: kubectl set image deployment/fenrir-web ...   │
              │  Agent Launch: kubectl create job agent-<id> --image ...   │
              └───────────────────────────────────────────────────────────┘
```

**How the app works:**
- Kubernetes `Deployment` with 1 replica, `Service` (ClusterIP), and `Ingress`
- Rolling updates on deploy: `kubectl set image` or `helm upgrade`
- HPA scales to 2-3 replicas under load (unlikely at <1K visits/day)

**How agent sandboxes work:**
- Kubernetes `Job` with `ttlSecondsAfterFinished: 3600` for auto-cleanup
- App API creates Jobs via K8s API (service account with RBAC to `sandboxes` namespace)
- Jobs run 10-60 minutes, then complete and are garbage-collected
- `ResourceQuota` on `sandboxes` namespace caps at 8 concurrent pods
- On EKS: Karpenter provisions Spot nodes when Jobs are created, terminates when done
- On GKE: Autopilot handles node provisioning transparently

**Namespace isolation:**
- `app` namespace: tight RBAC, network policies restrict ingress/egress
- `sandboxes` namespace: resource quotas (8 pods max, 16 vCPU, 32 GB RAM)
- Network policies prevent sandbox pods from reaching app pods directly
- Separate service accounts with minimal permissions

#### ECS-Based Architecture (Simpler Alternative)

```
              ┌──────────────────────────────────────────────┐
              │                 CloudFront CDN                │
              └──────────────────┬───────────────────────────┘
                                 │
              ┌──────────────────┴───────────────────────────┐
              │              ALB (Application LB)             │
              │              SSL via ACM                      │
              └──────────────────┬───────────────────────────┘
                                 │
              ┌──────────────────┴───────────────────────────┐
              │              ECS Cluster                      │
              │                                              │
              │  ┌─────────────────┐  ┌────────────────────┐ │
              │  │ ECS Service:    │  │ ECS Tasks (standalone│ │
              │  │ fenrir-web      │  │ agent-task-a        │ │
              │  │ Fargate         │  │ agent-task-b        │ │
              │  │ desired: 1      │  │ Fargate Spot        │ │
              │  │ 0.5cpu/512MB    │  │ 2cpu/4GB each       │ │
              │  └─────────────────┘  │ ... up to 8         │ │
              │                       └────────────────────┘ │
              └──────────────────────────────────────────────┘
                                 │
              ┌──────────────────┴───────────────────────────┐
              │  CI/CD: GitHub Actions → ECR → ECS Deploy    │
              │  App: aws ecs update-service --force-deploy   │
              │  Agent: aws ecs run-task --launch-type FARGATE│
              └──────────────────────────────────────────────┘
```

Simpler than K8s: no kubectl, no Helm, no YAML manifests. AWS CLI or SDK handles
everything. Agent tasks launched via `run-task`, auto-stop when complete.

---

### 12. Cost Comparison Table — Unified Platform

All costs in USD/month, us-east-1 (AWS) or us-central1 (GCP).
Agent sandbox assumption: average 4 concurrent pods x 30 min x 20 days/mo = 40 pod-hours/mo.

#### Itemized Cost Breakdown

| Line Item | EKS + Fargate | EKS + Karpenter | GKE Autopilot | ECS Fargate | App Runner + ECS | App Runner Only |
|---|---|---|---|---|---|---|
| **Control plane** | $73.00 | $73.00 | **$0.00**\* | **$0.00** | **$0.00** | **$0.00** |
| **App compute** | $16.41 | $5-7 (Spot node) | $25.67 | $16.41 | $5-7 | $5-7 |
| **Agent compute** (40 pod-hrs) | $3.95 | $3-8 (Spot) | $1.44 (Spot) | $1.20 (Spot) | $1.20 (Spot) | N/A |
| **NAT Gateway / Cloud NAT** | $32.85 | $32.85 | $32.85 | $32.85 | $32.85 | $0.00 |
| **Load Balancer** | $20-25 | $20-25 | $18-25 | $20-25 | $0 (included) | $0 (included) |
| **Container registry** | $1-2 | $1-2 | $1-2 | $1-2 | $1-2 | $0-1 |
| **Monitoring/logging** | $5-10 | $5-10 | $5-10 | $5-10 | $2-5 | $0-2 |
| **Auto deploy fee** | — | — | — | — | $1 | $1 |
| **Total** | **$152-163** | **$140-158** | **$84-97** | **$77-87** | **$43-51** | **$6-11** |

\* GKE Autopilot cluster fee covered by $74.40/mo free credit (1 cluster per billing account)

**Note:** App Runner Only cannot run agent sandboxes — included for app-hosting-only comparison.

#### At 2,000 App Deploys/Month + Agent Sandboxes

| Platform | App Hosting | Agent Sandboxes | Infrastructure | **Total** |
|---|---|---|---|---|
| **ECS Fargate** | $16.41 | $1-4 | $54-60 | **$77-87/mo** |
| **GKE Autopilot** | $25.67 | $1-4 | $52-60 | **$84-97/mo** |
| **App Runner + ECS** | $5-7 | $1-4 | $34-40 | **$43-51/mo** |
| **EKS + Karpenter** | $5-7 | $3-8 | $54-60 | **$140-158/mo** |
| **EKS + Fargate** | $16.41 | $3-4 | $54-60 | **$152-163/mo** |

#### At 6,000 App Deploys/Month + Agent Sandboxes

Deploy frequency doesn't change infrastructure costs for container platforms — it only
affects CI/CD build time (GitHub Actions minutes). The costs above remain the same.

The only platform where deploy count matters is if using managed build services
(Amplify at $0.01/build-min). Container platforms just update the running image.

#### The NAT Gateway Problem

NAT Gateway is the single largest variable cost across all options except App Runner.
At $32.85/mo minimum, it often exceeds the actual compute costs.

**Elimination strategies:**
1. **VPC endpoints** for ECR, S3, CloudWatch, STS — eliminates NAT for AWS service calls
2. **NAT instance** (t3.nano at $3.80/mo) instead of managed NAT Gateway — 90% savings
3. **Public subnets** for pods that need internet (security trade-off)
4. **App Runner for the app** (no VPC needed) + ECS in public subnet for agents

If NAT Gateway is replaced with a NAT instance ($3.80/mo), all AWS options drop by ~$29:

| Platform (with NAT instance) | Revised Total |
|---|---|
| **ECS Fargate** | **$48-58/mo** |
| **App Runner + ECS** | **$14-22/mo** |
| **EKS + Fargate** | **$123-134/mo** |
| **EKS + Karpenter** | **$111-129/mo** |

---

### 13. Operational Overhead Assessment

| Factor | EKS | GKE Autopilot | ECS Fargate | App Runner + ECS |
|---|---|---|---|---|
| **K8s expertise needed** | High | Medium | None | None |
| **Cluster upgrades** | Manual (risk of $0.60/hr if delayed) | Automatic | N/A | N/A |
| **Node management** | You manage (or Karpenter) | Google manages | AWS manages | AWS manages |
| **Security patches** | You apply to nodes | Google auto-patches | AWS manages Fargate | AWS manages |
| **Networking setup** | Complex (VPC, subnets, NAT, SGs) | Moderate | Moderate | Simple |
| **Monitoring** | DIY (Prometheus/Grafana or CloudWatch) | GCP Operations built-in | CloudWatch built-in | CloudWatch built-in |
| **Incident debugging** | K8s expertise required | K8s familiarity helpful | AWS console/CLI | AWS console |
| **Learning curve** | Steep (K8s + AWS networking) | Moderate (K8s concepts) | Low (ECS concepts) | Very low |
| **Day-2 operations** | High (upgrades, scaling, security) | Low (Google manages most) | Low | Very low |
| **CI/CD complexity** | Moderate (kubectl/helm in GHA) | Moderate (kubectl in GHA) | Low (aws ecs CLI) | Very low (auto-deploy) |

**Key insight:** Our team consists of AI agents doing the deploying, not humans. The
"learning curve" matters less for deployments but matters more for debugging failures.
When something breaks at 2 AM, the complexity of the system determines how fast you
can diagnose and fix it.

#### Migration Complexity

| From Vercel To... | Effort | What's Involved |
|---|---|---|
| **App Runner** | Low (~2 hours) | Dockerfile, IAM role, `aws apprunner create-service` |
| **ECS Fargate** | Low-Medium (~4 hours) | Dockerfile, task definition, service, ALB, VPC setup |
| **GKE Autopilot** | Medium (~1 day) | Dockerfile, K8s manifests, GKE cluster, ingress, DNS |
| **EKS** | Medium-High (~1-2 days) | Dockerfile, K8s manifests, EKS cluster, VPC, Karpenter, ALB controller |

All migrations share the first step: write a Dockerfile for the Next.js app (~15 min
with agent assistance). The variance is in infrastructure provisioning.

---

### 14. CI/CD Integration — GitHub Actions to Deploy

#### EKS / GKE (Kubernetes)

```yaml
# Simplified GitHub Actions workflow
- name: Build & push image
  run: |
    docker build -t $REGISTRY/$IMAGE:$SHA .
    docker push $REGISTRY/$IMAGE:$SHA

- name: Deploy app
  run: kubectl set image deployment/fenrir-web fenrir-web=$REGISTRY/$IMAGE:$SHA

- name: Launch agent sandbox
  run: |
    kubectl create job agent-$ID --image=$REGISTRY/$AGENT_IMAGE:latest \
      --namespace=sandboxes -- /run-agent.sh
```

#### ECS Fargate

```yaml
- name: Deploy app
  run: |
    aws ecs update-service --cluster fenrir --service fenrir-web \
      --force-new-deployment

- name: Launch agent sandbox
  run: |
    aws ecs run-task --cluster fenrir --task-definition agent-sandbox \
      --launch-type FARGATE --network-configuration '...'
```

#### App Runner

```yaml
- name: Deploy app
  run: |
    aws apprunner start-deployment --service-arn $APP_RUNNER_ARN
  # Or: auto-deploy from ECR image push (zero CI/CD config needed)
```

---

### 15. Final Recommendation

#### Winner: ECS Fargate — $77-87/mo (or $48-58 with NAT instance)

**Why ECS Fargate wins:**

1. **No control plane fee.** ECS control plane is free. This saves $73/mo vs EKS.
   At our scale (1 app + 0-8 agents), Kubernetes adds complexity without proportional
   benefit.

2. **Same Fargate compute as EKS.** Identical pricing, identical pod isolation, identical
   Spot pricing. You lose nothing on the compute side.

3. **Simpler operations.** No K8s upgrades, no extended support fee traps ($0.60/hr!),
   no node management. ECS task definitions are simpler than K8s manifests.

4. **Native AWS integration.** Direct IAM task roles, CloudWatch logging, VPC networking,
   ECR — no adapters or controllers needed.

5. **Agent sandboxes work natively.** `aws ecs run-task` launches an agent sandbox as a
   standalone Fargate task. No Jobs API, no ttlSecondsAfterFinished — the task runs and
   stops, billed per-second.

6. **Fargate Spot for agents.** Up to 70% savings on agent sandbox tasks with 2-minute
   interruption warning. Acceptable for our 10-60 min agent workloads.

#### Strong Second: App Runner (app) + ECS Fargate (agents) — $43-51/mo

**Why this hybrid is compelling:**

- App Runner eliminates ALB ($20-25/mo) and simplifies app deployment to near-zero ops
- ECS Fargate handles agent sandboxes cheaply
- Only if we can avoid NAT Gateway (agents use VPC endpoints or public subnets)
- If NAT can be avoided: drops to **$14-22/mo** — cheapest option by far

**Risk:** Splitting infrastructure across two services adds operational surface area.
App Runner has limitations (max 25 instances, HTTP-only, limited networking).

#### Not Recommended

| Platform | Why Not |
|---|---|
| **AWS EKS** | $73/mo control plane for a workload that doesn't need Kubernetes. The K8s ecosystem (Helm, kubectl, CRDs) is powerful but overkill for 1 app + sandbox Jobs. Extended support fee trap ($0.60/hr) adds operational risk. |
| **Google GKE Autopilot** | Compelling at $84-97/mo (free cluster credit!), but Odin directed AWS-native. If we were cloud-agnostic, GKE Autopilot would be the K8s winner over EKS — better managed experience, lower cost, automatic node ops. |
| **Google GKE Standard** | All the complexity of K8s plus node management. No advantage over Autopilot at our scale. |
| **AWS App Runner (alone)** | Cannot run agent sandboxes. HTTP-only service. |

#### Updated Overall Recommendation (Combining Part 1 + Part 2)

Given Odin's direction (AWS native, full migration):

| Priority | Platform | Use Case | Monthly Cost |
|---|---|---|---|
| **1st** | **ECS Fargate** | App hosting + agent sandboxes | **$48-87/mo** |
| **2nd** | **App Runner + ECS Fargate** | App (Runner) + agents (ECS) | **$14-51/mo** |
| **3rd** | **GKE Autopilot** | Unified (if cloud-agnostic) | **$84-97/mo** |

Cost ranges reflect NAT Gateway (managed vs instance) choices.

**vs. Cloudflare Pages (Part 1 winner at $5-20/mo):**
Cloudflare Pages wins on pure app hosting cost. But it can't run agent sandboxes.
The question is whether a unified platform (one bill, one set of infrastructure) is
worth the premium over Cloudflare Pages (app) + separate sandbox compute.

**Bottom line:** If agent sandboxes must run alongside the app on shared infrastructure,
**ECS Fargate** is the pragmatic choice — simpler than Kubernetes, cheaper than EKS,
and fully AWS-native. If the app and agent sandboxes can be decoupled,
**Cloudflare Pages (app) + ECS Fargate (agents)** gives the best of both worlds.

---

### 16. Migration Path Outline

#### Phase 1: Containerize (Day 1)
1. Write Dockerfile for Next.js app (multi-stage build)
2. Set up ECR repository
3. GitHub Actions workflow: build → push to ECR

#### Phase 2: Deploy App (Day 2-3)
**ECS Fargate route:**
1. Create ECS cluster
2. Create task definition (0.5 vCPU / 512 MB, Fargate)
3. Create ECS service with ALB
4. Configure custom domain + ACM SSL certificate
5. DNS cutover from Vercel

**App Runner route (simpler):**
1. Create App Runner service from ECR
2. Configure custom domain (auto-SSL)
3. DNS cutover from Vercel

#### Phase 3: Agent Sandboxes (Day 3-5)
1. Write Dockerfile for agent sandbox
2. Create agent task definition (2 vCPU / 4 GB, Fargate Spot)
3. Create IAM task role with minimal permissions
4. Implement `run-task` API call in app backend
5. Set up CloudWatch log group for agent output
6. Test sandbox lifecycle: launch → execute → terminate → cleanup

#### Phase 4: Optimize (Week 2)
1. Set up VPC endpoints (ECR, S3, CloudWatch) to reduce NAT costs
2. Evaluate replacing NAT Gateway with NAT instance
3. Set up CloudWatch alarms for cost and performance
4. Add CloudFront CDN in front of ALB for static assets

**Total estimated migration time:** 3-5 days with agent assistance.
