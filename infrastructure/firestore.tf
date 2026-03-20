# --------------------------------------------------------------------------
# Firestore — Fenrir Ledger cloud sync database
#
# Native mode Firestore database in the same region as the GKE cluster.
# All app access flows through the Admin SDK via Workload Identity —
# no credentials file needed in pods.
#
# Security rules are deployed via google_firebaserules_release so they
# are version-controlled alongside the rest of the infrastructure.
# --------------------------------------------------------------------------

resource "google_firestore_database" "main" {
  project     = var.project_id
  name        = "fenrir-ledger-prod"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  # Prevent accidental deletion of production data
  deletion_policy = "DELETE"

  depends_on = [google_project_service.apis]
}

# --------------------------------------------------------------------------
# IAM — App workload identity gets Firestore read/write access
# --------------------------------------------------------------------------

resource "google_project_iam_member" "app_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.app_workload.email}"
}

# Deploy SA needs Firestore admin to manage the database and rules
resource "google_project_iam_member" "deploy_firestore" {
  project = var.project_id
  role    = "roles/datastore.owner"
  member  = "serviceAccount:${var.deploy_service_account}"
}

# --------------------------------------------------------------------------
# Security Rules — deployed from infrastructure/firestore/firestore.rules
# --------------------------------------------------------------------------

resource "google_firebaserules_ruleset" "firestore" {
  project = var.project_id

  source {
    files {
      name    = "firestore.rules"
      content = file("${path.module}/firestore/firestore.rules")
    }
  }

  depends_on = [google_project_service.apis]
}

resource "google_firebaserules_release" "firestore" {
  project      = var.project_id
  name         = "cloud.firestore"
  ruleset_name = google_firebaserules_ruleset.firestore.name

  depends_on = [google_firestore_database.main]
}

# --------------------------------------------------------------------------
# TTL Policy — processedEvents collection auto-purges after expiresAt
#
# Firestore native TTL: documents in processedEvents/ are automatically
# deleted once their expiresAt Timestamp field is in the past (within ~72h).
# The webhook handler sets expiresAt to now + 24h on each write.
# --------------------------------------------------------------------------

resource "google_firestore_field" "processed_events_ttl" {
  project    = var.project_id
  database   = google_firestore_database.main.name
  collection = "processedEvents"
  field      = "expiresAt"

  ttl_config {}

  depends_on = [google_firestore_database.main]
}
