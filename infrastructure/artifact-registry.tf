# --------------------------------------------------------------------------
# Artifact Registry — Container image repository for Fenrir Ledger
# --------------------------------------------------------------------------

resource "google_artifact_registry_repository" "images" {
  provider = google-beta

  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_repo_name
  description   = "Container images for Fenrir Ledger app and agent sandboxes"
  format        = "DOCKER"

  # Clean up untagged images after 14 days to control storage costs
  cleanup_policies {
    id     = "delete-untagged"
    action = "DELETE"

    condition {
      tag_state  = "UNTAGGED"
      older_than = "1209600s" # 14 days
    }
  }

  # Keep at least 10 tagged versions
  cleanup_policies {
    id     = "keep-minimum-versions"
    action = "KEEP"

    most_recent_versions {
      keep_count = 10
    }
  }

  depends_on = [google_project_service.apis]
}

# --------------------------------------------------------------------------
# IAM — Allow deploy service account to push images
# --------------------------------------------------------------------------

resource "google_artifact_registry_repository_iam_member" "deploy_writer" {
  provider = google-beta

  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.images.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${var.deploy_service_account}"
}

# --------------------------------------------------------------------------
# IAM — Allow GKE nodes to pull images
# --------------------------------------------------------------------------

resource "google_artifact_registry_repository_iam_member" "gke_reader" {
  provider = google-beta

  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.images.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.app_workload.email}"
}

resource "google_artifact_registry_repository_iam_member" "agents_reader" {
  provider = google-beta

  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.images.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.agents_workload.email}"
}
