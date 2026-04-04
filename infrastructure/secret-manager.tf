# --------------------------------------------------------------------------
# Secret Manager — Fenrir Ledger canonical secret store
#
# All application and infrastructure secrets are stored here as the source
# of truth. sync-secrets.mjs reads from Secret Manager and distributes to
# K8s secrets and GitHub Actions secrets.
#
# Access model:
#   - pods (app / agents)  → Workload Identity (no exported keys)
#   - local dev / CI/CD    → ADC (gcloud auth application-default login)
#   - secret rotation      → sync-secrets.mjs --push KEY (creates new version)
#
# Cost: ~$0.06/secret/month × 35 secrets ≈ $2.10/month
# --------------------------------------------------------------------------

# --------------------------------------------------------------------------
# Enable Secret Manager API
# (declared here; also referenced in main.tf's api set)
# --------------------------------------------------------------------------

resource "google_project_service" "secretmanager" {
  project            = var.project_id
  service            = "secretmanager.googleapis.com"
  disable_on_destroy = false
}

# --------------------------------------------------------------------------
# IAM helpers: who can access secrets?
# --------------------------------------------------------------------------

# App pods (Workload Identity via fenrir-app-workload SA) — read-only
resource "google_project_iam_member" "app_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.app_workload.email}"
}

# Agent pods (Workload Identity via fenrir-agents-workload SA) — read-only
resource "google_project_iam_member" "agents_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.agents_workload.email}"
}

# Deploy SA (GitHub Actions CI/CD + local dev ADC) — read + write new versions
resource "google_project_iam_member" "deploy_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${var.deploy_service_account}"
}

resource "google_project_iam_member" "deploy_secret_version_manager" {
  project = var.project_id
  role    = "roles/secretmanager.secretVersionManager"
  member  = "serviceAccount:${var.deploy_service_account}"
}

# --------------------------------------------------------------------------
# Local: canonical secret name list
# --------------------------------------------------------------------------

locals {
  # All canonical secret keys stored in Secret Manager.
  # Names follow the GCP convention: use the env-var name as-is (underscores
  # are valid in Secret Manager IDs).
  secret_names = [
    # GCP / Terraform infra (synced to GitHub Actions)
    "GCP_PROJECT_ID",
    "GCP_SA_KEY",
    "GCP_REGION",
    "GCP_ZONE",
    "GKE_CLUSTER_NAME",
    "TF_VAR_BILLING_ACCOUNT_ID",
    "TF_VAR_UPTIME_CHECK_HOST",

    # Google OAuth / Picker (app)
    "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_PICKER_API_KEY",

    # Anthropic
    "FENRIR_ANTHROPIC_API_KEY",

    # Encryption keys (MUST be versioned — static values that encrypt data)
    "ENTITLEMENT_ENCRYPTION_KEY",
    "N8N_ENCRYPTION_KEY",

    # Stripe
    "STRIPE_SECRET_KEY",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "STRIPE_PRICE_ID",

    # App config
    "ADMIN_EMAILS",
    "APP_BASE_URL",

    # GitHub PATs
    "GITHUB_TOKEN_PAT_CLASSIC",
    "GITHUB_TOKEN_PAT_FINE_GRAINED",

    # Claude / agent tokens
    "CLAUDE_CODE_OAUTH_TOKEN",

    # Gmail / n8n automation
    "GMAIL_MCP_CLIENT_ID",
    "GMAIL_MCP_CLIENT_SECRET",
    "GMAIL_REFRESH_TOKEN",
    "N8N_API_KEY",
  ]
}

# --------------------------------------------------------------------------
# Secret Manager secrets — one per canonical key
#
# Note: Terraform manages the secret *container* (metadata + IAM).
# The actual secret *values* (versions) are managed by sync-secrets.mjs
# (--upload bootstrap / --push rotation). This avoids storing secret values
# in Terraform state.
# --------------------------------------------------------------------------

resource "google_secret_manager_secret" "secrets" {
  for_each = toset(local.secret_names)

  project   = var.project_id
  secret_id = each.value

  replication {
    auto {}
  }

  labels = {
    managed-by = "terraform"
    project    = "fenrir-ledger"
  }

  depends_on = [google_project_service.secretmanager]
}

# --------------------------------------------------------------------------
# Outputs
# --------------------------------------------------------------------------

output "secret_manager_secrets" {
  description = "Map of canonical secret name → Secret Manager resource name"
  value       = { for k, v in google_secret_manager_secret.secrets : k => v.name }
}
