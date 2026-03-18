# Deployment Pipeline — `.github/workflows/deploy.yml`

Every push to `main` triggers the unified CI/CD pipeline. It detects which services changed, builds only what's needed, and deploys in parallel.

Pipeline file: `.github/workflows/deploy.yml` (849 lines)

---

## Trigger

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      image_tag:       # Override image tag (default: git SHA)
      skip_deploy:     # Build only — skip K8s deployment
      skip_terraform:  # Skip Terraform plan/apply
```

Deployments are **serial** — `concurrency.group: deploy-main` with `cancel-in-progress: false`. A push while a deploy is running queues behind it, never cancels it.

---

## Change Detection Matrix (Job 0)

The `detect-changes` job compares `HEAD~1..HEAD` and outputs boolean flags. All subsequent jobs gate on these flags.

| Output flag | Triggers when these paths change |
|---|---|
| `app` | `development/frontend/`, `Dockerfile`, `package*.json` |
| `k8s-app` | `infrastructure/k8s/app/`, `infrastructure/helm/fenrir-app/` |
| `monitor` | `development/monitor/` |
| `monitor-ui` | `development/monitor-ui/` |
| `helm-odin` | `infrastructure/helm/odin-throne/` |
| `infra` | `infrastructure/*.tf`, `infrastructure/firestore/` |
| `umami` | `infrastructure/helm/umami/` |

> **`workflow_dispatch`**: all flags are forced to `true`, deploying everything.

---

## Job Dependency Graph

```
detect-changes (Job 0)
├── terraform           (Job 1)  — if: infra changed
├── build-and-push      (Job 2)  — if: app or k8s-app changed
├── build-and-push-monitor   (Job 2b) — if: monitor changed
├── build-and-push-monitor-ui (Job 2c) — if: monitor-ui changed
├── test-app            (Job 2d) — needs: build-and-push
├── deploy-bootstrap    (Job 3a) — always (if not skip_deploy)
│   ├── deploy-fenrir-app    (Job 3b) — needs: test-app, build-and-push, deploy-bootstrap
│   ├── deploy-umami         (Job 3c) — needs: deploy-bootstrap, if: umami changed
│   └── deploy-odin-throne   (Job 3d) — needs: build-monitor, build-monitor-ui, deploy-bootstrap
```

---

## Job Details

### Job 1: Terraform Plan & Apply

- Runs if: `infra == 'true'` AND `!inputs.skip_terraform`
- Working directory: `infrastructure/`
- Steps: `terraform init` → `terraform plan -out=tfplan` → `terraform apply tfplan`
- Required secrets: `GCP_PROJECT_ID`, `GCP_SA_KEY`, `GCP_REGION`, `GCP_ZONE`, `TF_VAR_BILLING_ACCOUNT_ID`, `TF_VAR_UPTIME_CHECK_HOST`

### Job 2: Build & Push (App)

- Runs if: `app == 'true' || k8s-app == 'true'`
- Uses `docker/build-push-action` with GHA cache
- Tags pushed: `fenrir-app:<SHA>` and `fenrir-app:latest`
- Build args include `NEXT_PUBLIC_BUILD_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- Output: `full_image` used by downstream deploy job

### Job 2b/2c: Build & Push (Monitor + Monitor-UI)

- Separate jobs for `odin-throne` (backend) and `odin-throne-ui` (React frontend)
- Both push to Artifact Registry on changed paths

### Job 2d: Test App

- Runs after `build-and-push` succeeds
- Steps: TypeScript check → unit tests (Vitest) → build check → E2E tests (Playwright)
- Gates `deploy-fenrir-app` — deploy only runs if tests pass (or are skipped)
- Test reports uploaded as artifacts on failure

### Job 3: Deploy Fenrir App

- Needs: `test-app`, `build-and-push`, `detect-changes`
- **Secret injection** (before Helm):
  1. Creates/updates `fenrir-app-secrets` with all app env vars (API keys, Stripe, etc.)
  2. Creates/updates `agent-secrets` with `CLAUDE_CODE_OAUTH_TOKEN` + `GH_TOKEN`
  3. If no new image was built, resolves the current cluster image tag to avoid rolling out `:latest`
- **Helm deploy**: `helm upgrade --install fenrir-app` with `values-prod.yaml` + `--set app.image.tag=<SHA>`
- **Post-deploy**: Invalidates CDN cache for HTML pages via `gcloud compute url-maps invalidate-cdn-cache`
- Verifies with `kubectl rollout status deployment/fenrir-app -n fenrir-app --timeout=60s`

### Job 4: Deploy Umami

- Runs if: `umami == 'true'` AND `!skip_deploy`
- Secret injection: `umami-secrets` (database URL + app secret) + `umami-oauth2-proxy-secrets` (OAuth)
- Helm deploy with `values-prod.yaml`
- Verifies with `kubectl rollout status deployment/umami -n fenrir-analytics --timeout=60s`

### Job 3d: Deploy Odin's Throne

- Runs if `helm-odin == 'true'` OR new monitor images were built
- Creates `fenrir-monitor` namespace imperatively (not via bootstrap chart)
- Secret injection: `odin-throne-oauth2-proxy-secrets` (Google OAuth + cookie secret)
- Image tag resolution: if no new image was built, reads current tag from running deployment to avoid downgrade
- Helm deploy for both `odin-throne` and `odin-throne-ui` with separate image tags
- Verifies both deployments with `kubectl rollout status`

---

## Secrets Wiring

All secrets are GitHub repository secrets injected into the workflow via `${{ secrets.* }}`.

| Secret | Used by | Purpose |
|---|---|---|
| `GCP_SA_KEY` | All GCP jobs | Base64 GCP service account JSON |
| `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_ZONE` | All GCP jobs | GCP targeting |
| `GKE_CLUSTER_NAME` | All deploy jobs | kubectl context |
| `FENRIR_ANTHROPIC_API_KEY` | deploy-fenrir-app | Anthropic API key for app |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` | deploy-fenrir-app | Stripe integration |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | deploy-fenrir-app (+ build arg) | Stripe publishable key |
| `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | deploy-fenrir-app | OAuth |
| `GOOGLE_PICKER_API_KEY` | deploy-fenrir-app | Drive Picker |
| `ENTITLEMENT_ENCRYPTION_KEY` | deploy-fenrir-app | AES-256 key |
| `CLAUDE_CODE_OAUTH_TOKEN` | deploy-fenrir-app (agent-secrets) | Claude Code CLI token for agents |
| `GH_TOKEN_AGENTS` | deploy-fenrir-app (agent-secrets) | GitHub PAT for agent operations |
| `UMAMI_OAUTH2_PROXY_COOKIE_SECRET` | deploy-umami | 32-byte oauth2-proxy cookie secret |
| `MONITOR_OAUTH2_PROXY_COOKIE_SECRET` | deploy-odin-throne | 32-byte oauth2-proxy cookie secret |
| `ODINS_THRONE_CLIENT_ID/SECRET` | deploy-odin-throne | Google OAuth for Odin's Throne |
| `TF_VAR_BILLING_ACCOUNT_ID` | terraform | GCP billing account |

> `REDIS_URL` is set inline in the deploy step (not a secret): `redis://redis.fenrir-app.svc.cluster.local:6379`

---

## Rollback Procedure

### App rollback (fenrir-app)

```bash
# Option 1: Helm rollback to previous release
helm rollback fenrir-app -n fenrir-app

# Option 2: kubectl rollout undo
kubectl rollout undo deployment/fenrir-app -n fenrir-app

# Verify
kubectl rollout status deployment/fenrir-app -n fenrir-app --timeout=60s
kubectl get pods -n fenrir-app
```

### Odin's Throne rollback

```bash
helm rollback odin-throne -n fenrir-monitor
kubectl rollout status deployment/odin-throne -n fenrir-monitor --timeout=60s
kubectl rollout status deployment/odin-throne-ui -n fenrir-monitor --timeout=60s
```

### Umami rollback

```bash
helm rollback umami -n fenrir-analytics
kubectl rollout status deployment/umami -n fenrir-analytics --timeout=60s
```

### Deploy a specific image tag

To re-deploy a previous git SHA without modifying `main`, use `workflow_dispatch` with the `image_tag` input set to the target SHA.

---

## Manual Deploy (without CI)

For emergency deploys or local testing:

```bash
# Authenticate
gcloud auth login
gcloud container clusters get-credentials fenrir-autopilot --region us-central1 --project fenrir-ledger-prod

# Deploy app
helm upgrade --install fenrir-app ./infrastructure/helm/fenrir-app \
  -f ./infrastructure/helm/fenrir-app/values-prod.yaml \
  --set app.image.tag=<SHA> --namespace fenrir-app --wait
```

See [SMOKE-TEST.md](../SMOKE-TEST.md) for verification steps after manual deploys.
