# Database Restore Procedures

Fenrir Ledger runs three databases in production. This document describes how to
restore each one from backup.

---

## 1. Firestore (Primary App Database)

**Collections:** users, households, cards, trials, processedEvents, entitlements

### Backup Configuration

| Setting | Value |
|---------|-------|
| Type | Firestore managed backup schedule |
| Schedule | Daily |
| Retention | 30 days |
| PITR window | 35 days |
| Terraform resource | `google_firestore_backup_schedule.daily` |
| Database | `fenrir-ledger-prod` |

### List Available Backups

```bash
gcloud firestore backups list \
  --location=us-central1 \
  --project=fenrir-ledger-prod
```

### Restore to a New Database

Firestore restore creates a **new** database. You cannot restore directly into an
existing database. After restore, update the app's `FIRESTORE_DB` config to point
at the restored database and verify before decommissioning the broken one.

```bash
# 1. Pick a backup from the list above
BACKUP_NAME="projects/fenrir-ledger-prod/locations/us-central1/backups/<BACKUP_ID>"

# 2. Restore into a new database (takes 5–30 min depending on data size)
gcloud firestore databases restore \
  --source-backup="$BACKUP_NAME" \
  --destination-database="fenrir-ledger-restore-$(date +%Y%m%d)" \
  --project=fenrir-ledger-prod

# 3. Monitor restore progress
gcloud firestore operations list \
  --project=fenrir-ledger-prod

# 4. After verification, update FIRESTORE_DB in the K8s ConfigMap
kubectl edit configmap fenrir-app-config -n fenrir-app
# Change FIRESTORE_DB to the restored database name

# 5. Restart the app
kubectl rollout restart deployment/fenrir-app -n fenrir-app
```

### Point-in-Time Recovery (PITR)

PITR allows restoring the database to any second within the last **35 days**.

```bash
# Restore to a specific timestamp (ISO 8601)
gcloud firestore databases restore \
  --source-database="fenrir-ledger-prod" \
  --restore-time="2026-04-01T03:00:00Z" \
  --destination-database="fenrir-ledger-pitr-$(date +%Y%m%d)" \
  --project=fenrir-ledger-prod
```

---

## 2. PostgreSQL for Umami Analytics

**Namespace:** `fenrir-analytics`
**PVC:** `postgresql-data-postgresql-0`
**Schedule:** Daily GCE disk snapshot at 03:00 UTC, 7-day retention
**Terraform resource:** `google_compute_disk_resource_policy_attachment.postgresql_snapshot_attachment`

### List Available Snapshots

```bash
# Get the disk name
PV_NAME=$(kubectl get pvc postgresql-data-postgresql-0 \
  -n fenrir-analytics \
  -o jsonpath='{.spec.volumeName}')
DISK_HANDLE=$(kubectl get pv "$PV_NAME" -o jsonpath='{.spec.csi.volumeHandle}')
DISK_NAME="${DISK_HANDLE##*/}"
echo "Disk: $DISK_NAME"

# List snapshots for this disk
gcloud compute snapshots list \
  --filter="sourceDisk~${DISK_NAME}" \
  --project=fenrir-ledger-prod \
  --sort-by=~creationTimestamp \
  --limit=10
```

### Restore Procedure

GCE disk snapshots restore by creating a **new disk** from the snapshot, then
re-binding the PVC to that disk.

```bash
# 1. Pick a snapshot name from the list above
SNAPSHOT_NAME="<snapshot-name>"
ZONE="us-central1-a"

# 2. Create a new disk from the snapshot
gcloud compute disks create "postgresql-restore-$(date +%Y%m%d)" \
  --source-snapshot="$SNAPSHOT_NAME" \
  --zone="$ZONE" \
  --project=fenrir-ledger-prod

# 3. Scale down PostgreSQL StatefulSet to release the PVC
kubectl scale statefulset postgresql \
  -n fenrir-analytics --replicas=0

# 4. Delete the existing PVC (reclaimPolicy=Retain keeps the underlying disk)
kubectl delete pvc postgresql-data-postgresql-0 -n fenrir-analytics

# 5. Delete the old PV (the GCE disk is retained)
kubectl delete pv "$PV_NAME"

# 6. Create a new PV pointing at the restored disk
#    Replace RESTORED_DISK with the disk name from step 2
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolume
metadata:
  name: postgresql-restore-pv
spec:
  capacity:
    storage: 1Gi
  accessModes: [ReadWriteOnce]
  persistentVolumeReclaimPolicy: Retain
  storageClassName: standard-rwo-retain
  csi:
    driver: pd.csi.storage.gke.io
    volumeHandle: projects/fenrir-ledger-prod/zones/${ZONE}/disks/postgresql-restore-$(date +%Y%m%d)
    fsType: ext4
  claimRef:
    namespace: fenrir-analytics
    name: postgresql-data-postgresql-0
EOF

# 7. Scale PostgreSQL back up
kubectl scale statefulset postgresql \
  -n fenrir-analytics --replicas=1

# 8. Verify
kubectl rollout status statefulset/postgresql -n fenrir-analytics --timeout=120s
kubectl get pods -n fenrir-analytics
```

---

## 3. n8n SQLite (Marketing Automation)

**Namespace:** `fenrir-marketing`
**PVC:** First PVC in namespace (n8n data volume)
**Mount:** `/home/node/.n8n` inside the n8n pod
**Schedule:** Daily GCE disk snapshot at 04:00 UTC, 7-day retention
**Terraform resource:** `google_compute_disk_resource_policy_attachment.n8n_snapshot_attachment`

### List Available Snapshots

```bash
# Get the disk name
PV_NAME=$(kubectl get pvc -n fenrir-marketing \
  -o jsonpath='{.items[0].spec.volumeName}')
DISK_HANDLE=$(kubectl get pv "$PV_NAME" -o jsonpath='{.spec.csi.volumeHandle}')
DISK_NAME="${DISK_HANDLE##*/}"
echo "Disk: $DISK_NAME"

# List snapshots
gcloud compute snapshots list \
  --filter="sourceDisk~${DISK_NAME}" \
  --project=fenrir-ledger-prod \
  --sort-by=~creationTimestamp \
  --limit=10
```

### Restore Procedure

```bash
# 1. Pick a snapshot name from the list above
SNAPSHOT_NAME="<snapshot-name>"
ZONE="us-central1-a"

# 2. Create a new disk from the snapshot
gcloud compute disks create "n8n-restore-$(date +%Y%m%d)" \
  --source-snapshot="$SNAPSHOT_NAME" \
  --zone="$ZONE" \
  --project=fenrir-ledger-prod

# 3. Scale down n8n to release the PVC
kubectl scale deployment n8n -n fenrir-marketing --replicas=0

# 4. Delete PVC (reclaimPolicy=Retain keeps the underlying disk)
kubectl delete pvc -n fenrir-marketing \
  $(kubectl get pvc -n fenrir-marketing -o jsonpath='{.items[0].metadata.name}')

# 5. Delete the old PV
kubectl delete pv "$PV_NAME"

# 6. Create a new PV pointing at the restored disk
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolume
metadata:
  name: n8n-restore-pv
spec:
  capacity:
    storage: 1Gi
  accessModes: [ReadWriteOnce]
  persistentVolumeReclaimPolicy: Retain
  storageClassName: standard-rwo-retain
  csi:
    driver: pd.csi.storage.gke.io
    volumeHandle: projects/fenrir-ledger-prod/zones/${ZONE}/disks/n8n-restore-$(date +%Y%m%d)
    fsType: ext4
  claimRef:
    namespace: fenrir-marketing
    name: n8n-data
EOF

# 7. Scale n8n back up
kubectl scale deployment n8n -n fenrir-marketing --replicas=1

# 8. Verify
kubectl rollout status deployment/n8n -n fenrir-marketing --timeout=120s
kubectl get pods -n fenrir-marketing
```

---

## Verifying Backups Are Running

### Firestore

```bash
# List recent backups — should show backups from the last 30 days
gcloud firestore backups list \
  --location=us-central1 \
  --project=fenrir-ledger-prod
```

### PostgreSQL & n8n Disk Snapshots

```bash
# List all auto-snapshots created by the scheduled policies
gcloud compute snapshots list \
  --filter="labels.managed-by=terraform" \
  --project=fenrir-ledger-prod \
  --sort-by=~creationTimestamp
```

### Terraform State

```bash
cd infrastructure
terraform show | grep -A5 "snapshot_attachment\|backup_schedule"
```

---

## Snapshot Retention

| Database | Schedule | Retention | Policy resource |
|----------|----------|-----------|-----------------|
| Firestore | Daily | 30 days | `google_firestore_backup_schedule.daily` |
| PostgreSQL | 03:00 UTC daily | 7 days | `google_compute_resource_policy.postgresql_daily_snapshot` |
| n8n | 04:00 UTC daily | 7 days | `google_compute_resource_policy.n8n_daily_snapshot` |

> **Note:** The issue (#2090) notes that 7-day retention for disk snapshots may be
> increased to 30 days for production. To increase, update `max_retention_days` in
> `infrastructure/postgresql-backup.tf` and `infrastructure/n8n-backup.tf` and run
> `terraform apply`.
