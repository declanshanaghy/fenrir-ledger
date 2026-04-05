# Terraform — Fenrir Ledger GCP Infrastructure

Terraform manages all **Google Cloud** resources: the GKE cluster, networking, DNS, CDN, monitoring, Firestore, Artifact Registry, and IAM. It does **not** manage Kubernetes workloads — that's Helm's job.

All `.tf` files live in `infrastructure/`. State is stored remotely in GCS bucket `fenrir-ledger-tf-state` (prefix: `infrastructure`).

---

## Quick Reference

| File | What it manages |
|---|---|
| `main.tf` | Provider config, backend (GCS state), required GCP APIs |
| `gke.tf` | GKE Autopilot cluster |
| `network.tf` | VPC, subnets, secondary IP ranges for pods/services |
| `dns.tf` | Cloud DNS zone, static IP, A records |
| `cdn-monitoring.tf` | Cloud CDN monitoring dashboard + alert policies |
| `monitoring.tf` | Uptime checks and alert policies for the app |
| `firestore.tf` | Firestore (native mode) + security rules |
| `artifact-registry.tf` | Google Artifact Registry for container images |
| `iam.tf` | Workload Identity bindings for K8s service accounts |
| `variables.tf` | Input variable definitions |
| `outputs.tf` | Output values (cluster name, artifact registry URL, etc.) |

---

## Running Terraform

### Prerequisites

```bash
# Authenticate
gcloud auth application-default login

# Set project
gcloud config set project fenrir-ledger-prod

# Get existing state
cd infrastructure
terraform init
```

### Plan

```bash
terraform plan \
  -var="project_id=fenrir-ledger-prod" \
  -var="region=us-central1" \
  -var="zone=us-central1-a" \
  -out=tfplan
```

### Apply

```bash
terraform apply tfplan
```

### CI (GitHub Actions)

Terraform runs automatically in CI when `*.tf` files or `infrastructure/firestore/` change. See [Deployment Pipeline](deployment-pipeline.md) for the full job definition.

Required CI secrets: `GCP_PROJECT_ID`, `GCP_SA_KEY`, `GCP_REGION`, `GCP_ZONE`, `TF_VAR_BILLING_ACCOUNT_ID`, `TF_VAR_UPTIME_CHECK_HOST`.

---

## File-by-File Details

### `main.tf` — Provider & Backend

Configures:
- Terraform `>= 1.5.0`, Google provider `~> 5.0`, Google-Beta provider `~> 5.0`
- Remote state backend: `gs://fenrir-ledger-tf-state/infrastructure`
- Enables required GCP APIs (Container, DNS, Artifact Registry, Firestore, Monitoring, etc.)

### `gke.tf` — GKE Autopilot Cluster

Creates a **regional GKE Autopilot cluster** in `us-central1`. Autopilot means Google manages node provisioning, scaling, and security patches.

Key settings:
- `enable_autopilot = true`
- Private nodes (no public node IPs), public control plane endpoint
- Workload Identity enabled (`workload_pool = "${project_id}.svc.id.goog"`)
- Release channel: `REGULAR`
- System components + workloads logging/monitoring enabled

### `network.tf` — VPC & Subnets

Creates a custom-mode VPC with:
- Primary subnet: `10.0.0.0/20` (nodes)
- Secondary ranges: `10.4.0.0/14` (pods), `10.0.32.0/20` (services)
- Cloud Router + NAT for private node egress (internet access without public IPs)
- Firewall rules for health checks and internal traffic

### `dns.tf` — DNS & Static IP

Creates:
- `google_compute_global_address` — static global IP `fenrir-app-ip` for the GKE Ingress
- `google_dns_managed_zone` — Cloud DNS zone for `fenrirledger.com`
- A records for `fenrirledger.com` (apex) and `www.fenrirledger.com` → `fenrir-app-ip`

> After first apply: delegate DNS at your registrar to Google's nameservers.
> Get them: `terraform output dns_nameservers`

### `cdn-monitoring.tf` — CDN Observability

Creates a Google Cloud Monitoring dashboard and alert policies for CDN performance:
- Cache hit ratio tracking
- Latency percentiles (p50/p95/p99) — edge and origin
- Bandwidth (cache vs origin)
- Error rates by cache status

Metrics source: `loadbalancing.googleapis.com/https/*`

### `monitoring.tf` — App Uptime Monitoring

Creates uptime checks and alert policies for the main app:
- HTTP uptime check against `/api/health`
- Alert policies for uptime check failures and container error rates

### `firestore.tf` — Firestore Database

Creates:
- `google_firestore_database` — native-mode Firestore named `fenrir-ledger-prod` in `us-central1`
- `deletion_policy = "DELETE"` — Prevents accidental deletion in CI/CD
- Firestore security rules deployed via `google_firebaserules_release`

All app access uses the Admin SDK via Workload Identity — no credentials file required in pods.

### `artifact-registry.tf` — Container Image Repository

Creates a Docker repository at `us-central1-docker.pkg.dev/fenrir-ledger-prod/fenrir-images/`.

Stores images:
- `fenrir-app` — Next.js application
- `odin-throne` — Monitor backend
- `odin-throne-ui` — Monitor UI
- `agent-sandbox` — Agent GKE Job container

Cleanup policy: untagged images auto-deleted after 14 days.

### `iam.tf` — Workload Identity

Creates GCP service accounts and Workload Identity bindings for K8s pods:

**`fenrir-app-workload`** (used by `fenrir-app-sa` in `fenrir-app` namespace):
- `roles/storage.objectViewer` — Cloud Storage read
- `roles/logging.logWriter` — Cloud Logging write
- `roles/monitoring.metricWriter` — Cloud Monitoring write
- `roles/datastore.user` — Firestore read/write

**`fenrir-agents-workload`** (used by `fenrir-agents-sa` in `fenrir-agents` namespace):
- `roles/artifactregistry.reader` — pull container images
- `roles/logging.logWriter` — Cloud Logging write

Binding pattern: each K8s SA is annotated with `iam.gke.io/gcp-service-account=<gcp-sa-email>`, and the GCP SA gets `roles/iam.workloadIdentityUser` for the K8s SA principal.

### `variables.tf` — Input Variables

| Variable | Default | Description |
|---|---|---|
| `project_id` | `fenrir-ledger-prod` | GCP project ID |
| `region` | `us-central1` | GCP region |
| `zone` | `us-central1-a` | GCP zone |
| `cluster_name` | `fenrir-autopilot` | GKE cluster name |
| `network_name` | (set in var) | VPC name |
| `artifact_repo_name` | (set in var) | Artifact Registry repo name |
| `uptime_check_host` | — | Hostname for uptime monitoring check |

All variables have defaults except `uptime_check_host` — this must be supplied at apply time (via GitHub Secrets in CI).

### `outputs.tf` — Output Values

| Output | Description |
|---|---|
| `cluster_name` | GKE cluster name |
| `cluster_endpoint` | K8s API endpoint (sensitive) |
| `cluster_location` | Cluster region |
| `artifact_registry_url` | Full Artifact Registry URL |
| `app_service_account_email` | GCP SA email for app Workload Identity |
