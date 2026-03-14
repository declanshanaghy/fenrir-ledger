# --------------------------------------------------------------------------
# DNS & Static IP — Fenrir Ledger
#
# Reserves a global static IP for the GKE Ingress, creates a Cloud DNS
# managed zone for fenrirledger.com, and adds A records for the apex
# and www subdomain.
#
# After applying, delegate DNS at Namecheap by setting custom nameservers
# to the values from: terraform output dns_nameservers
# --------------------------------------------------------------------------

# --------------------------------------------------------------------------
# Static Global IP — stable address for Ingress
# --------------------------------------------------------------------------

resource "google_compute_global_address" "app_ip" {
  name    = "fenrir-app-ip"
  project = var.project_id

  depends_on = [google_project_service.apis]
}

# --------------------------------------------------------------------------
# Cloud DNS Managed Zone
# --------------------------------------------------------------------------

resource "google_dns_managed_zone" "app" {
  name        = "fenrirledger-com"
  dns_name    = "${var.domain}."
  description = "Fenrir Ledger — managed DNS zone for ${var.domain}"
  project     = var.project_id

  visibility = "public"

  depends_on = [google_project_service.apis]
}

# --------------------------------------------------------------------------
# DNS A Records
# --------------------------------------------------------------------------

resource "google_dns_record_set" "apex" {
  name         = "${var.domain}."
  managed_zone = google_dns_managed_zone.app.name
  project      = var.project_id
  type         = "A"
  ttl          = 300

  rrdatas = [google_compute_global_address.app_ip.address]
}

resource "google_dns_record_set" "www" {
  name         = "www.${var.domain}."
  managed_zone = google_dns_managed_zone.app.name
  project      = var.project_id
  type         = "A"
  ttl          = 300

  rrdatas = [google_compute_global_address.app_ip.address]
}

resource "google_dns_record_set" "analytics" {
  name         = "analytics.${var.domain}."
  managed_zone = google_dns_managed_zone.app.name
  project      = var.project_id
  type         = "A"
  ttl          = 300

  rrdatas = [google_compute_global_address.app_ip.address]
}
