/**
 * Vitest unit tests for Umami oauth2-proxy sidecar — Issue #930
 *
 * Validates the Helm chart configuration for the oauth2-proxy sidecar:
 * - Default values define the sidecar config (port, image, resources)
 * - Service routes traffic through the proxy (not directly to Umami)
 * - Health check targets the proxy's /ping endpoint
 * - Deployment template configures skip-auth routes for Umami tracking endpoints
 * - Production values enable the proxy with the correct redirect URL
 * - Placeholder credentials are not real values
 *
 * These tests validate structural/logical correctness of Helm YAML.
 * Go template expressions cannot be fully parsed, so assertions use
 * string matching against known template strings.
 *
 * @ref #930
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { load as yamlLoad } from "js-yaml";

const REPO_ROOT = join(__dirname, "../../../../..");
const HELM_DIR = join(REPO_ROOT, "infrastructure/helm/umami");

function readValues(): Record<string, unknown> {
  const raw = readFileSync(join(HELM_DIR, "values.yaml"), "utf8");
  return yamlLoad(raw) as Record<string, unknown>;
}

function readValuesProd(): Record<string, unknown> {
  const raw = readFileSync(join(HELM_DIR, "values-prod.yaml"), "utf8");
  return yamlLoad(raw) as Record<string, unknown>;
}

function readTemplate(name: string): string {
  return readFileSync(join(HELM_DIR, "templates", name), "utf8");
}

describe("Umami oauth2-proxy sidecar — Issue #930", () => {
  // ---------------------------------------------------------------------------
  describe("values.yaml — oauth2Proxy stanza", () => {
    it("oauth2Proxy key exists in default values", () => {
      const v = readValues();
      expect(v).toHaveProperty("oauth2Proxy");
    });

    it("oauth2Proxy.enabled defaults to true", () => {
      const v = readValues();
      const proxy = v.oauth2Proxy as Record<string, unknown>;
      expect(proxy.enabled).toBe(true);
    });

    it("oauth2Proxy.port is 4180 (standard oauth2-proxy port)", () => {
      const v = readValues();
      const proxy = v.oauth2Proxy as Record<string, unknown>;
      expect(proxy.port).toBe(4180);
    });

    it("oauth2Proxy.image.repository is the official quay.io image", () => {
      const v = readValues();
      const proxy = v.oauth2Proxy as Record<string, unknown>;
      const image = proxy.image as Record<string, unknown>;
      expect(image.repository).toBe("quay.io/oauth2-proxy/oauth2-proxy");
    });

    it("oauth2Proxy.image.tag is pinned to a specific version (not 'latest')", () => {
      const v = readValues();
      const proxy = v.oauth2Proxy as Record<string, unknown>;
      const image = proxy.image as Record<string, unknown>;
      expect(image.tag).toBeTruthy();
      expect(image.tag).not.toBe("latest");
    });

    it("oauth2Proxy has resource requests and limits defined", () => {
      const v = readValues();
      const proxy = v.oauth2Proxy as Record<string, unknown>;
      const resources = proxy.resources as Record<string, unknown>;
      expect(resources).toHaveProperty("requests");
      expect(resources).toHaveProperty("limits");
    });

    it("oauth2Proxy resource requests include cpu, memory, and ephemeral-storage", () => {
      const v = readValues();
      const proxy = v.oauth2Proxy as Record<string, unknown>;
      const requests = (proxy.resources as Record<string, unknown>)
        .requests as Record<string, unknown>;
      expect(requests).toHaveProperty("cpu");
      expect(requests).toHaveProperty("memory");
      expect(requests).toHaveProperty("ephemeral-storage");
    });

    it("oauth2Proxy.secrets.googleClientId is a placeholder (not a real credential)", () => {
      const v = readValues();
      const proxy = v.oauth2Proxy as Record<string, unknown>;
      const secrets = proxy.secrets as Record<string, unknown>;
      expect(String(secrets.googleClientId)).toContain("REPLACE_WITH");
    });

    it("oauth2Proxy.secrets.googleClientSecret is a placeholder (not a real credential)", () => {
      const v = readValues();
      const proxy = v.oauth2Proxy as Record<string, unknown>;
      const secrets = proxy.secrets as Record<string, unknown>;
      expect(String(secrets.googleClientSecret)).toContain("REPLACE_WITH");
    });

    it("oauth2Proxy.secrets.cookieSecret is a placeholder (not a real credential)", () => {
      const v = readValues();
      const proxy = v.oauth2Proxy as Record<string, unknown>;
      const secrets = proxy.secrets as Record<string, unknown>;
      expect(String(secrets.cookieSecret)).toContain("REPLACE_WITH");
    });

    it("oauth2Proxy.secrets.allowedEmails is defined (email allowlist)", () => {
      const v = readValues();
      const proxy = v.oauth2Proxy as Record<string, unknown>;
      const secrets = proxy.secrets as Record<string, unknown>;
      expect(secrets.allowedEmails).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  describe("values.yaml — service routes traffic through proxy", () => {
    it("service.targetPort is 'oauth2-proxy' (not 'http' or 3000)", () => {
      const v = readValues();
      const service = v.service as Record<string, unknown>;
      expect(service.targetPort).toBe("oauth2-proxy");
    });

    it("service.containerPort (Umami) is 3000", () => {
      // Umami app still listens on 3000; proxy forwards to localhost:3000
      const v = readValues();
      const service = v.service as Record<string, unknown>;
      expect(service.containerPort).toBe(3000);
    });

    it("service.port (external) is 80", () => {
      const v = readValues();
      const service = v.service as Record<string, unknown>;
      expect(service.port).toBe(80);
    });
  });

  // ---------------------------------------------------------------------------
  describe("values.yaml — health check targets proxy endpoint", () => {
    it("ingress backendConfig healthCheck port is 4180 (proxy port)", () => {
      const v = readValues();
      const ingress = v.ingress as Record<string, unknown>;
      const bc = ingress.backendConfig as Record<string, unknown>;
      const hc = bc.healthCheck as Record<string, unknown>;
      expect(hc.port).toBe(4180);
    });

    it("ingress backendConfig healthCheck requestPath is /ping (proxy health endpoint)", () => {
      const v = readValues();
      const ingress = v.ingress as Record<string, unknown>;
      const bc = ingress.backendConfig as Record<string, unknown>;
      const hc = bc.healthCheck as Record<string, unknown>;
      expect(hc.requestPath).toBe("/ping");
    });
  });

  // ---------------------------------------------------------------------------
  describe("values-prod.yaml — production oauth2-proxy config", () => {
    it("oauth2Proxy.enabled is true in production", () => {
      const v = readValuesProd();
      const proxy = v.oauth2Proxy as Record<string, unknown>;
      expect(proxy.enabled).toBe(true);
    });

    it("oauth2Proxy.redirectUrl is set to the production analytics domain", () => {
      const v = readValuesProd();
      const proxy = v.oauth2Proxy as Record<string, unknown>;
      expect(String(proxy.redirectUrl)).toContain("analytics.fenrirledger.com");
      expect(String(proxy.redirectUrl)).toContain("/oauth2/callback");
    });

    it("production health check port is 4180 (proxy port)", () => {
      const v = readValuesProd();
      const ingress = v.ingress as Record<string, unknown>;
      const bc = ingress.backendConfig as Record<string, unknown>;
      const hc = bc.healthCheck as Record<string, unknown>;
      expect(hc.port).toBe(4180);
    });

    it("production health check requestPath is /ping", () => {
      const v = readValuesProd();
      const ingress = v.ingress as Record<string, unknown>;
      const bc = ingress.backendConfig as Record<string, unknown>;
      const hc = bc.healthCheck as Record<string, unknown>;
      expect(hc.requestPath).toBe("/ping");
    });
  });

  // ---------------------------------------------------------------------------
  describe("deployment.yaml template — proxy sidecar structure", () => {
    it("deployment template conditionally includes oauth2-proxy container", () => {
      const content = readTemplate("deployment.yaml");
      expect(content).toContain("oauth2Proxy.enabled");
      expect(content).toContain("name: oauth2-proxy");
    });

    it("oauth2-proxy container upstreams to localhost (Umami container)", () => {
      const content = readTemplate("deployment.yaml");
      expect(content).toContain("--upstream=http://localhost:");
    });

    it("oauth2-proxy uses Google provider", () => {
      const content = readTemplate("deployment.yaml");
      expect(content).toContain("--provider=google");
    });

    it("oauth2-proxy skip-auth-route is configured for Umami script.js (tracking pixel)", () => {
      // AC: Analytics tracking must work without requiring Google login
      const content = readTemplate("deployment.yaml");
      expect(content).toContain("--skip-auth-route=GET=^/script\\.js$");
    });

    it("oauth2-proxy skip-auth-route is configured for Umami /api/send (event ingestion)", () => {
      // AC: Analytics event ingestion must work without requiring Google login
      const content = readTemplate("deployment.yaml");
      expect(content).toContain("--skip-auth-route=POST=^/api/send$");
    });

    it("email allowlist is volume-mounted from secret (not hardcoded in args)", () => {
      const content = readTemplate("deployment.yaml");
      expect(content).toContain("--authenticated-emails-file=");
      expect(content).toContain("oauth2-proxy-emails");
      expect(content).toContain("mountPath: /etc/oauth2-proxy");
    });

    it("oauth2-proxy container exposes its port via containerPort", () => {
      const content = readTemplate("deployment.yaml");
      expect(content).toContain("name: oauth2-proxy");
      expect(content).toContain("containerPort:");
    });

    it("oauth2-proxy container has readinessProbe on /ping", () => {
      const content = readTemplate("deployment.yaml");
      // proxy health probes must hit /ping (not Umami's /)
      expect(content).toContain("path: /ping");
    });

    it("credentials are sourced from K8s secret (not hardcoded in template)", () => {
      const content = readTemplate("deployment.yaml");
      expect(content).toContain("secretKeyRef");
      expect(content).toContain("GOOGLE_CLIENT_ID");
      expect(content).toContain("GOOGLE_CLIENT_SECRET");
      expect(content).toContain("OAUTH2_PROXY_COOKIE_SECRET");
    });
  });

  // ---------------------------------------------------------------------------
  describe("secrets.yaml template — oauth2-proxy K8s Secret", () => {
    it("secrets template conditionally creates oauth2-proxy Secret", () => {
      const content = readTemplate("secrets.yaml");
      expect(content).toContain("oauth2Proxy.enabled");
      expect(content).toContain("umami-oauth2-proxy-secrets");
    });

    it("Secret contains GOOGLE_CLIENT_ID key", () => {
      const content = readTemplate("secrets.yaml");
      expect(content).toContain("GOOGLE_CLIENT_ID:");
    });

    it("Secret contains GOOGLE_CLIENT_SECRET key", () => {
      const content = readTemplate("secrets.yaml");
      expect(content).toContain("GOOGLE_CLIENT_SECRET:");
    });

    it("Secret contains OAUTH2_PROXY_COOKIE_SECRET key", () => {
      const content = readTemplate("secrets.yaml");
      expect(content).toContain("OAUTH2_PROXY_COOKIE_SECRET:");
    });

    it("Secret contains emails.txt key (allowlist file)", () => {
      const content = readTemplate("secrets.yaml");
      expect(content).toContain("emails.txt:");
    });

    it("Secret has helm.sh/resource-policy: keep annotation (survives helm uninstall)", () => {
      // AC: Credentials must not be deleted on helm uninstall (they are manually managed)
      const content = readTemplate("secrets.yaml");
      expect(content).toContain("helm.sh/resource-policy: keep");
    });
  });

  // ---------------------------------------------------------------------------
  describe("service.yaml template — targetPort from values", () => {
    it("service targetPort is templated from .Values.service.targetPort", () => {
      // AC: targetPort must be configurable (now points to proxy, not Umami directly)
      const content = readTemplate("service.yaml");
      expect(content).toContain(".Values.service.targetPort");
    });

    it("service.yaml does not hardcode targetPort as 'http'", () => {
      // Old config hardcoded 'http'; proxy rename required templating
      const content = readTemplate("service.yaml");
      expect(content).not.toContain("targetPort: http");
    });
  });

  // ---------------------------------------------------------------------------
  describe("Security config — cookie and session safety", () => {
    it("oauth2-proxy is configured with --cookie-secure=true", () => {
      const content = readTemplate("deployment.yaml");
      expect(content).toContain("--cookie-secure=true");
    });

    it("oauth2-proxy is configured with --cookie-samesite=lax", () => {
      const content = readTemplate("deployment.yaml");
      expect(content).toContain("--cookie-samesite=lax");
    });
  });
});
