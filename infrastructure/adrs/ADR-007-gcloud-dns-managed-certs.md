# ADR-007: Google Cloud DNS and Managed Certificates for TLS

## Status: Accepted

## Date: 2026-03-14

## Context

Fenrir Ledger is deployed on GKE Autopilot (`fenrir-autopilot`, `us-central1`, project `fenrir-ledger-prod`). The application must be reachable at `fenrirledger.com`, `www.fenrirledger.com`, and `analytics.fenrirledger.com` over HTTPS with a valid TLS certificate.

**Prior state (Vercel era):** When the project hosted on Vercel, DNS and TLS were fully automatic — Vercel managed the DNS zone, provisioned a Let's Encrypt certificate, and renewed it without any operator action. Migrating to GKE required replacing that automation with equivalent cloud-native primitives.

**Constraints:**

- The domain registrar is **Namecheap**; we cannot host the authoritative zone there at no cost with fine-grained record control.
- The GKE HTTP(S) Load Balancer (via the `gce` Ingress class) requires a **global static IP** and a **Google-managed SSL certificate** attached to the Ingress — self-managed cert secrets in a Kubernetes Secret are not supported by the GCE Ingress controller.
- All infrastructure is defined in Terraform and applied via CI/CD; no click-ops.
- Secrets and infrastructure configuration live in Google Cloud (K8s Secrets, Terraform state in GCS) — no third-party cert management service.

## Decision

Use **Google Cloud DNS** as the authoritative DNS zone and **Google-managed SSL certificates** (via `google_compute_managed_ssl_certificate` + `networking.gke.io/ManagedCertificate`) for automatic TLS provisioning and renewal.

### Architecture

```
Namecheap registrar
  └── delegates NS records → Cloud DNS nameservers (terraform output dns_nameservers)

Cloud DNS managed zone: fenrirledger-com
  ├── A  fenrirledger.com             → fenrir-app-ip (global static IP)
  ├── A  www.fenrirledger.com         → fenrir-app-ip
  └── A  analytics.fenrirledger.com  → fenrir-app-ip

GKE Ingress (gce class)
  ├── annotation: kubernetes.io/ingress.global-static-ip-name = "fenrir-app-ip"
  ├── annotation: networking.gke.io/managed-certificates = "fenrir-app-cert"
  └── rules: fenrirledger.com, www.fenrirledger.com, analytics.fenrirledger.com → fenrir-app:80

ManagedCertificate: fenrir-app-cert
  └── domains: fenrirledger.com, www.fenrirledger.com, analytics.fenrirledger.com

Terraform resource: google_compute_managed_ssl_certificate.app_cert
  └── managed.domains: [var.domain, "www.${var.domain}", "analytics.${var.domain}"]

Terraform resource: google_compute_global_address.app_ip
  └── name: fenrir-app-ip
```

### Certificate Provisioning Flow

1. `terraform apply` provisions `google_compute_global_address.app_ip` and `google_compute_managed_ssl_certificate.app_cert`.
2. `kubectl apply` (via GitHub Actions) creates the `ManagedCertificate` object and the `Ingress` with the static IP and cert annotations.
3. The GCE Ingress controller programs the Google HTTP(S) Load Balancer with the static IP.
4. The operator updates Namecheap's nameservers to the four Cloud DNS nameservers from `terraform output dns_nameservers`.
5. Once DNS propagates and `fenrirledger.com` resolves to `fenrir-app-ip`, Google's certificate authority performs an HTTP-01 challenge against the domain.
6. On success, the certificate becomes `Active` and HTTPS traffic is terminated at the load balancer with the Google-managed cert. Google auto-renews the cert before expiry.

### Key Terraform and Kubernetes Resources

| Resource | File | Purpose |
|---|---|---|
| `google_compute_global_address.app_ip` | `infrastructure/dns.tf` | Stable global IP for Ingress |
| `google_dns_managed_zone.app` | `infrastructure/dns.tf` | Authoritative zone for `fenrirledger.com` |
| `google_dns_record_set.apex/www/analytics` | `infrastructure/dns.tf` | A records pointing all three hosts to the static IP |
| `google_compute_managed_ssl_certificate.app_cert` | `infrastructure/gke.tf` | Google-managed TLS cert covering all three domains |
| `ManagedCertificate` (fenrir-app-cert) | `infrastructure/k8s/app/ingress.yaml` | K8s object binding the cert to the Ingress |
| `Ingress` (fenrir-app) | `infrastructure/k8s/app/ingress.yaml` | GCE L7 LB routing all three virtual hosts to `fenrir-app:80` |

### APIs Enabled

`dns.googleapis.com` is enabled in `infrastructure/main.tf` alongside the GKE and Compute APIs.

### IAM

The deploy service account (`fenrir-deploy@fenrir-ledger-prod.iam.gserviceaccount.com`) holds `roles/dns.admin` and `roles/certificatemanager.editor` to allow Terraform to manage the zone and certificate lifecycle.

## Options Considered

### 1. Google Cloud DNS + Google-managed SSL certificate (chosen)

**Pros:** Native to Google Cloud; zero operator cert renewal; integrates directly with the GCE Ingress controller; Terraform-managed end-to-end; auto-renewal handled by Google.

**Cons:** Initial DNS cutover requires manual nameserver change at Namecheap; cert provisioning can take 15–60 minutes after DNS propagates; HTTP must remain allowed on the Ingress during provisioning for the HTTP-01 challenge.

### 2. cert-manager + Let's Encrypt (rejected)

Requires deploying cert-manager into the cluster, managing `ClusterIssuer` and `Certificate` CRDs, and storing cert material in K8s Secrets. The GCE Ingress controller does not read TLS Secrets — it requires Google-managed certs. This approach would necessitate switching to a different Ingress class (nginx) and adding significant operational surface area.

### 3. Cloudflare DNS + Cloudflare-managed TLS (rejected)

Adds a third-party dependency outside the Google Cloud perimeter. Cloudflare's free tier proxies traffic, which introduces an intermediary for a security-focused finance application. Certificate management would be split across two providers.

### 4. Vercel (status quo, rejected)

Vercel was the hosting platform before GKE. It handled DNS and TLS automatically. The migration to GKE Autopilot (see ADR-001, ADR-007-remote-builder-platforms in `architecture/adrs/`) made Vercel's DNS/TLS no longer applicable — GKE requires Google-native primitives.

## Consequences

**Positive:**

- TLS certificates are provisioned and renewed automatically by Google; no operator action required after initial DNS cutover.
- DNS, compute, and certificate resources are all Terraform-managed in the same `fenrir-ledger-prod` project — unified observability and IAM.
- A stable global static IP (`fenrir-app-ip`) means the DNS A records never need updating after initial setup, even through cluster upgrades.
- Cloud Monitoring uptime checks (`infrastructure/monitoring.tf`) will be extended to use the custom domain once DNS cutover is complete (tracked in issue #684).

**Negative:**

- **DNS cutover is a manual one-time step** — the operator must log in to Namecheap and set four custom nameservers from `terraform output dns_nameservers`. There is no automated delegation.
- **Cert provisioning latency** — after cutover, HTTPS may be unavailable for up to 60 minutes while Google provisions the certificate. HTTP remains functional during this window (`kubernetes.io/ingress.allow-http: "true"`).
- **HTTP-01 challenge requirement** — the Ingress must allow HTTP traffic during cert provisioning. This should be revisited post-cutover to enforce HTTPS-only (HSTS + HTTP→HTTPS redirect).
- **Domain scope** — adding new subdomains requires updating `google_compute_managed_ssl_certificate.app_cert` managed domains list, the `ManagedCertificate` spec, and adding DNS A records. Each addition triggers a cert re-provisioning cycle.

## References

- `infrastructure/dns.tf` — Cloud DNS zone and A records
- `infrastructure/gke.tf` — `google_compute_managed_ssl_certificate`
- `infrastructure/k8s/app/ingress.yaml` — Ingress, ManagedCertificate, BackendConfig
- `infrastructure/outputs.tf` — `dns_nameservers` output for Namecheap delegation
- [Google Cloud: Using Google-managed SSL certificates](https://cloud.google.com/kubernetes-engine/docs/how-to/managed-certs)
- [Google Cloud DNS documentation](https://cloud.google.com/dns/docs)
- Issue #684 — custom domain monitoring cutover (pending)
