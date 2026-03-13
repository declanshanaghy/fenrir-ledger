# Example Terraform variables — copy to terraform.tfvars and fill in values
# DO NOT commit terraform.tfvars (it's in .gitignore)

project_id         = "fenrir-ledger-prod"
region             = "us-central1"
zone               = "us-central1-a"
cluster_name       = "fenrir-autopilot"
domain             = "fenrirledger.com"
billing_account_id = "XXXXXX-XXXXXX-XXXXXX"
cost_alert_amount  = 150

# Monitoring
alert_email        = "alerts@fenrirledger.com"
uptime_check_host  = "34.xxx.xxx.xxx.nip.io"  # GKE Ingress hostname — get from: kubectl get ingress -n fenrir-app
