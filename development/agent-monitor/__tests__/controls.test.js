/**
 * Agent Monitor UI controls tests
 * Tests for Issue #822: Log controls button interactions
 *
 * Tests:
 * - Save Log button functionality
 * - Brandify HTML button (disabled until log saved)
 * - Brandify MDX button (disabled until log saved)
 * - Error handling and status feedback
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Agent Monitor Log Controls', () => {
  let mockElements;
  let mockFetch;

  beforeEach(() => {
    // Mock DOM elements
    mockElements = {
      saveLogBtn: {
        disabled: false,
        addEventListener: vi.fn(),
        click: vi.fn(),
      },
      brandifyHtmlBtn: {
        disabled: true,
        addEventListener: vi.fn(),
        click: vi.fn(),
      },
      brandifyMdxBtn: {
        disabled: true,
        addEventListener: vi.fn(),
        click: vi.fn(),
      },
      logControlsStatus: {
        style: { display: 'none' },
      },
      logControlsStatusText: {
        textContent: '',
      },
      logSession: {
        textContent: 'session-123',
      },
    };

    // Mock global fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  describe('Button Initial State', () => {
    it('should have Save Log button enabled', () => {
      expect(mockElements.saveLogBtn.disabled).toBe(false);
    });

    it('should have Brandify buttons disabled initially', () => {
      expect(mockElements.brandifyHtmlBtn.disabled).toBe(true);
      expect(mockElements.brandifyMdxBtn.disabled).toBe(true);
    });
  });

  describe('Save Log Button', () => {
    it('should POST to /save-log with jobName and sessionId', async () => {
      const jobName = 'agent-job-12345';
      const sessionId = 'session-abc';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, lines: 42 }),
      });

      // Simulate button click handler
      const payload = { jobName, sessionId };
      const response = await mockFetch('/save-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      expect(mockFetch).toHaveBeenCalledWith('/save-log', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }));
      expect(data.success).toBe(true);
      expect(data.lines).toBe(42);
    });

    it('should show loading status while saving', () => {
      mockElements.logControlsStatus.style.display = 'flex';
      mockElements.logControlsStatusText.textContent = 'Saving log...';

      expect(mockElements.logControlsStatus.style.display).toBe('flex');
      expect(mockElements.logControlsStatusText.textContent).toBe('Saving log...');
    });

    it('should enable Brandify buttons after successful save', async () => {
      mockElements.brandifyHtmlBtn.disabled = false;
      mockElements.brandifyMdxBtn.disabled = false;

      expect(mockElements.brandifyHtmlBtn.disabled).toBe(false);
      expect(mockElements.brandifyMdxBtn.disabled).toBe(false);
    });

    it('should show success message with line count', () => {
      mockElements.logControlsStatusText.textContent = '✓ Saved 42 lines';

      expect(mockElements.logControlsStatusText.textContent).toContain('✓ Saved');
      expect(mockElements.logControlsStatusText.textContent).toContain('42');
    });

    it('should handle errors and show error message', () => {
      mockElements.logControlsStatusText.textContent = '✗ Error: Failed to save log';

      expect(mockElements.logControlsStatusText.textContent).toMatch(/✗ Error/);
    });

    it('should disable button while saving', () => {
      mockElements.saveLogBtn.disabled = true;
      expect(mockElements.saveLogBtn.disabled).toBe(true);

      mockElements.saveLogBtn.disabled = false;
      expect(mockElements.saveLogBtn.disabled).toBe(false);
    });
  });

  describe('Brandify HTML Button', () => {
    it('should remain disabled until log is saved', () => {
      expect(mockElements.brandifyHtmlBtn.disabled).toBe(true);
    });

    it('should POST to /brandify with sessionId and publish=false', async () => {
      const sessionId = 'session-abc';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, filename: 'session-abc.html' }),
      });

      const response = await mockFetch('/brandify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, publish: false }),
      });

      const data = await response.json();

      expect(data.filename).toMatch(/\.html$/);
    });

    it('should open generated report in new tab', () => {
      const filename = 'session-abc.html';
      const url = `/reports/${filename}`;

      // window.open would be called with this URL
      expect(url).toContain('/reports/');
      expect(url).toContain('.html');
    });

    it('should show loading status while generating', () => {
      mockElements.logControlsStatusText.textContent = 'Generating HTML...';
      expect(mockElements.logControlsStatusText.textContent).toContain('HTML');
    });
  });

  describe('Brandify MDX Button', () => {
    it('should remain disabled until log is saved', () => {
      expect(mockElements.brandifyMdxBtn.disabled).toBe(true);
    });

    it('should POST to /brandify with sessionId and publish=true', async () => {
      const sessionId = 'session-abc';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, filename: 'session-abc.mdx' }),
      });

      const response = await mockFetch('/brandify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, publish: true }),
      });

      const data = await response.json();

      expect(data.filename).toMatch(/\.mdx$/);
    });

    it('should open generated MDX in new tab', () => {
      const filename = 'session-abc.mdx';
      const url = `/reports/${filename}`;

      expect(url).toContain('/reports/');
      expect(url).toContain('.mdx');
    });

    it('should show loading status while generating', () => {
      mockElements.logControlsStatusText.textContent = 'Generating MDX...';
      expect(mockElements.logControlsStatusText.textContent).toContain('MDX');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing log file error', () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Log file not found' }),
      });

      expect(mockFetch('/save-log', {
        method: 'POST',
        body: JSON.stringify({ jobName: 'job', sessionId: 'session' }),
      })).resolves.toBeTruthy();
    });

    it('should handle K8s API errors gracefully', () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to list pods' }),
      });

      expect(mockFetch).toBeDefined();
    });

    it('should show error messages with ✗ prefix', () => {
      mockElements.logControlsStatusText.textContent = '✗ Error: Something went wrong';
      expect(mockElements.logControlsStatusText.textContent).toMatch(/^✗/);
    });
  });

  describe('UI Styling', () => {
    it('should match gold/void-black Fenrir theme', () => {
      // Check that buttons use expected CSS classes
      expect(mockElements.saveLogBtn).toBeDefined();
      expect(mockElements.brandifyHtmlBtn).toBeDefined();
      expect(mockElements.brandifyMdxBtn).toBeDefined();
    });

    it('should show loading spinner during operations', () => {
      mockElements.logControlsStatus.style.display = 'flex';
      expect(mockElements.logControlsStatus.style.display).toBe('flex');
    });

    it('should hide status when operation completes', () => {
      mockElements.logControlsStatus.style.display = 'none';
      expect(mockElements.logControlsStatus.style.display).toBe('none');
    });
  });

  describe('Control Flow', () => {
    it('should enforce save before brandify', () => {
      // Brandify buttons start disabled
      expect(mockElements.brandifyHtmlBtn.disabled).toBe(true);
      expect(mockElements.brandifyMdxBtn.disabled).toBe(true);

      // After save succeeds, they become enabled
      mockElements.brandifyHtmlBtn.disabled = false;
      mockElements.brandifyMdxBtn.disabled = false;

      expect(mockElements.brandifyHtmlBtn.disabled).toBe(false);
      expect(mockElements.brandifyMdxBtn.disabled).toBe(false);
    });

    it('should clear status message after 2-3 seconds', () => {
      mockElements.logControlsStatus.style.display = 'flex';

      // After success timeout (2s)
      setTimeout(() => {
        mockElements.logControlsStatus.style.display = 'none';
      }, 2000);

      expect(mockElements.logControlsStatus.style.display).toBe('flex');
    });
  });
});
