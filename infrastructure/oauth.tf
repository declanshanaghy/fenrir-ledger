# --------------------------------------------------------------------------
# OAuth Configuration — Fenrir Ledger
#
# The IAP API and brand are managed by Terraform. OAuth clients themselves
# are created manually in GCP Console (Google does not expose a public API
# for standard Web Application OAuth clients).
#
# Brand was imported into state:
#   terraform import google_iap_brand.fenrir \
#     projects/317218387675/brands/317218387675
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
# Singleton per project. Imported from existing.
# --------------------------------------------------------------------------

resource "google_iap_brand" "fenrir" {
  project           = data.google_project.project.number
  application_title = "Odin's Throne"  # Must match existing brand
  support_email     = "declanshanaghy@gmail.com"

  depends_on = [google_project_service.iap_api]
}

# --------------------------------------------------------------------------
# OAuth Clients (manually created in GCP Console)
#
# Google does not expose a public API for creating standard "Web Application"
# OAuth 2.0 clients. The google_iap_client Terraform resource only supports
# Internal brands. These clients are created manually and documented here.
#
# 1. fenrir-spa — Main app PKCE sign-in
#    Project: fenrir-ledger-prod
#    Type: Web Application
#    Secret: NEXT_PUBLIC_GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
#    Redirect URIs:
#      https://www.fenrirledger.com/auth/callback
#      https://fenrirledger.com/auth/callback
#      http://localhost:9653/auth/callback
#
# 2. odin-throne — Shared oauth2-proxy client
#    Project: fenrir-ledger-prod
#    Type: Web Application
#    Secret: ODINS_THRONE_CLIENT_ID / ODINS_THRONE_CLIENT_SECRET
#    Used by: Odin's Throne, Umami analytics, n8n marketing
#    Redirect URIs:
#      https://odins-throne.fenrirledger.com/oauth2/callback
#      https://analytics.fenrirledger.com/oauth2/callback
#      https://marketing.fenrirledger.com/oauth2/callback
# --------------------------------------------------------------------------
