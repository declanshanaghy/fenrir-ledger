# GitHub Actions Authoring — Shared Rules

Canonical rules for CI/CD workflows. Referenced by FiremanDecko (author) and Loki (reviewer).

## Step Naming (UNBREAKABLE)

Every step must have a `name:`. Canonical names:

| Action | Step name |
|--------|-----------|
| `actions/checkout` | `Checkout` |
| `google-github-actions/auth` | `Authenticate to GCP` |
| `google-github-actions/setup-gcloud` | `Setup gcloud CLI` |
| `google-github-actions/get-gke-credentials` | `Get GKE credentials` |
| `azure/setup-helm` | `Setup Helm` |
| `docker/setup-buildx-action` | `Setup Buildx` |
| `actions/setup-node` | `Setup Node.js` |
| `hashicorp/setup-terraform` | `Setup Terraform` |

## Step Order Within Deploy Jobs (UNBREAKABLE)

1. Checkout
2. Authenticate to GCP
3. Setup gcloud CLI
4. Get GKE credentials
5. Setup Helm (if deploying via Helm)
6. Ensure namespace
7. Sync secrets
8. Login to external registries (GHCR, etc.)
9. Helm deploy / Helm deploy `<component>`
10. Verify rollout / Summary

## Namespace Isolation

| Service | Namespace |
|---------|-----------|
| App | `fenrir-app` |
| Agents | `fenrir-agents` |
| Odin's Throne | `fenrir-monitor` |
| Analytics | `fenrir-analytics` |
| Marketing Engine | `fenrir-marketing` |

New services: add namespace to `Pre-adopt bootstrap resources` AND `Verify namespaces` in the `namespaces` job.

Always idempotent: `kubectl create namespace <ns> --dry-run=client -o yaml | kubectl apply -f -`

## External OCI Charts (GHCR)

Jobs pulling `oci://ghcr.io/` need `packages: read` in permissions + a `helm registry login ghcr.io` step.

## Docker Image Builds

Use `docker/build-push-action@v7` with `cache-from: type=gha` / `cache-to: type=gha,mode=max`. Two tags: versioned + `latest`. Summary step writes tag + digest to `$GITHUB_STEP_SUMMARY`.

## Helm Deploy Pattern

```yaml
- name: Helm deploy
  run: |
    helm upgrade --install <release> ./infrastructure/helm/<chart> \
      --namespace=<namespace> -f ./infrastructure/helm/<chart>/values-prod.yaml \
      --set <key>=${{ env.VALUE }} --wait --timeout=5m
```

Always `--wait --timeout=Xm`. Never omit both.

## Verify Rollout Pattern

```yaml
- name: Verify rollout
  run: |
    echo "### <Service> Deploy" >> $GITHUB_STEP_SUMMARY
    kubectl get pods -n <namespace> >> $GITHUB_STEP_SUMMARY
    kubectl rollout status deployment/<name> -n <namespace> --timeout=60s
```

## detect-changes Job

`workflow_dispatch` must set ALL service flags to `true`. Push-triggered runs use `git diff --name-only HEAD~1 HEAD`.
