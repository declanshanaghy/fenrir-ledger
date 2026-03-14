/**
 * Odin's Throne Helm Chart — Structural Validation
 *
 * Issue #884: Odin's Throne: Helm chart, GKE deploy, and monitor.fenrirledger.com DNS
 *
 * Validates acceptance criteria:
 * - Helm chart structure: Chart.yaml, values.yaml, values-prod.yaml, all templates
 * - Namespace: fenrir-monitor
 * - Image: correct Artifact Registry path (odin-throne)
 * - Service: ClusterIP on port 80, container port 3001
 * - Ingress: monitor.fenrirledger.com host, static IP annotation "monitor-ip", GCE class
 * - ManagedCertificate: monitor.fenrirledger.com domain
 * - BackendConfig: healthCheck on /healthz port 3001
 * - RBAC: ServiceAccount + Role (jobs/pods/logs read in fenrir-agents) + RoleBinding
 * - Health probes: readiness, liveness, startup all target /healthz
 *
 * These are static-file validation tests (Vitest unit) — no browser needed.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Odin\'s Throne Helm Chart (issue #884)', () => {
  const repoRoot = path.join(__dirname, '../../../../..');
  const chartDir = path.join(repoRoot, 'infrastructure', 'helm', 'odin-throne');
  const templatesDir = path.join(chartDir, 'templates');

  let chartYaml: string;
  let valuesYaml: string;
  let valuesProdYaml: string;
  let deploymentYaml: string;
  let serviceYaml: string;
  let ingressYaml: string;
  let rbacYaml: string;
  let secretsYaml: string;
  let helpersTpl: string;

  beforeAll(() => {
    chartYaml = fs.readFileSync(path.join(chartDir, 'Chart.yaml'), 'utf-8');
    valuesYaml = fs.readFileSync(path.join(chartDir, 'values.yaml'), 'utf-8');
    valuesProdYaml = fs.readFileSync(path.join(chartDir, 'values-prod.yaml'), 'utf-8');
    deploymentYaml = fs.readFileSync(path.join(templatesDir, 'deployment.yaml'), 'utf-8');
    serviceYaml = fs.readFileSync(path.join(templatesDir, 'service.yaml'), 'utf-8');
    ingressYaml = fs.readFileSync(path.join(templatesDir, 'ingress.yaml'), 'utf-8');
    rbacYaml = fs.readFileSync(path.join(templatesDir, 'rbac.yaml'), 'utf-8');
    secretsYaml = fs.readFileSync(path.join(templatesDir, 'secrets.yaml'), 'utf-8');
    helpersTpl = fs.readFileSync(path.join(templatesDir, '_helpers.tpl'), 'utf-8');
  });

  // -------------------------------------------------------------------------
  // AC: Chart.yaml — valid Helm chart metadata
  // -------------------------------------------------------------------------

  describe('Chart.yaml', () => {
    it('uses Helm apiVersion v2', () => {
      expect(chartYaml).toContain('apiVersion: v2');
    });

    it('has chart name "odin-throne"', () => {
      expect(chartYaml).toContain('name: odin-throne');
    });

    it('has chart type "application"', () => {
      expect(chartYaml).toContain('type: application');
    });

    it('has version 0.1.0', () => {
      expect(chartYaml).toContain('version: 0.1.0');
    });

    it('has a description referencing Odin\'s Throne or GKE monitor', () => {
      expect(chartYaml.toLowerCase()).toMatch(/odin|throne|monitor/);
    });
  });

  // -------------------------------------------------------------------------
  // AC: values.yaml — namespace, image, service, ingress, RBAC defaults
  // -------------------------------------------------------------------------

  describe('values.yaml — namespace', () => {
    it('uses namespace "fenrir-monitor"', () => {
      expect(valuesYaml).toContain('namespace: fenrir-monitor');
    });
  });

  describe('values.yaml — image', () => {
    it('references the odin-throne image in Artifact Registry', () => {
      expect(valuesYaml).toContain('odin-throne');
    });

    it('uses the us-central1 Artifact Registry region', () => {
      expect(valuesYaml).toContain('us-central1-docker.pkg.dev');
    });

    it('uses project "fenrir-ledger-prod"', () => {
      expect(valuesYaml).toContain('fenrir-ledger-prod');
    });
  });

  describe('values.yaml — service', () => {
    it('exposes service on port 80', () => {
      expect(valuesYaml).toContain('port: 80');
    });

    it('targets container port 3001', () => {
      expect(valuesYaml).toContain('containerPort: 3001');
    });

    it('uses ClusterIP service type', () => {
      expect(valuesYaml).toContain('type: ClusterIP');
    });
  });

  describe('values.yaml — ingress', () => {
    it('has ingress enabled by default', () => {
      expect(valuesYaml).toMatch(/ingress:\s*\n\s+enabled: true/);
    });

    it('targets monitor.fenrirledger.com host', () => {
      expect(valuesYaml).toContain('monitor.fenrirledger.com');
    });

    it('uses "gce" ingress class for GKE Autopilot', () => {
      expect(valuesYaml).toContain('className: "gce"');
    });

    it('annotates with static IP name "monitor-ip"', () => {
      expect(valuesYaml).toContain('monitor-ip');
    });

    it('annotates with managed certificate "odin-throne-cert"', () => {
      expect(valuesYaml).toContain('odin-throne-cert');
    });

    it('references BackendConfig annotation', () => {
      expect(valuesYaml).toContain('cloud.google.com/backend-config');
    });
  });

  describe('values.yaml — ManagedCertificate', () => {
    it('enables the ManagedCertificate', () => {
      expect(valuesYaml).toMatch(/managedCertificate:\s*\n\s+enabled: true/);
    });

    it('includes monitor.fenrirledger.com as a certificate domain', () => {
      // domains section under managedCertificate
      expect(valuesYaml).toContain('monitor.fenrirledger.com');
    });
  });

  describe('values.yaml — BackendConfig', () => {
    it('enables BackendConfig', () => {
      expect(valuesYaml).toMatch(/backendConfig:\s*\n\s+enabled: true/);
    });

    it('healthCheck targets /healthz path', () => {
      expect(valuesYaml).toContain('requestPath: /healthz');
    });

    it('healthCheck targets port 3001', () => {
      // Port in backendConfig.healthCheck
      expect(valuesYaml).toContain('port: 3001');
    });
  });

  describe('values.yaml — RBAC', () => {
    it('enables RBAC by default', () => {
      expect(valuesYaml).toMatch(/rbac:\s*\n\s+enabled: true/);
    });

    it('sets agentsNamespace to "fenrir-agents"', () => {
      expect(valuesYaml).toContain('agentsNamespace: fenrir-agents');
    });
  });

  describe('values.yaml — health probes', () => {
    it('readinessProbe uses /healthz path', () => {
      expect(valuesYaml).toMatch(/readinessProbe[\s\S]*?path: \/healthz/);
    });

    it('livenessProbe uses /healthz path', () => {
      expect(valuesYaml).toMatch(/livenessProbe[\s\S]*?path: \/healthz/);
    });

    it('startupProbe uses /healthz path', () => {
      expect(valuesYaml).toMatch(/startupProbe[\s\S]*?path: \/healthz/);
    });
  });

  // -------------------------------------------------------------------------
  // AC: values-prod.yaml — production overrides
  // -------------------------------------------------------------------------

  describe('values-prod.yaml', () => {
    it('uses namespace "fenrir-monitor"', () => {
      expect(valuesProdYaml).toContain('namespace: fenrir-monitor');
    });

    it('keeps ingress enabled in prod', () => {
      expect(valuesProdYaml).toMatch(/ingress:\s*\n\s+enabled: true/);
    });

    it('keeps RBAC enabled in prod', () => {
      expect(valuesProdYaml).toMatch(/rbac:\s*\n\s+enabled: true/);
    });

    it('keeps replicaCount at 1 for GKE Autopilot cost control', () => {
      expect(valuesProdYaml).toContain('replicaCount: 1');
    });
  });

  // -------------------------------------------------------------------------
  // AC: templates/deployment.yaml
  // -------------------------------------------------------------------------

  describe('templates/deployment.yaml', () => {
    it('is a Deployment kind', () => {
      expect(deploymentYaml).toContain('kind: Deployment');
    });

    it('uses namespace from values', () => {
      expect(deploymentYaml).toContain('.Values.namespace');
    });

    it('references serviceAccountName from values', () => {
      expect(deploymentYaml).toContain('.Values.app.serviceAccountName');
    });

    it('sets container port from values', () => {
      expect(deploymentYaml).toContain('.Values.service.containerPort');
    });

    it('includes readinessProbe', () => {
      expect(deploymentYaml).toContain('readinessProbe');
    });

    it('includes livenessProbe', () => {
      expect(deploymentYaml).toContain('livenessProbe');
    });

    it('includes startupProbe', () => {
      expect(deploymentYaml).toContain('startupProbe');
    });

    it('uses rolling update strategy from values', () => {
      expect(deploymentYaml).toContain('.Values.app.strategy');
    });

    it('names the container "odin-throne"', () => {
      expect(deploymentYaml).toContain('name: odin-throne');
    });
  });

  // -------------------------------------------------------------------------
  // AC: templates/service.yaml
  // -------------------------------------------------------------------------

  describe('templates/service.yaml', () => {
    it('is a Service kind', () => {
      expect(serviceYaml).toContain('kind: Service');
    });

    it('uses namespace from values', () => {
      expect(serviceYaml).toContain('.Values.namespace');
    });

    it('exposes port from values', () => {
      expect(serviceYaml).toContain('.Values.service.port');
    });

    it('targets port from values (targetPort)', () => {
      expect(serviceYaml).toContain('.Values.service.targetPort');
    });

    it('uses selector labels helper', () => {
      expect(serviceYaml).toContain('odin-throne.selectorLabels');
    });
  });

  // -------------------------------------------------------------------------
  // AC: templates/ingress.yaml — Ingress + ManagedCertificate + BackendConfig
  // -------------------------------------------------------------------------

  describe('templates/ingress.yaml — Ingress', () => {
    it('wraps in ingress.enabled conditional', () => {
      expect(ingressYaml).toContain('.Values.ingress.enabled');
    });

    it('is a networking.k8s.io/v1 Ingress', () => {
      expect(ingressYaml).toContain('apiVersion: networking.k8s.io/v1');
      expect(ingressYaml).toContain('kind: Ingress');
    });

    it('uses namespace from values', () => {
      expect(ingressYaml).toContain('.Values.namespace');
    });

    it('ranges over hosts from values', () => {
      expect(ingressYaml).toContain('.Values.ingress.hosts');
    });

    it('references service port from values', () => {
      expect(ingressYaml).toContain('.Values.service.port');
    });
  });

  describe('templates/ingress.yaml — ManagedCertificate', () => {
    it('wraps in managedCertificate.enabled conditional', () => {
      expect(ingressYaml).toContain('.Values.ingress.managedCertificate.enabled');
    });

    it('is a GKE ManagedCertificate resource', () => {
      expect(ingressYaml).toContain('apiVersion: networking.gke.io/v1');
      expect(ingressYaml).toContain('kind: ManagedCertificate');
    });

    it('names the certificate "odin-throne-cert"', () => {
      expect(ingressYaml).toContain('name: odin-throne-cert');
    });

    it('ranges over certificate domains from values', () => {
      expect(ingressYaml).toContain('.Values.ingress.managedCertificate.domains');
    });
  });

  describe('templates/ingress.yaml — BackendConfig', () => {
    it('wraps in backendConfig.enabled conditional', () => {
      expect(ingressYaml).toContain('.Values.ingress.backendConfig.enabled');
    });

    it('is a cloud.google.com/v1 BackendConfig', () => {
      expect(ingressYaml).toContain('apiVersion: cloud.google.com/v1');
      expect(ingressYaml).toContain('kind: BackendConfig');
    });

    it('names the BackendConfig "odin-throne-backend-config"', () => {
      expect(ingressYaml).toContain('name: odin-throne-backend-config');
    });

    it('includes healthCheck from values', () => {
      expect(ingressYaml).toContain('.Values.ingress.backendConfig.healthCheck');
    });
  });

  // -------------------------------------------------------------------------
  // AC: templates/rbac.yaml — ServiceAccount + Role + RoleBinding
  // -------------------------------------------------------------------------

  describe('templates/rbac.yaml — ServiceAccount', () => {
    it('wraps in rbac.enabled conditional', () => {
      expect(rbacYaml).toContain('.Values.rbac.enabled');
    });

    it('creates a ServiceAccount', () => {
      expect(rbacYaml).toContain('kind: ServiceAccount');
    });

    it('places ServiceAccount in monitor namespace from values', () => {
      expect(rbacYaml).toContain('.Values.namespace');
    });

    it('uses serviceAccountName from values', () => {
      expect(rbacYaml).toContain('.Values.app.serviceAccountName');
    });
  });

  describe('templates/rbac.yaml — Role', () => {
    it('creates a Role (not ClusterRole — limited to fenrir-agents namespace)', () => {
      expect(rbacYaml).toContain('kind: Role');
    });

    it('names the Role "odin-throne-agent-reader"', () => {
      expect(rbacYaml).toContain('name: odin-throne-agent-reader');
    });

    it('places the Role in the agents namespace from values', () => {
      expect(rbacYaml).toContain('.Values.rbac.agentsNamespace');
    });

    it('grants get/list/watch on batch/jobs', () => {
      expect(rbacYaml).toContain('"batch"');
      expect(rbacYaml).toContain('"jobs"');
      expect(rbacYaml).toContain('"get"');
      expect(rbacYaml).toContain('"list"');
      expect(rbacYaml).toContain('"watch"');
    });

    it('grants get/list/watch on core/pods and pods/log', () => {
      expect(rbacYaml).toContain('"pods"');
      expect(rbacYaml).toContain('"pods/log"');
    });

    it('does NOT grant write verbs (create/delete/update/patch)', () => {
      // Monitor is read-only — must not have write access
      expect(rbacYaml).not.toContain('"create"');
      expect(rbacYaml).not.toContain('"delete"');
      expect(rbacYaml).not.toContain('"update"');
      expect(rbacYaml).not.toContain('"patch"');
    });
  });

  describe('templates/rbac.yaml — RoleBinding', () => {
    it('creates a RoleBinding', () => {
      expect(rbacYaml).toContain('kind: RoleBinding');
    });

    it('binds to the Role "odin-throne-agent-reader"', () => {
      // roleRef.name must match the Role
      const roleRefIdx = rbacYaml.indexOf('roleRef:');
      const roleRefBlock = rbacYaml.slice(roleRefIdx, roleRefIdx + 200);
      expect(roleRefBlock).toContain('odin-throne-agent-reader');
    });

    it('subjects the ServiceAccount from fenrir-monitor namespace', () => {
      const subjectsIdx = rbacYaml.indexOf('subjects:');
      const subjectsBlock = rbacYaml.slice(subjectsIdx, subjectsIdx + 200);
      expect(subjectsBlock).toContain('kind: ServiceAccount');
      expect(subjectsBlock).toContain('.Values.namespace');
    });
  });

  // -------------------------------------------------------------------------
  // AC: templates/_helpers.tpl — label helpers
  // -------------------------------------------------------------------------

  describe('templates/_helpers.tpl', () => {
    it('defines "odin-throne.labels" helper', () => {
      expect(helpersTpl).toContain('define "odin-throne.labels"');
    });

    it('defines "odin-throne.selectorLabels" helper', () => {
      expect(helpersTpl).toContain('define "odin-throne.selectorLabels"');
    });

    it('labels resources as part of "fenrir-ledger"', () => {
      expect(helpersTpl).toContain('fenrir-ledger');
    });

    it('sets managed-by to "helm"', () => {
      expect(helpersTpl).toContain('managed-by: helm');
    });
  });

  // -------------------------------------------------------------------------
  // Structural: all expected template files exist
  // -------------------------------------------------------------------------

  describe('Chart file structure', () => {
    const expectedFiles = [
      'Chart.yaml',
      'values.yaml',
      'values-prod.yaml',
      path.join('templates', 'deployment.yaml'),
      path.join('templates', 'service.yaml'),
      path.join('templates', 'ingress.yaml'),
      path.join('templates', 'rbac.yaml'),
      path.join('templates', 'secrets.yaml'),
      path.join('templates', '_helpers.tpl'),
    ];

    for (const file of expectedFiles) {
      it(`contains ${file}`, () => {
        expect(fs.existsSync(path.join(chartDir, file))).toBe(true);
      });
    }
  });
});
