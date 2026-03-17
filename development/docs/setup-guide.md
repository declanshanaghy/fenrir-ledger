# Fenrir Ledger — Development Setup Guide

Complete setup guide for local development and GKE infrastructure access.

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | >= 18 | [nodejs.org](https://nodejs.org) |
| npm | (comes with Node) | |
| gcloud CLI | latest | [cloud.google.com/sdk](https://cloud.google.com/sdk/docs/install) |
| Docker | latest | [docker.com](https://www.docker.com/products/docker-desktop/) |

The setup script installs the remaining tools automatically (kubectl, gke-gcloud-auth-plugin, k9s).

## Quick Start

```bash
# Clone and enter the repo
git clone git@github.com:declanshanaghy/fenrir-ledger.git
cd fenrir-ledger

# Run the full setup (Node deps + GKE auth + tools)
bash development/scripts/setup-local.sh

# Start the dev server
cd development/frontend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What the Setup Script Does

`development/scripts/setup-local.sh` is the single entry point. It runs these steps in order:

1. **Node.js check** — verifies Node >= 18 is installed
2. **npm dependencies** — runs `npm ci` in `development/frontend/`
3. **Environment file** — copies `.env.example` to `.env.local` if not present
4. **GKE setup** — runs `scripts/gke-setup.sh` (see below)

## GKE Setup (Infrastructure Access)

`scripts/gke-setup.sh` configures your local CLI for the GKE Autopilot cluster. It's called automatically by the main setup script but can be re-run independently:

```bash
bash scripts/gke-setup.sh
```

This script:

1. Verifies **gcloud CLI** is installed
2. Installs **kubectl** via gcloud (if missing)
3. Installs **gke-gcloud-auth-plugin** (if missing)
4. Installs **k9s** terminal UI via Homebrew (if missing)
5. Authenticates with Google Cloud (opens browser if needed)
6. Sets project to `fenrir-ledger-prod`
7. Fetches GKE cluster credentials for `fenrir-autopilot` in `us-central1`
8. Verifies cluster connectivity

### GKE Cluster Details

| Property | Value |
|----------|-------|
| Project | `fenrir-ledger-prod` |
| Cluster | `fenrir-autopilot` |
| Region | `us-central1` |
| Type | GKE Autopilot (fully managed) |
| Artifact Registry | `us-central1-docker.pkg.dev/fenrir-ledger-prod/fenrir-images` |

### Useful kubectl Commands

```bash
# Terminal UI (recommended)
k9s

# App pods
kubectl get pods -n fenrir-app

# Services and external IPs
kubectl get svc -n fenrir-app

# Ingress (external hostname/IP)
kubectl get ingress -n fenrir-app

# App logs
kubectl logs -n fenrir-app -l app.kubernetes.io/name=fenrir-app

# Agent sandbox jobs
kubectl get jobs -n fenrir-agents
kubectl logs job/<job-name> -n fenrir-agents --follow
```

## Environment Variables

Copy the example file and fill in values:

```bash
cp development/frontend/.env.example development/frontend/.env.local
```

Required variables for local development:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_PICKER_API_KEY` | Google Picker API key |
| `FENRIR_ANTHROPIC_API_KEY` | Anthropic API key for LLM extraction |
| `ENTITLEMENT_ENCRYPTION_KEY` | AES-256 key for entitlement tokens |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_ID` | Stripe price ID for Karl tier |
| `REDIS_URL` | Redis connection URL (in-cluster: `redis://redis.fenrir-app.svc.cluster.local:6379`) |
| `FIRESTORE_PROJECT_ID` | GCP project ID for Firestore cloud sync (Karl tier) |

## Dev Server with Stripe

For Stripe webhook testing, use the services script:

```bash
bash .claude/scripts/services.sh start    # Starts dev server + Stripe CLI
bash .claude/scripts/services.sh stop     # Stops everything
bash .claude/scripts/services.sh status   # Check status
bash .claude/scripts/services.sh logs     # Tail frontend logs
```

## CI/CD Pipeline

Every push to `main` triggers the unified deploy pipeline (`.github/workflows/deploy.yml`):

1. **Terraform** — ensures GKE infrastructure is up to date
2. **Build & Push** — Docker build, push to Artifact Registry
3. **Deploy** — rolling update to GKE Autopilot (zero-downtime)
4. **Health Check** — verifies `/api/health` via Ingress IP

## Project Structure

```
fenrir-ledger/
  development/
    frontend/           # Next.js app (src/, public/, package.json)
    scripts/            # setup-local.sh
    docs/               # This guide and other dev docs
  infrastructure/
    main.tf             # Terraform provider + GCP APIs
    gke.tf              # GKE Autopilot cluster
    iam.tf              # Workload Identity + IAM
    variables.tf        # Terraform variables
    k8s/app/            # K8s manifests (deployment, service, ingress)
    k8s/agents/         # Agent sandbox job template + dispatch script
  scripts/
    gke-setup.sh        # GKE CLI setup (kubectl, k9s, auth)
  quality/
    scripts/            # verify.sh, test runners
    test-suites/        # Playwright E2E tests
  .github/workflows/    # CI/CD pipelines
```
