# --------------------------------------------------------------------------
# GKE Autopilot Cluster — Fenrir Ledger
#
# Regional Autopilot cluster in us-central1.
# Autopilot mode: Google manages nodes, scaling, security patches.
# --------------------------------------------------------------------------

resource "google_container_cluster" "autopilot" {
  provider = google-beta

  name     = var.cluster_name
  project  = var.project_id
  location = var.region # Autopilot clusters are always regional

  # Enable Autopilot mode
  enable_autopilot = true

  # Networking
  network    = google_compute_network.vpc.id
  subnetwork = google_compute_subnetwork.subnet.id

  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  # Private cluster — nodes have no public IPs, control plane is accessible
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false # Allow kubectl from outside (via auth)
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  # Control plane authorized networks
  master_authorized_networks_config {
    cidr_blocks {
      cidr_block   = "0.0.0.0/0"
      display_name = "All (restrict in production)"
    }
  }

  # Release channel — Regular for balanced stability/features
  release_channel {
    channel = "REGULAR"
  }

  # Workload Identity — required for pod-level IAM
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Logging and monitoring
  logging_config {
    enable_components = [
      "SYSTEM_COMPONENTS",
      "WORKLOADS",
    ]
  }

  monitoring_config {
    enable_components = [
      "SYSTEM_COMPONENTS",
    ]

    managed_prometheus {
      enabled = true
    }
  }

  # Gateway API support for ingress/SSL
  gateway_api_config {
    channel = "CHANNEL_STANDARD"
  }

  # Maintenance window — weekdays 3-7 AM CT (08:00-12:00 UTC)
  maintenance_policy {
    recurring_window {
      start_time = "2024-01-01T08:00:00Z"
      end_time   = "2024-01-01T12:00:00Z"
      recurrence = "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
    }
  }

  # Binary Authorization for supply chain security
  binary_authorization {
    evaluation_mode = "PROJECT_SINGLETON_POLICY_ENFORCE"
  }

  # Deletion protection — prevent accidental terraform destroy
  deletion_protection = true

  depends_on = [
    google_project_service.apis,
    google_compute_subnetwork.subnet,
  ]
}

# --------------------------------------------------------------------------
# Google-managed SSL certificate for the application domain
# --------------------------------------------------------------------------

resource "google_compute_managed_ssl_certificate" "app_cert" {
  provider = google-beta
  project  = var.project_id
  name     = "fenrir-app-cert"

  managed {
    domains = [var.domain, "www.${var.domain}", "analytics.${var.domain}"]
  }
}
