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
# Depends on cluster because the Workload Identity pool doesn't exist until the cluster is created
resource "google_service_account_iam_member" "app_workload_identity" {
  service_account_id = google_service_account.app_workload.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[fenrir-app/fenrir-app-sa]"

  depends_on = [google_container_cluster.autopilot]
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

  depends_on = [google_container_cluster.autopilot]
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
# Deploy service account — IAM roles for GitHub Actions CI/CD
#
# These roles are required for the deploy SA to manage all infrastructure.
# For a fresh project, run scripts/bootstrap-iam.sh FIRST to grant these
# roles before the initial terraform apply (chicken-and-egg: Terraform
# can't grant itself permissions it doesn't yet have).
# --------------------------------------------------------------------------

locals {
  deploy_roles = [
    "roles/container.admin",               # GKE cluster management
    "roles/container.developer",           # K8s resource management
    "roles/compute.loadBalancerAdmin",     # Ingress / LB management
    "roles/compute.networkAdmin",          # VPC, subnets, firewall rules
    "roles/compute.securityAdmin",         # SSL certs, security policies
    "roles/dns.admin",                     # Cloud DNS zones and records
    "roles/iam.serviceAccountAdmin",       # Create/manage service accounts
    "roles/iam.serviceAccountUser",        # Attach SAs to resources
    "roles/resourcemanager.projectIamAdmin", # Manage IAM bindings
    "roles/artifactregistry.admin",        # Artifact Registry repos
    "roles/logging.admin",                 # Cloud Logging config
    "roles/monitoring.admin",              # Cloud Monitoring config
    "roles/certificatemanager.editor",     # Managed SSL certs
    "roles/firebaserules.admin",           # Firebase Security Rules (Firestore)
    "roles/compute.storageAdmin",          # Disk snapshot policies
  ]
}

resource "google_project_iam_member" "deploy_roles" {
  for_each = toset(local.deploy_roles)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${var.deploy_service_account}"
}

# --------------------------------------------------------------------------
# Data sources
# --------------------------------------------------------------------------

data "google_project" "project" {
  project_id = var.project_id
}
