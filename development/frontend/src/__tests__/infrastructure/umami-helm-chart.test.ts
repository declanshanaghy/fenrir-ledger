import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Umami Helm Chart', () => {
  const repoRoot = path.join(__dirname, '../../../../..');
  const chartDir = path.join(repoRoot, 'infrastructure', 'helm', 'umami');
  const templatesDir = path.join(chartDir, 'templates');

  describe('Chart.yaml', () => {
    it('should have valid Chart.yaml with correct metadata', () => {
      const chartYaml = fs.readFileSync(path.join(chartDir, 'Chart.yaml'), 'utf-8');

      expect(chartYaml).toContain('apiVersion: v2');
      expect(chartYaml).toContain('name: umami');
      expect(chartYaml).toContain('version: 0.1.0');
      expect(chartYaml).toContain('description: Umami Analytics');
      expect(chartYaml).toContain('type: application');
    });
  });

  describe('values.yaml', () => {
    it('should have valid values.yaml with namespace', () => {
      const valuesYaml = fs.readFileSync(path.join(chartDir, 'values.yaml'), 'utf-8');

      expect(valuesYaml).toContain('namespace: fenrir-analytics');
    });

    it('should have Umami configuration', () => {
      const valuesYaml = fs.readFileSync(path.join(chartDir, 'values.yaml'), 'utf-8');

      expect(valuesYaml).toContain('ghcr.io/umami-software/umami');
      expect(valuesYaml).toContain('postgresql-latest');
      expect(valuesYaml).toContain('umami:');
      expect(valuesYaml).toContain('replicaCount: 1');
    });

    it('should have correct Umami resource limits', () => {
      const valuesYaml = fs.readFileSync(path.join(chartDir, 'values.yaml'), 'utf-8');

      // Umami resources should be 100m/256Mi
      expect(valuesYaml).toMatch(/cpu.*100m/);
      expect(valuesYaml).toMatch(/memory.*256Mi/);
    });

    it('should have PostgreSQL configuration', () => {
      const valuesYaml = fs.readFileSync(path.join(chartDir, 'values.yaml'), 'utf-8');

      expect(valuesYaml).toContain('postgresql:');
      expect(valuesYaml).toContain('postgres');
      expect(valuesYaml).toContain('16-alpine');
      expect(valuesYaml).toContain('POSTGRES_DB: "umami"');
      expect(valuesYaml).toContain('1Gi');
      expect(valuesYaml).toContain('standard-rwo');
    });

    it('should have correct PostgreSQL resource limits', () => {
      const valuesYaml = fs.readFileSync(path.join(chartDir, 'values.yaml'), 'utf-8');

      // PostgreSQL resources should be 250m/256Mi
      const postgresSection = valuesYaml.substring(
        valuesYaml.indexOf('postgresql:'),
        valuesYaml.indexOf('# -- Service')
      );

      expect(postgresSection).toMatch(/cpu.*250m/);
      expect(postgresSection).toContain('POSTGRES_PASSWORD:');
    });

    it('should have Ingress configuration', () => {
      const valuesYaml = fs.readFileSync(path.join(chartDir, 'values.yaml'), 'utf-8');

      expect(valuesYaml).toContain('ingress:');
      expect(valuesYaml).toContain('analytics.fenrirledger.com');
      expect(valuesYaml).toContain('className: "gce"');
      expect(valuesYaml).toContain('umami-cert');
    });

    it('should have Secrets configuration', () => {
      const valuesYaml = fs.readFileSync(path.join(chartDir, 'values.yaml'), 'utf-8');

      expect(valuesYaml).toContain('secrets:');
      expect(valuesYaml).toContain('databaseUrl:');
      expect(valuesYaml).toContain('postgresql://umami:');
    });
  });

  describe('values-prod.yaml', () => {
    it('should have valid values-prod.yaml', () => {
      const valuesYaml = fs.readFileSync(path.join(chartDir, 'values-prod.yaml'), 'utf-8');

      expect(valuesYaml).toContain('namespace: fenrir-analytics');
    });

    it('should override replicaCount for production HA', () => {
      const valuesYaml = fs.readFileSync(path.join(chartDir, 'values-prod.yaml'), 'utf-8');

      const umamiSection = valuesYaml.substring(
        valuesYaml.indexOf('umami:'),
        valuesYaml.indexOf('image:')
      );

      expect(umamiSection).toContain('replicaCount: 2');
    });

    it('should configure production ingress', () => {
      const valuesYaml = fs.readFileSync(path.join(chartDir, 'values-prod.yaml'), 'utf-8');

      expect(valuesYaml).toContain('analytics.fenrirledger.com');
      expect(valuesYaml).toContain('umami-ip');
    });
  });

  describe('Template files', () => {
    it('should have all required template files', () => {
      const requiredFiles = [
        'deployment.yaml',
        'postgresql-statefulset.yaml',
        'postgresql-service.yaml',
        'service.yaml',
        'ingress.yaml',
        'secrets.yaml',
        'configmap.yaml',
        '_helpers.tpl',
      ];

      requiredFiles.forEach((file) => {
        const filePath = path.join(templatesDir, file);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    });

    it('should have valid Kubernetes deployment template', () => {
      const deploymentYaml = fs.readFileSync(path.join(templatesDir, 'deployment.yaml'), 'utf-8');

      expect(deploymentYaml).toContain('apiVersion: apps/v1');
      expect(deploymentYaml).toContain('kind: Deployment');
      expect(deploymentYaml).toContain('name: umami');
      expect(deploymentYaml).toContain('.Values.umami.image.repository');
      expect(deploymentYaml).toContain('.Values.umami.image.tag');
      expect(deploymentYaml).toContain('secretRef:');
      expect(deploymentYaml).toContain('umami-secrets');
    });

    it('should have valid PostgreSQL StatefulSet template', () => {
      const statefulsetYaml = fs.readFileSync(path.join(templatesDir, 'postgresql-statefulset.yaml'), 'utf-8');

      expect(statefulsetYaml).toContain('apiVersion: apps/v1');
      expect(statefulsetYaml).toContain('kind: StatefulSet');
      expect(statefulsetYaml).toContain('name: postgresql');
      expect(statefulsetYaml).toContain('postgres');
      expect(statefulsetYaml).toContain('5432');
      expect(statefulsetYaml).toContain('POSTGRES_PASSWORD');
      expect(statefulsetYaml).toContain('pg_isready');
    });

    it('should have headless service for PostgreSQL StatefulSet', () => {
      const serviceYaml = fs.readFileSync(path.join(templatesDir, 'postgresql-service.yaml'), 'utf-8');

      expect(serviceYaml).toContain('apiVersion: v1');
      expect(serviceYaml).toContain('kind: Service');
      expect(serviceYaml).toContain('name: postgresql-svc');
      expect(serviceYaml).toContain('clusterIP: None');
    });

    it('should have Umami service template', () => {
      const serviceYaml = fs.readFileSync(path.join(templatesDir, 'service.yaml'), 'utf-8');

      expect(serviceYaml).toContain('apiVersion: v1');
      expect(serviceYaml).toContain('kind: Service');
      expect(serviceYaml).toContain('name: umami');
      expect(serviceYaml).toContain('type: {{ .Values.service.type }}');
    });

    it('should have valid Ingress template', () => {
      const ingressYaml = fs.readFileSync(path.join(templatesDir, 'ingress.yaml'), 'utf-8');

      expect(ingressYaml).toContain('apiVersion: networking.k8s.io/v1');
      expect(ingressYaml).toContain('kind: Ingress');
      expect(ingressYaml).toContain('name: umami');
      expect(ingressYaml).toContain('.Values.ingress.hosts');
      expect(ingressYaml).toContain('.Values.ingress.className');
    });

    it('should have valid Secrets template', () => {
      const secretsYaml = fs.readFileSync(path.join(templatesDir, 'secrets.yaml'), 'utf-8');

      expect(secretsYaml).toContain('apiVersion: v1');
      expect(secretsYaml).toContain('kind: Secret');
      expect(secretsYaml).toContain('name: umami-secrets');
      expect(secretsYaml).toContain('DATABASE_URL');
      expect(secretsYaml).toContain('b64enc');
    });

    it('should have ConfigMap template', () => {
      const configmapYaml = fs.readFileSync(path.join(templatesDir, 'configmap.yaml'), 'utf-8');

      expect(configmapYaml).toContain('apiVersion: v1');
      expect(configmapYaml).toContain('kind: ConfigMap');
      expect(configmapYaml).toContain('name: umami-init-db');
    });

    it('should have Helm helper templates', () => {
      const helpersYaml = fs.readFileSync(path.join(templatesDir, '_helpers.tpl'), 'utf-8');

      expect(helpersYaml).toContain('umami.name');
      expect(helpersYaml).toContain('umami.labels');
      expect(helpersYaml).toContain('umami.selectorLabels');
    });
  });

  describe('Architecture compliance', () => {
    it('should use fenrir-analytics namespace for isolation', () => {
      const valuesYaml = fs.readFileSync(path.join(chartDir, 'values.yaml'), 'utf-8');
      const deploymentYaml = fs.readFileSync(path.join(templatesDir, 'deployment.yaml'), 'utf-8');

      expect(valuesYaml).toContain('namespace: fenrir-analytics');
      expect(deploymentYaml).toContain('namespace: {{ .Values.namespace }}');
    });

    it('should use correct database image for PostgreSQL backend', () => {
      const valuesYaml = fs.readFileSync(path.join(chartDir, 'values.yaml'), 'utf-8');

      expect(valuesYaml).toContain('postgres');
      expect(valuesYaml).toContain('16-alpine');
      expect(valuesYaml).toContain('DATABASE_TYPE: "postgresql"');
    });

    it('should use standard-rwo storage class for GKE Autopilot', () => {
      const valuesYaml = fs.readFileSync(path.join(chartDir, 'values.yaml'), 'utf-8');

      expect(valuesYaml).toContain('standard-rwo');
    });

    it('should use Umami PostgreSQL image from GHCR', () => {
      const valuesYaml = fs.readFileSync(path.join(chartDir, 'values.yaml'), 'utf-8');

      expect(valuesYaml).toContain('ghcr.io/umami-software/umami');
      expect(valuesYaml).toContain('postgresql-latest');
    });
  });

  describe('Budget and resource constraints', () => {
    it('should have Umami configured with 100m/256Mi', () => {
      const valuesYaml = fs.readFileSync(path.join(chartDir, 'values.yaml'), 'utf-8');

      const umamiSection = valuesYaml.substring(
        valuesYaml.indexOf('umami:'),
        valuesYaml.indexOf('# -- PostgreSQL')
      );

      expect(umamiSection).toMatch(/requests:[\s\S]*cpu: "100m"/);
      expect(umamiSection).toMatch(/requests:[\s\S]*memory: "256Mi"/);
    });

    it('should have PostgreSQL configured with 250m/256Mi', () => {
      const valuesYaml = fs.readFileSync(path.join(chartDir, 'values.yaml'), 'utf-8');

      const postgresSection = valuesYaml.substring(
        valuesYaml.indexOf('postgresql:'),
        valuesYaml.indexOf('# -- Service')
      );

      expect(postgresSection).toMatch(/requests:[\s\S]*cpu: "250m"/);
      expect(postgresSection).toMatch(/requests:[\s\S]*memory: "256Mi"/);
    });

    it('should configure 1Gi PVC for PostgreSQL', () => {
      const valuesYaml = fs.readFileSync(path.join(chartDir, 'values.yaml'), 'utf-8');

      const persistenceSection = valuesYaml.substring(
        valuesYaml.indexOf('persistence:'),
        valuesYaml.indexOf('# -- Service')
      );

      expect(persistenceSection).toContain('size: 1Gi');
    });
  });

  describe('DNS and TLS integration', () => {
    it('should configure analytics.fenrirledger.com domain', () => {
      const valuesYaml = fs.readFileSync(path.join(chartDir, 'values.yaml'), 'utf-8');

      expect(valuesYaml).toContain('analytics.fenrirledger.com');
    });

    it('should use GCE ingress class for GKE', () => {
      const valuesYaml = fs.readFileSync(path.join(chartDir, 'values.yaml'), 'utf-8');

      expect(valuesYaml).toContain('className: "gce"');
      expect(valuesYaml).toContain('umami-cert');
      expect(valuesYaml).toContain('managed-certificates');
    });
  });
});
