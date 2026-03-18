/**
 * Agent Sandbox Infrastructure Validation Tests
 * Validates Issue #681: Migrate agent sandboxes from Depot to GKE Autopilot pods
 *
 * This test suite validates:
 * - Agent sandbox Dockerfile configuration
 * - K8s Job spec template structure and resource specs
 * - Secrets template (no hardcoded values)
 * - Dispatch script structure
 * - Entrypoint script requirements
 * - GitHub Actions workflow for agent image builds
 * - Dispatch skill updates (Depot → GKE references)
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const INFRA_DIR = '/workspace/infrastructure';
const AGENTS_DIR = path.join(INFRA_DIR, 'k8s/agents');
const DISPATCH_SKILL = '/workspace/.claude/skills/dispatch/SKILL.md';
const SANDBOX_SETUP = '/workspace/.claude/scripts/sandbox-setup.sh';

const readFile = (filepath: string): string => {
  return fs.readFileSync(filepath, 'utf-8');
};

const readAgentFile = (filename: string): string => {
  return readFile(path.join(AGENTS_DIR, filename));
};

describe('Agent Sandbox Infrastructure (Issue #681)', () => {
  describe('Required Files', () => {
    it('should have all required agent sandbox files', () => {
      const requiredFiles = [
        'Dockerfile',
        'entrypoint.sh',
        'job-template.yaml',
        'secrets-template.yaml',
        'dispatch-job.sh',
        'docker-build-agents.yml',
      ];

      requiredFiles.forEach((file) => {
        expect(
          fs.existsSync(path.join(AGENTS_DIR, file)),
          `Missing file: ${file}`
        ).toBe(true);
      });
    });
  });

  describe('Dockerfile', () => {
    const dockerfile = readAgentFile('Dockerfile');

    it('should use Node.js 20 base image', () => {
      expect(dockerfile).toMatch(/FROM node:20/);
    });

    it('should install required system dependencies', () => {
      expect(dockerfile).toContain('git');
      expect(dockerfile).toContain('curl');
      expect(dockerfile).toContain('jq');
    });

    it('should install GitHub CLI', () => {
      expect(dockerfile).toContain('gh');
      expect(dockerfile).toContain('githubcli');
    });

    it('should install Claude Code CLI', () => {
      expect(dockerfile).toContain('@anthropic-ai/claude-code');
    });

    it('should set WORKDIR to /workspace', () => {
      expect(dockerfile).toContain('WORKDIR /workspace');
    });

    it('should copy and use entrypoint.sh', () => {
      expect(dockerfile).toContain('COPY infrastructure/k8s/agents/entrypoint.sh');
      expect(dockerfile).toContain('ENTRYPOINT');
      expect(dockerfile).toContain('entrypoint.sh');
    });

    it('should not contain hardcoded secrets', () => {
      expect(dockerfile).not.toMatch(/sk-ant-/);
      expect(dockerfile).not.toMatch(/ghp_/);
      expect(dockerfile).not.toMatch(/ANTHROPIC_API_KEY/);
    });
  });

  describe('Entrypoint Script', () => {
    const entrypoint = readAgentFile('entrypoint.sh');

    it('should require ANTHROPIC_API_KEY', () => {
      expect(entrypoint).toContain('ANTHROPIC_API_KEY');
      expect(entrypoint).toContain('[FATAL]');
    });

    it('should require GH_TOKEN', () => {
      expect(entrypoint).toContain('GH_TOKEN');
    });

    it('should require TASK_PROMPT', () => {
      expect(entrypoint).toContain('TASK_PROMPT');
    });

    it('should configure git credentials via gh auth', () => {
      expect(entrypoint).toContain('gh auth login');
      expect(entrypoint).toContain('gh auth setup-git');
    });

    it('should clone the repository', () => {
      expect(entrypoint).toContain('git clone');
      expect(entrypoint).toContain('fenrir-ledger');
    });

    it('should handle branch checkout/creation', () => {
      expect(entrypoint).toContain('git checkout');
      expect(entrypoint).toContain('git checkout -b');
    });

    it('should install frontend dependencies', () => {
      expect(entrypoint).toContain('npm ci');
    });

    it('should handle Spot pod eviction gracefully', () => {
      expect(entrypoint).toContain('SIGTERM');
      expect(entrypoint).toContain('cleanup_on_eviction');
      expect(entrypoint).toContain('git commit');
      expect(entrypoint).toContain('auto-save before pod eviction');
    });

    it('should invoke Claude Code CLI', () => {
      expect(entrypoint).toContain('exec claude');
      expect(entrypoint).toContain('--model');
      expect(entrypoint).toContain('--print');
    });

    it('should support --dangerously-skip-permissions flag', () => {
      expect(entrypoint).toContain('SKIP_PERMISSIONS');
      expect(entrypoint).toContain('--dangerously-skip-permissions');
    });

    it('should set proper shebang', () => {
      expect(entrypoint.startsWith('#!/usr/bin/env bash')).toBe(true);
    });
  });

  describe('K8s Job Template', () => {
    const jobTemplate = readAgentFile('job-template.yaml');

    it('should be a batch/v1 Job', () => {
      expect(jobTemplate).toContain('apiVersion: batch/v1');
      expect(jobTemplate).toContain('kind: Job');
    });

    it('should target fenrir-agents namespace', () => {
      expect(jobTemplate).toContain('namespace: fenrir-agents');
    });

    it('should have ttlSecondsAfterFinished for auto-cleanup', () => {
      expect(jobTemplate).toContain('ttlSecondsAfterFinished: 3600');
    });

    it('should have activeDeadlineSeconds for timeout (60 min max)', () => {
      expect(jobTemplate).toContain('activeDeadlineSeconds: 3600');
    });

    it('should not retry on failure (backoffLimit: 0)', () => {
      expect(jobTemplate).toContain('backoffLimit: 0');
    });

    it('should use fenrir-agents-sa service account', () => {
      expect(jobTemplate).toContain('serviceAccountName: fenrir-agents-sa');
    });

    it('should request Spot/preemptible pods', () => {
      expect(jobTemplate).toContain('cloud.google.com/gke-spot');
    });

    it('should tolerate Spot eviction', () => {
      expect(jobTemplate).toContain('tolerations');
      expect(jobTemplate).toContain('cloud.google.com/gke-spot');
    });

    it('should set terminationGracePeriodSeconds for cleanup', () => {
      expect(jobTemplate).toContain('terminationGracePeriodSeconds: 30');
    });

    it('should have restartPolicy: Never', () => {
      expect(jobTemplate).toContain('restartPolicy: Never');
    });

    it('should request 2 vCPU / 4GB RAM per acceptance criteria', () => {
      expect(jobTemplate).toContain('cpu: "2"');
      expect(jobTemplate).toContain('memory: 4Gi');
    });

    it('should request ephemeral storage for repo/deps', () => {
      expect(jobTemplate).toContain('ephemeral-storage: 10Gi');
    });

    it('should have correct fenrir-ledger labels', () => {
      expect(jobTemplate).toContain(
        'app.kubernetes.io/part-of: fenrir-ledger'
      );
      expect(jobTemplate).toContain(
        'app.kubernetes.io/component: agent-sandbox'
      );
    });

    it('should inject secrets from K8s Secret agent-secrets', () => {
      expect(jobTemplate).toContain('secretKeyRef');
      expect(jobTemplate).toContain('name: agent-secrets');
      expect(jobTemplate).toContain('key: anthropic-api-key');
      expect(jobTemplate).toContain('key: gh-token');
    });

    it('should have all required placeholders', () => {
      const placeholders = [
        '{{JOB_NAME}}',
        '{{SESSION_ID}}',
        '{{BRANCH}}',
        '{{AGENT_MODEL}}',
        '{{IMAGE_TAG}}',
        '{{TASK_PROMPT}}',
      ];

      placeholders.forEach((placeholder) => {
        expect(
          jobTemplate,
          `Missing placeholder: ${placeholder}`
        ).toContain(placeholder);
      });
    });

    it('should use the correct Artifact Registry image path', () => {
      expect(jobTemplate).toContain(
        'us-central1-docker.pkg.dev/fenrir-ledger-prod/fenrir-images/agent-sandbox'
      );
    });

    it('should set imagePullPolicy to Always', () => {
      expect(jobTemplate).toContain('imagePullPolicy: Always');
    });
  });

  describe('Secrets Template', () => {
    const secretsTemplate = readAgentFile('secrets-template.yaml');

    it('should define a K8s Secret', () => {
      expect(secretsTemplate).toContain('kind: Secret');
      expect(secretsTemplate).toContain('type: Opaque');
    });

    it('should target fenrir-agents namespace', () => {
      expect(secretsTemplate).toContain('namespace: fenrir-agents');
    });

    it('should have anthropic-api-key and gh-token keys', () => {
      expect(secretsTemplate).toContain('anthropic-api-key:');
      expect(secretsTemplate).toContain('gh-token:');
    });

    it('should NOT contain real secret values', () => {
      expect(secretsTemplate).not.toMatch(/sk-ant-/);
      expect(secretsTemplate).not.toMatch(/ghp_/);
      expect(secretsTemplate).toContain('REPLACE_WITH_BASE64_ENCODED');
    });
  });

  describe('Dispatch Script', () => {
    const dispatchScript = readAgentFile('dispatch-job.sh');

    it('should accept required arguments', () => {
      expect(dispatchScript).toContain('--session-id');
      expect(dispatchScript).toContain('--branch');
      expect(dispatchScript).toContain('--model');
      expect(dispatchScript).toContain('--prompt');
    });

    it('should support --dry-run flag', () => {
      expect(dispatchScript).toContain('--dry-run');
      expect(dispatchScript).toContain('DRY RUN');
    });

    it('should support --image-tag flag', () => {
      expect(dispatchScript).toContain('--image-tag');
      expect(dispatchScript).toContain('IMAGE_TAG="latest"');
    });

    it('should support --prompt-file flag for reliable prompt delivery', () => {
      expect(dispatchScript).toContain('--prompt-file');
      expect(dispatchScript).toContain('PROMPT_FILE');
    });

    it('should support --no-spot flag for on-demand nodes', () => {
      expect(dispatchScript).toContain('--no-spot');
      expect(dispatchScript).toContain('USE_SPOT');
    });

    it('should validate required arguments', () => {
      expect(dispatchScript).toContain('required');
      expect(dispatchScript).toContain('exit 1');
    });

    it('should generate DNS-compatible job names', () => {
      expect(dispatchScript).toContain('tr');
      expect(dispatchScript).toContain('cut -c1-63');
    });

    it('should use job-template.yaml', () => {
      expect(dispatchScript).toContain('job-template.yaml');
    });

    it('should use kubectl apply', () => {
      expect(dispatchScript).toContain('kubectl apply');
      expect(dispatchScript).toContain('fenrir-agents');
    });

    it('should clean up temp files', () => {
      expect(dispatchScript).toContain('rm -f');
      expect(dispatchScript).toContain('mktemp');
    });

    it('should set proper shebang', () => {
      expect(dispatchScript.startsWith('#!/usr/bin/env bash')).toBe(true);
    });
  });

  describe('GitHub Actions Agent Build Workflow', () => {
    const workflow = readAgentFile('docker-build-agents.yml');

    it('should have a descriptive name', () => {
      expect(workflow).toContain('Build Agent Sandbox Image');
    });

    it('should trigger on push to main with agent file changes', () => {
      expect(workflow).toContain('branches: [main]');
      expect(workflow).toContain('infrastructure/k8s/agents/Dockerfile');
      expect(workflow).toContain('infrastructure/k8s/agents/entrypoint.sh');
    });

    it('should support manual dispatch', () => {
      expect(workflow).toContain('workflow_dispatch');
    });

    it('should target agent-sandbox image name', () => {
      expect(workflow).toContain('IMAGE_NAME: agent-sandbox');
    });

    it('should authenticate to Google Cloud', () => {
      expect(workflow).toContain('google-github-actions/auth');
      expect(workflow).toContain('secrets.GCP_SA_KEY');
    });

    it('should push to Artifact Registry', () => {
      expect(workflow).toContain('docker.pkg.dev');
      expect(workflow).toContain('push: true');
    });

    it('should use build caching', () => {
      expect(workflow).toContain('cache-from: type=gha');
      expect(workflow).toContain('cache-to: type=gha,mode=max');
    });
  });

  describe('Dispatch Skill Updates', () => {
    const dispatchSkill = readFile(DISPATCH_SKILL);

    it('should reference GKE instead of Depot', () => {
      expect(dispatchSkill).toContain('GKE Autopilot');
      expect(dispatchSkill).toContain('K8s Job');
    });

    it('should reference dispatch-job.sh instead of depot claude', () => {
      expect(dispatchSkill).toContain('dispatch-job.sh');
    });

    it('should update error handling for kubectl', () => {
      expect(dispatchSkill).toContain('kubectl');
    });

    it('should document fire-and-forget pattern', () => {
      expect(dispatchSkill).toContain('fire-and-forget');
    });

    it('should document log retrieval', () => {
      expect(dispatchSkill).toContain('kubectl logs');
    });

    it('should update model mapping table header', () => {
      expect(dispatchSkill).toContain('Remote (GKE)');
    });

    it('should update dispatch report output format', () => {
      expect(dispatchSkill).toContain('GKE/Local');
    });
  });

  describe('Sandbox Setup Script Updates', () => {
    const setupScript = readFile(SANDBOX_SETUP);

    it('should detect container environment', () => {
      expect(setupScript).toContain('KUBERNETES_SERVICE_HOST');
      expect(setupScript).toContain('.dockerenv');
    });

    it('should work in both local and container environments', () => {
      expect(setupScript).toContain('container');
      expect(setupScript).toContain('local');
    });

    it('should update git identity to GKE Agent', () => {
      expect(setupScript).toContain('GKE Agent');
    });
  });

  describe('Issue #681 Acceptance Criteria', () => {
    it('[✓] Agent sandbox container image defined (Dockerfile)', () => {
      expect(fs.existsSync(path.join(AGENTS_DIR, 'Dockerfile'))).toBe(true);
      const dockerfile = readAgentFile('Dockerfile');
      expect(dockerfile).toContain('node:20');
      expect(dockerfile).toContain('@anthropic-ai/claude-code');
    });

    it('[✓] K8s Job spec: 2 vCPU / 4GB RAM', () => {
      const jobTemplate = readAgentFile('job-template.yaml');
      expect(jobTemplate).toContain('cpu: "2"');
      expect(jobTemplate).toContain('memory: 4Gi');
    });

    it('[✓] Spot/preemptible pods for cost savings', () => {
      const jobTemplate = readAgentFile('job-template.yaml');
      expect(jobTemplate).toContain('cloud.google.com/gke-spot');
    });

    it('[✓] Dispatch updated to create K8s Jobs', () => {
      const dispatchSkill = readFile(DISPATCH_SKILL);
      expect(dispatchSkill).toContain('dispatch-job.sh');
      expect(dispatchSkill).toContain('GKE Autopilot K8s Job');
    });

    it('[✓] Env vars injected via K8s Secrets', () => {
      const jobTemplate = readAgentFile('job-template.yaml');
      expect(jobTemplate).toContain('secretKeyRef');
      expect(jobTemplate).toContain('anthropic-api-key');
      expect(jobTemplate).toContain('gh-token');
    });

    it('[✓] Concurrent dispatch supported (multiple Jobs in parallel)', () => {
      // ResourceQuota allows up to 8 pods
      const namespaces = readFile(
        path.join(INFRA_DIR, 'k8s/namespaces.yaml')
      );
      expect(namespaces).toContain('pods: "8"');
    });

    it('[✓] Job logs retrievable for debugging', () => {
      const dispatchSkill = readFile(DISPATCH_SKILL);
      expect(dispatchSkill).toContain('kubectl logs');
      expect(dispatchSkill).toContain('Cloud Logging');
    });

    it('[✓] Timeout/cleanup configured', () => {
      const jobTemplate = readAgentFile('job-template.yaml');
      expect(jobTemplate).toContain('ttlSecondsAfterFinished: 3600');
      expect(jobTemplate).toContain('activeDeadlineSeconds: 3600');
    });

    it('[✓] Fire-and-forget pattern preserved', () => {
      const dispatchScript = readAgentFile('dispatch-job.sh');
      expect(dispatchScript).toContain('kubectl apply');
      // Script returns after apply, doesn't wait
      expect(dispatchScript).not.toContain('kubectl wait');
    });

    it('[✓] Spot pod disruption handled gracefully', () => {
      const entrypoint = readAgentFile('entrypoint.sh');
      expect(entrypoint).toContain('SIGTERM');
      expect(entrypoint).toContain('cleanup_on_eviction');
      expect(entrypoint).toContain('auto-save before pod eviction');
    });
  });
});
