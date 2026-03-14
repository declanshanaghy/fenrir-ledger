# Analytics Platform Evaluation for Fenrir Ledger

**Issue:** #745
**Date:** 2026-03-14
**Author:** FiremanDecko (Principal Engineer)

## Context

Fenrir Ledger needs a free/OSS analytics platform to replace the defunct Vercel Analytics
integration (#332). The platform must be self-hostable on our existing GKE Autopilot
infrastructure.

---

## Comparison Table

| Criteria | Plausible | Umami | Matomo | PostHog | OpenReplay |
|---|---|---|---|---|---|
| **License** | AGPL-3.0 | MIT | GPL-3.0 | MIT (hobby) | ELv2 |
| **Language** | Elixir | Next.js (Node) | PHP | Python/Django | Python/Node |
| **Tracker size** | < 1 KB | ~2 KB | ~22 KB | ~5 KB | ~26 KB |
| **Page views / sessions** | Yes | Yes | Yes | Yes | Yes |
| **Custom events** | Yes | Yes | Yes | Yes | Yes |
| **Real-time dashboard** | Yes | Yes | Yes | Yes | Yes |
| **Web Vitals** | Via custom events | Via custom events | Plugin | Built-in | Built-in |
| **Session replay** | No | No | Premium only | Yes (OSS) | Yes (core feature) |
| **Funnel analysis** | No | No | Yes | Yes | Limited |
| **Privacy / cookieless** | Yes (no cookies) | Yes (no cookies) | Configurable | Configurable | Configurable |
| **GDPR compliant** | Yes (no banner) | Yes (no banner) | Yes (with config) | Yes (with config) | Yes (with config) |
| **K8s Helm chart** | Community (3+) | No official; DIY | Bitnami + community | Sunsetted (2023) | Official Helm |
| **Data store** | PostgreSQL + ClickHouse | PostgreSQL only | MySQL/MariaDB | PostgreSQL + ClickHouse + Kafka + Redis | PostgreSQL + ClickHouse + Redis + Kafka |
| **Min resources** | ~256 MB RAM, 0.1 CPU | ~500 MB RAM, 0.25 CPU | ~512 MB RAM, 0.5 CPU | 8 GB RAM, 4 CPU | 8 GB RAM, 2 CPU |
| **Next.js integration** | `next-plausible` (mature) | `next-umami` / Script tag | Manual script tag | `posthog-js` + React | `@openreplay/tracker` |
| **Community (GH stars)** | ~21k | ~24k | ~20k | ~23k | ~10k |
| **Maintenance burden** | Low | Low | Medium (PHP stack) | High (16+ services) | Medium-High |
| **Self-host viability** | Active | Active | Active | Sunsetted K8s | Active |

---

## Detailed Assessments

### 1. Plausible Analytics — RECOMMENDED

**Strengths:**
- Smallest tracker (< 1 KB) — negligible bundle impact
- Privacy-first: no cookies, no personal data, no consent banner needed
- Clean, focused dashboard — real-time by default
- Mature Next.js integration via `next-plausible` (v3.12.x, App Router support)
- Custom events via `usePlausible()` hook
- Proxy support to bypass ad blockers (built into next-plausible)
- Multiple community Helm charts (8gears, IMIO, zekker6) actively maintained
- Modest resource footprint for GKE Autopilot

**Weaknesses:**
- No native session replay
- No built-in funnel analysis
- Web Vitals require custom event mapping (minor — Next.js `reportWebVitals` bridges this)
- Requires ClickHouse (additional stateful component)
- AGPL license (fine for self-hosted, not for SaaS redistribution — not a concern for us)

**GKE Resource Estimate:**
| Component | CPU Request | Memory Request | Storage |
|---|---|---|---|
| Plausible app | 100m | 128Mi | — |
| PostgreSQL | 250m | 256Mi | 5Gi |
| ClickHouse | 500m | 512Mi | 10Gi |
| **Total** | **850m** | **~896Mi** | **15Gi** |

### 2. Umami — RUNNER-UP

**Strengths:**
- MIT license (most permissive)
- Built on Next.js — same stack as Fenrir Ledger
- PostgreSQL only — no ClickHouse dependency, simplest infra
- Lightest resource footprint (~500 MB total)
- Rename tracker script/endpoint to avoid ad blockers
- Privacy-first, cookieless, GDPR compliant without banner

**Weaknesses:**
- No official Helm chart — requires custom K8s manifests
- No session replay
- No native Web Vitals (requires custom event bridge)
- PostgreSQL-based analytics queries slower than ClickHouse at scale
- Fewer advanced analytics features (no funnels, limited segmentation)

**GKE Resource Estimate:**
| Component | CPU Request | Memory Request | Storage |
|---|---|---|---|
| Umami app | 100m | 256Mi | — |
| PostgreSQL | 250m | 256Mi | 5Gi |
| **Total** | **350m** | **~512Mi** | **5Gi** |

### 3. Matomo

**Assessment:** Full-featured but PHP-based stack is a mismatch with our Node/Next.js
ecosystem. Bitnami Helm chart is well-maintained but brings MariaDB dependency. Tracker
script is 22 KB — largest among privacy-focused options. Advanced features (session replay,
heatmaps) are premium-only. Good option for PHP shops, not ideal for our stack.

### 4. PostHog

**Assessment:** Most feature-rich (session replay, funnels, feature flags) but
**Kubernetes self-hosting was sunsetted in 2023**. Security updates ended May 2024. The
hobby Docker Compose deployment requires 16 GB RAM, 4 CPUs minimum — too heavy for our
GKE budget. Maintenance burden is 6-8 hours/month by practitioner reports. Not viable for
self-hosting on GKE Autopilot.

### 5. OpenReplay

**Assessment:** Best-in-class session replay with co-browsing, but minimum 8 GB RAM / 2
vCPUs baseline is heavy. Requires PostgreSQL + ClickHouse + Redis + Kafka — similar
complexity to PostHog. The 26 KB tracker is the largest. Good if session replay is the
primary need, but overkill for basic analytics. Has official Helm chart, which is a plus.

---

## Recommendation: Plausible Analytics

**Primary:** Plausible Analytics
**Fallback:** Umami (if ClickHouse is deemed too heavy)

### Rationale

1. **Minimal bundle impact** — < 1 KB tracker vs. our current zero-analytics baseline
2. **Privacy by default** — No cookie banner, no PII, GDPR compliant out of the box
3. **Right-sized for our needs** — Page views, sessions, referrers, custom events cover
   our tracking requirements (card saves, import completions, easter egg discoveries)
4. **Proven K8s deployment** — Multiple active Helm charts with GKE compatibility
5. **GKE Autopilot fit** — ~850m CPU / ~896Mi memory total is within Autopilot's
   per-pod resource allocation model
6. **Mature Next.js integration** — `next-plausible` with App Router support, hook-based
   custom events, and built-in proxy for ad-blocker bypass
7. **Web Vitals bridgeable** — Next.js `reportWebVitals` can pipe LCP/FID/CLS/TTFB to
   Plausible as custom events with ~10 lines of code

### Why not Umami?

Umami is the simpler option (PostgreSQL-only, same Node stack) and would be the pick if we
want absolute minimal infrastructure. However, Plausible's ClickHouse backend will handle
analytical queries faster as traffic grows, and its tracker is half the size. The
infrastructure delta (adding ClickHouse) is manageable given we already run stateful
workloads (Redis) on GKE.

---

## Deployment Approach

### Helm Chart

Use the **8gears/plausible-analytics-helm-chart** — most actively maintained community chart.

```bash
helm repo add plausible https://8gears.container-registry.com/chartrepo/library
helm install plausible plausible/plausible-analytics \
  --namespace fenrir-analytics \
  --create-namespace \
  -f values-plausible.yaml
```

### GKE Autopilot Considerations

- Autopilot auto-provisions node resources — no node pool management needed
- ClickHouse and PostgreSQL need `PersistentVolumeClaim` with `storageClassName: standard-rwo`
- Use `topologySpreadConstraints` to avoid co-locating DB pods
- Configure `resources.requests` explicitly — Autopilot bills on requests, not limits

### Recommended `values-plausible.yaml` Skeleton

```yaml
plausible:
  baseUrl: https://analytics.fenrir-ledger.dev
  secretKeyBase: <from-k8s-secret>
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 500m
      memory: 256Mi

postgresql:
  enabled: true
  persistence:
    size: 5Gi
    storageClass: standard-rwo
  resources:
    requests:
      cpu: 250m
      memory: 256Mi

clickhouse:
  enabled: true
  persistence:
    size: 10Gi
    storageClass: standard-rwo
  resources:
    requests:
      cpu: 500m
      memory: 512Mi
```

---

## Next.js Integration Steps

### 1. Install

```bash
npm install next-plausible
```

### 2. Add Provider (App Router)

```tsx
// app/layout.tsx
import PlausibleProvider from 'next-plausible';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PlausibleProvider
          domain="fenrir-ledger.dev"
          selfHosted
          customDomain="https://analytics.fenrir-ledger.dev"
          trackOutboundLinks
          taggedEvents
        >
          {children}
        </PlausibleProvider>
      </body>
    </html>
  );
}
```

### 3. Custom Events

```tsx
import { usePlausible } from 'next-plausible';

function CardSaveButton() {
  const plausible = usePlausible();

  const handleSave = () => {
    plausible('Card Saved', { props: { cardType: 'creature' } });
    // ... save logic
  };

  return <button onClick={handleSave}>Save Card</button>;
}
```

### 4. Web Vitals Bridge

```tsx
// app/web-vitals.tsx
'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { usePlausible } from 'next-plausible';

export function WebVitalsReporter() {
  const plausible = usePlausible();

  useReportWebVitals((metric) => {
    plausible('Web Vitals', {
      props: {
        name: metric.name,       // LCP, FID, CLS, TTFB, INP
        value: Math.round(metric.value),
        rating: metric.rating,   // good, needs-improvement, poor
      },
    });
  });

  return null;
}
```

### 5. Ad-Blocker Bypass (Proxy)

```tsx
// next.config.ts
import { withPlausibleProxy } from 'next-plausible';

export default withPlausibleProxy({
  customDomain: 'https://analytics.fenrir-ledger.dev',
})({
  // ... existing Next.js config
});
```

---

## Estimated Monthly GKE Cost

Based on GKE Autopilot pricing (us-central1):

| Resource | Amount | Unit Price | Monthly |
|---|---|---|---|
| CPU (850m) | 0.85 vCPU | ~$31.68/vCPU | ~$27 |
| Memory (896Mi) | 0.875 GB | ~$3.55/GB | ~$3 |
| Storage (15Gi) | 15 GB | ~$0.04/GB | ~$1 |
| **Total** | | | **~$31/mo** |

This is well within budget for a self-hosted analytics solution and compares favorably to
Plausible Cloud ($9/mo for 10k pageviews, scaling up with traffic).

---

## Next Steps

1. **Odin review** — Approve platform selection
2. **Implementation issue** — Create issue for Plausible deployment on GKE
3. **K8s manifests** — Add to `infrastructure/k8s/analytics/`
4. **Next.js integration** — Add `next-plausible` to frontend
5. **Custom events spec** — Define event taxonomy (card saves, imports, easter eggs)
