# --------------------------------------------------------------------------
# OAuth Clients — Fenrir Ledger Google IAP OAuth Management
#
# Manages Google OAuth clients via Identity-Aware Proxy (IAP) for the
# fenrir-ledger-prod GCP project.
#
# Resources:
#   - google_project_service.iap_api    — enables the IAP API
#   - google_iap_brand.fenrir           — OAuth consent screen (one per project)
#   - google_iap_client.fenrir_spa      — NEW client for the Fenrir SPA
#   - google_iap_client.odin_throne     — EXISTING client (import into state)
#   - null_resource.fenrir_spa_redirect_uris — sets redirect URIs via REST API
#
# NOTE: google_iap_brand is a singleton per GCP project. If one already
# exists, import it before running terraform apply:
#
#   terraform import google_iap_brand.fenrir \
#     projects/<project-number>/brands/<project-number>
#
# NOTE: google_iap_client.odin_throne manages the EXISTING manually-created
# Odin's Throne client. Import it before running terraform apply:
#
#   terraform import google_iap_client.odin_throne \
#     "projects/<project-number>/brands/<project-number>/identityAwareProxyClients/<client-id>"
#
# Replace <project-number> with the numeric GCP project number (not the
# project ID string). Find it with:
#   gcloud projects describe fenrir-ledger-prod --format='value(projectNumber)'
#
# The <client-id> for odin_throne is stored in GitHub secret ODINS_THRONE_CLIENT_ID.
# --------------------------------------------------------------------------

# --------------------------------------------------------------------------
# Enable IAP API
# --------------------------------------------------------------------------

resource "google_project_service" "iap_api" {
  project            = var.project_id
  service            = "iap.googleapis.com"
  disable_on_destroy = false
}

# --------------------------------------------------------------------------
# IAP Brand (OAuth consent screen)
#
# Only one brand is allowed per GCP project. If the project already has a
# brand (created manually or by another process), import it:
#
#   terraform import google_iap_brand.fenrir \
#     projects/<project-number>/brands/<project-number>
# --------------------------------------------------------------------------

resource "google_iap_brand" "fenrir" {
  project           = data.google_project.project.number
  application_title = "Odin's Throne"  # Must match existing brand — changing forces destroy+recreate which fails
  support_email     = "declanshanaghy@gmail.com"

  depends_on = [google_project_service.iap_api]
}

# --------------------------------------------------------------------------
# fenrir-spa OAuth Client (NEW — created by terraform apply)
#
# This is the replacement for the manually-created client in the wrong
# project (fenrir-ledger lowercase). The app continues to use the old
# client until the next issue swaps the credentials over.
# --------------------------------------------------------------------------

resource "google_iap_client" "fenrir_spa" {
  brand        = google_iap_brand.fenrir.name
  display_name = "fenrir-spa"
}

# --------------------------------------------------------------------------
# Odin's Throne OAuth Client (EXISTING — import into state)
#
# This client was manually created in fenrir-ledger-prod and is used by
# oauth2-proxy sidecars for Odin's Throne, Umami analytics, and n8n.
#
# Import command (run once before terraform apply):
#
#   terraform import google_iap_client.odin_throne \
#     "projects/<project-number>/brands/<project-number>/identityAwareProxyClients/<client-id>"
#
# After import, terraform plan should show "No changes" for this resource.
#
# Redirect URIs (manually configured, not managed by Terraform):
#   https://odins-throne.fenrirledger.com/oauth2/callback
#   https://analytics.fenrirledger.com/oauth2/callback
#   https://marketing.fenrirledger.com/oauth2/callback
# --------------------------------------------------------------------------

resource "google_iap_client" "odin_throne" {
  brand        = google_iap_brand.fenrir.name
  display_name = "odin-throne"
}

# --------------------------------------------------------------------------
# Redirect URIs for fenrir-spa
#
# Terraform's google_iap_client resource does not support configuring
# redirect URIs natively. This null_resource calls the GCP REST API via
# curl to set them after the client is created.
#
# Trigger: re-runs whenever the client_id changes (i.e. client recreated).
# --------------------------------------------------------------------------

resource "null_resource" "fenrir_spa_redirect_uris" {
  triggers = {
    client_id = google_iap_client.fenrir_spa.client_id
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -e
      PROJECT_NUMBER=$(gcloud projects describe ${var.project_id} --format='value(projectNumber)')
      CLIENT_ID="${google_iap_client.fenrir_spa.client_id}"
      BRAND="projects/$${PROJECT_NUMBER}/brands/$${PROJECT_NUMBER}"
      CLIENT_RESOURCE="$${BRAND}/identityAwareProxyClients/$${CLIENT_ID}"

      ACCESS_TOKEN=$(gcloud auth print-access-token)

      curl -s -X PATCH \
        -H "Authorization: Bearer $${ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        "https://iap.googleapis.com/v1/$${CLIENT_RESOURCE}?updateMask=redirectUris" \
        -d '{
          "redirectUris": [
            "https://www.fenrirledger.com/auth/callback",
            "https://fenrirledger.com/auth/callback",
            "http://localhost:9653/auth/callback"
          ]
        }'
    EOT
  }
}

# --------------------------------------------------------------------------
# Outputs — fenrir-spa
# --------------------------------------------------------------------------

output "fenrir_spa_client_id" {
  description = "OAuth client ID for the fenrir-spa client (safe to share)"
  value       = google_iap_client.fenrir_spa.client_id
}

output "fenrir_spa_client_secret" {
  description = "OAuth client secret for the fenrir-spa client. Retrieve with: terraform output -raw fenrir_spa_client_secret"
  value       = google_iap_client.fenrir_spa.secret
  sensitive   = true
}

# --------------------------------------------------------------------------
# Outputs — Odin's Throne
# --------------------------------------------------------------------------

output "odin_throne_client_id" {
  description = "OAuth client ID for the Odin's Throne client (safe to share)"
  value       = google_iap_client.odin_throne.client_id
}

output "odin_throne_client_secret" {
  description = "OAuth client secret for the Odin's Throne client. Retrieve with: terraform output -raw odin_throne_client_secret"
  value       = google_iap_client.odin_throne.secret
  sensitive   = true
}
