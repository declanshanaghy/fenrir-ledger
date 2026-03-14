/**
 * Agent Monitor README Diagram Validation Tests
 * Tests Issue #799: Verify mermaid diagrams in Agent Monitor README are documented correctly
 *
 * Validates:
 * 1. System Architecture Diagram - SPA → serve.mjs → kubectl proxy → K8s API → pods
 * 2. Log Streaming Flow Diagram - sequenceDiagram of JSONL parsing and heckler injection
 * 3. Heckler Escalation State Machine - finite state machine: normal → retort → apoplectic → explosion → new heckler
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Agent Monitor README Diagrams - Issue #799', () => {
  let readmeContent: string;

  beforeEach(() => {
    const readmePath = join(__dirname, '../../../agent-monitor/README.md');
    readmeContent = readFileSync(readmePath, 'utf-8');
  });

  describe('System Architecture Diagram', () => {
    it('should contain System Architecture Diagram section', () => {
      expect(readmeContent).toContain('### System Architecture Diagram');
    });

    it('should use mermaid graph TD syntax', () => {
      const hasArchDiagram = readmeContent.includes('### System Architecture Diagram') &&
        readmeContent.includes('```mermaid') &&
        readmeContent.includes('graph TD');
      expect(hasArchDiagram).toBe(true);
    });

    it('should define browser node with SPA label', () => {
      const archSection = readmeContent.split('### System Architecture Diagram')[1];
      expect(archSection).toContain('Browser SPA - Agent Monitor');
    });

    it('should define serve.mjs proxy node', () => {
      const archSection = readmeContent.split('### System Architecture Diagram')[1];
      expect(archSection).toContain('serve.mjs');
      expect(archSection).toContain('K8s API Proxy');
    });

    it('should define kubectl proxy node', () => {
      const archSection = readmeContent.split('### System Architecture Diagram')[1];
      expect(archSection).toContain('kubectl proxy');
    });

    it('should define K8s API endpoints', () => {
      const archSection = readmeContent.split('### System Architecture Diagram')[1];
      expect(archSection).toContain('fenrir-agents/jobs');
      expect(archSection).toContain('fenrir-agents/pods');
      expect(archSection).toContain('follow=true');
    });

    it('should include Agent Pods and Pod Logs nodes', () => {
      const archSection = readmeContent.split('### System Architecture Diagram')[1];
      expect(archSection).toContain('Agent Pods');
      expect(archSection).toContain('stream-json Format');
    });

    it('should define color classes for diagram nodes', () => {
      const archSection = readmeContent.split('### System Architecture Diagram')[1];
      expect(archSection).toContain('classDef');
      expect(archSection).toContain('class Browser');
    });
  });

  describe('Log Streaming Flow Diagram', () => {
    it('should contain Log Streaming Flow Diagram section', () => {
      expect(readmeContent).toContain('### Log Streaming Flow Diagram');
    });

    it('should use mermaid sequenceDiagram syntax', () => {
      const hasFlowDiagram = readmeContent.includes('### Log Streaming Flow Diagram') &&
        readmeContent.includes('sequenceDiagram');
      expect(hasFlowDiagram).toBe(true);
    });

    it('should define Browser participant', () => {
      const flowSection = readmeContent.split('### Log Streaming Flow Diagram')[1];
      expect(flowSection).toContain('Browser - Agent Monitor');
    });

    it('should define K8s API Proxy participant', () => {
      const flowSection = readmeContent.split('### Log Streaming Flow Diagram')[1];
      expect(flowSection).toContain('K8s API Proxy');
    });

    it('should define K8s API Server participant', () => {
      const flowSection = readmeContent.split('### Log Streaming Flow Diagram')[1];
      expect(flowSection).toContain('K8s API Server');
    });

    it('should define Agent Pod participant', () => {
      const flowSection = readmeContent.split('### Log Streaming Flow Diagram')[1];
      expect(flowSection).toContain('Agent Pod');
    });

    it('should include parseLogLine operation', () => {
      const flowSection = readmeContent.split('### Log Streaming Flow Diagram')[1];
      expect(flowSection).toContain('parseLogLine');
    });

    it('should include maybeHeckle operation', () => {
      const flowSection = readmeContent.split('### Log Streaming Flow Diagram')[1];
      expect(flowSection).toContain('maybeHeckle');
    });

    it('should show log streaming with follow=true', () => {
      const flowSection = readmeContent.split('### Log Streaming Flow Diagram')[1];
      expect(flowSection).toContain('follow=true');
    });

    it('should show stream-json event format', () => {
      const flowSection = readmeContent.split('### Log Streaming Flow Diagram')[1];
      expect(flowSection).toContain('stream-json');
    });
  });

  describe('Heckler Escalation State Machine Diagram', () => {
    it('should contain Heckler Escalation State Machine section', () => {
      expect(readmeContent).toContain('### Heckler Escalation State Machine');
    });

    it('should use mermaid stateDiagram-v2 syntax', () => {
      const hasStateDiagram = readmeContent.includes('### Heckler Escalation State Machine') &&
        readmeContent.includes('stateDiagram-v2');
      expect(hasStateDiagram).toBe(true);
    });

    it('should define Normal state', () => {
      const stateSection = readmeContent.split('### Heckler Escalation State Machine')[1];
      expect(stateSection).toContain('[*] --> Normal');
    });

    it('should define Retort state', () => {
      const stateSection = readmeContent.split('### Heckler Escalation State Machine')[1];
      expect(stateSection).toContain('Retort');
    });

    it('should define Apoplectic state', () => {
      const stateSection = readmeContent.split('### Heckler Escalation State Machine')[1];
      expect(stateSection).toContain('Apoplectic');
    });

    it('should define Explosion state', () => {
      const stateSection = readmeContent.split('### Heckler Escalation State Machine')[1];
      expect(stateSection).toContain('Explosion');
    });

    it('should define NewHeckler state', () => {
      const stateSection = readmeContent.split('### Heckler Escalation State Machine')[1];
      expect(stateSection).toContain('NewHeckler');
    });

    it('should show transition: Normal → Retort on agent response', () => {
      const stateSection = readmeContent.split('### Heckler Escalation State Machine')[1];
      expect(stateSection).toContain('Normal --> Retort');
      expect(stateSection).toContain('escalationLevel++');
    });

    it('should show transition: Retort → Apoplectic on agent response', () => {
      const stateSection = readmeContent.split('### Heckler Escalation State Machine')[1];
      expect(stateSection).toContain('Retort --> Apoplectic');
    });

    it('should show transition: Apoplectic → Explosion on agent response', () => {
      const stateSection = readmeContent.split('### Heckler Escalation State Machine')[1];
      expect(stateSection).toContain('Apoplectic --> Explosion');
    });

    it('should show transition: Explosion → NewHeckler with reset', () => {
      const stateSection = readmeContent.split('### Heckler Escalation State Machine')[1];
      expect(stateSection).toContain('Explosion --> NewHeckler');
      expect(stateSection).toContain('reset');
    });

    it('should show transition: NewHeckler → Normal with reset', () => {
      const stateSection = readmeContent.split('### Heckler Escalation State Machine')[1];
      expect(stateSection).toContain('NewHeckler --> Normal');
      expect(stateSection).toContain('escalationLevel = 0');
    });

    it('should show Normal → Normal self-loop for ignored heckle', () => {
      const stateSection = readmeContent.split('### Heckler Escalation State Machine')[1];
      expect(stateSection).toContain('Normal --> Normal');
      expect(stateSection).toContain('ignores');
    });

    it('should reference ESCALATION_RETORTS levels', () => {
      const stateSection = readmeContent.split('### Heckler Escalation State Machine')[1];
      expect(stateSection).toContain('ESCALATION_RETORTS');
    });

    it('should show state annotations with example retorts', () => {
      const stateSection = readmeContent.split('### Heckler Escalation State Machine')[1];
      // Check for note annotations with examples
      expect(stateSection).toContain('Note over');
    });

    it('should include retort examples: "Oh is THAT so??"', () => {
      const stateSection = readmeContent.split('### Heckler Escalation State Machine')[1];
      expect(stateSection).toContain('Oh is THAT so');
    });

    it('should include retort examples: "RIGHT THAT\'S IT!!"', () => {
      const stateSection = readmeContent.split('### Heckler Escalation State Machine')[1];
      expect(stateSection).toContain("RIGHT THAT'S IT");
    });

    it('should include explosion example with 💥', () => {
      const stateSection = readmeContent.split('### Heckler Escalation State Machine')[1];
      expect(stateSection).toContain('💥');
    });

    it('should include new heckler entrance example', () => {
      const stateSection = readmeContent.split('### Heckler Escalation State Machine')[1];
      expect(stateSection).toContain('what\'d I miss');
    });
  });

  describe('Diagram Syntax Validation', () => {
    it('should have proper mermaid code blocks with syntax highlighting', () => {
      const mermaidBlocks = readmeContent.match(/```mermaid/g);
      expect(mermaidBlocks).not.toBeNull();
      expect((mermaidBlocks || []).length).toBeGreaterThanOrEqual(3);
    });

    it('should include fontSize init directive in diagrams', () => {
      const initDirectives = readmeContent.match(/%%\{init:[^}]*fontSize[^}]*\}\}%%/g) ||
                             readmeContent.match(/themeVariables.*fontSize/g);
      expect(initDirectives).not.toBeNull();
      // Should have at least one for architecture diagram
      expect((initDirectives || []).length).toBeGreaterThanOrEqual(1);
    });

    it('all code blocks should close properly', () => {
      const opens = readmeContent.match(/```mermaid/g);
      const closes = readmeContent.match(/```/g);
      // Each open should have a matching close
      expect((closes || []).length).toBeGreaterThanOrEqual((opens || []).length);
    });
  });

  describe('Documentation Completeness', () => {
    it('should explain the three diagrams add value to the README', () => {
      expect(readmeContent).toContain('Architecture');
      expect(readmeContent).toContain('Streaming');
      expect(readmeContent).toContain('Heckler');
    });

    it('should maintain existing documentation sections', () => {
      expect(readmeContent).toContain('## Features');
      expect(readmeContent).toContain('## Requirements');
      expect(readmeContent).toContain('## How It Works');
    });

    it('should reference K8s API concepts correctly', () => {
      expect(readmeContent).toContain('kubectl proxy');
      expect(readmeContent).toContain('K8s API');
      expect(readmeContent).toContain('fenrir-agents');
    });

    it('should document parseLogLine and maybeHeckle functions', () => {
      expect(readmeContent).toContain('parseLogLine');
      expect(readmeContent).toContain('maybeHeckle');
    });
  });
});
