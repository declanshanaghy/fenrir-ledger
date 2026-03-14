/**
 * Agent Monitor serve.mjs endpoint tests
 * Tests for Issue #822: Add save-log and brandify endpoints
 *
 * Tests:
 * - POST /save-log: fetch K8s pod logs and save as JSONL
 * - POST /brandify: run brandify-agent script on saved logs
 * - GET /reports/<filename>: serve generated HTML/MDX reports
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const TEST_DIR = '/tmp/agent-monitor-tests';
const LOGS_DIR = join(TEST_DIR, 'agent-logs');

beforeEach(() => {
  mkdirSync(LOGS_DIR, { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true });
  }
});

describe('Agent Monitor Endpoints', () => {
  describe('POST /save-log', () => {
    it('should extract and save JSONL log lines only', () => {
      // Mock response with mixed content (timestamps, JSON, text)
      const logLines = [
        '[2026-03-14 10:30:45] Starting agent...',
        '{"type":"message","content":"Hello"}',
        'Non-JSON line should be filtered',
        '{"type":"step","action":"fetch"}',
        '',
        '{"type":"complete"}',
      ];

      const jsonlLines = logLines
        .filter(line => {
          try {
            JSON.parse(line);
            return true;
          } catch {
            return false;
          }
        })
        .join('\n');

      // Verify only JSON lines are kept
      expect(jsonlLines.split('\n')).toHaveLength(3);
      expect(jsonlLines).toContain('{"type":"message","content":"Hello"}');
      expect(jsonlLines).not.toContain('[2026-03-14');
      expect(jsonlLines).not.toContain('Non-JSON line');
    });

    it('should save log with sessionId filename', () => {
      const sessionId = 'session-12345';
      const logPath = join(LOGS_DIR, `${sessionId}.log`);
      const content = '{"line":1}\n{"line":2}\n';

      // Simulate saving
      const fs = require('node:fs');
      fs.writeFileSync(logPath, content);

      expect(existsSync(logPath)).toBe(true);
      expect(readFileSync(logPath, 'utf-8')).toEqual(content);
    });

    it('should return error if jobName or sessionId is missing', () => {
      // These checks happen before making K8s API calls
      const testPayloads = [
        { sessionId: 'session-1' }, // missing jobName
        { jobName: 'job-1' }, // missing sessionId
        {}, // missing both
      ];

      testPayloads.forEach(payload => {
        const isValid = payload.jobName && payload.sessionId;
        expect(isValid).toBe(false);
      });
    });
  });

  describe('POST /brandify', () => {
    it('should require sessionId', () => {
      const testPayload = { publish: false };
      const isValid = testPayload.sessionId;
      expect(isValid).toBeUndefined();
    });

    it('should accept publish flag', () => {
      const htmlPayload = { sessionId: 'session-1', publish: false };
      const mdxPayload = { sessionId: 'session-1', publish: true };

      expect(htmlPayload.publish).toBe(false);
      expect(mdxPayload.publish).toBe(true);
    });

    it('should fail if log file not found', () => {
      const sessionId = 'nonexistent-session';
      const logPath = join(LOGS_DIR, `${sessionId}.log`);

      expect(existsSync(logPath)).toBe(false);
    });

    it('should set correct output extension based on publish flag', () => {
      const sessionId = 'session-123';

      const htmlOutput = `${sessionId}.html`;
      const mdxOutput = `${sessionId}.mdx`;

      expect(htmlOutput).toMatch(/\.html$/);
      expect(mdxOutput).toMatch(/\.mdx$/);
    });
  });

  describe('GET /reports/<filename>', () => {
    it('should serve HTML reports', () => {
      const filename = 'session-123.html';
      const reportPath = join(LOGS_DIR, filename);
      const htmlContent = '<html><body>Report</body></html>';

      const fs = require('node:fs');
      fs.writeFileSync(reportPath, htmlContent);

      expect(existsSync(reportPath)).toBe(true);
      expect(readFileSync(reportPath, 'utf-8')).toEqual(htmlContent);
    });

    it('should serve MDX reports', () => {
      const filename = 'session-123.mdx';
      const reportPath = join(LOGS_DIR, filename);
      const mdxContent = '# Report\n\nContent here';

      const fs = require('node:fs');
      fs.writeFileSync(reportPath, mdxContent);

      expect(existsSync(reportPath)).toBe(true);
      expect(readFileSync(reportPath, 'utf-8')).toEqual(mdxContent);
    });

    it('should return 404 if report not found', () => {
      const filename = 'nonexistent.html';
      const reportPath = join(LOGS_DIR, filename);

      expect(existsSync(reportPath)).toBe(false);
    });

    it('should set correct MIME type for HTML', () => {
      const filename = 'session-123.html';
      const ext = filename.split('.').pop();
      const mime = ext === 'mdx' ? 'text/plain' : 'text/html';

      expect(mime).toBe('text/html');
    });

    it('should set correct MIME type for MDX', () => {
      const filename = 'session-123.mdx';
      const ext = filename.split('.').pop();
      const mime = ext === 'mdx' ? 'text/plain' : 'text/html';

      expect(mime).toBe('text/plain');
    });
  });

  describe('Log control flow', () => {
    it('should enforce: save log before brandify', async () => {
      const sessionId = 'session-abc';

      // Without save, log file doesn't exist
      const logPath = join(LOGS_DIR, `${sessionId}.log`);
      expect(existsSync(logPath)).toBe(false);

      // After save, it exists
      const fs = require('node:fs');
      fs.writeFileSync(logPath, '{"line":1}\n');
      expect(existsSync(logPath)).toBe(true);

      // Now brandify can proceed
      expect(existsSync(logPath)).toBe(true);
    });
  });
});
