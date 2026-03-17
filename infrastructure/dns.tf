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

# Import for existing manually-created Umami static IP.
# Terraform 1.5+ native import block (runs automatically on `terraform apply`):
#
#   import {
#     to = google_compute_global_address.umami_ip
#     id = "projects/fenrir-ledger-prod/global/addresses/umami-ip"
#   }
#
# Equivalent CLI command (run once before first apply if not using the block):
#   terraform import google_compute_global_address.umami_ip \
#     projects/fenrir-ledger-prod/global/addresses/umami-ip

import {
  to = google_compute_global_address.umami_ip
  id = "projects/fenrir-ledger-prod/global/addresses/umami-ip"
}

resource "google_compute_global_address" "umami_ip" {
  name    = "umami-ip"
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
  # TTL lowered to 60s pre-CDN for fast DNS-level rollback.
  # Raise to 3600s after CDN stability is confirmed (issue #1209).
  ttl = 60

  rrdatas = [google_compute_global_address.app_ip.address]
}

resource "google_dns_record_set" "www" {
  name         = "www.${var.domain}."
  managed_zone = google_dns_managed_zone.app.name
  project      = var.project_id
  type         = "A"
  # TTL lowered to 60s pre-CDN for fast DNS-level rollback.
  # Raise to 3600s after CDN stability is confirmed (issue #1209).
  ttl = 60

  rrdatas = [google_compute_global_address.app_ip.address]
}

# Import for existing manually-created analytics DNS A record.
# Terraform 1.5+ native import block (runs automatically on `terraform apply`):
#
#   import {
#     to = google_dns_record_set.analytics
#     id = "projects/fenrir-ledger-prod/managedZones/fenrirledger-com/rrsets/analytics.fenrirledger.com./A"
#   }
#
# Equivalent CLI command (run once before first apply if not using the block):
#   terraform import google_dns_record_set.analytics \
#     projects/fenrir-ledger-prod/managedZones/fenrirledger-com/rrsets/analytics.fenrirledger.com./A

import {
  to = google_dns_record_set.analytics
  id = "projects/fenrir-ledger-prod/managedZones/fenrirledger-com/rrsets/analytics.fenrirledger.com./A"
}

resource "google_dns_record_set" "analytics" {
  name         = "analytics.${var.domain}."
  managed_zone = google_dns_managed_zone.app.name
  project      = var.project_id
  type         = "A"
  # TTL lowered to 60s pre-CDN for fast DNS-level rollback.
  # Raise to 3600s after CDN stability is confirmed (issue #1209).
  ttl = 60

  rrdatas = [google_compute_global_address.umami_ip.address]
}

resource "google_dns_record_set" "marketing" {
  name         = "marketing.${var.domain}."
  managed_zone = google_dns_managed_zone.app.name
  project      = var.project_id
  type         = "A"
  # TTL lowered to 60s pre-CDN for fast DNS-level rollback.
  # Raise to 3600s after CDN stability is confirmed (issue #1209).
  ttl = 60

  rrdatas = [google_compute_global_address.app_ip.address]
}

# --------------------------------------------------------------------------
# Static Global IP — Odin's Throne (monitor.fenrirledger.com)
# --------------------------------------------------------------------------

resource "google_compute_global_address" "monitor_ip" {
  name    = "monitor-ip"
  project = var.project_id

  depends_on = [google_project_service.apis]
}

resource "google_dns_record_set" "monitor" {
  name         = "monitor.${var.domain}."
  managed_zone = google_dns_managed_zone.app.name
  project      = var.project_id
  type         = "A"
  # TTL lowered to 60s pre-CDN for fast DNS-level rollback.
  # Raise to 3600s after CDN stability is confirmed (issue #1209).
  ttl = 60

  rrdatas = [google_compute_global_address.monitor_ip.address]
}
