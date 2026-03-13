# --------------------------------------------------------------------------
# Provider & Backend — Fenrir Ledger GKE Autopilot Infrastructure
# --------------------------------------------------------------------------

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }

  # Remote state in GCS — create the bucket before first apply:
  #   gsutil mb -l us-central1 gs://fenrir-ledger-tfstate
  #   gsutil versioning set on gs://fenrir-ledger-tfstate
  backend "gcs" {
    bucket = "fenrir-ledger-tfstate"
    prefix = "infrastructure"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# --------------------------------------------------------------------------
# Enable required GCP APIs
# --------------------------------------------------------------------------

resource "google_project_service" "apis" {
  for_each = toset([
    "container.googleapis.com",          # GKE
    "artifactregistry.googleapis.com",   # Artifact Registry
    "compute.googleapis.com",            # Compute Engine (networking)
    "iam.googleapis.com",                # IAM
    "cloudresourcemanager.googleapis.com", # Resource Manager
    "monitoring.googleapis.com",         # Cloud Monitoring
    "logging.googleapis.com",            # Cloud Logging
    "billingbudgets.googleapis.com",     # Billing Budgets
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}
