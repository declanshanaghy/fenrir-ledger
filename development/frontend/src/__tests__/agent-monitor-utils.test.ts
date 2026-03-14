import { describe, it, expect } from 'vitest';

/**
 * Unit tests for Agent Monitor SPA utility functions.
 * Tests parsing, formatting, and validation logic.
 */

// Utility implementations (would be extracted to separate module in production)

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

const SESSION_ID_REGEX = /^issue-(\d+)-step(\d+)-(\w+)-[a-f0-9]+$/;

interface SessionData {
  issue: string;
  step: string;
  agent: string;
}

function parseSessionId(sessionId: string): SessionData | null {
  const match = sessionId.match(SESSION_ID_REGEX);
  if (!match) return null;
  return {
    issue: match[1],
    step: match[2],
    agent: match[3],
  };
}

const JOB_NAME_REGEX = /^agent-[a-z0-9-]{1,60}$/;

function validateJobName(jobName: string): boolean {
  return JOB_NAME_REGEX.test(jobName);
}

interface LogEvent {
  type: 'system' | 'text' | 'tool_use' | 'tool_result' | 'result' | 'error';
  text?: string;
  tool?: string;
  input?: string;
  success?: boolean;
  output?: string;
  cost?: number;
  tokens?: number;
  duration?: number;
  message?: string;
}

interface StreamJsonEvent {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool?: string;
  content?: string;
  isError?: boolean;
  message?: string;
  usage?: {
    cache_read_input_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
  };
  duration?: number;
}

function parseStreamJsonEvent(json: StreamJsonEvent): LogEvent | null {
  if (json.type === 'text') {
    return {
      type: 'text',
      text: json.text || '',
    };
  } else if (json.type === 'tool_use') {
    return {
      type: 'tool_use',
      tool: json.name || 'unknown',
      input: JSON.stringify(json.input || {}, null, 2),
    };
  } else if (json.type === 'tool_result') {
    return {
      type: 'tool_result',
      tool: json.tool || 'unknown',
      success: json.isError === false,
      output: typeof json.content === 'string'
        ? json.content
        : JSON.stringify(json.content || {}, null, 2),
    };
  } else if (json.type === 'result') {
    return {
      type: 'result',
      cost: json.usage?.cache_read_input_tokens || 0,
      tokens: (json.usage?.input_tokens || 0) + (json.usage?.output_tokens || 0),
      duration: json.duration || 0,
    };
  } else if (json.type === 'error') {
    return {
      type: 'error',
      message: json.message || JSON.stringify(json),
    };
  } else if (json.type === 'system') {
    return {
      type: 'system',
      text: json.text || JSON.stringify(json),
    };
  }

  return null;
}

// ========================================================================
// Tests
// ========================================================================

describe('formatDuration', () => {
  it('handles null and undefined', () => {
    expect(formatDuration(null)).toBe('-');
    expect(formatDuration(undefined)).toBe('-');
    expect(formatDuration(0)).toBe('-');
  });

  it('formats seconds only', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(1)).toBe('1s');
    expect(formatDuration(59)).toBe('59s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(60)).toBe('1m 0s');
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(3599)).toBe('59m 59s');
  });

  it('formats hours, minutes, and seconds', () => {
    expect(formatDuration(3600)).toBe('1h 0m 0s');
    expect(formatDuration(3661)).toBe('1h 1m 1s');
    expect(formatDuration(7322)).toBe('2h 2m 2s');
  });

  it('handles large durations', () => {
    expect(formatDuration(86400)).toBe('24h 0m 0s'); // 1 day
  });
});

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<div>test</div>')).toBe('&lt;div&gt;test&lt;/div&gt;');
  });

  it('escapes quotes', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('escapes apostrophes', () => {
    expect(escapeHtml("it's mine")).toBe('it&#039;s mine');
  });

  it('handles multiple special chars', () => {
    expect(escapeHtml('<script>alert("xss")</script>'))
      .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('passes safe text through', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('handles mixed content', () => {
    expect(escapeHtml('a & b <c> "d" \'e\''))
      .toBe('a &amp; b &lt;c&gt; &quot;d&quot; &#039;e&#039;');
  });
});

describe('parseSessionId', () => {
  it('parses valid session IDs', () => {
    const result = parseSessionId('issue-743-step1-firemandecko-91a12936');
    expect(result).toEqual({
      issue: '743',
      step: '1',
      agent: 'firemandecko',
    });
  });

  it('handles multiple-digit issue and step numbers', () => {
    const result = parseSessionId('issue-12345-step99-loki-abcdef01');
    expect(result).toEqual({
      issue: '12345',
      step: '99',
      agent: 'loki',
    });
  });

  it('handles various agent names', () => {
    const result = parseSessionId('issue-1-step1-MyAgent123-abc123ef');
    expect(result).toEqual({
      issue: '1',
      step: '1',
      agent: 'MyAgent123',
    });
  });

  it('returns null for invalid session IDs', () => {
    expect(parseSessionId('invalid-format')).toBeNull();
    expect(parseSessionId('issue-abc-step1-agent-hash')).toBeNull();
    expect(parseSessionId('step1-firemandecko-hash')).toBeNull();
    expect(parseSessionId('')).toBeNull();
  });

  it('requires valid hash format', () => {
    // Hash must be hex characters
    expect(parseSessionId('issue-1-step1-agent-GHIJKL')).toBeNull();
    expect(parseSessionId('issue-1-step1-agent-abcdef')).not.toBeNull();
  });
});

describe('validateJobName', () => {
  it('accepts valid job names', () => {
    expect(validateJobName('agent-test')).toBe(true);
    expect(validateJobName('agent-issue-743-step1-firemandecko-91a12936')).toBe(true);
    expect(validateJobName('agent-a')).toBe(true);
    expect(validateJobName('agent-' + 'a'.repeat(58))).toBe(true);
  });

  it('rejects names without agent- prefix', () => {
    expect(validateJobName('job-test')).toBe(false);
    expect(validateJobName('test')).toBe(false);
    expect(validateJobName('agent')).toBe(false);
  });

  it('rejects names with uppercase', () => {
    expect(validateJobName('Agent-test')).toBe(false);
    expect(validateJobName('agent-Test')).toBe(false);
    expect(validateJobName('AGENT-TEST')).toBe(false);
  });

  it('rejects names that are too long', () => {
    expect(validateJobName('agent-' + 'a'.repeat(56))).toBe(false); // Over 60 chars
  });

  it('rejects names with invalid characters', () => {
    expect(validateJobName('agent-test_job')).toBe(false);
    expect(validateJobName('agent-test.job')).toBe(false);
    expect(validateJobName('agent-test job')).toBe(false);
    expect(validateJobName('agent-test@job')).toBe(false);
  });

  it('accepts names with hyphens and numbers', () => {
    expect(validateJobName('agent-test-123')).toBe(true);
    expect(validateJobName('agent-1-2-3')).toBe(true);
  });
});

describe('parseStreamJsonEvent', () => {
  it('parses text events', () => {
    const result = parseStreamJsonEvent({
      type: 'text',
      text: 'Hello, world!',
    });
    expect(result).toEqual({
      type: 'text',
      text: 'Hello, world!',
    });
  });

  it('parses tool_use events', () => {
    const result = parseStreamJsonEvent({
      type: 'tool_use',
      name: 'bash',
      input: { command: 'ls -la' },
    });
    expect(result).toEqual({
      type: 'tool_use',
      tool: 'bash',
      input: JSON.stringify({ command: 'ls -la' }, null, 2),
    });
  });

  it('parses tool_result events', () => {
    const result = parseStreamJsonEvent({
      type: 'tool_result',
      tool: 'bash',
      content: 'total 48',
      isError: false,
    });
    expect(result).toEqual({
      type: 'tool_result',
      tool: 'bash',
      success: true,
      output: 'total 48',
    });
  });

  it('parses tool_result error events', () => {
    const result = parseStreamJsonEvent({
      type: 'tool_result',
      tool: 'bash',
      content: 'command not found',
      isError: true,
    });
    expect(result).toEqual({
      type: 'tool_result',
      tool: 'bash',
      success: false,
      output: 'command not found',
    });
  });

  it('parses result events', () => {
    const result = parseStreamJsonEvent({
      type: 'result',
      usage: {
        cache_read_input_tokens: 100,
        input_tokens: 500,
        output_tokens: 200,
      },
      duration: 2500,
    });
    expect(result).toEqual({
      type: 'result',
      cost: 100,
      tokens: 700,
      duration: 2500,
    });
  });

  it('parses error events', () => {
    const result = parseStreamJsonEvent({
      type: 'error',
      message: 'Invalid input',
    });
    expect(result).toEqual({
      type: 'error',
      message: 'Invalid input',
    });
  });

  it('parses system events', () => {
    const result = parseStreamJsonEvent({
      type: 'system',
      text: 'System initialized',
    });
    expect(result).toEqual({
      type: 'system',
      text: 'System initialized',
    });
  });

  it('handles missing fields gracefully', () => {
    const result = parseStreamJsonEvent({
      type: 'tool_use',
      name: 'test',
    });
    expect(result?.type).toBe('tool_use');
    expect(result?.tool).toBe('test');
  });

  it('returns null for unknown event types', () => {
    const result = parseStreamJsonEvent({
      type: 'unknown_type',
    });
    expect(result).toBeNull();
  });
});

describe('Integration: Session ID parsing from job names', () => {
  it('extracts session data from typical job name', () => {
    const jobName = 'agent-issue-743-step1-firemandecko-91a12936';
    const sessionId = jobName.split('-').slice(1).join('-');
    const sessionData = parseSessionId(sessionId);

    expect(sessionData).toEqual({
      issue: '743',
      step: '1',
      agent: 'firemandecko',
    });
  });

  it('handles jobs with hyphens in session names', () => {
    const jobName = 'agent-issue-100-step5-my-agent-name-aabbccdd';
    const sessionId = jobName.split('-').slice(1).join('-');

    expect(validateJobName(jobName)).toBe(true);
  });
});

describe('Edge cases and security', () => {
  it('HTML escape prevents XSS in log display', () => {
    const malicious = '<img src=x onerror="alert(\'xss\')">';
    const escaped = escapeHtml(malicious);
    expect(escaped).not.toContain('<img');
    expect(escaped).not.toContain('onerror');
  });

  it('handles very long input strings', () => {
    const longString = 'a'.repeat(10000);
    const escaped = escapeHtml(longString);
    expect(escaped).toBe(longString);
  });

  it('parseSessionId is case-sensitive', () => {
    // Only lowercase hex digits allowed
    expect(parseSessionId('issue-1-step1-agent-ABCDEF01')).toBeNull();
    expect(parseSessionId('issue-1-step1-agent-abcdef01')).not.toBeNull();
  });

  it('formatDuration handles negative numbers gracefully', () => {
    // Negative durations don't make sense, but shouldn't crash
    const result = formatDuration(-1);
    expect(result).toBeDefined();
  });
});
