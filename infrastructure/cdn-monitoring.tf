# --------------------------------------------------------------------------
# CDN Monitoring — Fenrir Ledger Cloud CDN Observability
#
# Provides dashboards and alert policies for CDN performance tracking:
# - Cache hit ratio (hit / miss / revalidated breakdown)
# - Latency percentiles (p50 / p95 / p99) for edge and origin
# - Bandwidth served from cache vs origin
# - Error rates by cache status
#
# Metrics sourced from: loadbalancing.googleapis.com/https/*
# Issue: #1147
# --------------------------------------------------------------------------

# --------------------------------------------------------------------------
# CDN Monitoring Dashboard
# --------------------------------------------------------------------------

resource "google_monitoring_dashboard" "cdn" {
  project        = var.project_id
  dashboard_json = jsonencode({
    displayName = "Fenrir Ledger — CDN Observability"
    mosaicLayout = {
      columns = 12
      tiles = [
        # ----------------------------------------------------------------
        # Row 1: Cache Hit Ratio (full width)
        # ----------------------------------------------------------------
        {
          xPos   = 0
          yPos   = 0
          width  = 12
          height = 4
          widget = {
            title = "Cache Hit Ratio — Hit / Miss / Revalidated"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"https_lb_rule\" AND resource.labels.project_id=\"${var.project_id}\" AND metric.type=\"loadbalancing.googleapis.com/https/request_count\" AND metric.labels.cache_result=\"HIT\""
                      aggregation = {
                        alignmentPeriod    = "60s"
                        perSeriesAligner   = "ALIGN_RATE"
                        crossSeriesReducer = "REDUCE_SUM"
                        groupByFields      = ["metric.labels.cache_result"]
                      }
                    }
                  }
                  plotType   = "LINE"
                  legendTemplate = "Cache HIT"
                  targetAxis = "Y1"
                },
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"https_lb_rule\" AND resource.labels.project_id=\"${var.project_id}\" AND metric.type=\"loadbalancing.googleapis.com/https/request_count\" AND metric.labels.cache_result=\"MISS\""
                      aggregation = {
                        alignmentPeriod    = "60s"
                        perSeriesAligner   = "ALIGN_RATE"
                        crossSeriesReducer = "REDUCE_SUM"
                        groupByFields      = ["metric.labels.cache_result"]
                      }
                    }
                  }
                  plotType   = "LINE"
                  legendTemplate = "Cache MISS"
                  targetAxis = "Y1"
                },
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"https_lb_rule\" AND resource.labels.project_id=\"${var.project_id}\" AND metric.type=\"loadbalancing.googleapis.com/https/request_count\" AND metric.labels.cache_result=\"REVALIDATED\""
                      aggregation = {
                        alignmentPeriod    = "60s"
                        perSeriesAligner   = "ALIGN_RATE"
                        crossSeriesReducer = "REDUCE_SUM"
                        groupByFields      = ["metric.labels.cache_result"]
                      }
                    }
                  }
                  plotType   = "LINE"
                  legendTemplate = "Cache REVALIDATED"
                  targetAxis = "Y1"
                },
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Requests / sec"
                scale = "LINEAR"
              }
            }
          }
        },

        # ----------------------------------------------------------------
        # Row 2: Latency Percentiles — p50 / p95 / p99 (left 6 cols)
        # ----------------------------------------------------------------
        {
          xPos   = 0
          yPos   = 4
          width  = 6
          height = 4
          widget = {
            title = "Response Latency Percentiles (p50 / p95 / p99)"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"https_lb_rule\" AND resource.labels.project_id=\"${var.project_id}\" AND metric.type=\"loadbalancing.googleapis.com/https/total_latencies\""
                      aggregation = {
                        alignmentPeriod    = "60s"
                        perSeriesAligner   = "ALIGN_DELTA"
                        crossSeriesReducer = "REDUCE_PERCENTILE_50"
                      }
                    }
                  }
                  plotType       = "LINE"
                  legendTemplate = "p50 latency"
                  targetAxis     = "Y1"
                },
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"https_lb_rule\" AND resource.labels.project_id=\"${var.project_id}\" AND metric.type=\"loadbalancing.googleapis.com/https/total_latencies\""
                      aggregation = {
                        alignmentPeriod    = "60s"
                        perSeriesAligner   = "ALIGN_DELTA"
                        crossSeriesReducer = "REDUCE_PERCENTILE_95"
                      }
                    }
                  }
                  plotType       = "LINE"
                  legendTemplate = "p95 latency"
                  targetAxis     = "Y1"
                },
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"https_lb_rule\" AND resource.labels.project_id=\"${var.project_id}\" AND metric.type=\"loadbalancing.googleapis.com/https/total_latencies\""
                      aggregation = {
                        alignmentPeriod    = "60s"
                        perSeriesAligner   = "ALIGN_DELTA"
                        crossSeriesReducer = "REDUCE_PERCENTILE_99"
                      }
                    }
                  }
                  plotType       = "LINE"
                  legendTemplate = "p99 latency"
                  targetAxis     = "Y1"
                },
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Latency (ms)"
                scale = "LINEAR"
              }
            }
          }
        },

        # ----------------------------------------------------------------
        # Row 2: Backend Latency — Edge vs Origin (right 6 cols)
        # ----------------------------------------------------------------
        {
          xPos   = 6
          yPos   = 4
          width  = 6
          height = 4
          widget = {
            title = "Backend Latency — Edge vs Origin (p95)"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"https_lb_rule\" AND resource.labels.project_id=\"${var.project_id}\" AND metric.type=\"loadbalancing.googleapis.com/https/total_latencies\" AND metric.labels.cache_result=\"HIT\""
                      aggregation = {
                        alignmentPeriod    = "60s"
                        perSeriesAligner   = "ALIGN_DELTA"
                        crossSeriesReducer = "REDUCE_PERCENTILE_95"
                      }
                    }
                  }
                  plotType       = "LINE"
                  legendTemplate = "Edge latency p95 (cache HIT)"
                  targetAxis     = "Y1"
                },
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"https_lb_rule\" AND resource.labels.project_id=\"${var.project_id}\" AND metric.type=\"loadbalancing.googleapis.com/https/backend_latencies\""
                      aggregation = {
                        alignmentPeriod    = "60s"
                        perSeriesAligner   = "ALIGN_DELTA"
                        crossSeriesReducer = "REDUCE_PERCENTILE_95"
                      }
                    }
                  }
                  plotType       = "LINE"
                  legendTemplate = "Origin latency p95"
                  targetAxis     = "Y1"
                },
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Latency (ms)"
                scale = "LINEAR"
              }
            }
          }
        },

        # ----------------------------------------------------------------
        # Row 3: Bandwidth — Cache vs Origin (left 6 cols)
        # ----------------------------------------------------------------
        {
          xPos   = 0
          yPos   = 8
          width  = 6
          height = 4
          widget = {
            title = "Bandwidth — Bytes Served (Cache vs Origin)"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"https_lb_rule\" AND resource.labels.project_id=\"${var.project_id}\" AND metric.type=\"loadbalancing.googleapis.com/https/response_bytes_count\" AND metric.labels.cache_result=\"HIT\""
                      aggregation = {
                        alignmentPeriod    = "60s"
                        perSeriesAligner   = "ALIGN_RATE"
                        crossSeriesReducer = "REDUCE_SUM"
                        groupByFields      = ["metric.labels.cache_result"]
                      }
                    }
                  }
                  plotType       = "STACKED_AREA"
                  legendTemplate = "From cache (HIT)"
                  targetAxis     = "Y1"
                },
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"https_lb_rule\" AND resource.labels.project_id=\"${var.project_id}\" AND metric.type=\"loadbalancing.googleapis.com/https/response_bytes_count\" AND metric.labels.cache_result=\"MISS\""
                      aggregation = {
                        alignmentPeriod    = "60s"
                        perSeriesAligner   = "ALIGN_RATE"
                        crossSeriesReducer = "REDUCE_SUM"
                        groupByFields      = ["metric.labels.cache_result"]
                      }
                    }
                  }
                  plotType       = "STACKED_AREA"
                  legendTemplate = "From origin (MISS)"
                  targetAxis     = "Y1"
                },
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"https_lb_rule\" AND resource.labels.project_id=\"${var.project_id}\" AND metric.type=\"loadbalancing.googleapis.com/https/response_bytes_count\" AND metric.labels.cache_result=\"REVALIDATED\""
                      aggregation = {
                        alignmentPeriod    = "60s"
                        perSeriesAligner   = "ALIGN_RATE"
                        crossSeriesReducer = "REDUCE_SUM"
                        groupByFields      = ["metric.labels.cache_result"]
                      }
                    }
                  }
                  plotType       = "STACKED_AREA"
                  legendTemplate = "Revalidated"
                  targetAxis     = "Y1"
                },
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Bytes / sec"
                scale = "LINEAR"
              }
            }
          }
        },

        # ----------------------------------------------------------------
        # Row 3: Error Rate by Cache Status (right 6 cols)
        # ----------------------------------------------------------------
        {
          xPos   = 6
          yPos   = 8
          width  = 6
          height = 4
          widget = {
            title = "Error Rate by Response Code Class"
            xyChart = {
              dataSets = [
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"https_lb_rule\" AND resource.labels.project_id=\"${var.project_id}\" AND metric.type=\"loadbalancing.googleapis.com/https/request_count\" AND metric.labels.response_code_class=\"400\""
                      aggregation = {
                        alignmentPeriod    = "60s"
                        perSeriesAligner   = "ALIGN_RATE"
                        crossSeriesReducer = "REDUCE_SUM"
                        groupByFields      = ["metric.labels.response_code_class"]
                      }
                    }
                  }
                  plotType       = "LINE"
                  legendTemplate = "4xx errors"
                  targetAxis     = "Y1"
                },
                {
                  timeSeriesQuery = {
                    timeSeriesFilter = {
                      filter = "resource.type=\"https_lb_rule\" AND resource.labels.project_id=\"${var.project_id}\" AND metric.type=\"loadbalancing.googleapis.com/https/request_count\" AND metric.labels.response_code_class=\"500\""
                      aggregation = {
                        alignmentPeriod    = "60s"
                        perSeriesAligner   = "ALIGN_RATE"
                        crossSeriesReducer = "REDUCE_SUM"
                        groupByFields      = ["metric.labels.response_code_class"]
                      }
                    }
                  }
                  plotType       = "LINE"
                  legendTemplate = "5xx errors"
                  targetAxis     = "Y1"
                },
              ]
              timeshiftDuration = "0s"
              yAxis = {
                label = "Errors / sec"
                scale = "LINEAR"
              }
            }
          }
        },
      ]
    }
  })

  depends_on = [google_project_service.apis["monitoring.googleapis.com"]]
}

# --------------------------------------------------------------------------
# Alert policy — CDN cache hit ratio drop
#
# Fires when the cache hit ratio drops below 50% for 10 minutes.
# Computed as: hit_requests / total_requests < 0.5
#
# Uses a MonitoringQueryLanguage (MQL) condition to express the ratio.
# --------------------------------------------------------------------------

resource "google_monitoring_alert_policy" "cdn_cache_hit_ratio_low" {
  project      = var.project_id
  display_name = "CDN Cache Hit Ratio Low"
  combiner     = "OR"

  conditions {
    display_name = "Cache hit ratio below 50% for 10 minutes"

    condition_monitoring_query_language {
      query    = <<-EOT
        {
          fetch https_lb_rule
          | metric 'loadbalancing.googleapis.com/https/request_count'
          | filter (resource.project_id == '${var.project_id}') && (metric.cache_result == 'HIT')
          | align rate(1m)
          | every 1m
          | group_by [], [hits: sum(value.request_count)]
          ;
          fetch https_lb_rule
          | metric 'loadbalancing.googleapis.com/https/request_count'
          | filter resource.project_id == '${var.project_id}'
          | align rate(1m)
          | every 1m
          | group_by [], [total: sum(value.request_count)]
        }
        | join
        | value: div(val(0), val(1))
        | condition val < 0.5
      EOT
      duration = "600s" # 10 minutes
      trigger {
        count = 1
      }
    }
  }

  notification_channels = [
    google_monitoring_notification_channel.email.name,
  ]

  alert_strategy {
    auto_close = "3600s" # Auto-close after 1 hour of recovery
  }

  documentation {
    content   = "The CDN cache hit ratio has dropped below 50% for the past 10 minutes. This may indicate cache invalidation, new uncacheable routes, or increased cache misses due to query string variation. Check: Cloud CDN cache policy, TTL settings, and recent deployments."
    mime_type = "text/markdown"
  }

  depends_on = [google_project_service.apis["monitoring.googleapis.com"]]
}

# --------------------------------------------------------------------------
# Alert policy — CDN origin latency p95 spike
#
# Fires when the p95 backend (origin) latency exceeds 2000ms for 5 minutes.
# Targets requests that miss the cache and hit the origin backend.
# --------------------------------------------------------------------------

resource "google_monitoring_alert_policy" "cdn_origin_latency_high" {
  project      = var.project_id
  display_name = "CDN Origin Latency High (p95)"
  combiner     = "OR"

  conditions {
    display_name = "CDN origin p95 latency exceeds 2s for 5 minutes"

    condition_threshold {
      filter          = "resource.type=\"https_lb_rule\" AND resource.labels.project_id=\"${var.project_id}\" AND metric.type=\"loadbalancing.googleapis.com/https/backend_latencies\""
      comparison      = "COMPARISON_GT"
      threshold_value = 2000 # 2000ms = 2s
      duration        = "300s" # 5 minutes

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_DELTA"
        cross_series_reducer = "REDUCE_PERCENTILE_95"
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
    content   = "CDN origin (backend) p95 latency has exceeded 2 seconds for 5 minutes. Requests missing the cache are experiencing slow backend responses. Check: GKE pod CPU/memory, Redis latency, Firestore query performance, and recent code changes."
    mime_type = "text/markdown"
  }

  depends_on = [google_project_service.apis["monitoring.googleapis.com"]]
}
