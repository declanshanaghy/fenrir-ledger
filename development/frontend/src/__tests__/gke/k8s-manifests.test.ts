/**
 * Vitest integration tests for Kubernetes manifests — Issue #680
 *
 * These tests verify that K8s manifests are properly configured for:
 * 1. Deployment with correct resource requests/limits for Autopilot
 * 2. Service with proper port mapping
 * 3. Ingress with Google-managed SSL and routing rules
 * 4. Health checks (readiness, liveness, startup probes)
 * 5. Environment variable injection via Secrets
 *
 * @ref #680
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { load } from "js-yaml";

interface K8sResource {
  apiVersion?: string;
  kind?: string;
  metadata?: Record<string, unknown>;
  spec?: Record<string, unknown>;
}

describe("Kubernetes Manifests — GKE Deployment", () => {
  let deployment: K8sResource;
  let service: K8sResource;
  let ingress: K8sResource;

  beforeAll(() => {
    const deploymentPath = resolve(
      process.cwd(),
      "infrastructure/k8s/app/deployment.yaml"
    );
    const servicePath = resolve(
      process.cwd(),
      "infrastructure/k8s/app/service.yaml"
    );
    const ingressPath = resolve(
      process.cwd(),
      "infrastructure/k8s/app/ingress.yaml"
    );

    deployment = load(readFileSync(deploymentPath, "utf-8")) as K8sResource;
    service = load(readFileSync(servicePath, "utf-8")) as K8sResource;
    ingress = load(readFileSync(ingressPath, "utf-8")) as K8sResource;
  });

  describe("Deployment manifest", () => {
    it("has correct kind: Deployment", () => {
      expect(deployment.kind).toBe("Deployment");
    });

    it("has name: fenrir-app", () => {
      expect(deployment.metadata?.name).toBe("fenrir-app");
    });

    it("deploys to fenrir-app namespace", () => {
      expect(deployment.metadata?.namespace).toBe("fenrir-app");
    });

    it("has standard Kubernetes labels", () => {
      const labels = deployment.metadata?.labels as Record<string, string>;
      expect(labels["app.kubernetes.io/name"]).toBe("fenrir-app");
      expect(labels["app.kubernetes.io/part-of"]).toBe("fenrir-ledger");
      expect(labels["app.kubernetes.io/component"]).toBe("frontend");
    });
  });

  describe("Deployment replica strategy", () => {
    const spec = deployment.spec as Record<string, unknown>;

    it("has 2 replicas for HA", () => {
      expect(spec.replicas).toBe(2);
    });

    it("maintains history of last 5 revisions for rollback", () => {
      expect(spec.revisionHistoryLimit).toBe(5);
    });

    it("uses RollingUpdate strategy", () => {
      const strategy = spec.strategy as Record<string, unknown>;
      expect(strategy.type).toBe("RollingUpdate");
    });

    it("allows zero maxUnavailable (zero-downtime deploys)", () => {
      const rollingUpdate = (
        spec.strategy as Record<string, Record<string, unknown>>
      ).rollingUpdate;
      expect(rollingUpdate.maxUnavailable).toBe(0);
    });

    it("has maxSurge of 1 for controlled rollout", () => {
      const rollingUpdate = (
        spec.strategy as Record<string, Record<string, unknown>>
      ).rollingUpdate;
      expect(rollingUpdate.maxSurge).toBe(1);
    });
  });

  describe("Pod template and container spec", () => {
    const spec = deployment.spec as Record<string, unknown>;
    const template = spec.template as Record<string, unknown>;
    const containers = (template.spec as Record<string, unknown>)
      .containers as Array<Record<string, unknown>>;
    const container = containers[0];

    it("sets terminationGracePeriodSeconds to 30 for graceful shutdown", () => {
      expect((template.spec as Record<string, unknown>).terminationGracePeriodSeconds).toBe(30);
    });

    it("uses service account fenrir-app-sa", () => {
      expect((template.spec as Record<string, unknown>).serviceAccountName).toBe(
        "fenrir-app-sa"
      );
    });

    it("container is named fenrir-app", () => {
      expect(container.name).toBe("fenrir-app");
    });

    it("exposes port 3000 with name 'http'", () => {
      const ports = container.ports as Array<Record<string, unknown>>;
      const httpPort = ports.find((p) => p.name === "http");
      expect(httpPort?.containerPort).toBe(3000);
      expect(httpPort?.protocol).toBe("TCP");
    });

    it("loads env vars from fenrir-app-secrets Secret", () => {
      const envFrom = container.envFrom as Array<Record<string, unknown>>;
      const secretRef = envFrom.find((e) => e.secretRef);
      expect(secretRef?.secretRef).toEqual({ name: "fenrir-app-secrets" });
    });

    it("sets NODE_ENV=production and PORT=3000 as env vars", () => {
      const env = container.env as Array<Record<string, unknown>>;
      const nodeEnv = env.find((e) => e.name === "NODE_ENV");
      const port = env.find((e) => e.name === "PORT");
      expect(nodeEnv?.value).toBe("production");
      expect(port?.value).toBe("3000");
    });
  });

  describe("Resource requests and limits (Autopilot billing)", () => {
    const spec = deployment.spec as Record<string, unknown>;
    const template = spec.template as Record<string, unknown>;
    const containers = (template.spec as Record<string, unknown>)
      .containers as Array<Record<string, unknown>>;
    const container = containers[0];
    const resources = container.resources as Record<string, Record<string, string>>;

    it("requests 500m CPU (0.5 vCPU — Autopilot minimum)", () => {
      expect(resources.requests.cpu).toBe("500m");
    });

    it("requests 512Mi memory", () => {
      expect(resources.requests.memory).toBe("512Mi");
    });

    it("limits CPU to 500m", () => {
      expect(resources.limits.cpu).toBe("500m");
    });

    it("limits memory to 512Mi", () => {
      expect(resources.limits.memory).toBe("512Mi");
    });

    it("requests and limits ephemeral storage for /tmp and logs", () => {
      expect(resources.requests["ephemeral-storage"]).toBe("256Mi");
      expect(resources.limits["ephemeral-storage"]).toBe("512Mi");
    });
  });

  describe("Health checks (probes)", () => {
    const spec = deployment.spec as Record<string, unknown>;
    const template = spec.template as Record<string, unknown>;
    const containers = (template.spec as Record<string, unknown>)
      .containers as Array<Record<string, unknown>>;
    const container = containers[0];

    it("has readinessProbe checking /api/health", () => {
      const readiness = container.readinessProbe as Record<string, unknown>;
      const httpGet = readiness.httpGet as Record<string, unknown>;
      expect(httpGet.path).toBe("/api/health");
      expect(httpGet.port).toBe("http");
    });

    it("readiness probe has appropriate timeouts", () => {
      const readiness = container.readinessProbe as Record<string, unknown>;
      expect(readiness.initialDelaySeconds).toBe(5);
      expect(readiness.periodSeconds).toBe(10);
      expect(readiness.timeoutSeconds).toBe(3);
      expect(readiness.failureThreshold).toBe(3);
    });

    it("has livenessProbe with longer timeout for deep health checks", () => {
      const liveness = container.livenessProbe as Record<string, unknown>;
      const httpGet = liveness.httpGet as Record<string, unknown>;
      expect(httpGet.path).toBe("/api/health");
      expect(liveness.timeoutSeconds).toBe(5);
      expect(liveness.periodSeconds).toBe(30);
    });

    it("has startupProbe allowing extra time for cold starts", () => {
      const startup = container.startupProbe as Record<string, unknown>;
      const httpGet = startup.httpGet as Record<string, unknown>;
      expect(httpGet.path).toBe("/api/health");
      expect(startup.failureThreshold).toBe(12); // 12 * 5s = 60s startup window
    });
  });

  describe("Service manifest", () => {
    it("has kind: Service", () => {
      expect(service.kind).toBe("Service");
    });

    it("has name: fenrir-app", () => {
      expect(service.metadata?.name).toBe("fenrir-app");
    });

    it("uses ClusterIP type (internal service)", () => {
      expect((service.spec as Record<string, unknown>).type).toBe("ClusterIP");
    });

    it("selects pods with app.kubernetes.io/name=fenrir-app", () => {
      const selector = (service.spec as Record<string, unknown>)
        .selector as Record<string, string>;
      expect(selector["app.kubernetes.io/name"]).toBe("fenrir-app");
    });

    it("exposes port 80, targets container port 'http' (3000)", () => {
      const ports = (service.spec as Record<string, unknown>).ports as Array<
        Record<string, unknown>
      >;
      const httpPort = ports[0];
      expect(httpPort.port).toBe(80);
      expect(httpPort.targetPort).toBe("http");
      expect(httpPort.protocol).toBe("TCP");
    });
  });

  describe("Ingress manifest", () => {
    it("has kind: Ingress", () => {
      expect(ingress.kind).toBe("Ingress");
    });

    it("has name: fenrir-app", () => {
      expect(ingress.metadata?.name).toBe("fenrir-app");
    });

    it("uses GKE Ingress controller (gce)", () => {
      const annotations = ingress.metadata?.annotations as Record<
        string,
        string
      >;
      expect(annotations["kubernetes.io/ingress.class"]).toBe("gce");
    });

    it("references Google-managed SSL certificate", () => {
      const annotations = ingress.metadata?.annotations as Record<
        string,
        string
      >;
      expect(annotations["networking.gke.io/managed-certificates"]).toContain(
        "fenrir-app-cert"
      );
    });

    it("routes to fenrir-app Service on port 80", () => {
      const spec = ingress.spec as Record<string, unknown>;
      const backend = spec.defaultBackend as Record<string, unknown>;
      const service = (backend.service as Record<string, unknown>).name as string;
      expect(service).toBe("fenrir-app");
    });

    it("has hostname rule for app.fenrirledger.com", () => {
      const spec = ingress.spec as Record<string, unknown>;
      const rules = spec.rules as Array<Record<string, unknown>>;
      const rule = rules.find((r) => r.host === "app.fenrirledger.com");
      expect(rule).toBeDefined();
    });

    it("disallows HTTP (redirects to HTTPS)", () => {
      const annotations = ingress.metadata?.annotations as Record<
        string,
        string
      >;
      expect(annotations["kubernetes.io/ingress.allow-http"]).toBe("false");
    });

    it("uses BackendConfig for health checks", () => {
      const annotations = ingress.metadata?.annotations as Record<
        string,
        string
      >;
      expect(annotations["cloud.google.com/backend-config"]).toContain(
        "fenrir-app-backend-config"
      );
    });
  });
});
