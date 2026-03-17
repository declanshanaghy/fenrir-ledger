# GKE Smoke Test — Fenrir Ledger

How to verify the app is running on the GKE Ingress hostname.

## Prerequisites

- `kubectl` configured for the `fenrir-autopilot` cluster
- `gcloud` authenticated with the `fenrir-ledger-prod` project

```bash
gcloud container clusters get-credentials fenrir-autopilot \
  --region us-central1 \
  --project fenrir-ledger-prod
```

## 1. Get the Ingress hostname

```bash
kubectl get ingress -n fenrir-app -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}'
```

The Ingress IP should be assigned. If blank, the Ingress controller is still provisioning.

## 2. Health check

```bash
INGRESS_IP=$(kubectl get ingress -n fenrir-app -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}')
curl -sk "https://${INGRESS_IP}/api/health" -H "Host: ${INGRESS_IP}" -w "\nHTTP %{http_code}\n"
```

Expected: HTTP 200 with a JSON response.

## 3. Homepage loads

```bash
curl -sk "https://${INGRESS_IP}/" -H "Host: ${INGRESS_IP}" -o /dev/null -w "HTTP %{http_code}\n"
```

Expected: HTTP 200.

## 4. Verify pods are healthy

```bash
kubectl get pods -n fenrir-app
```

All pods should be `Running` with `READY 1/1`.

## 5. Check pod logs for startup errors

```bash
kubectl logs -n fenrir-app -l app=fenrir-app --tail=50
```

Should show Next.js startup messages without error stack traces.

## 6. Verify Cloud Monitoring

After Terraform apply with monitoring config:

```bash
# Check uptime check exists
gcloud monitoring uptime-check-configs list --project=fenrir-ledger-prod

# Check alert policies
gcloud alpha monitoring policies list --project=fenrir-ledger-prod
```

## Troubleshooting

| Symptom | Check |
|---------|-------|
| No Ingress IP | `kubectl describe ingress -n fenrir-app` — look for events |
| Pods CrashLoopBackOff | `kubectl logs -n fenrir-app <pod> --previous` |
| 502 Bad Gateway | Pods not ready yet, or health check path wrong |
| SSL errors | Expected with IP-based access (no cert for IP); use `-k` flag |
