# --------------------------------------------------------------------------
# Redis Disk Snapshot Policy — Fenrir Ledger
#
# Schedules daily snapshots of the Redis persistent disk.
# Redis is the cloud sync backend for Karl-tier user card data.
# Snapshots ensure point-in-time recovery even if the PV is corrupted.
#
# The Redis PV reclaim policy is now set to Retain (see Helm StorageClass
# redis-retain), so the underlying GCE disk survives PVC/namespace deletion.
# These snapshots add a second layer of protection.
#
# Disk name: obtained from the GKE-provisioned PV at deploy time.
# Variable: redis_disk_name — set in CI via:
#   kubectl get pv <pv-name> -o jsonpath='{.spec.csi.volumeHandle}'
# --------------------------------------------------------------------------

variable "redis_disk_name" {
  description = "Name of the GCE persistent disk backing the Redis PVC (from kubectl get pv -o jsonpath='{.spec.csi.volumeHandle}'). Set at apply time by CI."
  type        = string
  default     = ""
}

# --------------------------------------------------------------------------
# Snapshot resource policy — daily at 02:00 UTC, 7-day retention
# --------------------------------------------------------------------------

resource "google_compute_resource_policy" "redis_daily_snapshot" {
  name    = "redis-daily-snapshot"
  project = var.project_id
  region  = var.region

  snapshot_schedule_policy {
    schedule {
      daily_schedule {
        days_in_cycle = 1
        start_time    = "02:00" # 02:00 UTC — off-peak for US users
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
        component   = "redis"
        purpose     = "cloud-sync-backup"
      }
      storage_locations = [var.region]
    }
  }

  depends_on = [google_project_service.apis["compute.googleapis.com"]]
}

# --------------------------------------------------------------------------
# Attach snapshot policy to the Redis disk
#
# Only created when redis_disk_name is provided (set by CI after PV exists).
# Usage: terraform apply -var="redis_disk_name=<disk-name>"
# --------------------------------------------------------------------------

resource "google_compute_disk_resource_policy_attachment" "redis_snapshot_attachment" {
  count = var.redis_disk_name != "" ? 1 : 0

  name    = google_compute_resource_policy.redis_daily_snapshot.name
  disk    = var.redis_disk_name
  project = var.project_id
  zone    = var.zone
}
