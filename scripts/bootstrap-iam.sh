#!/usr/bin/env bash
# --------------------------------------------------------------------------
# bootstrap-iam.sh — Grant all required IAM roles before first terraform apply
#
# Terraform can't grant itself permissions it doesn't yet have. Run this
# script once before the initial `terraform apply` on a fresh project to
# bootstrap the deploy service account with all required roles.
#
# Usage:
#   bash scripts/bootstrap-iam.sh [PROJECT_ID] [SERVICE_ACCOUNT_EMAIL]
#
# Defaults:
#   PROJECT_ID:             fenrir-ledger-prod
#   SERVICE_ACCOUNT_EMAIL:  fenrir-deploy@fenrir-ledger-prod.iam.gserviceaccount.com
#
# Prerequisites:
#   - gcloud CLI authenticated with Owner or IAM Admin on the project
#   - The service account must already exist
# --------------------------------------------------------------------------
set -euo pipefail

PROJECT_ID="${1:-fenrir-ledger-prod}"
SA_EMAIL="${2:-fenrir-deploy@${PROJECT_ID}.iam.gserviceaccount.com}"

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

echo -e "${BOLD}Fenrir Ledger — IAM Bootstrap${RESET}"
echo "  Project: ${PROJECT_ID}"
echo "  Service Account: ${SA_EMAIL}"
echo ""

# --------------------------------------------------------------------------
# Required roles — must match local.deploy_roles in infrastructure/iam.tf
# --------------------------------------------------------------------------
ROLES=(
  "roles/container.admin"
  "roles/container.developer"
  "roles/compute.loadBalancerAdmin"
  "roles/compute.networkAdmin"
  "roles/compute.securityAdmin"
  "roles/dns.admin"
  "roles/iam.serviceAccountAdmin"
  "roles/iam.serviceAccountUser"
  "roles/resourcemanager.projectIamAdmin"
  "roles/artifactregistry.admin"
  "roles/logging.admin"
  "roles/monitoring.admin"
  "roles/certificatemanager.editor"
)

# --------------------------------------------------------------------------
# Preflight
# --------------------------------------------------------------------------
if ! command -v gcloud &>/dev/null; then
  echo -e "${RED}Error: gcloud CLI not found.${RESET}" >&2
  exit 1
fi

# Verify the SA exists
if ! gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" &>/dev/null; then
  echo -e "${YELLOW}Service account ${SA_EMAIL} does not exist. Creating...${RESET}"
  gcloud iam service-accounts create "$(echo "$SA_EMAIL" | cut -d@ -f1)" \
    --project="$PROJECT_ID" \
    --display-name="Fenrir Deploy (GitHub Actions)" \
    --description="CI/CD service account for GitHub Actions deployments"
  echo -e "${GREEN}✓${RESET} Service account created"
fi

# --------------------------------------------------------------------------
# Grant roles
# --------------------------------------------------------------------------
FAILED=0
for ROLE in "${ROLES[@]}"; do
  if gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE" \
    --quiet &>/dev/null; then
    echo -e "  ${GREEN}✓${RESET} ${ROLE}"
  else
    echo -e "  ${RED}✗${RESET} ${ROLE} — failed to grant"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}✓${RESET} All ${#ROLES[@]} roles granted successfully."
  echo ""
  echo "Next steps:"
  echo "  1. cd infrastructure"
  echo "  2. terraform init"
  echo "  3. terraform plan -var billing_account_id=XXXXXX-XXXXXX-XXXXXX"
  echo "  4. terraform apply"
else
  echo -e "${RED}✗${RESET} ${FAILED} role(s) failed. Check permissions — you need Owner or IAM Admin."
  exit 1
fi
