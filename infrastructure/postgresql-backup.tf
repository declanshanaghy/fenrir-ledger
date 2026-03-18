# --------------------------------------------------------------------------
# PostgreSQL Disk Snapshot Policy — Fenrir Ledger
#
# Schedules daily snapshots of the PostgreSQL persistent disk backing the
# Umami analytics StatefulSet in the fenrir-analytics namespace.
#
# Background: issue #1337 — the previous reclaimPolicy=Delete caused permanent
# data loss when the fenrir-bootstrap Helm release was uninstalled. These
# snapshots provide a second layer of protection alongside reclaimPolicy=Retain.
#
# Disk name: obtained from the GKE-provisioned PV at deploy time.
# Variable: postgresql_disk_name — set in CI via:
#   kubectl get pv <pv-name> -o jsonpath='{.spec.csi.volumeHandle}'
# where <pv-name> comes from:
#   kubectl get pvc postgresql-data-postgresql-0 -n fenrir-analytics \
#     -o jsonpath='{.spec.volumeName}'
# --------------------------------------------------------------------------

variable "postgresql_disk_name" {
  description = "Name of the GCE persistent disk backing the PostgreSQL PVC in fenrir-analytics (from kubectl get pv -o jsonpath='{.spec.csi.volumeHandle}'). Set at apply time by CI."
  type        = string
  default     = ""
}

# --------------------------------------------------------------------------
# Snapshot resource policy — daily at 03:00 UTC, 7-day retention
# Offset from Redis (02:00) to avoid concurrent snapshot I/O.
# --------------------------------------------------------------------------

resource "google_compute_resource_policy" "postgresql_daily_snapshot" {
  name    = "postgresql-daily-snapshot"
  project = var.project_id
  region  = var.region

  snapshot_schedule_policy {
    schedule {
      daily_schedule {
        days_in_cycle = 1
        start_time    = "03:00" # 03:00 UTC — off-peak, offset from Redis at 02:00
      }
    }

    retention_policy {
      max_retention_days    = 7
      on_source_disk_delete = "KEEP_AUTO_SNAPSHOTS"
    }

    snapshot_properties {
      labels = {
        managed-by  = "terraform"
        environment = "production"
        component   = "postgresql"
        purpose     = "analytics-backup"
      }
      storage_locations = [var.region]
    }
  }

  depends_on = [google_project_service.apis["compute.googleapis.com"]]
}

# --------------------------------------------------------------------------
# Attach snapshot policy to the PostgreSQL disk
#
# Only created when postgresql_disk_name is provided (set by CI after PV exists).
# Usage: terraform apply -var="postgresql_disk_name=<disk-name>"
# --------------------------------------------------------------------------

resource "google_compute_disk_resource_policy_attachment" "postgresql_snapshot_attachment" {
  count = var.postgresql_disk_name != "" ? 1 : 0

  name    = google_compute_resource_policy.postgresql_daily_snapshot.name
  disk    = var.postgresql_disk_name
  project = var.project_id
  zone    = var.zone
}
