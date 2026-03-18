# GKE Smoke Test — Fenrir Ledger

How to verify the app is running on the GKE Ingress hostname.

## Prerequisites

- `kubectl` configured for the `fenrir-autopilot` cluster
- `gcloud` authenticated with the `fenrir-ledger-prod` project

```bash
gcloud container clusters get-credentials fenrir-autopilot \
  --region us-central1 \
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
#    Set cdn.enabled: false in infrastructure/helm/fenrir-app/values.yaml

# 2. Apply the Helm upgrade
helm upgrade fenrir-app ./infrastructure/helm/fenrir-app \
  --namespace fenrir-app \
  -f ./infrastructure/helm/fenrir-app/values-prod.yaml \
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

---

## PostgreSQL (Umami Analytics) — Backup & Restore

### Background

Issue #1337: the `fenrir-bootstrap` Helm release previously owned the
`fenrir-analytics` namespace. Uninstalling it cascaded and deleted the PVC
(reclaim policy was `Delete`), permanently destroying the Umami database.

**Protections now in place:**

1. `fenrir-analytics` namespace created imperatively by CI — never owned by Helm.
2. StorageClass `standard-rwo-retain` (`reclaimPolicy: Retain`) — disk survives PVC deletion.
3. CI patches any pre-existing PV to `Retain` on every deploy.
4. Daily GCP disk snapshots via `infrastructure/postgresql-backup.tf` (03:00 UTC, 7-day retention).

---

### Verify PV reclaim policy

```bash
PV_NAME=$(kubectl get pvc postgresql-data-postgresql-0 \
  -n fenrir-analytics -o jsonpath='{.spec.volumeName}')
kubectl get pv "$PV_NAME" -o jsonpath='{.spec.persistentVolumeReclaimPolicy}'
# Expected: Retain
```

If output is `Delete`, patch it manually:

```bash
kubectl patch pv "$PV_NAME" \
  -p '{"spec":{"persistentVolumeReclaimPolicy":"Retain"}}'
```

---

### Attach GCP snapshot policy (post initial deploy)

After the PV exists, obtain the underlying GCE disk name and apply Terraform:

```bash
# 1. Get PV name
PV_NAME=$(kubectl get pvc postgresql-data-postgresql-0 \
  -n fenrir-analytics -o jsonpath='{.spec.volumeName}')

# 2. Get GCE disk name from the PV (CSI volumeHandle is "projects/.../zones/.../disks/<name>")
DISK_HANDLE=$(kubectl get pv "$PV_NAME" -o jsonpath='{.spec.csi.volumeHandle}')
# volumeHandle format: projects/PROJECT/zones/ZONE/disks/DISK_NAME
DISK_NAME=$(echo "$DISK_HANDLE" | awk -F'/' '{print $NF}')
echo "Disk name: $DISK_NAME"

# 3. Apply Terraform to attach the snapshot policy
cd infrastructure
terraform apply -var="postgresql_disk_name=$DISK_NAME"
```

---

### Verify snapshot policy is attached

```bash
DISK_NAME=<disk-name-from-above>
gcloud compute disks describe "$DISK_NAME" \
  --zone=us-central1-a \
  --project=fenrir-ledger-prod \
  --format='value(resourcePolicies)'
# Expected: .../resourcePolicies/postgresql-daily-snapshot
```

---

### Restore from GCP snapshot

```bash
# 1. List available snapshots
gcloud compute snapshots list \
  --filter="sourceDisk~postgresql" \
  --project=fenrir-ledger-prod \
  --sort-by="~creationTimestamp" \
  --limit=10

# 2. Create a new disk from the desired snapshot
SNAPSHOT_NAME=<snapshot-name>
gcloud compute disks create postgresql-restored \
  --source-snapshot="$SNAPSHOT_NAME" \
  --zone=us-central1-a \
  --project=fenrir-ledger-prod \
  --type=pd-balanced

# 3. Scale down PostgreSQL StatefulSet
kubectl scale statefulset postgresql -n fenrir-analytics --replicas=0

# 4. Delete the existing PVC (PV is Retain — underlying disk is NOT deleted)
kubectl delete pvc postgresql-data-postgresql-0 -n fenrir-analytics

# 5. Manually create a PV pointing to the restored disk, then a PVC binding to it.
#    Patch the PV claimRef to point to the new PVC, then re-scale:
kubectl scale statefulset postgresql -n fenrir-analytics --replicas=1

# 6. Verify
kubectl get pods -n fenrir-analytics
kubectl logs statefulset/postgresql -n fenrir-analytics --tail=20
```

---

## n8n (Marketing Engine) — Backup & Restore

### Background

Issue #1338: the n8n PVC in `fenrir-marketing` had `reclaimPolicy: Delete` (GKE
default). Deleting the namespace or PVC would permanently destroy all n8n
workflows, credentials, and execution history — the same class of vulnerability
that wiped Umami (#1337).

**Protections now in place:**

1. StorageClass `standard-rwo-retain` (`reclaimPolicy: Retain`) — disk survives PVC deletion.
2. CI deploys n8n-infra chart (StorageClass) before n8n app chart on every deploy.
3. CI patches any pre-existing PV to `Retain` on every deploy.
4. Daily GCP disk snapshots via `infrastructure/n8n-backup.tf` (04:00 UTC, 7-day retention).

---

### Verify PV reclaim policy

```bash
PV_NAME=$(kubectl get pvc -n fenrir-marketing \
  -o jsonpath='{.items[0].spec.volumeName}')
kubectl get pv "$PV_NAME" -o jsonpath='{.spec.persistentVolumeReclaimPolicy}'
# Expected: Retain
```

If output is `Delete`, patch it manually:

```bash
kubectl patch pv "$PV_NAME" \
  -p '{"spec":{"persistentVolumeReclaimPolicy":"Retain"}}'
```

---

### Attach GCP snapshot policy (post initial deploy)

After the PV exists, obtain the underlying GCE disk name and apply Terraform:

```bash
# 1. Get PV name
PV_NAME=$(kubectl get pvc -n fenrir-marketing \
  -o jsonpath='{.items[0].spec.volumeName}')

# 2. Get GCE disk name from the PV (CSI volumeHandle is "projects/.../zones/.../disks/<name>")
DISK_HANDLE=$(kubectl get pv "$PV_NAME" -o jsonpath='{.spec.csi.volumeHandle}')
DISK_NAME=$(echo "$DISK_HANDLE" | awk -F'/' '{print $NF}')
echo "Disk name: $DISK_NAME"

# 3. Apply Terraform to attach the snapshot policy
cd infrastructure
terraform apply -var="n8n_disk_name=$DISK_NAME"
```

---

### Verify snapshot policy is attached

```bash
DISK_NAME=<disk-name-from-above>
gcloud compute disks describe "$DISK_NAME" \
  --zone=us-central1-a \
  --project=fenrir-ledger-prod \
  --format='value(resourcePolicies)'
# Expected: .../resourcePolicies/n8n-daily-snapshot
```

---

### Restore from GCP snapshot

```bash
# 1. List available snapshots
gcloud compute snapshots list \
  --filter="sourceDisk~n8n" \
  --project=fenrir-ledger-prod \
  --sort-by="~creationTimestamp" \
  --limit=10

# 2. Create a new disk from the desired snapshot
SNAPSHOT_NAME=<snapshot-name>
gcloud compute disks create n8n-restored \
  --source-snapshot="$SNAPSHOT_NAME" \
  --zone=us-central1-a \
  --project=fenrir-ledger-prod \
  --type=pd-balanced

# 3. Scale down n8n deployment
kubectl scale deployment n8n -n fenrir-marketing --replicas=0

# 4. Delete the existing PVC (PV is Retain — underlying disk is NOT deleted)
PV_NAME=$(kubectl get pvc -n fenrir-marketing -o jsonpath='{.items[0].spec.volumeName}')
kubectl delete pvc -n fenrir-marketing --all

# 5. Manually create a PV pointing to the restored disk, then a PVC binding to it.
#    Patch the PV claimRef to point to the new PVC, then re-scale:
kubectl scale deployment n8n -n fenrir-marketing --replicas=1

# 6. Verify
kubectl get pods -n fenrir-marketing
kubectl logs deployment/n8n -n fenrir-marketing --tail=20
```

---

### Re-create Umami admin account (post data-loss recovery only)

If Umami data was lost and the database is empty:

1. Visit https://analytics.fenrirledger.com/setup
2. Create the admin account
3. Re-add tracked sites and copy the tracking scripts

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
