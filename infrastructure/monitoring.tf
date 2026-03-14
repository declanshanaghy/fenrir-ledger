# --------------------------------------------------------------------------
# Cloud Monitoring — Fenrir Ledger GKE Application
#
# Provides basic uptime monitoring and error rate alerting for the
# GKE-hosted Next.js application. App currently runs on the Google-
# provided Ingress hostname; custom domain monitoring will be added
# when DNS cutover happens (#684).
# --------------------------------------------------------------------------

# --------------------------------------------------------------------------
# Notification channel — email alerts
# --------------------------------------------------------------------------

resource "google_monitoring_notification_channel" "email" {
  project      = var.project_id
  display_name = "Fenrir Ledger Alerts"
  type         = "email"

  labels = {
    email_address = var.alert_email
  }

  depends_on = [google_project_service.apis["monitoring.googleapis.com"]]
}

# --------------------------------------------------------------------------
# Uptime check — HTTP(S) health probe against the Ingress hostname
#
# Checks the /api/health endpoint every 5 minutes from multiple regions.
# The health endpoint returns 200 when the app is running.
# --------------------------------------------------------------------------

resource "google_monitoring_uptime_check_config" "app_health" {
  project      = var.project_id
  display_name = "Fenrir App Health Check"
  timeout      = "10s"
  period       = "300s" # 5 minutes

  http_check {
    path         = "/api/health"
    port         = 443
    use_ssl      = true
    validate_ssl = true

    accepted_response_status_codes {
      status_class = "STATUS_CLASS_2XX"
    }
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = var.uptime_check_host
    }
  }

  # Check from multiple regions for reliability
  selected_regions = [
    "USA",
    "EUROPE",
    "ASIA_PACIFIC",
  ]

  depends_on = [google_project_service.apis["monitoring.googleapis.com"]]
}

# --------------------------------------------------------------------------
# Alert policy — uptime check failure
#
# Fires when the uptime check fails for 2 consecutive checks (~10 min).
# --------------------------------------------------------------------------

resource "google_monitoring_alert_policy" "uptime_failure" {
  project      = var.project_id
  display_name = "Fenrir App Down"
  combiner     = "OR"

  conditions {
    display_name = "Uptime check failing"

    condition_threshold {
      filter          = "resource.type = \"uptime_url\" AND metric.type = \"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.labels.check_id = \"${google_monitoring_uptime_check_config.app_health.uptime_check_id}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 1
      duration        = "600s" # 10 minutes (2 consecutive failures)

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_NEXT_OLDER"
        cross_series_reducer = "REDUCE_COUNT_FALSE"
        group_by_fields      = ["resource.label.project_id"]
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = [
    google_monitoring_notification_channel.email.name,
  ]

  alert_strategy {
    auto_close = "1800s" # Auto-close after 30 min of recovery
  }

  documentation {
    content   = "The Fenrir Ledger application health check has been failing for >10 minutes. Check GKE pod status: `kubectl get pods -n fenrir-app`"
    mime_type = "text/markdown"
  }

  depends_on = [google_monitoring_uptime_check_config.app_health]
}

# --------------------------------------------------------------------------
# Alert policy — GKE container error rate
#
# Fires when container restart count exceeds threshold, indicating
# application crashes or OOM kills.
# --------------------------------------------------------------------------

resource "google_monitoring_alert_policy" "container_restarts" {
  project      = var.project_id
  display_name = "Fenrir Container Restarts"
  combiner     = "OR"

  conditions {
    display_name = "Container restart rate elevated"

    condition_threshold {
      filter          = "resource.type = \"k8s_container\" AND resource.labels.namespace_name = \"fenrir-app\" AND metric.type = \"kubernetes.io/container/restart_count\""
      comparison      = "COMPARISON_GT"
      threshold_value = 3
      duration        = "300s"

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_DELTA"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = [
    google_monitoring_notification_channel.email.name,
  ]

  alert_strategy {
    auto_close = "1800s"
  }

  documentation {
    content   = "Fenrir Ledger containers in the fenrir-app namespace are restarting frequently. This may indicate OOM kills, crash loops, or config errors. Check: `kubectl describe pods -n fenrir-app` and `kubectl logs -n fenrir-app --previous`"
    mime_type = "text/markdown"
  }

  depends_on = [google_project_service.apis["monitoring.googleapis.com"]]
}
