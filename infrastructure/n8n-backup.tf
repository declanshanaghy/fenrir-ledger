# --------------------------------------------------------------------------
# n8n Disk Snapshot Policy — Fenrir Ledger
#
# Schedules daily snapshots of the n8n persistent disk backing the SQLite
# database in the fenrir-marketing namespace.
#
# Background: issue #1338 — the default reclaimPolicy=Delete risked permanent
# data loss for n8n workflows, credentials, and execution history if the PVC
# or namespace was deleted (same class of vulnerability as issue #1337).
# These snapshots provide a second layer of protection alongside
# reclaimPolicy=Retain.
#
# Disk name: obtained from the GKE-provisioned PV at deploy time.
# Variable: n8n_disk_name — set in CI via:
#   kubectl get pv <pv-name> -o jsonpath='{.spec.csi.volumeHandle}'
# where <pv-name> comes from:
#   kubectl get pvc -n fenrir-marketing \
#     -o jsonpath='{.items[0].spec.volumeName}'
# --------------------------------------------------------------------------

variable "n8n_disk_name" {
  description = "Name of the GCE persistent disk backing the n8n PVC in fenrir-marketing (from kubectl get pv -o jsonpath='{.spec.csi.volumeHandle}'). Set at apply time by CI."
  type        = string
  default     = ""
}

# --------------------------------------------------------------------------
# Snapshot resource policy — daily at 04:00 UTC, 7-day retention
# Offset from Redis (02:00) and PostgreSQL (03:00) to avoid concurrent I/O.
# --------------------------------------------------------------------------

resource "google_compute_resource_policy" "n8n_daily_snapshot" {
  name    = "n8n-daily-snapshot"
  project = var.project_id
  region  = var.region

  snapshot_schedule_policy {
    schedule {
      daily_schedule {
        days_in_cycle = 1
        start_time    = "04:00" # 04:00 UTC — offset from Redis (02:00) and PostgreSQL (03:00)
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
        component   = "n8n"
        purpose     = "workflow-backup"
      }
      storage_locations = [var.region]
    }
  }

  depends_on = [google_project_service.apis["compute.googleapis.com"]]
}

# --------------------------------------------------------------------------
# Attach snapshot policy to the n8n disk
#
# Only created when n8n_disk_name is provided (set by CI after PV exists).
# Usage: terraform apply -var="n8n_disk_name=<disk-name>"
# --------------------------------------------------------------------------

resource "google_compute_disk_resource_policy_attachment" "n8n_snapshot_attachment" {
  count = var.n8n_disk_name != "" ? 1 : 0

  name    = google_compute_resource_policy.n8n_daily_snapshot.name
  disk    = var.n8n_disk_name
  project = var.project_id
  zone    = var.zone
}
