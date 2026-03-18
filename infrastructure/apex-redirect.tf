# --------------------------------------------------------------------------
# Apex Redirect Load Balancer — Fenrir Ledger
#
# Redirects all fenrirledger.com (apex) traffic to https://www.fenrirledger.com
# at the GCP Load Balancer layer, before any request reaches GKE pods.
#
# Architecture:
#   fenrirledger.com → apex_redirect_ip → URL map → 301 https://www.fenrirledger.com{path}
#   www.fenrirledger.com → app_ip → GKE LB → pods (unchanged)
#
# Issue #1318
# --------------------------------------------------------------------------

# Static IP for apex redirect LB
resource "google_compute_global_address" "apex_redirect_ip" {
  name    = "fenrir-apex-redirect-ip"
  project = var.project_id

  depends_on = [google_project_service.apis]
}

# Managed SSL cert for fenrirledger.com (apex only)
resource "google_compute_managed_ssl_certificate" "apex_redirect_cert" {
  provider = google-beta
  name     = "fenrir-apex-redirect-cert"
  project  = var.project_id

  managed {
    domains = ["${var.domain}"]
  }
}

# URL map: redirect all apex traffic to https://www
resource "google_compute_url_map" "apex_redirect" {
  name    = "fenrir-apex-redirect"
  project = var.project_id

  default_url_redirect {
    https_redirect         = true
    host_redirect          = "www.${var.domain}"
    strip_query            = false
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
  }
}

# HTTP proxy (HTTP apex → redirect to https://www)
resource "google_compute_target_http_proxy" "apex_redirect" {
  name    = "fenrir-apex-redirect-http"
  project = var.project_id
  url_map = google_compute_url_map.apex_redirect.id
}

# HTTPS proxy (HTTPS apex → redirect to https://www)
resource "google_compute_target_https_proxy" "apex_redirect" {
  name             = "fenrir-apex-redirect-https"
  project          = var.project_id
  url_map          = google_compute_url_map.apex_redirect.id
  ssl_certificates = [google_compute_managed_ssl_certificate.apex_redirect_cert.id]
}

# HTTP forwarding rule for apex (port 80)
resource "google_compute_global_forwarding_rule" "apex_redirect_http" {
  name       = "fenrir-apex-redirect-http"
  project    = var.project_id
  target     = google_compute_target_http_proxy.apex_redirect.id
  port_range = "80"
  ip_address = google_compute_global_address.apex_redirect_ip.address
}

# HTTPS forwarding rule for apex (port 443)
resource "google_compute_global_forwarding_rule" "apex_redirect_https" {
  name       = "fenrir-apex-redirect-https"
  project    = var.project_id
  target     = google_compute_target_https_proxy.apex_redirect.id
  port_range = "443"
  ip_address = google_compute_global_address.apex_redirect_ip.address
}
