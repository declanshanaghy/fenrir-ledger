#!/usr/bin/env bash
# --------------------------------------------------------------------------
# dispatch-job.sh — Create and apply a K8s Job for agent dispatch
#
# Generates a Job manifest from the template, substitutes placeholders,
# and applies it to the GKE cluster. Fire-and-forget: returns immediately
# after Job creation.
#
# Usage:
#   bash infrastructure/k8s/agents/dispatch-job.sh \
#     --session-id "issue-681-step1-firemandecko-a1b2c3d4" \
#     --branch "feat/issue-681-gke-agent-sandboxes" \
#     --model "claude-opus-4-6" \
#     --prompt "Your task prompt here..." \
#     [--image-tag "latest"] \
#     [--dry-run]
#
# Required:
#   --session-id  Unique session identifier
#   --branch      Git branch name
#   --model       Claude model identifier
#   --prompt      Task prompt text
#
# Optional:
#   --image-tag   Container image tag (default: latest)
#   --dry-run     Print generated manifest without applying
# --------------------------------------------------------------------------
set -euo pipefail

# --------------------------------------------------------------------------
# Parse arguments
# --------------------------------------------------------------------------
SESSION_ID=""
BRANCH=""
MODEL=""
PROMPT=""
IMAGE_TAG="latest"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --session-id) SESSION_ID="$2"; shift 2 ;;
    --branch)     BRANCH="$2"; shift 2 ;;
    --model)      MODEL="$2"; shift 2 ;;
    --prompt)     PROMPT="$2"; shift 2 ;;
    --image-tag)  IMAGE_TAG="$2"; shift 2 ;;
    --dry-run)    DRY_RUN=true; shift ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# Validate required arguments
if [ -z "$SESSION_ID" ] || [ -z "$BRANCH" ] || [ -z "$MODEL" ] || [ -z "$PROMPT" ]; then
  echo "Error: --session-id, --branch, --model, and --prompt are all required." >&2
  exit 1
fi

# --------------------------------------------------------------------------
# Generate Job name (must be DNS-compatible: lowercase, max 63 chars)
# --------------------------------------------------------------------------
# Extract issue number and agent from session ID for a readable name
JOB_NAME=$(echo "agent-${SESSION_ID}" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | cut -c1-63)

# --------------------------------------------------------------------------
# Locate template
# --------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="${SCRIPT_DIR}/job-template.yaml"

if [ ! -f "$TEMPLATE" ]; then
  echo "Error: Job template not found at ${TEMPLATE}" >&2
  exit 1
fi

# --------------------------------------------------------------------------
# Substitute placeholders
# --------------------------------------------------------------------------
# The task prompt needs to be properly escaped for YAML embedding.
# We use a simple approach: the prompt is passed as-is in the env var.
# For multiline prompts, the entrypoint reads TASK_PROMPT from env.

MANIFEST=$(cat "$TEMPLATE" \
  | sed "s|{{JOB_NAME}}|${JOB_NAME}|g" \
  | sed "s|{{SESSION_ID}}|${SESSION_ID}|g" \
  | sed "s|{{BRANCH}}|${BRANCH}|g" \
  | sed "s|{{AGENT_MODEL}}|${MODEL}|g" \
  | sed "s|{{IMAGE_TAG}}|${IMAGE_TAG}|g"
)

# Handle TASK_PROMPT separately — it can contain special chars.
# We base64-encode it and the entrypoint will decode it.
# Actually, the prompt goes directly as env var value in the Job spec.
# For safety, we write a temporary file with the full manifest.
TMPFILE=$(mktemp /tmp/agent-job-XXXXXX.yaml)
echo "$MANIFEST" | sed "s|{{TASK_PROMPT}}|${PROMPT}|g" > "$TMPFILE"

# --------------------------------------------------------------------------
# Apply or dry-run
# --------------------------------------------------------------------------
if [ "$DRY_RUN" = true ]; then
  echo "=== DRY RUN — Generated Job Manifest ==="
  cat "$TMPFILE"
  rm -f "$TMPFILE"
  exit 0
fi

echo "Creating K8s Job: ${JOB_NAME}"
echo "  Namespace: fenrir-agents"
echo "  Branch: ${BRANCH}"
echo "  Model: ${MODEL}"
echo "  Image: agent-sandbox:${IMAGE_TAG}"

kubectl apply -f "$TMPFILE" -n fenrir-agents

rm -f "$TMPFILE"

echo "[ok] Job created: ${JOB_NAME}"
echo "  Logs: kubectl logs job/${JOB_NAME} -n fenrir-agents --follow"
echo "  Status: kubectl get job/${JOB_NAME} -n fenrir-agents"
