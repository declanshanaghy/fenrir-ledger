# --------------------------------------------------------------------------
# Outputs — Fenrir Ledger GKE Autopilot Infrastructure
# --------------------------------------------------------------------------

output "cluster_name" {
  description = "Name of the GKE Autopilot cluster"
  value       = google_container_cluster.autopilot.name
}

output "cluster_endpoint" {
  description = "GKE cluster API endpoint"
  value       = google_container_cluster.autopilot.endpoint
  sensitive   = true
}

output "cluster_location" {
  description = "Location (region) of the GKE cluster"
  value       = google_container_cluster.autopilot.location
}

output "artifact_registry_url" {
  description = "Artifact Registry Docker repository URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.images.repository_id}"
}

output "app_service_account_email" {
  description = "GCP service account email for app workload identity"
  value       = google_service_account.app_workload.email
}

output "agents_service_account_email" {
  description = "GCP service account email for agents workload identity"
  value       = google_service_account.agents_workload.email
}

output "kubectl_connect_command" {
  description = "Command to configure kubectl for this cluster"
  value       = "gcloud container clusters get-credentials ${google_container_cluster.autopilot.name} --region ${var.region} --project ${var.project_id}"
}

output "vpc_network" {
  description = "VPC network name"
  value       = google_compute_network.vpc.name
}

output "subnet" {
  description = "Subnet name"
  value       = google_compute_subnetwork.subnet.name
}

output "static_ip" {
  description = "Reserved global static IP for the GKE Ingress"
  value       = google_compute_global_address.app_ip.address
}

output "dns_nameservers" {
  description = "Google Cloud DNS nameservers — set these as custom nameservers at your registrar"
  value       = google_dns_managed_zone.app.name_servers
}
