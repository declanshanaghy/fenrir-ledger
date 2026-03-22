# QA Handoff: Umami Analytics Deployment on GKE Autopilot

**Issue**: #781 — Deploy self-hosted Umami analytics platform with PostgreSQL backend
**Branch**: `enhancement/issue-781-umami-deploy`
**PR**: https://github.com/declanshanaghy/fenrir-ledger/pull/809
**Date**: 2026-03-14
**Principal Engineer**: FiremanDecko

---

## What Was Implemented

### 1. Umami Helm Chart (`infrastructure/helm/umami/`)

Complete, production-ready Helm chart for deploying Umami analytics with PostgreSQL backend on GKE Autopilot:

- **Chart Metadata**: `Chart.yaml` with appVersion `postgresql-latest`
- **Default Values**: `values.yaml` with sensible development defaults
- **Production Overrides**: `values-prod.yaml` with HA (2 replicas) and production settings
- **Templates**:
  - `deployment.yaml` — Umami app (100m/256Mi requests)
  - `postgresql-statefulset.yaml` — PostgreSQL 16 database (250m/256Mi requests)
  - `postgresql-service.yaml` — Headless service for StatefulSet discovery
  - `service.yaml` — ClusterIP service for Umami
  - `ingress.yaml` — GCE Ingress with analytics.fenrirledger.com hostname
  - `secrets.yaml` — DATABASE_URL, POSTGRES_PASSWORD, APP_SECRET
  - `configmap.yaml` — Placeholder for future DB init scripts
  - `_helpers.tpl` — Helm template helpers (labels, selector labels)

### 2. Deploy Workflow Updates (`.github/workflows/deploy.yml`)

Added automated Umami deployment to the CI/CD pipeline:

- **Namespace**: Auto-create `fenrir-analytics` namespace
- **Secrets**: Create `umami-secrets` with database connection details
- **Helm Install**: `helm upgrade --install umami ./infrastructure/helm/umami ... -f values-prod.yaml`

Deployment happens after app deployment, ensuring infrastructure is ready.

### 3. Test Suite (`development/ledger/src/__tests__/infrastructure/umami-helm-chart.test.ts`)

Comprehensive Vitest test suite (29 tests, all passing):

- ✓ Chart.yaml metadata validation
- ✓ values.yaml and values-prod.yaml structure
- ✓ All template files exist and contain valid Kubernetes YAML
- ✓ Resource limits meet GKE Autopilot budget (350m CPU, 512Mi memory)
- ✓ Storage class is standard-rwo with 1Gi PVC
- ✓ Image references are correct (ghcr.io/umami-software/umami:postgresql-latest, postgres:16-alpine)
- ✓ Namespace is fenrir-analytics
- ✓ DNS domain is analytics.fenrirledger.com
- ✓ Service types and ingress class are correct (GCE)

---

## Files Changed

### Infrastructure

| File | Change | Notes |
|---|---|---|
| `infrastructure/helm/umami/Chart.yaml` | NEW | Helm chart metadata |
| `infrastructure/helm/umami/values.yaml` | NEW | Default config (dev) |
| `infrastructure/helm/umami/values-prod.yaml` | NEW | Production overrides (HA) |
| `infrastructure/helm/umami/templates/_helpers.tpl` | NEW | Helm template helpers |
| `infrastructure/helm/umami/templates/deployment.yaml` | NEW | Umami app Deployment |
| `infrastructure/helm/umami/templates/postgresql-statefulset.yaml` | NEW | PostgreSQL StatefulSet |
| `infrastructure/helm/umami/templates/postgresql-service.yaml` | NEW | PostgreSQL headless service |
| `infrastructure/helm/umami/templates/service.yaml` | NEW | Umami ClusterIP service |
| `infrastructure/helm/umami/templates/ingress.yaml` | NEW | GCE Ingress for analytics.fenrirledger.com |
| `infrastructure/helm/umami/templates/secrets.yaml` | NEW | K8s secrets (database creds) |
| `infrastructure/helm/umami/templates/configmap.yaml` | NEW | ConfigMap for init scripts |
| `.github/workflows/deploy.yml` | MODIFIED | Added Umami deploy step |

### Tests

| File | Change | Notes |
|---|---|---|
| `development/ledger/src/__tests__/infrastructure/umami-helm-chart.test.ts` | NEW | 29 test cases |

---

## Deployment Steps

### Prerequisites

1. GKE cluster provisioned (via Terraform)
2. GitHub Actions secrets configured (GCP_SA_KEY, GCP_PROJECT_ID, etc.)
3. DNS subdomain `analytics.fenrirledger.com` already set up (issue #780)

### Deployment Flow

**Automatic via GitHub Actions** on merge to `main`:

```
1. Terraform → GKE infrastructure
2. Build & push app image to Artifact Registry
3. Helm install fenrir-app (main app)
4. Helm install umami (NEW) ← Analytics platform
5. Health check
```

**Manual deployment** (if needed):

```bash
# 1. Create namespace
kubectl create namespace fenrir-analytics

# 2. Create secrets
kubectl create secret generic umami-secrets \
  --namespace=fenrir-analytics \
  --from-literal=DATABASE_URL="postgresql://umami:PASSWORD@postgresql-svc.fenrir-analytics.svc.cluster.local:5432/umami" \
  --from-literal=POSTGRES_PASSWORD="PASSWORD" \
  --from-literal=DATABASE_PASSWORD="PASSWORD" \
  --from-literal=APP_SECRET="SECRET_KEY"

# 3. Deploy via Helm
helm upgrade --install umami \
  ./infrastructure/helm/umami \
  --namespace=fenrir-analytics \
  -f ./infrastructure/helm/umami/values-prod.yaml \
  --wait \
  --timeout=5m

# 4. Verify
kubectl get pods -n fenrir-analytics
kubectl get svc -n fenrir-analytics
kubectl get ingress -n fenrir-analytics
```

---

## Endpoints & DNS

### Analytics UI

- **Domain**: https://analytics.fenrirledger.com
- **Service**: `umami` (ClusterIP)
- **Port**: 80
- **Ingress**: GCE managed ingress with TLS certificate

### Database

- **Service**: `postgresql-svc.fenrir-analytics.svc.cluster.local:5432`
- **Database**: `umami`
- **User**: `umami`
- **Type**: PostgreSQL 16

### Initial Umami Access

1. Navigate to https://analytics.fenrirledger.com
2. Default credentials (if auto-init): Check Umami documentation
3. Create admin account and websites

---

## Resource Budgets

### Requests (What GKE Autopilot bills on)

| Component | CPU | Memory | Storage |
|---|---|---|---|
| Umami app | 100m | 256Mi | — |
| PostgreSQL | 250m | 256Mi | 1Gi |
| **Total** | **350m** | **512Mi** | **1Gi** |

### Limits (Upper bound, never reached)

| Component | CPU | Memory |
|---|---|---|
| Umami app | 500m | 512Mi |
| PostgreSQL | 500m | 512Mi |

### Monthly Cost (GKE Autopilot, us-central1)

- **CPU**: 350m × $31.68/vCPU/month ≈ $11
- **Memory**: 512Mi × $3.55/GB/month ≈ $2
- **Storage**: 1Gi × $0.04/GB/month ≈ $0.04
- **Total**: **~$13/month** (under $20 budget target)

---

## Known Limitations & Caveats

1. **Single PostgreSQL Replica** — No HA for database. For critical analytics data, consider adding backup strategy.

2. **Default Secrets in Values** — Production must override `APP_SECRET` and `POSTGRES_PASSWORD` via GitHub Actions secrets. Current values are placeholders.

3. **No Session Replay** — Umami doesn't include session replay like PostHog. Use custom events for user flow tracking.

4. **Analytics Queries on PostgreSQL** — Slower than ClickHouse at scale (>100M events/month). Plausible (with ClickHouse) was evaluated but Umami's simpler stack chosen per issue #745 analysis.

5. **No Ingress Health Check Integration** — GCE backend config health check hits `/` which may not be ideal. Ensure Umami responds 200 on root path.

6. **Manual Schema Initialization** — Umami runs migrations automatically on startup. First pod startup may take 10-20 seconds while DB initializes.

---

## Suggested Test Focus

### 1. Deployment & Infrastructure

- [ ] Verify `fenrir-analytics` namespace created
- [ ] Verify `umami-secrets` secret exists with correct keys
- [ ] Verify `umami` Deployment has 2 replicas (prod) / 1 replica (dev)
- [ ] Verify `postgresql` StatefulSet has 1 replica with 1Gi PVC
- [ ] Verify `umami` Service is ClusterIP on port 80
- [ ] Verify `umami` Ingress routes analytics.fenrirledger.com → Service
- [ ] Verify GCE managed certificate is provisioned for analytics.fenrirledger.com

### 2. Connectivity

- [ ] Port-forward to `umami` service: `kubectl port-forward -n fenrir-analytics svc/umami 3000:80`
  - Visit http://localhost:3000 and verify Umami UI loads
- [ ] Verify PostgreSQL StatefulSet pod has initialized (check logs): `kubectl logs -n fenrir-analytics postgresql-0`
  - Should show PostgreSQL started successfully
- [ ] Test database connection from Umami pod:
  - `kubectl exec -n fenrir-analytics deployment/umami -- psql postgresql://umami:PASSWORD@postgresql-svc:5432/umami -c "SELECT 1"`

### 3. DNS & TLS

- [ ] After Ingress IP assignment (may take 15-60 min), verify SSL:
  - `curl -v https://analytics.fenrirledger.com/`
  - Expect 200 OK with valid cert
- [ ] Verify no cert warnings

### 4. Umami Functionality

- [ ] Log in to https://analytics.fenrirledger.com
- [ ] Create test website and note the tracking code
- [ ] Verify tracking code can be embedded (CORS, ad-blocker bypass)
- [ ] Send test event and verify in dashboard
- [ ] Check Umami UI responsiveness on different browsers

### 5. Data Persistence

- [ ] Create test event, website, or admin account
- [ ] Delete Umami pod: `kubectl delete pod -n fenrir-analytics $(kubectl get pods -n fenrir-analytics -l app.kubernetes.io/name=umami -o jsonpath='{.items[0].metadata.name}')`
- [ ] Pod auto-restarts, verify data persists (reuse tracking code, event still in history)

### 6. Scale & Resource Constraints

- [ ] Monitor resource usage:
  - `kubectl top pods -n fenrir-analytics` (CPU/memory actual usage)
  - Compare to requests (100m/256Mi Umami, 250m/256Mi PostgreSQL)
- [ ] Simulate traffic (optional, for performance baseline)
- [ ] Verify no OOM kills or CPU throttling

### 7. Backup & Disaster Recovery (Future)

- [ ] Verify PVC snapshot capability (GKE persistent disk snapshots)
- [ ] Document backup/restore procedure for production

---

## Handoff Notes

### For QA

This is a **green-field deployment** — Umami is new infrastructure with no existing data or users. Testing focus should be:

1. **Happy path**: Deploy, access UI, create account, track events
2. **Persistence**: Data survives pod restarts
3. **Scale**: Resource budgets hold under typical load
4. **DNS/TLS**: Subdomain and certificate work correctly

### For Product

Umami is now live for analytics starting on production merge. Frontend integration (tracking code) is **out of scope** for this issue (tracked separately). Umami is accessible to admin users at https://analytics.fenrirledger.com once deployed.

### For Security

- Database password is injected via K8s secret (not in code)
- App secret should be rotated in production values-prod.yaml
- Umami does not require external auth (uses internal admin accounts)
- No PII exposed in analytics (Umami is privacy-first, no cookies)

---

## Related Issues

- **#780**: DNS & TLS for analytics.fenrirledger.com (prerequisite, done ✓)
- **#745**: Analytics platform evaluation (Umami selected)

---

**Ready for QA testing.** Merge PR and monitor first deployment on main.
