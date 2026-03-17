# GKE Smoke Test — Fenrir Ledger

How to verify the app is running on the GKE Ingress hostname.

## Prerequisites

- `kubectl` configured for the `fenrir-autopilot` cluster
- `gcloud` authenticated with the `fenrir-ledger-prod` project

```bash
gcloud container clusters get-credentials fenrir-autopilot \
  --zone us-central1-a \
  --project fenrir-ledger-prod
```

## 1. Get the Ingress hostname

```bash
kubectl get ingress -n fenrir-app -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}'
```

The Ingress IP should be assigned. If blank, the Ingress controller is still provisioning.

## 2. Health check

```bash
INGRESS_IP=$(kubectl get ingress -n fenrir-app -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}')
curl -sk "https://${INGRESS_IP}/api/health" -H "Host: ${INGRESS_IP}" -w "\nHTTP %{http_code}\n"
```

Expected: HTTP 200 with a JSON response.

## 3. Homepage loads

```bash
curl -sk "https://${INGRESS_IP}/" -H "Host: ${INGRESS_IP}" -o /dev/null -w "HTTP %{http_code}\n"
```

Expected: HTTP 200.

## 4. Verify pods are healthy

```bash
kubectl get pods -n fenrir-app
```

All pods should be `Running` with `READY 1/1`.

## 5. Check pod logs for startup errors

```bash
kubectl logs -n fenrir-app -l app=fenrir-app --tail=50
```

Should show Next.js startup messages without error stack traces.

## 6. Verify Cloud Monitoring

After Terraform apply with monitoring config:

```bash
# Check uptime check exists
gcloud monitoring uptime-check-configs list --project=fenrir-ledger-prod

# Check alert policies
gcloud alpha monitoring policies list --project=fenrir-ledger-prod
```

## 7. CDN Verification

After Cloud CDN is enabled (see `infrastructure/cdn.tf`), validate edge serving:

```bash
# Run the CDN validation script against production
node infrastructure/scripts/validate-cdn.mjs

# Or target a specific domain (e.g. staging)
node infrastructure/scripts/validate-cdn.mjs --base-url https://fenrirledger.com
```

### What the script checks

| URL | Expected `x-goog-cache-status` |
|-----|-------------------------------|
| `fenrirledger.com/` | `HIT` (after warm request) |
| `fenrirledger.com/_next/static/chunks/main.js` | `HIT` |
| `fenrirledger.com/_next/static/css/app.css` | `HIT` |
| `fenrirledger.com/api/health` | `MISS` / absent (uncacheable) |
| `fenrirledger.com/api/auth/token` | `MISS` / absent (uncacheable) |

Possible `x-goog-cache-status` values from Google Cloud CDN:

| Value | Meaning |
|-------|---------|
| `HIT` | Served from CDN edge cache |
| `MISS` | Cache miss — fetched from origin |
| `REVALIDATED` | Stale entry revalidated with origin |
| `STALE` | Served stale while revalidating in background |

### Manual header inspection

```bash
# Check a single URL
curl -sI https://fenrirledger.com/ | grep -i x-goog-cache-status

# Check static asset (replace BUILD_ID with output of: kubectl exec ... -- cat /app/.next/BUILD_ID)
curl -sI "https://fenrirledger.com/_next/static/chunks/main.js" | grep -i x-goog-cache-status

# API route must NOT show HIT
curl -sI https://fenrirledger.com/api/health | grep -i x-goog-cache-status
```

---

## CDN Rollback Runbook

If CDN is causing issues (stale content, incorrect caching, errors), follow these steps:

### Option A — Disable CDN in Helm (recommended, fastest)

```bash
# 1. Edit the Helm values to disable CDN
#    Set cdn.enabled: false in infrastructure/k8s/helm/values.yaml

# 2. Apply the Helm upgrade
helm upgrade fenrir-app infrastructure/k8s/helm/ \
  --namespace fenrir-app \
  --reuse-values \
  --set cdn.enabled=false

# 3. Verify BackendConfig no longer has CDN block
kubectl get backendconfig -n fenrir-app -o yaml | grep -A5 cdn
```

### Option B — Edit BackendConfig directly (emergency)

```bash
# Patch the BackendConfig to remove CDN settings
kubectl patch backendconfig fenrir-app -n fenrir-app \
  --type=json \
  -p='[{"op": "remove", "path": "/spec/cdn"}]'

# Confirm the patch applied
kubectl get backendconfig fenrir-app -n fenrir-app -o yaml
```

### Option C — DNS-level rollback (nuclear, last resort)

Because DNS TTLs are set to 60s (pre-CDN safety setting), DNS propagates within ~1 minute.

```bash
# 1. Update dns.tf to point to a backup IP or remove CDN-fronted IP
# 2. Apply Terraform
cd infrastructure && terraform apply -target=google_dns_record_set.apex -target=google_dns_record_set.www

# 3. Wait ~60s for TTL expiry, then verify
sleep 60 && curl -sI https://fenrirledger.com/ | grep x-goog-cache-status
```

### Post-rollback validation

```bash
# Confirm CDN is no longer serving (no HIT headers)
node infrastructure/scripts/validate-cdn.mjs

# Verify app is still serving correctly
curl -sk https://fenrirledger.com/api/health | jq .
```

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| No Ingress IP | `kubectl describe ingress -n fenrir-app` — look for events |
| Pods CrashLoopBackOff | `kubectl logs -n fenrir-app <pod> --previous` |
| 502 Bad Gateway | Pods not ready yet, or health check path wrong |
| SSL errors | Expected with IP-based access (no cert for IP); use `-k` flag |
| CDN serving stale content | Run Option A rollback above, then re-enable after fix |
| API routes returning `HIT` | Check BackendConfig cache rules — API paths must be excluded |
