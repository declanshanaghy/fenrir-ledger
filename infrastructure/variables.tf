# --------------------------------------------------------------------------
# Variables — Fenrir Ledger GKE Autopilot Infrastructure
# --------------------------------------------------------------------------

variable "project_id" {
  description = "GCP project ID"
  type        = string
  default     = "fenrir-ledger-prod"
}

variable "region" {
  description = "GCP region for the cluster and resources"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP zone (used by Terraform plan env var, not by cluster)"
  type        = string
  default     = "us-central1-a"
}

variable "cluster_name" {
  description = "Name of the GKE Autopilot cluster"
  type        = string
  default     = "fenrir-autopilot"
}

variable "network_name" {
  description = "Name of the VPC network"
  type        = string
  default     = "fenrir-vpc"
}

variable "subnet_name" {
  description = "Name of the subnet for GKE pods"
  type        = string
  default     = "fenrir-subnet"
}

variable "artifact_repo_name" {
  description = "Name of the Artifact Registry repository"
  type        = string
  default     = "fenrir-images"
}

variable "domain" {
  description = "Domain name for the application (used for managed SSL cert)"
  type        = string
  default     = "fenrirledger.com"
}

variable "deploy_service_account" {
  description = "Existing GCP service account used by GitHub Actions for deployment"
  type        = string
  default     = "fenrir-deploy@fenrir-ledger-prod.iam.gserviceaccount.com"
}

# --------------------------------------------------------------------------
# Monitoring
# --------------------------------------------------------------------------

variable "alert_email" {
  description = "Email address for Cloud Monitoring alert notifications"
  type        = string
  default     = "alerts@fenrirledger.com"
}

variable "uptime_check_host" {
  description = "Hostname for the uptime check (GKE Ingress IP or custom domain)"
  type        = string
  # No default — must be provided at apply time (Ingress hostname from kubectl)
}

# --------------------------------------------------------------------------
# Stripe
# --------------------------------------------------------------------------

variable "stripe_api_key" {
  description = "Stripe secret API key used to manage webhook endpoints via Terraform. Never commit this value — pass via TF_VAR_stripe_api_key env var or a secrets manager."
  type        = string
  sensitive   = true
}
