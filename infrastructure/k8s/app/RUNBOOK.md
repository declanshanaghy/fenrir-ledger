# Fenrir Ledger — GKE App Deployment Runbook

## Build & Deploy Times (Benchmarks)

| Stage | Estimated Time | Notes |
|---|---|---|
| Docker build (cold) | ~3-5 min | Multi-stage, no cache |
| Docker build (cached) | ~1-2 min | GitHub Actions GHA cache |
| Image push to GAR | ~30-60s | ~150MB compressed image |
| K8s rollout | ~1-2 min | Rolling update, 2 replicas |
| **Total pipeline** | **~5-8 min** | Push to main → live |

## Rollback Strategy

The Deployment maintains `revisionHistoryLimit: 5` previous ReplicaSets.

### Quick Rollback (< 30s)

```bash
# Roll back to the previous revision
kubectl rollout undo deployment/fenrir-app -n fenrir-app

# Roll back to a specific revision
kubectl rollout undo deployment/fenrir-app -n fenrir-app --to-revision=N

# Check rollout history
kubectl rollout history deployment/fenrir-app -n fenrir-app
```

### Deploy a Specific Image Tag

```bash
kubectl set image deployment/fenrir-app \
  fenrir-app=us-central1-docker.pkg.dev/fenrir-ledger-prod/fenrir-images/fenrir-app:<TAG> \
  -n fenrir-app
```

### Emergency: Scale Down

```bash
kubectl scale deployment/fenrir-app --replicas=0 -n fenrir-app
```

## Resource Configuration

- **CPU:** 500m (0.5 vCPU) per pod — Autopilot minimum billable unit
- **Memory:** 512Mi per pod
- **Replicas:** 2 (provides HA and zero-downtime deploys)
- **Estimated monthly cost:** ~$30-40 (2 pods x 0.5 vCPU x 512Mi)

## Health Checks

| Probe | Path | Interval | Timeout | Threshold |
|---|---|---|---|---|
| Startup | `/api/health` | 5s | 5s | 12 failures |
| Readiness | `/api/health` | 10s | 3s | 3 failures |
| Liveness | `/api/health` | 30s | 5s | 3 failures |

## Monitoring

- **Logs:** GKE → Cloud Logging (auto-collected)
- **Metrics:** GKE → Cloud Monitoring + Managed Prometheus
- **Pod status:** `kubectl get pods -n fenrir-app -l app.kubernetes.io/name=fenrir-app`

## SSL Certificate

Google-managed SSL cert provisioning takes 15-60 minutes on first deploy.
DNS must point `fenrirledger.com` to the reserved static IP.

```bash
# Check Ingress IP
kubectl get ingress fenrir-app -n fenrir-app

# Check cert status
kubectl get managedcertificate fenrir-app-cert -n fenrir-app -o yaml
```
