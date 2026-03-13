#!/usr/bin/env bash
# --------------------------------------------------------------------------
# gke-setup.sh — Configure local CLI for Fenrir Ledger GKE Autopilot
#
# Installs missing tools, authenticates, and configures kubectl context.
# Safe to re-run (idempotent).
#
# Usage: bash .claude/scripts/gke-setup.sh
# --------------------------------------------------------------------------
set -euo pipefail

PROJECT_ID="fenrir-ledger-prod"
CLUSTER_NAME="fenrir-autopilot"
REGION="us-central1"

info()  { echo "✓ $*"; }
warn()  { echo "⚠ $*"; }
fail()  { echo "✗ $*" >&2; exit 1; }

# --------------------------------------------------------------------------
# 1. Check prerequisites
# --------------------------------------------------------------------------
echo "=== Fenrir Ledger GKE Setup ==="
echo ""

# gcloud
if ! command -v gcloud &>/dev/null; then
  fail "gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"
fi
info "gcloud $(gcloud version --format='value(version)' 2>/dev/null || gcloud --version | head -1 | awk '{print $4}')"

# kubectl
if ! command -v kubectl &>/dev/null; then
  echo "Installing kubectl via gcloud..."
  gcloud components install kubectl --quiet
fi
info "kubectl found at $(which kubectl)"

# gke-gcloud-auth-plugin (required for GKE auth)
if ! command -v gke-gcloud-auth-plugin &>/dev/null; then
  echo "Installing gke-gcloud-auth-plugin..."
  gcloud components install gke-gcloud-auth-plugin --quiet
fi
info "gke-gcloud-auth-plugin installed"

# k9s (terminal UI for Kubernetes)
if ! command -v k9s &>/dev/null; then
  echo "Installing k9s..."
  if command -v brew &>/dev/null; then
    brew install derailed/k9s/k9s
  else
    fail "k9s not found and brew not available. Install manually: https://k9scli.io/topics/install/"
  fi
fi
info "k9s $(k9s version --short 2>/dev/null || echo 'installed')"

# --------------------------------------------------------------------------
# 2. Authenticate (if needed)
# --------------------------------------------------------------------------
echo ""
ACTIVE_ACCOUNT=$(gcloud auth list --filter="status=ACTIVE" --format="value(account)" 2>/dev/null || true)

if [ -z "$ACTIVE_ACCOUNT" ]; then
  echo "No active gcloud account. Launching browser login..."
  gcloud auth login --update-adc
  ACTIVE_ACCOUNT=$(gcloud auth list --filter="status=ACTIVE" --format="value(account)")
fi
info "Authenticated as: ${ACTIVE_ACCOUNT}"

# --------------------------------------------------------------------------
# 3. Set project
# --------------------------------------------------------------------------
echo ""
gcloud config set project "$PROJECT_ID" --quiet
info "Project set to: ${PROJECT_ID}"

# --------------------------------------------------------------------------
# 4. Get GKE credentials (configures kubectl context)
# --------------------------------------------------------------------------
echo ""
echo "Fetching GKE cluster credentials..."
gcloud container clusters get-credentials "$CLUSTER_NAME" \
  --region "$REGION" \
  --project "$PROJECT_ID"
info "kubectl context configured for: ${CLUSTER_NAME}"

# --------------------------------------------------------------------------
# 5. Verify
# --------------------------------------------------------------------------
echo ""
echo "=== Verification ==="

CONTEXT=$(kubectl config current-context 2>/dev/null || true)
info "Current context: ${CONTEXT}"

echo ""
echo "Cluster info:"
kubectl cluster-info 2>/dev/null | head -2 || warn "Could not reach cluster (may still be provisioning)"

echo ""
echo "Nodes:"
kubectl get nodes 2>/dev/null || warn "Could not list nodes (Autopilot scales on demand)"

echo ""
echo "Namespaces:"
kubectl get namespaces 2>/dev/null || warn "Could not list namespaces"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Useful commands:"
echo "  k9s                                     # Terminal UI for the cluster"
echo "  kubectl get pods -n fenrir-app          # App pods"
echo "  kubectl get svc -n fenrir-app           # Services"
echo "  kubectl get ingress -n fenrir-app       # Ingress + external IP"
echo "  kubectl logs -n fenrir-app -l app.kubernetes.io/name=fenrir-app  # App logs"
