# n8n — GKE Autopilot Deployment

n8n workflow automation platform deployed in the `fenrir-analytics` namespace
via Helm. Uses SQLite on a 1Gi PVC for persistence. Accessible at
`marketing.fenrirledger.com` (DNS + TLS from issue #1231).

## Files

| File | Purpose |
|---|---|
| `values.yaml` | Helm values for `oci://ghcr.io/8gears/n8n` |
| `namespace.yaml` | `fenrir-analytics` namespace (created by bootstrap, emergency fallback) |
| `managed-certificate.yaml` | GKE ManagedCertificate for `marketing.fenrirledger.com` |
| `ingress-patch.yaml` | GCE Ingress + BackendConfig routing to n8n service |

## Deploy / Upgrade

```bash
# 1. Ensure namespace exists (idempotent — bootstrap chart usually creates it)
kubectl apply -f infrastructure/k8s/n8n/namespace.yaml

# 2. Apply GKE ManagedCertificate (TLS provisioning starts immediately)
kubectl apply -f infrastructure/k8s/n8n/managed-certificate.yaml -n fenrir-analytics

# 3. Deploy n8n via Helm
helm upgrade --install n8n oci://ghcr.io/8gears/n8n \
  -n fenrir-analytics \
  -f infrastructure/k8s/n8n/values.yaml

# 4. Apply GCE Ingress + BackendConfig (may override Helm-managed ingress)
kubectl apply -f infrastructure/k8s/n8n/ingress-patch.yaml -n fenrir-analytics
```

## Verify

```bash
# Pod health
kubectl get pods -n fenrir-analytics -l app.kubernetes.io/name=n8n

# Ingress + IP allocation
kubectl get ingress -n fenrir-analytics

# Certificate provisioning status (may take 10–20 min on first deploy)
kubectl describe managedcertificate n8n-cert -n fenrir-analytics

# PVC bound
kubectl get pvc -n fenrir-analytics

# Service endpoint
kubectl get svc n8n -n fenrir-analytics
```

## Architecture

```
marketing.fenrirledger.com (DNS A → fenrir-app-ip)
  └── GCE Ingress (fenrir-app-ip static IP)
        └── GKE ManagedCertificate (n8n-cert) — TLS termination
              └── n8n Service (ClusterIP :80 → pod :5678)
                    └── n8n Pod (n8nio/n8n)
                          └── PVC (1Gi standard-rwo) → /home/node/.n8n (SQLite)
```

## Configuration

- **Namespace:** `fenrir-analytics`
- **Static IP:** `fenrir-app-ip` (shared with main app, `marketing.` DNS points here)
- **Storage:** SQLite on 1Gi PVC (`standard-rwo` StorageClass)
- **Resources:** 250m CPU / 512Mi memory (requests = limits)
- **Host:** `marketing.fenrirledger.com`
- **Protocol:** `https`

## Environment Variables

Key n8n env vars set via `values.yaml`:

| Var | Value |
|---|---|
| `N8N_HOST` | `marketing.fenrirledger.com` |
| `N8N_PROTOCOL` | `https` |
| `N8N_PORT` | `5678` |
| `N8N_EDITOR_BASE_URL` | `https://marketing.fenrirledger.com/` |
| `WEBHOOK_URL` | `https://marketing.fenrirledger.com/` |
| `N8N_USER_FOLDER` | `/home/node/.n8n` (PVC mount) |

## Related Issues

- **#1232** — This deployment (n8n Helm + GKE)
- **#1231** — DNS A-record + TLS cert for `marketing.fenrirledger.com`
- **#1230** — n8n workflow git backup
