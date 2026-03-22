#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Fenrir Ledger — Local Development Setup Script
#
# Idempotent: safe to run multiple times with identical results.
# Supports macOS and Linux.
#
# Usage:
#   ./development/scripts/setup-local.sh
#
# After running, start the dev server:
#   cd development/ledger && npm run dev
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── ANSI color codes ──────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${GREEN}[INFO]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET} $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }
header()  { echo -e "\n${BOLD}$*${RESET}"; }

# ── Resolve script location → repo root ──────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SRC_DIR="${REPO_ROOT}/development/ledger"

header "Fenrir Ledger — Local Dev Setup"
echo "Repo root:  ${REPO_ROOT}"
echo "Source dir: ${SRC_DIR}"

# ── Check Node.js ─────────────────────────────────────────────────────────────
header "Checking prerequisites..."

if ! command -v node &>/dev/null; then
  error "Node.js is not installed. Install Node.js >= 18 from https://nodejs.org"
fi

NODE_VERSION=$(node --version | sed 's/v//')
NODE_MAJOR=$(echo "${NODE_VERSION}" | cut -d. -f1)

if [ "${NODE_MAJOR}" -lt 18 ]; then
  error "Node.js >= 18 is required. Found: v${NODE_VERSION}. Upgrade at https://nodejs.org"
fi

info "Node.js v${NODE_VERSION} ✓"

# ── Check npm ─────────────────────────────────────────────────────────────────
if ! command -v npm &>/dev/null; then
  error "npm is not installed. It should come with Node.js."
fi

NPM_VERSION=$(npm --version)
info "npm v${NPM_VERSION} ✓"

# ── Install npm dependencies ──────────────────────────────────────────────────
header "Installing npm dependencies..."

if [ ! -d "${SRC_DIR}" ]; then
  error "Source directory not found: ${SRC_DIR}"
fi

cd "${SRC_DIR}"

if [ -f "package-lock.json" ]; then
  info "Found package-lock.json — running npm ci"
  npm ci
else
  info "No package-lock.json — running npm install"
  npm install
fi

info "Dependencies installed ✓"

# ── Set up .env.local ─────────────────────────────────────────────────────────
header "Setting up environment..."

ENV_EXAMPLE="${SRC_DIR}/.env.example"
ENV_LOCAL="${SRC_DIR}/.env.local"

if [ ! -f "${ENV_EXAMPLE}" ]; then
  warn ".env.example not found at ${ENV_EXAMPLE}. Skipping .env.local setup."
elif [ -f "${ENV_LOCAL}" ]; then
  info ".env.local already exists — skipping (not overwriting)"
else
  cp "${ENV_EXAMPLE}" "${ENV_LOCAL}"
  info "Created .env.local from .env.example ✓"
fi

# ── GKE setup (required) ────────────────────────────────────────────────────
header "GKE / kubectl setup..."

GKE_SETUP="${REPO_ROOT}/scripts/gke-setup.sh"
if [ ! -f "${GKE_SETUP}" ]; then
  error "scripts/gke-setup.sh not found. Repo may be incomplete."
fi

if ! command -v gcloud &>/dev/null; then
  error "gcloud CLI is required. Install: https://cloud.google.com/sdk/docs/install"
fi

bash "${GKE_SETUP}"
info "GKE setup complete ✓"

# ── Done ──────────────────────────────────────────────────────────────────────
header "Setup complete!"
echo ""
echo -e "  ${GREEN}To start the development server:${RESET}"
echo -e "  ${BOLD}cd development/ledger && npm run dev${RESET}"
echo ""
echo -e "  Then open: ${BOLD}http://localhost:3000${RESET}"
echo ""
echo -e "  ${GREEN}Other setup scripts:${RESET}"
echo -e "  ${BOLD}bash scripts/gke-setup.sh${RESET}  — Reconfigure kubectl for GKE"
echo ""
