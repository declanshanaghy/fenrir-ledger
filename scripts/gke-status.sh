#!/usr/bin/env bash
# --------------------------------------------------------------------------
# gke-status.sh — GKE cluster and app status summary
#
# Outputs a full overview of the Fenrir Ledger deployment: cluster info,
# nodes, app pods, services, ingress, secrets, certificates, and health.
#
# Usage: bash scripts/gke-status.sh
# --------------------------------------------------------------------------
set -euo pipefail

PROJECT_ID="fenrir-ledger-prod"
CLUSTER_NAME="fenrir-autopilot"
REGION="us-central1"
APP_NS="fenrir-app"
AGENTS_NS="fenrir-agents"

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

section() { echo -e "\n${BOLD}${CYAN}═══ $* ═══${RESET}"; }
ok()      { echo -e "${GREEN}✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}⚠${RESET} $*"; }
fail()    { echo -e "${RED}✗${RESET} $*"; }

# --------------------------------------------------------------------------
# Preflight
# --------------------------------------------------------------------------
if ! command -v kubectl &>/dev/null; then
  echo "kubectl not found. Run: bash scripts/gke-setup.sh" >&2
  exit 1
fi

CONTEXT=$(kubectl config current-context 2>/dev/null || true)
if [ -z "$CONTEXT" ]; then
  echo "No kubectl context. Run: bash scripts/gke-setup.sh" >&2
  exit 1
fi

echo -e "${BOLD}Fenrir Ledger — GKE Status Report${RESET}"
echo "$(date '+%Y-%m-%d %H:%M:%S %Z')"

# --------------------------------------------------------------------------
# Cluster
# --------------------------------------------------------------------------
section "Cluster"
echo -e "  Project:  ${BOLD}${PROJECT_ID}${RESET}"
echo -e "  Cluster:  ${BOLD}${CLUSTER_NAME}${RESET}"
echo -e "  Region:   ${BOLD}${REGION}${RESET}"
echo -e "  Context:  ${CONTEXT}"
echo ""
kubectl cluster-info 2>/dev/null | head -2 | sed 's/^/  /' || warn "Could not reach cluster"

# --------------------------------------------------------------------------
# Nodes
# --------------------------------------------------------------------------
section "Nodes"
kubectl get nodes -o wide 2>/dev/null | sed 's/^/  /' || warn "No nodes (Autopilot scales on demand)"

# --------------------------------------------------------------------------
# Namespaces
# --------------------------------------------------------------------------
section "Namespaces"
kubectl get namespaces --no-headers 2>/dev/null | awk '{printf "  %-40s %s\n", $1, $2}'

# --------------------------------------------------------------------------
# App Deployment
# --------------------------------------------------------------------------
section "App Deployment (${APP_NS})"

# Deployment
echo -e "\n${BOLD}  Deployment:${RESET}"
kubectl get deployment -n "$APP_NS" -o wide 2>/dev/null | sed 's/^/  /' || warn "No deployments"

# Pods
echo -e "\n${BOLD}  Pods:${RESET}"
kubectl get pods -n "$APP_NS" -o wide 2>/dev/null | sed 's/^/  /' || warn "No pods"

# Pod resource usage (if metrics-server available)
if kubectl top pods -n "$APP_NS" &>/dev/null 2>&1; then
  echo -e "\n${BOLD}  Resource Usage:${RESET}"
  kubectl top pods -n "$APP_NS" 2>/dev/null | sed 's/^/  /'
fi

# --------------------------------------------------------------------------
# Service
# --------------------------------------------------------------------------
section "Service"
kubectl get svc -n "$APP_NS" -o wide 2>/dev/null | sed 's/^/  /' || warn "No services"

# --------------------------------------------------------------------------
# Ingress & External Access
# --------------------------------------------------------------------------
section "Ingress & External Access"
kubectl get ingress -n "$APP_NS" -o wide 2>/dev/null | sed 's/^/  /' || warn "No ingress"

INGRESS_IP=$(kubectl get ingress fenrir-app -n "$APP_NS" \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)

DOMAIN="fenrirledger.com"

if [ -n "$INGRESS_IP" ]; then
  echo ""
  ok "External IP: ${BOLD}${INGRESS_IP}${RESET}"
  echo -e "  Domain: https://${DOMAIN}"
  echo -e "  HTTP:   http://${INGRESS_IP}"
  echo -e "  Health: https://${DOMAIN}/api/health"
else
  warn "No external IP assigned yet"
fi

# --------------------------------------------------------------------------
# SSL Certificate
# --------------------------------------------------------------------------
section "SSL Certificate"
kubectl get managedcertificates -n "$APP_NS" 2>/dev/null | sed 's/^/  /' || echo "  No managed certificates"

CERT_STATUS=$(kubectl get managedcertificate fenrir-app-cert -n "$APP_NS" \
  -o jsonpath='{.status.certificateStatus}' 2>/dev/null || true)

if [ -n "$CERT_STATUS" ]; then
  case "$CERT_STATUS" in
    Active)       ok "Certificate: Active" ;;
    Provisioning) warn "Certificate: Provisioning (can take 15-60 min, requires DNS)" ;;
    *)            warn "Certificate: ${CERT_STATUS}" ;;
  esac
fi

# --------------------------------------------------------------------------
# Secrets
# --------------------------------------------------------------------------
section "Secrets"
kubectl get secrets -n "$APP_NS" --no-headers 2>/dev/null | while read -r name type data age; do
  echo -e "  ${name}  (${type}, ${data} keys, age: ${age})"
done

# --------------------------------------------------------------------------
# Service Account & Workload Identity
# --------------------------------------------------------------------------
section "Service Accounts"
kubectl get serviceaccounts -n "$APP_NS" --no-headers 2>/dev/null | while read -r name secrets age; do
  ANNOTATION=$(kubectl get serviceaccount "$name" -n "$APP_NS" \
    -o jsonpath='{.metadata.annotations.iam\.gke\.io/gcp-service-account}' 2>/dev/null || true)
  if [ -n "$ANNOTATION" ]; then
    echo -e "  ${name}  → ${ANNOTATION}"
  else
    echo -e "  ${name}"
  fi
done

# --------------------------------------------------------------------------
# Backend Config
# --------------------------------------------------------------------------
section "Backend Config"
kubectl get backendconfig -n "$APP_NS" 2>/dev/null | sed 's/^/  /' || echo "  None"

# --------------------------------------------------------------------------
# Agent Sandboxes
# --------------------------------------------------------------------------
section "Agent Sandboxes (${AGENTS_NS})"
if kubectl get namespace "$AGENTS_NS" &>/dev/null 2>&1; then
  JOBS=$(kubectl get jobs -n "$AGENTS_NS" --no-headers 2>/dev/null | wc -l | tr -d ' ')
  RUNNING=$(kubectl get jobs -n "$AGENTS_NS" --no-headers 2>/dev/null | grep -c "1/1" || true)
  PENDING=$(kubectl get jobs -n "$AGENTS_NS" --no-headers 2>/dev/null | grep -c "0/1" || true)
  echo -e "  Total jobs: ${JOBS}  |  Completed: ${RUNNING}  |  Running: ${PENDING}"
  echo ""
  kubectl get jobs -n "$AGENTS_NS" --sort-by=.metadata.creationTimestamp 2>/dev/null | tail -6 | sed 's/^/  /'
else
  echo "  Namespace ${AGENTS_NS} does not exist yet"
fi

# --------------------------------------------------------------------------
# Health Check
# --------------------------------------------------------------------------
section "Health Check"

# Try HTTPS via domain first, fall back to HTTP via IP
if [ -n "$INGRESS_IP" ]; then
  echo -e "  Checking https://${DOMAIN}/api/health ..."
  HTTPS_CODE=$(curl -sf -o /dev/null -w '%{http_code}' --max-time 10 \
    "https://${DOMAIN}/api/health" 2>/dev/null || echo "000")
  if [ "$HTTPS_CODE" = "200" ]; then
    ok "HTTPS health check PASSED (HTTP ${HTTPS_CODE})"
    BODY=$(curl -sf --max-time 10 "https://${DOMAIN}/api/health" 2>/dev/null || true)
    if [ -n "$BODY" ]; then
      echo -e "  Response: ${BODY}"
    fi
  else
    warn "HTTPS health check returned HTTP ${HTTPS_CODE} — falling back to IP"
    echo -e "  Checking http://${INGRESS_IP}/api/health ..."
    HTTP_CODE=$(curl -sf -o /dev/null -w '%{http_code}' --max-time 10 \
      "http://${INGRESS_IP}/api/health" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
      ok "HTTP health check PASSED (HTTP ${HTTP_CODE})"
      BODY=$(curl -sf --max-time 10 "http://${INGRESS_IP}/api/health" 2>/dev/null || true)
      if [ -n "$BODY" ]; then
        echo -e "  Response: ${BODY}"
      fi
    else
      warn "Health check returned HTTP ${HTTP_CODE}"
    fi
  fi
else
  warn "Skipped — no external IP"
fi

# --------------------------------------------------------------------------
# GCP Dependencies
# --------------------------------------------------------------------------
section "GCP Dependencies"
if command -v gcloud &>/dev/null; then
  echo -e "\n${BOLD}  Artifact Registry:${RESET}"
  gcloud artifacts repositories describe fenrir-images \
    --location="$REGION" --project="$PROJECT_ID" \
    --format="table[box](name,format,sizeBytes,createTime)" 2>/dev/null | sed 's/^/  /' \
    || warn "Could not describe Artifact Registry"

  echo -e "\n${BOLD}  Recent Images:${RESET}"
  gcloud artifacts docker images list \
    "${REGION}-docker.pkg.dev/${PROJECT_ID}/fenrir-images/fenrir-app" \
    --sort-by="~UPDATE_TIME" --limit=5 \
    --format="table(package,tags,update_time)" 2>/dev/null | sed 's/^/  /' \
    || warn "Could not list images"

  echo -e "\n${BOLD}  IAM Service Accounts:${RESET}"
  gcloud iam service-accounts list --project="$PROJECT_ID" \
    --filter="email:fenrir" \
    --format="table(email,displayName,disabled)" 2>/dev/null | sed 's/^/  /' \
    || warn "Could not list service accounts"
else
  warn "gcloud not available — skipping GCP dependency checks"
fi

echo ""
echo -e "${BOLD}═══ End of Report ═══${RESET}"
