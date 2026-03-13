# --------------------------------------------------------------------------
# Workload Identity — Service accounts and bindings for GKE pods
#
# Workload Identity lets K8s service accounts act as GCP service accounts,
# eliminating the need for exported keys in pods.
# --------------------------------------------------------------------------

# --------------------------------------------------------------------------
# App namespace workload identity (fenrir-app)
# --------------------------------------------------------------------------

resource "google_service_account" "app_workload" {
  project      = var.project_id
  account_id   = "fenrir-app-workload"
  display_name = "Fenrir App Workload Identity"
  description  = "GCP service account for fenrir-app namespace pods"
}

# Allow the K8s service account to impersonate the GCP service account
resource "google_service_account_iam_member" "app_workload_identity" {
  service_account_id = google_service_account.app_workload.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[fenrir-app/fenrir-app-sa]"
}

# App pods can read from Cloud Storage (for assets, config, etc.)
resource "google_project_iam_member" "app_storage_reader" {
  project = var.project_id
  role    = "roles/storage.objectViewer"
  member  = "serviceAccount:${google_service_account.app_workload.email}"
}

# App pods can write logs and metrics
resource "google_project_iam_member" "app_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.app_workload.email}"
}

resource "google_project_iam_member" "app_monitoring" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.app_workload.email}"
}

# --------------------------------------------------------------------------
# Agents namespace workload identity (fenrir-agents)
# --------------------------------------------------------------------------

resource "google_service_account" "agents_workload" {
  project      = var.project_id
  account_id   = "fenrir-agents-workload"
  display_name = "Fenrir Agents Workload Identity"
  description  = "GCP service account for fenrir-agents namespace pods"
}

# Allow the K8s service account to impersonate the GCP service account
resource "google_service_account_iam_member" "agents_workload_identity" {
  service_account_id = google_service_account.agents_workload.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[fenrir-agents/fenrir-agents-sa]"
}

# Agent pods can read/write Cloud Storage (for sandbox artifacts)
resource "google_project_iam_member" "agents_storage" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.agents_workload.email}"
}

# Agent pods can write logs
resource "google_project_iam_member" "agents_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.agents_workload.email}"
}

resource "google_project_iam_member" "agents_monitoring" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.agents_workload.email}"
}

# --------------------------------------------------------------------------
# Deploy service account — GKE access for GitHub Actions
# --------------------------------------------------------------------------

resource "google_project_iam_member" "deploy_gke_admin" {
  project = var.project_id
  role    = "roles/container.developer"
  member  = "serviceAccount:${var.deploy_service_account}"
}

# --------------------------------------------------------------------------
# Cost Alerts — Budget notification
# --------------------------------------------------------------------------

resource "google_billing_budget" "monthly_budget" {
  provider = google-beta

  billing_account = var.billing_account_id
  display_name    = "Fenrir Ledger Monthly Budget"

  budget_filter {
    projects = ["projects/${data.google_project.project.number}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.cost_alert_amount)
    }
  }

  threshold_rules {
    threshold_percent = 0.5
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 0.8
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 1.2
    spend_basis       = "FORECASTED_SPEND"
  }
}

# --------------------------------------------------------------------------
# Data sources
# --------------------------------------------------------------------------

data "google_project" "project" {
  project_id = var.project_id
}
