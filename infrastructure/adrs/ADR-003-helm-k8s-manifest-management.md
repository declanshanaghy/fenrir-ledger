# ADR-003 — Helm for Kubernetes Manifest Management

**Status:** Accepted
**Date:** 2026-03-14
**Authors:** FiremanDecko (Principal Engineer)
**Ref:** GitHub Issue #856

---

## Context

Fenrir Ledger runs on **GKE Autopilot** (`us-central1`). The initial Kubernetes
configuration was written as raw manifest files in `infrastructure/k8s/app/`, composed
using **Kustomize**. As the platform expanded to include a second workload (Umami
self-hosted analytics, ADR-006) and the need for per-environment overrides became
apparent, the limitations of the raw-manifest approach became a recurring friction
point.

### Current state (raw manifests + Kustomize)

`infrastructure/k8s/app/` contains:

```
deployment.yaml
service.yaml
ingress.yaml
redis-statefulset.yaml
secrets.yaml         ← template only; excluded from kustomization.yaml
kustomization.yaml
```

Kustomize applies common labels (`app.kubernetes.io/managed-by: kustomize`) and
namespace scoping, but all configuration values — image tags, resource requests,
replica counts, health-check paths — are hardcoded in each YAML file. Changing the
image tag for a deploy requires patching a string inside `deployment.yaml`. There is
no clean mechanism to maintain a `dev` and `prod` configuration in the same repository
without duplicating entire manifests.

### New requirements surfacing

1. **Second workload (Umami)** — analytics stack added its own namespace
   (`fenrir-analytics`), PostgreSQL StatefulSet, ConfigMap, and Managed Certificate.
   A copy-paste of the raw-manifest pattern means two independent directories with no
   shared conventions.
2. **Image tag injection at deploy time** — CI/CD must stamp the image tag produced
   by the build into the manifest without patching a YAML file mid-pipeline.
3. **Environment-specific overrides** — production runs 2 replicas at 500m CPU; a
   future staging environment may run 1 replica at 250m CPU. Kustomize overlays can
   model this, but they require a full patch file per changed field, growing
   proportionally with the number of overridable parameters.
4. **Warm-node-pool lifecycle management** (see ADR-004) — the idle-detector CronJob
   and RBAC resources for the warm node pool needed to be deployed and torn down
   together with the application chart, not managed as separate `kubectl apply` calls.
5. **Rollback ergonomics** — `kubectl rollout undo` handles Deployment rollbacks, but
   does not roll back accompanying ConfigMaps, Services, or Ingress objects that
   changed in the same release.

---

## Options Considered

### Option 1 — Continue with Kustomize

Keep raw manifests in `infrastructure/k8s/`. Add overlays (`base/`, `overlays/prod/`,
`overlays/staging/`) for environment-specific patches.

**Pros:**
- No new tooling dependency; `kubectl` ships with Kustomize built-in
- Familiar to engineers with plain-YAML experience

**Cons:**
- Image tag injection requires a `kustomize edit set image` call or `sed` in CI —
  fragile and pipeline-specific
- Overlay patches grow linearly with the number of overridable values; a resource
  change requires editing three files (base + each overlay)
- No release concept — there is no atomic version of "everything that was deployed
  together at time T"
- No built-in rollback for non-Deployment resources (ConfigMaps, Services, Ingresses)
- Second workload (Umami) gets its own independent directory with no shared
  conventions or tooling

### Option 2 — Helm

Package each workload as a **Helm chart** under `infrastructure/helm/`. Define all
variable parameters in a `values.yaml` with sane defaults, override per-environment
via `values-prod.yaml`, and inject the image tag at deploy time via `--set
app.image.tag=$IMAGE_TAG`.

**Pros:**
- Single `helm upgrade --install` command deploys all resources atomically
- `helm rollback` reverts every resource in the release to the previous revision
- `values.yaml` + `values-prod.yaml` gives a clean, auditable diff of what differs
  between environments — no patch files
- `--set app.image.tag=<sha>` injects the image tag without touching any file
- Chart reuse: Umami chart follows identical structure to `fenrir-app` chart;
  engineers learn the pattern once
- Helm release history stored in the cluster (`helm history fenrir-app`)

**Cons:**
- Go template syntax (`{{ }}`) adds visual noise vs. plain YAML
- A new CLI dependency (`helm`) required in local dev and CI
- Template errors surface at `helm template` time, not at `kubectl apply` time
- Slight coupling between the Helm chart structure and the Kubernetes API; upgrading
  API versions requires chart changes

### Option 3 — Pulumi / CDK for Kubernetes

Define infrastructure as TypeScript or Python code, rendering Kubernetes manifests
programmatically.

**Why rejected:**
- Pulumi state backend introduces another persistent external dependency
- Language runtime required in all environments that apply infrastructure
- Significant rewrite cost relative to the existing YAML investment
- No substantial benefit over Helm for the scale and complexity of this cluster

---

## Decision

**Adopt Helm as the Kubernetes manifest management tool for all Fenrir Ledger
workloads.**

### Chart layout

```
infrastructure/helm/
├── fenrir-app/          ← Next.js app + Redis StatefulSet + warm-node-pool
│   ├── Chart.yaml
│   ├── values.yaml      ← defaults (dev-safe)
│   ├── values-prod.yaml ← production overrides (replicas, resource limits)
│   └── templates/
│       ├── _helpers.tpl
│       ├── deployment.yaml
│       ├── service.yaml
│       ├── ingress.yaml
│       ├── managed-certificate.yaml
│       ├── redis.yaml
│       ├── secrets.yaml
│       ├── warm-node-pool.yaml
│       ├── idle-detector-cronjob.yaml
│       ├── warm-node-pool-rbac.yaml
│       └── priority-class.yaml
└── umami/               ← Umami analytics + PostgreSQL StatefulSet
    ├── Chart.yaml
    ├── values.yaml
    ├── values-prod.yaml
    └── templates/
        ├── _helpers.tpl
        ├── deployment.yaml
        ├── service.yaml
        ├── ingress.yaml
        ├── managed-certificate.yaml
        ├── postgresql-statefulset.yaml
        ├── postgresql-service.yaml
        ├── configmap.yaml
        └── secrets.yaml
```

### Canonical deploy command

```bash
helm upgrade --install fenrir-app ./infrastructure/helm/fenrir-app \
  -f ./infrastructure/helm/fenrir-app/values-prod.yaml \
  --set app.image.tag=$IMAGE_TAG \
  --namespace fenrir-app \
  --create-namespace
```

### Raw manifests (`infrastructure/k8s/app/`)

The existing raw manifests in `infrastructure/k8s/app/` are retained as a
**reference snapshot** of the configuration at the point Helm was adopted. They are
not applied in CI/CD. The Kustomize-based deploy path is superseded by this decision.
Agent namespace resources (`infrastructure/k8s/agents/`) continue to be applied
directly via `kubectl` — they are imperatively managed by `dispatch-job.sh` and do
not benefit from Helm's release model.

### Values layering

| Layer | File | Purpose |
|-------|------|---------|
| Defaults | `values.yaml` | Safe fallbacks; all template variables must have a default |
| Production | `values-prod.yaml` | Overrides for replica counts, resource limits, host names |
| Deploy-time | `--set app.image.tag=<sha>` | Image tag from CI/CD build output |

### Secrets handling

`templates/secrets.yaml` renders the `Secret` resource but is **disabled by default**
(`secrets.enabled: false`). In production the CD pipeline creates or updates the
Secret directly via `kubectl` with values sourced from the GCP Secret Manager /
environment variables. This follows the established pattern from the raw-manifest era
and avoids Helm managing sensitive values in release history.

---

## Consequences

### Positive

- **Atomic releases** — `helm upgrade` applies all resources in a single transaction;
  `helm rollback` reverts all of them, including ConfigMaps and Ingresses
- **Clean environment diffs** — `values-prod.yaml` contains only what differs from
  defaults; a reviewer can see the production configuration in one file
- **Image tag injection without file mutation** — `--set app.image.tag=<sha>` is
  idempotent and leaves no dirty working tree in CI
- **Consistent second-workload pattern** — Umami follows the same `values.yaml` /
  `values-prod.yaml` / `templates/` structure; onboarding a third workload is
  mechanical
- **Release history** — `helm history fenrir-app` gives an auditable log of every
  deploy, with revision numbers that `helm rollback` can target

### Negative

- **Go template learning curve** — engineers unfamiliar with Helm may find
  `{{ include "fenrir-app.fullname" . }}` syntax opaque vs. plain YAML
- **Helm CLI in all deploy environments** — local dev, CI runners, and any operator
  workstation must have `helm` installed (mitigated: Helm is a single binary, present
  in all standard CI images)
- **Template errors are deferred** — a malformed template will not fail until
  `helm template` or `helm install`; no static analysis beyond `helm lint`

### Risks

| Risk | Mitigation |
|------|------------|
| Helm chart diverges from raw manifests | Raw manifests in `k8s/app/` are clearly marked as reference-only; CI does not apply them |
| Secret values leak into Helm release history | `secrets.enabled: false` by default; CD pipeline manages secrets outside Helm |
| `helm upgrade` partially fails | Helm marks the release as `FAILED`; `helm rollback` restores the prior state; health probes gate rollout |
| Agent jobs (`k8s/agents/`) mistakenly converted to Helm | Agents are imperatively dispatched; they remain kubectl-managed per ADR-004 |

---

## References

- `infrastructure/helm/fenrir-app/` — production chart for the Next.js application
- `infrastructure/helm/umami/` — production chart for self-hosted analytics
- `infrastructure/k8s/app/` — reference raw manifests (Kustomize, superseded)
- [ADR-004: GKE Jobs for Agent Execution](./ADR-004-gke-jobs-agent-execution.md) — agent namespace; kubectl-managed, not Helm
- [ADR-005: In-Cluster Redis over Vercel KV](./ADR-005-redis-over-vercel-kv.md) — Redis StatefulSet included in fenrir-app chart
- [ADR-006: Umami Self-Hosted Analytics](./ADR-006-umami-self-hosted-analytics.md) — Umami chart context
- [Helm Documentation](https://helm.sh/docs/)
- [Kustomize Documentation](https://kustomize.io/)
