# GitHub Actions Workflows

## Deploy Pipeline (`deploy.yml`)

Runs on every push to `main` and `workflow_dispatch`. Builds, tests, and deploys services to GKE Autopilot.

### Pipeline Overview

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '18px'}}}%%
graph LR
    classDef primary fill:#03A9F4,stroke:#0288D1,color:#FFF
    classDef healthy fill:#4CAF50,stroke:#388E3C,color:#FFF
    classDef warning fill:#FF9800,stroke:#F57C00,color:#FFF
    classDef background fill:#2C2C2C,stroke:#444,color:#FFF

    detect([Detect Changes]) ==> build-app[Build App Image]
    detect ==> build-odins-throne[Build Monitor Image]
    detect ==> build-odins-throne-ui[Build Monitor UI Image]
    detect ==> terraform[Terraform]
    detect ==> deploy-umami[Deploy Umami]

    build-app ==> test-app[Test App]
    test-app ==> deploy-app[Deploy App]

    build-odins-throne ==> deploy-odin[Deploy Odin's Throne]
    build-odins-throne-ui ==> deploy-odin

    class detect background
    class build-app,build-odins-throne,build-odins-throne-ui primary
    class test-app warning
    class deploy-app,deploy-odin,deploy-umami,terraform healthy
```

### Change Detection

The `detect-changes` job inspects `git diff HEAD~1 HEAD` and produces boolean outputs that gate all downstream jobs. On `workflow_dispatch`, all outputs are forced `true`.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '18px'}}}%%
graph TD
    classDef primary fill:#03A9F4,stroke:#0288D1,color:#FFF
    classDef healthy fill:#4CAF50,stroke:#388E3C,color:#FFF
    classDef background fill:#2C2C2C,stroke:#444,color:#FFF

    diff([git diff HEAD~1 HEAD]) --> app{app?}
    diff --> k8sapp{k8s-app?}
    diff --> monitor{monitor?}
    diff --> monui{odins-throne-ui?}
    diff --> helmodin{helm-odin?}
    diff --> infra{infra?}
    diff --> umami{umami?}

    app -->|"development/ledger/ - Dockerfile - package*.json"| build-app[build-app]
    k8sapp -->|"infrastructure/helm/fenrir-app/"| build-app
    monitor -->|"development/odins-throne/"| build-odins-throne[build-odins-throne]
    monui -->|"development/odins-throne-ui/"| build-odins-throne-ui[build-odins-throne-ui]
    helmodin -->|"infrastructure/helm/odin-throne/"| deploy-odin[deploy-odin-throne]
    infra -->|"infrastructure/terraform/ - infrastructure/firestore/"| terraform[terraform]
    umami -->|"infrastructure/helm/umami/"| deploy-umami[deploy-umami]

    class diff background
    class app,k8sapp,monitor,monui,helmodin,infra,umami primary
    class build-app,build-odins-throne,build-odins-throne-ui,deploy-odin,terraform,deploy-umami healthy
```

| Output | Paths | Consumer |
|--------|-------|----------|
| `app` | `development/ledger/`, `Dockerfile`, `package*.json` | build-app |
| `k8s-app` | `infrastructure/k8s/app/` | build-app, deploy-app |
| `monitor` | `development/odins-throne/` | build-odins-throne |
| `monitor-ui` | `development/odins-throne-ui/` | build-odins-throne-ui |
| `helm-odin` | `infrastructure/helm/odin-throne/` | deploy-odin-throne |
| `infra` | `infrastructure/terraform/`, `infrastructure/monitoring/` | terraform |
| `umami` | `infrastructure/helm/umami/` | deploy-umami |

### App Pipeline — Build, Test, Deploy

The main application follows a strict build-test-deploy chain. No deployment without passing tests.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '18px'}}}%%
graph LR
    classDef primary fill:#03A9F4,stroke:#0288D1,color:#FFF
    classDef healthy fill:#4CAF50,stroke:#388E3C,color:#FFF
    classDef warning fill:#FF9800,stroke:#F57C00,color:#FFF
    classDef critical fill:#F44336,stroke:#D32F2F,color:#FFF
    classDef background fill:#2C2C2C,stroke:#444,color:#FFF

    build[Build Docker Image] -->|"push to Artifact Registry"| test[Test - tsc + Vitest]
    test -->|"all green"| resolve[Resolve Image Tag]
    resolve -->|"new build: SHA tag"| deploy[Helm Deploy to GKE]
    resolve -->|"k8s-only: current cluster tag"| deploy

    test -->|"failure"| stop([Pipeline Stops])

    class build primary
    class test warning
    class deploy healthy
    class stop critical
    class resolve background
```

**Image tag resolution:** When a new image was built, the deploy uses `$IMAGE_TAG` (commit SHA). When only K8s manifests or Helm values changed (no new build), the deploy queries the cluster for the currently running image tag.

```bash
# Resolve tag from cluster when no new image was built
kubectl get deployment fenrir-app -n fenrir-app \
  -o jsonpath='{.spec.template.spec.containers[?(@.name=="fenrir-app")].image}' \
  | rev | cut -d: -f1 | rev
```

### Monitor Pipeline — Odin's Throne

Two images (API + UI) with independent builds but a single combined deploy.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '18px'}}}%%
graph TD
    classDef primary fill:#03A9F4,stroke:#0288D1,color:#FFF
    classDef healthy fill:#4CAF50,stroke:#388E3C,color:#FFF
    classDef background fill:#2C2C2C,stroke:#444,color:#FFF

    detect([Detect Changes]) --> build-api[Build Monitor API]
    detect --> build-ui[Build Monitor UI]
    detect -->|"helm-odin changed"| resolve

    build-api --> resolve[Resolve Image Tags]
    build-ui --> resolve
    resolve --> deploy[Helm Deploy Odin's Throne]

    class detect background
    class build-api,build-ui primary
    class resolve background
    class deploy healthy
```

**Deploy triggers when:**
- Either monitor image was built successfully, OR
- Only Helm chart files changed (no build needed — resolve tags from cluster)

**Deploy blocks when:**
- Either build job failed (not skipped — failed)

### Infrastructure Jobs

Terraform and Umami run independently — no cross-dependencies with app or monitor pipelines.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '18px'}}}%%
graph LR
    classDef healthy fill:#4CAF50,stroke:#388E3C,color:#FFF
    classDef background fill:#2C2C2C,stroke:#444,color:#FFF

    detect([Detect Changes]) -->|"infra changed"| terraform[Terraform Plan + Apply]
    detect -->|"umami chart changed"| umami[Deploy Umami - Helm]

    class detect background
    class terraform,umami healthy
```

### Job Dependency Summary

| Job | Depends On | Runs When |
|-----|-----------|-----------|
| `detect-changes` | -- | Always |
| `terraform` | detect-changes | `infra == true` |
| `build-app` | detect-changes | `app == true` OR `k8s-app == true` |
| `test-app` | build-app | build-app succeeded |
| `deploy-app` | test-app, build-app, detect-changes | test-app succeeded |
| `build-odins-throne` | detect-changes | `monitor == true` |
| `build-odins-throne-ui` | detect-changes | `monitor-ui == true` |
| `deploy-odin-throne` | build-odins-throne, build-odins-throne-ui, detect-changes | Any build succeeded OR `helm-odin == true` (no failures) |
| `deploy-umami` | detect-changes | `umami == true` |

### Concurrency

```yaml
concurrency:
  group: deploy-main
  cancel-in-progress: false
```

Deploy runs are serialized — queued, never cancelled. This prevents mid-deploy interruptions.

---

## CI Tests Pipeline (`ci-tests.yml`)

Runs on every push to non-main branches when frontend or test files change.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontSize': '18px'}}}%%
graph LR
    classDef primary fill:#03A9F4,stroke:#0288D1,color:#FFF
    classDef warning fill:#FF9800,stroke:#F57C00,color:#FFF
    classDef healthy fill:#4CAF50,stroke:#388E3C,color:#FFF

    push([Push to PR branch]) --> tsc[TypeScript Check]
    tsc --> unit[Vitest Unit Tests]
    unit --> e2e[Playwright E2E - vs prod]
    e2e --> report[Upload Report + PR Comment]

    class push primary
    class tsc,unit warning
    class e2e warning
    class report healthy
```

**Path filters:** Only triggers on changes to `development/ledger/**`, `quality/test-suites/**`, or `.github/workflows/ci-tests.yml`.

**Target:** Tests run against live production (`https://fenrirledger.com`), not a staging environment.

**PR comment:** Upserts a single results table per PR (updates on each push, doesn't spam).
