# ADR-006 — Umami Self-Hosted Analytics on GKE Autopilot

**Status:** Accepted
**Date:** 2026-03-14
**Authors:** FiremanDecko (Principal Engineer)
**Ref:** GitHub Issue #859 (ADR), #781 (implementation), #745 (platform evaluation), #780 (DNS/TLS)

---

## Context

Fenrir Ledger needs web analytics to understand user behaviour, track feature adoption, and
measure growth — without compromising user privacy or sending raw user data to third-party
advertising networks.

Issue #745 evaluated available analytics platforms against the following requirements:

- **Privacy-first** — no cookies, no cross-site tracking, GDPR-friendly by default
- **Data ownership** — event data stays within Fenrir infrastructure
- **Operational simplicity** — must fit within the existing GKE Autopilot + Helm + Terraform
  stack without spinning up a separate managed service
- **Cost** — total added infrastructure cost must remain under ~$20/month
- **Open source** — auditable, no vendor lock-in on data schema

### Platforms Evaluated

| Platform | Notes | Verdict |
|----------|-------|---------|
| **Umami** | Privacy-first, open-source, PostgreSQL backend, simple UI | **Selected** |
| **Plausible** | Privacy-first, but requires ClickHouse — heavier operational footprint | Rejected |
| **PostHog** | Feature-rich (session replay, feature flags), but heavy, not cookie-free by default | Rejected |
| **Google Analytics 4** | Requires cookies, sends data to Google, GDPR friction | Rejected |
| **Mixpanel** | Paid SaaS, data leaves infrastructure | Rejected |

---

## Decision

Deploy **Umami** (`ghcr.io/umami-software/umami:postgresql-latest`) as a self-hosted analytics
platform on GKE Autopilot, in a dedicated `fenrir-analytics` namespace, backed by an in-cluster
PostgreSQL 16 StatefulSet.

### Deployment Architecture

```
analytics.fenrirledger.com
        │
  GCE Ingress (gce class)
  Managed TLS Certificate
        │
  umami Service (ClusterIP :80)
        │
  umami Deployment (2 replicas in prod)
  ghcr.io/umami-software/umami:postgresql-latest
  containerPort: 3000
        │
  postgresql-svc.fenrir-analytics.svc.cluster.local:5432
  PostgreSQL 16 StatefulSet (1 replica)
  1 Gi PVC — standard-rwo storage class
```

**Namespace:** `fenrir-analytics` (isolated from `fenrir-app` and `fenrir-agents`)

**Helm chart:** `infrastructure/helm/umami/` — custom chart with templates for Deployment,
StatefulSet, Services, Ingress, BackendConfig, ManagedCertificate, Secrets, ConfigMap.

**CI/CD:** The `.github/workflows/deploy.yml` pipeline creates the namespace, provisions the
`umami-secrets` Kubernetes Secret from GitHub Actions secrets, then runs
`helm upgrade --install umami ./infrastructure/helm/umami -f values-prod.yaml` after the main
app deployment.

### Resource Budget

| Component | CPU Request | Memory Request | Storage |
|-----------|-------------|----------------|---------|
| Umami app (×2 in prod) | 100m | 256 Mi | — |
| PostgreSQL 16 | 250 m | 256 Mi | 1 Gi |
| **Total** | **350 m** | **512 Mi** | **1 Gi** |

Estimated GKE Autopilot cost: **~$13/month** (well under the $20 target).

### Secret Management

Secrets (`DATABASE_URL`, `POSTGRES_PASSWORD`, `APP_SECRET`) are injected at deploy time from
GitHub Actions secrets into a `umami-secrets` Kubernetes Secret. No secrets are stored in the
Helm chart or repository. The `values-prod.yaml` production override contains only
non-sensitive configuration; all credential values reference the injected secret.

### Privacy Properties

- No cookies — Umami is cookieless by design
- No cross-site tracking — all data is first-party
- IP addresses are never stored — Umami hashes them before aggregation
- GDPR-compliant without a consent banner (no personal data collected)
- Data stored exclusively in the in-cluster PostgreSQL instance; never leaves GCP project
  `fenrir-ledger-prod`

---

## Consequences

### Positive

- **Full data ownership** — analytics data lives in Fenrir's PostgreSQL, not a third-party SaaS
- **GDPR-compliant by default** — no consent banner required, no PII stored
- **Fits existing stack** — same GKE Autopilot, Helm, GCE Ingress, and managed-certificate
  patterns used by the main app; no new infrastructure primitives
- **Low cost** — ~$13/month total, within budget
- **Isolated namespace** — `fenrir-analytics` is separate from app and agent workloads;
  Kubernetes NetworkPolicy prevents cross-namespace interference
- **Automated deployment** — Umami ships with every `main` merge via existing CI/CD pipeline

### Negative / Trade-offs

- **Operational overhead** — database upgrades, backups, and incident response fall to the
  Fenrir team rather than a managed service
- **Single PostgreSQL replica** — no database HA; a PostgreSQL pod failure will cause brief
  analytics downtime until the StatefulSet recovers (data is persisted on the PVC)
- **No session replay** — Umami does not record session replays (unlike PostHog). User flow
  analysis is limited to page views and custom events
- **PostgreSQL at scale** — PostgreSQL is appropriate for current traffic volumes; if events
  exceed ~100 M/month, ClickHouse-backed Plausible or a managed time-series store should be
  re-evaluated
- **Manual backup strategy** — PVC snapshots via GCP persistent disk snapshots must be
  configured separately; not provisioned in this ADR

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| PostgreSQL PVC data loss | GCP persistent disk is replicated within the zone; add Cloud SQL or PVC snapshot backup for production continuity |
| Umami image vulnerabilities | Pin to a specific semver tag in values-prod.yaml once the upstream project publishes versioned releases; enable Artifact Registry image scanning |
| Analytics-driven Ingress TLS latency | GCE managed certificate provisioning takes 15–60 min on first deploy; retry health checks before marking deployment successful |
| Schema migration on upgrade | Umami runs database migrations on startup; test upgrades in a staging namespace before production rollout |

---

## Implementation Notes

The full Helm chart, deploy workflow changes, and a 29-test Vitest suite validating chart
structure, resource limits, and Kubernetes manifest correctness were delivered in
[PR #809](https://github.com/declanshanaghy/fenrir-ledger/pull/809) (issue #781).

Frontend tracking-code integration (embedding the Umami script tag in the Next.js app) is
tracked separately from this infrastructure ADR.

---

## References

- [Umami](https://umami.is/) — official project site
- [Umami GitHub](https://github.com/umami-software/umami) — source, release notes, schema
- `infrastructure/helm/umami/` — Helm chart templates and values
- `.github/workflows/deploy.yml` — CI/CD deploy pipeline (Umami deploy step)
- `development/qa-handoff-umami-deployment.md` — QA handoff with deployment and test procedures
- Issue [#745](https://github.com/declanshanaghy/fenrir-ledger/issues/745) — analytics platform evaluation
- Issue [#780](https://github.com/declanshanaghy/fenrir-ledger/issues/780) — DNS/TLS for analytics.fenrirledger.com
- Issue [#781](https://github.com/declanshanaghy/fenrir-ledger/issues/781) — Umami deployment implementation
