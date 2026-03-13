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
