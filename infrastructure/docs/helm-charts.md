# Helm Charts — Fenrir Ledger

Fenrir Ledger uses **3 Helm charts** to manage all Kubernetes workloads. Each chart lives under `infrastructure/helm/`.

Upgrade command pattern:
```bash
helm upgrade --install <release-name> ./infrastructure/helm/<chart> \
  -f ./infrastructure/helm/<chart>/values-prod.yaml \
  [--set key=value ...]
```

---

## Charts at a Glance

| Chart | Release name | Namespace | URL | What it deploys |
|---|---|---|---|---|
| `fenrir-app` | `fenrir-app` | `fenrir-app` | `fenrirledger.com` | Next.js app, Redis, Ingress, PDB, warm-node placeholder |
| `odin-throne` | `odin-throne` | `fenrir-monitor` | `odins-throne.fenrirledger.com` | Monitor backend + UI + oauth2-proxy |
| `umami` | `umami` | `fenrir-analytics` | `analytics.fenrirledger.com` | Umami analytics + PostgreSQL |

---

## 1. `fenrir-app`

**Path:** `infrastructure/helm/fenrir-app/`

The main application chart. Deploys the Next.js standalone app, GCE Ingress with managed TLS, PodDisruptionBudget, and a warm-node-pool placeholder pod.

### What it deploys

| Template | Resource(s) |
|---|---|
| `deployment.yaml` | `fenrir-app` Deployment (Next.js, 2 replicas) |
| `service.yaml` | ClusterIP Service on port 80 |
| `ingress.yaml` | GCE Ingress + BackendConfig, routes `fenrirledger.com` + `www.fenrirledger.com` |
| `pdb.yaml` | PodDisruptionBudget — minAvailable: 1 |
| `warm-node-pool.yaml` | Low-priority `pause` pod to prevent Autopilot scale-to-zero cold starts |
| `warm-node-pool-rbac.yaml` | RBAC for idle-detector CronJob |
| `idle-detector-cronjob.yaml` | CronJob that scales down the warm-node pod after 3h of agent inactivity |
| `secrets.yaml` | Secret skeleton (real values injected by CI before helm runs) |

### Key values (`values.yaml` → `values-prod.yaml` overrides)

| Key | Default | Prod override |
|---|---|---|
| `app.replicaCount` | 2 | 2 |
| `app.image.repository` | `…/fenrir-app` | (same) |
| `app.image.tag` | `latest` | Set by CI to `$IMAGE_TAG` (git SHA) |
| `ingress.backendConfig.cdn.enabled` | `false` | `true` |
| `warmNodePool.enabled` | `true` | (same) |

> **Note:** Redis was removed in issue #1521 (PR #1568). Entitlements and trial state are now stored in Firestore via the app's `FIRESTORE_PROJECT_ID` env var. See [legacy-manifests.md](legacy-manifests.md) for history.

### Upgrade

```bash
helm upgrade --install fenrir-app \
  ./infrastructure/helm/fenrir-app \
  -f ./infrastructure/helm/fenrir-app/values-prod.yaml \
  --set app.image.tag=<IMAGE_TAG> \
  --namespace fenrir-app \
  --wait --timeout=5m
```

---

## 2. `odin-throne`

**Path:** `infrastructure/helm/odin-throne/`

Deploys **Odin's Throne** — the real-time agent monitor. Two containers in the cluster:
- **Backend** (`odin-throne`): Hono-based server that streams K8s Job/Pod events from `fenrir-agents`
- **UI** (`odin-throne-ui`): nginx-served React frontend

Both are fronted by an **oauth2-proxy** sidecar for Google SSO access control.

### What it deploys

| Template | Resource(s) |
|---|---|
| `deployment.yaml` | `odin-throne` Deployment (backend + oauth2-proxy sidecar) |
| `deployment-ui.yaml` | `odin-throne-ui` Deployment (nginx + oauth2-proxy sidecar) |
| `service.yaml` | ClusterIP Service for backend |
| `service-ui.yaml` | ClusterIP Service for UI |
| `ingress.yaml` | GCE Ingress for `odins-throne.fenrirledger.com` |
| `managed-certificate.yaml` | Google-managed TLS cert |
| `rbac.yaml` | ClusterRole + Binding allowing cross-namespace read of `fenrir-agents` jobs/pods/logs |
| `secrets.yaml` | Secret skeleton for OAuth credentials |

### Key values

| Key | Default | Prod override |
|---|---|---|
| `namespace` | `fenrir-monitor` | `fenrir-monitor` |
| `app.replicaCount` | 1 | 1 |
| `app.env.K8S_NAMESPACE` | `fenrir-agents` | (same) |
| `oauth2Proxy.redirectUrl` | `https://odins-throne.fenrirledger.com/oauth2/callback` | (same) |
| `rbac.enabled` | `true` | `true` |
| `rbac.agentsNamespace` | `fenrir-agents` | (same) |

The backend reads K8s API within `fenrir-agents` to list Jobs and stream Pod logs. The RBAC ClusterRole is scoped to read-only access on those resources.

### Upgrade

```bash
helm upgrade --install odin-throne \
  ./infrastructure/helm/odin-throne \
  -f ./infrastructure/helm/odin-throne/values-prod.yaml \
  --set app.image.tag=<IMAGE_TAG> \
  --set ui.image.tag=<IMAGE_TAG> \
  --namespace fenrir-monitor \
  --wait --timeout=5m
```

---

## 3. `umami`

**Path:** `infrastructure/helm/umami/`

Deploys [Umami](https://umami.is/) self-hosted analytics with a PostgreSQL backend. Protected by an **oauth2-proxy** sidecar for Google SSO.

### What it deploys

| Template | Resource(s) |
|---|---|
| `deployment.yaml` | `umami` Deployment (2 replicas in prod) + oauth2-proxy sidecar |
| `postgresql-statefulset.yaml` | `postgresql` StatefulSet with 1Gi PVC |
| `postgresql-service.yaml` | ClusterIP Service for PostgreSQL |
| `service.yaml` | ClusterIP Service for Umami |
| `ingress.yaml` | GCE Ingress for `analytics.fenrirledger.com` |
| `managed-certificate.yaml` | Google-managed TLS cert |
| `backend-config.yaml` | GCE BackendConfig with health check |
| `configmap.yaml` | Non-sensitive env configuration |
| `secrets.yaml` | `umami-secrets` and `umami-oauth2-proxy-secrets` skeletons |

### Key values

| Key | Default | Prod override |
|---|---|---|
| `namespace` | `fenrir-analytics` | `fenrir-analytics` |
| `umami.replicaCount` | 1 | 2 (HA) |
| `postgresql.enabled` | `true` | `true` |
| `postgresql.persistence.size` | `1Gi` | `1Gi` |
| `oauth2Proxy.redirectUrl` | `https://analytics.fenrirledger.com/oauth2/callback` | (same) |

### Upgrade

```bash
helm upgrade --install umami \
  ./infrastructure/helm/umami \
  -f ./infrastructure/helm/umami/values-prod.yaml \
  --namespace fenrir-analytics \
  --wait --timeout=5m
```

---

## Secrets pattern

All charts follow the same pattern: `secrets.yaml` creates a Secret resource with placeholder values. Real credentials are injected **before** `helm upgrade` via `kubectl create secret ... --dry-run=client -o yaml | kubectl apply -f -` in the deploy workflow. This prevents secrets from ever appearing in Helm values files.

See [Deployment Pipeline](deployment-pipeline.md) for the full CI secret injection sequence.
