# ADR-002 — Next.js Standalone Docker Builds

**Status:** Accepted
**Date:** 2026-03-14
**Authors:** FiremanDecko (Principal Engineer)
**Ref:** GitHub Issue #855

---

## Context

Fenrir Ledger launched with its frontend deployed to **Vercel**, using the default
Next.js serverless function model. In that model, Vercel compiles each API route and
page into an independent lambda function, handles cold starts, edge routing, and TLS
automatically, and charges per-execution.

As the infrastructure matured, two constraints made the Vercel model untenable:

1. **The application now runs on GKE Autopilot.** The Redis session store
   (`redis://redis.fenrir-app.svc.cluster.local:6379`) is an in-cluster StatefulSet
   (see ADR-005). Vercel serverless functions run outside the cluster perimeter — they
   cannot reach a `svc.cluster.local` address. Bridging that gap would require either
   a public Redis endpoint (security regression) or an expensive Vercel Pro private
   network connection.

2. **Long-running request patterns don't fit the serverless model.** Several API
   routes invoke the Anthropic SDK with streaming responses. Vercel's default 10-second
   function timeout (60 seconds on Pro) is a hard ceiling that increases operational
   complexity without eliminating the constraint.

The team evaluated three paths:

### Options Considered

#### A. Vercel with private networking (status quo +)
Connect the Vercel deployment to GCP via Vercel's Premium tier private networking.

**Why rejected:**
- Requires Vercel Enterprise plan ($thousands/month)
- Adds Vercel as a persistent dependency sitting in front of GKE infrastructure we
  already own and pay for
- Secrets (`GOOGLE_CLIENT_SECRET`, `FENRIR_ANTHROPIC_API_KEY`, etc.) would need to
  be stored in both Vercel and GCP Secret Manager — two sources of truth for the same
  material
- Does not remove the function timeout constraint

#### B. Vercel + external Redis (status quo +)
Replace the in-cluster Redis StatefulSet with Vercel KV or Upstash Redis.

**Why rejected:**
- ADR-005 explicitly rejected this: Vercel KV costs $0.20/100K commands at scale
  vs. ~$8/month for a GKE Spot node running Redis; session data never leaves GCP
- Reverses an already-accepted architectural decision

#### C. Next.js standalone build deployed as a GKE container (chosen)
Use `output: "standalone"` in `next.config.ts` to produce a self-contained Node.js
server, package it in a multi-stage Docker image, and deploy to the existing GKE
Autopilot cluster via Helm.

---

## Decision

**Deploy the Next.js application as a containerised standalone Node.js server on GKE
Autopilot. Remove the Vercel deployment entirely.**

### How `output: "standalone"` Works

When `output: "standalone"` is set in `next.config.ts`, the Next.js build produces:

```
.next/
  standalone/
    server.js          ← self-contained HTTP server (no `next start` needed)
    node_modules/      ← only the modules required at runtime (tree-shaken)
  static/              ← compiled JS/CSS chunks
public/                ← static assets
```

`server.js` is the production entrypoint. It embeds the Next.js request handler,
handles routing, SSR, and API routes in a single persistent process — no per-request
cold start, no function timeout.

### Multi-Stage Dockerfile (`/Dockerfile`)

The build uses three stages to minimise the final image size (~150 MB):

| Stage | Base | Purpose |
|-------|------|---------|
| `deps` | `node:20-alpine` | `npm ci` — installs all dependencies |
| `builder` | `node:20-alpine` | `npm run build` — runs the Next.js standalone build |
| `runner` | `node:20-alpine` | Copies only `standalone/`, `static/`, and `public/` |

The `runner` stage adds a non-root `nextjs` user (uid 1001) and exposes port 3000.
A `HEALTHCHECK` directive pings `/api/health` every 30 seconds so Kubernetes liveness
probes have a Docker-level fallback.

Build-time public environment variables (`NEXT_PUBLIC_*`) are passed as `ARG`/`ENV`
so they are baked into the client bundle at build time, as Next.js requires.

### CI/CD Pipeline (`.github/workflows/deploy.yml`)

On every push to `main`:

```
GitHub Actions
  └── build-and-push job
        ├── docker/build-push-action (multi-stage, GitHub Actions cache)
        ├── tags: us-central1-docker.pkg.dev/…/fenrir-app:<sha>
        │         us-central1-docker.pkg.dev/…/fenrir-app:latest
        └── outputs: image_digest
  └── deploy job
        └── helm upgrade --install fenrir-app ./infrastructure/helm/fenrir-app
              --set app.image.tag=<sha>
```

Docker layer caching via `cache-from/cache-to: type=gha` keeps incremental builds
under two minutes for typical source-only changes.

### GKE Deployment (`infrastructure/k8s/app/deployment.yaml`)

The container runs as a GKE Autopilot `Deployment` with:

| Parameter | Value |
|-----------|-------|
| Replicas | 2 (rolling update, `maxUnavailable: 0`) |
| CPU / Memory | 500m / 512Mi (request = limit — GKE Autopilot requirement) |
| Image | `us-central1-docker.pkg.dev/fenrir-ledger-prod/fenrir-images/fenrir-app:<sha>` |
| Port | 3000 |
| `REDIS_URL` | `redis://redis.fenrir-app.svc.cluster.local:6379` |

Readiness, liveness, and startup probes all hit `/api/health`. The rolling update
strategy (`maxUnavailable: 0`, `maxSurge: 1`) ensures zero-downtime deploys.

---

## Consequences

### Positive

- **In-cluster Redis access** — the standalone server runs as a long-lived process
  inside the `fenrir-app` namespace; it reaches `redis.fenrir-app.svc.cluster.local`
  with no NAT or public endpoint required
- **No function timeout** — Node.js HTTP keep-alive handles long streaming API
  responses; no 10/60 second ceiling
- **Smaller image** — multi-stage build copies only the standalone output; the final
  image is ~150 MB vs. a full `node_modules` image of ~600+ MB
- **Vercel dependency removed** — all secrets, networking, and observability live
  exclusively in GCP; no split-brain secret management
- **Cost** — GKE Spot nodes hosting the app pods cost significantly less than Vercel
  Pro + private networking; compute is shared with the cluster already paying for
  Redis, Umami, and agent jobs
- **Unified rollback** — a bad deploy is reverted with `helm rollback fenrir-app`; no
  Vercel dashboard required

### Negative

- **Container management overhead** — the team must maintain the Dockerfile, base
  image updates, and Artifact Registry storage; Vercel handled this automatically
- **No automatic CDN** — Vercel's edge CDN served static assets globally; on GKE the
  static assets are served from a single region pod. A Cloud CDN layer in front of the
  GKE Ingress is the planned mitigation (tracked separately)
- **Cold start on pod restart** — when a pod restarts, there is a brief period
  (covered by the startup probe) before traffic is admitted. With `replicas: 2` and
  `maxUnavailable: 0`, the other pod absorbs traffic during restart, so user impact is
  zero under normal conditions
- **Build args for public env vars** — `NEXT_PUBLIC_*` vars must be present at Docker
  build time; they cannot be injected at pod start. Changes to these values require a
  full image rebuild

### Risks

| Risk | Mitigation |
|------|------------|
| `output: "standalone"` misses a required module | Covered by E2E tests post-deploy; `outputFileTracingRoot` pinned to frontend dir in `next.config.ts` |
| Image size grows with new dependencies | Docker layer cache surfaced in CI summary; alert if final image exceeds 300 MB |
| Pod OOM with increased SSR load | Resources are at request=limit (GKE Autopilot); HPA on CPU/memory can be added if needed |
| Base image CVEs | Dependabot monitors `node:20-alpine`; Artifact Registry vulnerability scanning enabled |

---

## References

- `Dockerfile` — multi-stage build definition (repo root)
- `development/ledger/next.config.ts` — `output: "standalone"` configuration
- `infrastructure/k8s/app/deployment.yaml` — GKE Deployment spec
- `.github/workflows/deploy.yml` — CI/CD build and deploy pipeline
- `infrastructure/helm/fenrir-app/` — Helm chart for app deployment
- [ADR-005: In-Cluster Redis over Vercel KV](./ADR-005-redis-over-vercel-kv.md)
- [Next.js Standalone Output](https://nextjs.org/docs/app/api-reference/next-config-js/output#standalone)
- [GKE Autopilot Resource Model](https://cloud.google.com/kubernetes-engine/docs/concepts/autopilot-resource-requests)
