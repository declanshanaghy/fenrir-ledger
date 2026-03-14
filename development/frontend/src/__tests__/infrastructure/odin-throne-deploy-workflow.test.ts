/**
 * GitHub Actions deploy.yml — Odin's Throne CI/CD pipeline validation
 *
 * Issue #884: Odin's Throne: Helm chart, GKE deploy, and monitor.fenrirledger.com DNS
 *
 * Validates acceptance criteria:
 * - MONITOR_IMAGE_NAME env var is set to "odin-throne"
 * - build-and-push-monitor job exists, depends on terraform, builds from development/monitor/Dockerfile
 * - deploy job depends on both build-and-push AND build-and-push-monitor
 * - fenrir-monitor namespace is created via kubectl in the deploy job
 * - helm upgrade --install odin-throne is invoked with correct args
 * - Existing deploy pipeline is not broken
 *
 * These are static-file validation tests (Vitest unit) — no browser needed.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('GitHub Actions deploy.yml — Odin\'s Throne CI/CD additions (issue #884)', () => {
  const repoRoot = path.join(__dirname, '../../../../..');
  const workflowPath = path.join(repoRoot, '.github', 'workflows', 'deploy.yml');

  let workflowContent: string;

  beforeAll(() => {
    workflowContent = fs.readFileSync(workflowPath, 'utf-8');
  });

  // -------------------------------------------------------------------------
  // AC-1: MONITOR_IMAGE_NAME env var
  // -------------------------------------------------------------------------

  describe('MONITOR_IMAGE_NAME env var', () => {
    it('declares MONITOR_IMAGE_NAME in the top-level env block', () => {
      expect(workflowContent).toContain('MONITOR_IMAGE_NAME: odin-throne');
    });

    it('places MONITOR_IMAGE_NAME alongside IMAGE_NAME', () => {
      const imageNameIdx = workflowContent.indexOf('IMAGE_NAME: fenrir-app');
      const monitorNameIdx = workflowContent.indexOf('MONITOR_IMAGE_NAME: odin-throne');
      // Both should be in the top-level env section (within 200 chars of each other)
      expect(imageNameIdx).toBeGreaterThan(-1);
      expect(monitorNameIdx).toBeGreaterThan(-1);
      expect(Math.abs(imageNameIdx - monitorNameIdx)).toBeLessThan(200);
    });
  });

  // -------------------------------------------------------------------------
  // AC-2: build-and-push-monitor job
  // -------------------------------------------------------------------------

  describe('build-and-push-monitor job', () => {
    it('declares the build-and-push-monitor job', () => {
      expect(workflowContent).toContain('build-and-push-monitor:');
    });

    it('depends on the terraform job (needs: terraform)', () => {
      const jobSection = extractJobSection(workflowContent, 'build-and-push-monitor:');
      expect(jobSection).toContain('needs: terraform');
    });

    it('builds from the development/monitor/Dockerfile context', () => {
      const jobSection = extractJobSection(workflowContent, 'build-and-push-monitor:');
      expect(jobSection).toContain('./development/monitor');
    });

    it('builds and pushes to Artifact Registry', () => {
      const jobSection = extractJobSection(workflowContent, 'build-and-push-monitor:');
      expect(jobSection).toContain('docker/build-push-action');
      expect(jobSection).toContain('push: true');
    });

    it('tags the image with MONITOR_IMAGE_NAME', () => {
      const jobSection = extractJobSection(workflowContent, 'build-and-push-monitor:');
      expect(jobSection).toContain('MONITOR_IMAGE_NAME');
    });

    it('authenticates to Google Cloud', () => {
      const jobSection = extractJobSection(workflowContent, 'build-and-push-monitor:');
      expect(jobSection).toContain('google-github-actions/auth');
    });

    it('requires id-token: write permission for Workload Identity', () => {
      const jobSection = extractJobSection(workflowContent, 'build-and-push-monitor:');
      expect(jobSection).toContain('id-token: write');
    });
  });

  // -------------------------------------------------------------------------
  // AC-3: deploy job depends on both build jobs
  // -------------------------------------------------------------------------

  describe('deploy job — dependency on monitor build', () => {
    it('lists both build-and-push and build-and-push-monitor in needs', () => {
      const deploySection = extractJobSection(workflowContent, '  deploy:');
      // Should contain both in the needs array
      expect(deploySection).toContain('build-and-push');
      expect(deploySection).toContain('build-and-push-monitor');
    });

    it('uses array syntax for needs (both jobs required)', () => {
      // The needs should be an array containing both jobs
      expect(workflowContent).toMatch(/needs:\s*\[build-and-push,\s*build-and-push-monitor\]/);
    });
  });

  // -------------------------------------------------------------------------
  // AC-4: fenrir-monitor namespace creation
  // -------------------------------------------------------------------------

  describe('deploy job — fenrir-monitor namespace', () => {
    it('creates the fenrir-monitor namespace with idempotent kubectl apply', () => {
      expect(workflowContent).toContain(
        'kubectl create namespace fenrir-monitor --dry-run=client -o yaml | kubectl apply -f -'
      );
    });
  });

  // -------------------------------------------------------------------------
  // AC-5: helm upgrade --install odin-throne
  // -------------------------------------------------------------------------

  describe('deploy job — Helm deploy of Odin\'s Throne', () => {
    it('runs helm upgrade --install for odin-throne', () => {
      expect(workflowContent).toContain('helm upgrade --install odin-throne');
    });

    it('points to the odin-throne Helm chart directory', () => {
      expect(workflowContent).toContain('./infrastructure/helm/odin-throne');
    });

    it('targets the fenrir-monitor namespace', () => {
      // --namespace=fenrir-monitor in the helm command
      const helmCmdIdx = workflowContent.indexOf('helm upgrade --install odin-throne');
      const helmCmdSection = workflowContent.slice(helmCmdIdx, helmCmdIdx + 500);
      expect(helmCmdSection).toContain('fenrir-monitor');
    });

    it('applies the values-prod.yaml overlay', () => {
      const helmCmdIdx = workflowContent.indexOf('helm upgrade --install odin-throne');
      const helmCmdSection = workflowContent.slice(helmCmdIdx, helmCmdIdx + 500);
      expect(helmCmdSection).toContain('values-prod.yaml');
    });

    it('sets image repository via --set using MONITOR_IMAGE_NAME', () => {
      const helmCmdIdx = workflowContent.indexOf('helm upgrade --install odin-throne');
      const helmCmdSection = workflowContent.slice(helmCmdIdx, helmCmdIdx + 500);
      expect(helmCmdSection).toContain('MONITOR_IMAGE_NAME');
      expect(helmCmdSection).toContain('app.image.repository');
    });

    it('sets image tag via --set to IMAGE_TAG', () => {
      const helmCmdIdx = workflowContent.indexOf('helm upgrade --install odin-throne');
      const helmCmdSection = workflowContent.slice(helmCmdIdx, helmCmdIdx + 500);
      expect(helmCmdSection).toContain('app.image.tag');
      expect(helmCmdSection).toContain('IMAGE_TAG');
    });

    it('waits for rollout with --wait flag', () => {
      const helmCmdIdx = workflowContent.indexOf('helm upgrade --install odin-throne');
      const helmCmdSection = workflowContent.slice(helmCmdIdx, helmCmdIdx + 500);
      expect(helmCmdSection).toContain('--wait');
    });

    it('sets a --timeout for the Helm deploy', () => {
      const helmCmdIdx = workflowContent.indexOf('helm upgrade --install odin-throne');
      const helmCmdSection = workflowContent.slice(helmCmdIdx, helmCmdIdx + 500);
      expect(helmCmdSection).toContain('--timeout');
    });
  });

  // -------------------------------------------------------------------------
  // Structural integrity: existing pipeline is not broken
  // -------------------------------------------------------------------------

  describe('Structural integrity — existing pipeline unaffected', () => {
    it('retains the main build-and-push job', () => {
      expect(workflowContent).toContain('build-and-push:');
    });

    it('retains the terraform job', () => {
      expect(workflowContent).toContain('terraform:');
    });

    it('retains the main app Helm deploy (fenrir-app or umami)', () => {
      // The main app and umami deploys should still be present
      expect(workflowContent).toContain('helm upgrade --install');
    });

    it('retains IMAGE_NAME env var for the main app image', () => {
      expect(workflowContent).toContain('IMAGE_NAME: fenrir-app');
    });
  });
});

// ---------------------------------------------------------------------------
// Helper: extract the content of a job section from the workflow YAML
// Given a job header like "  build-and-push-monitor:", returns ~2000 chars from that point
// (enough to cover the whole job definition)
// ---------------------------------------------------------------------------

function extractJobSection(content: string, jobHeader: string): string {
  const start = content.indexOf(jobHeader);
  if (start === -1) return '';

  // Find the next top-level job definition (line starting with "  <word>:" but not deeper indented)
  // Grab 3000 chars as a practical limit for a job block
  return content.slice(start, start + 3000);
}
