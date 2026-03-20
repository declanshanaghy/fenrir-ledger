# Legacy Manifests — Status and History

This document records the status of raw Kubernetes manifests that existed in `infrastructure/k8s/` before the full Helm migration. It exists to explain what was removed, why, and what remains.

---

## Current State of `infrastructure/k8s/`

```
infrastructure/k8s/
└── agents/          ← ACTIVE — agent sandbox Jobs (not managed by Helm)
    ├── Dockerfile
    ├── entrypoint.sh
    ├── job-template.yaml
    ├── dispatch-job.sh
    ├── secrets-template.yaml
    ├── agent-logs.mjs
    ├── mayo-heckler.mjs
    └── README.md
```

There is no `k8s/app/` directory and no `k8s/namespaces.yaml`. Both were deleted in PR #1243 (commit `d91861b`) as part of the Helm bootstrap migration (issue #1242).

---

## Deleted: `k8s/app/` — Superseded by `helm/fenrir-app/`

The following files previously existed in `infrastructure/k8s/app/` and were the raw Kubernetes manifests for the Next.js application:

| File | What it was | Replaced by |
|---|---|---|
| `deployment.yaml` | App Deployment (Next.js) | `helm/fenrir-app/templates/deployment.yaml` |
| `service.yaml` | ClusterIP Service | `helm/fenrir-app/templates/service.yaml` |
| `ingress.yaml` | GCE Ingress + managed cert | `helm/fenrir-app/templates/ingress.yaml` |
| `kustomization.yaml` | Kustomize manifest list | Helm replaces Kustomize entirely |
| `redis-statefulset.yaml` | Redis StatefulSet + PVC | `helm/fenrir-app/templates/redis.yaml` |

All of these were **deleted** because `helm/fenrir-app` supersedes them with templated, values-driven equivalents. See [ADR-003](../adrs/ADR-003-helm-k8s-manifest-management.md).

### Redis — authoritative source

Redis is managed by **`helm/fenrir-app/templates/redis.yaml`**. It deploys a `StatefulSet` named `redis` in the `fenrir-app` namespace. The raw `redis-statefulset.yaml` was deleted along with the rest of `k8s/app/` in PR #1243.

There is no separate `kubectl apply` for Redis. The Helm chart is the only deployment path.

---

## Deleted: `k8s/namespaces.yaml` — Superseded by inline CI bootstrap

`k8s/namespaces.yaml` was a raw manifest that defined the `fenrir-app` and `fenrir-agents` namespaces, RBAC, ResourceQuota, and NetworkPolicies.

It was deleted in PR #1243. The cluster bootstrap is now handled inline in `deploy.yml` via the `Ensure namespaces, service accounts, and resource quotas` step, which runs idempotently on every deploy. (`helm/fenrir-bootstrap` was a short-lived intermediate approach that was also removed.)

What the inline CI bootstrap step manages (that `namespaces.yaml` used to):
- `fenrir-app`, `fenrir-agents`, `fenrir-analytics`, `fenrir-monitor`, `fenrir-marketing` namespaces
- `fenrir-app-sa` and `fenrir-agents-sa` service accounts with Workload Identity annotations
- ResourceQuota for `fenrir-agents`
- `agent-secrets` Secret skeleton

---

## Still Active: `k8s/agents/` — Not Managed by Helm

The `k8s/agents/` directory is **the only remaining raw manifest directory** and it is **active**.

Agent sandbox Jobs are **not** managed by Helm by design — they are ephemeral, fire-and-forget workloads dispatched on demand via `dispatch-job.sh`. Helm is inappropriate for one-shot Jobs that should self-delete after completion.

See [agent-sandbox.md](agent-sandbox.md) for full documentation.

---

## Migration Timeline

| PR | What happened |
|---|---|
| (early) | `helm/fenrir-app` added (replacing `k8s/app/` raw manifests) |
| (early) | `helm/odin-throne` and `helm/umami` added |
| #1243 (issue #1242) | `helm/fenrir-bootstrap` added (temporary), `k8s/app/` and `k8s/namespaces.yaml` deleted |
| (later) | `helm/fenrir-bootstrap` removed; namespace bootstrap inlined into `deploy.yml` (`Ensure namespaces, service accounts, and resource quotas` step) |
| #1533–#1539 (issues #1516–#1518) | Redis entitlement/trial stores migrated to Firestore |
| #1558 (issue #1519) | Redis client (`ioredis`) and Odin's Spear Redis commands removed from app code |
| #1568 (issue #1521) | `helm/fenrir-app/templates/redis.yaml`, `infrastructure/redis-backup.tf`, and `REDIS_URL` deploy step deleted |

---

## Do Not Apply Raw Manifests

**Do not `kubectl apply` any files from the old `k8s/app/` layout.** If you need to re-examine those files for historical reference, use `git show d91861b^:infrastructure/k8s/app/deployment.yaml` (the commit before deletion) to view them without affecting the live cluster.

The authoritative deployment path for all workloads is:
1. `deploy.yml` bootstrap step — inline namespace + SA + quota creation (idempotent)
2. `helm/fenrir-app` — Next.js app (no Redis; Firestore for entitlements)
3. `helm/odin-throne` — Odin's Throne monitor
4. `helm/umami` — Umami analytics
5. `helm/n8n` — Marketing engine
6. `k8s/agents/dispatch-job.sh` — agent sandbox Jobs only
