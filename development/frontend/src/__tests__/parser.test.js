/**
 * Log Parser Tests — Vitest unit tests for parser.js
 */

import { describe, it, expect } from "vitest";
import {
  trunc,
  stripMd,
  toolSummary,
  parseSessionId,
  formatLine,
  processLogLine,
  COLORS,
} from "../../../agent-monitor/parser.js";

describe("trunc", () => {
  it("should return empty string for falsy input", () => {
    expect(trunc(null)).toBe("");
    expect(trunc(undefined)).toBe("");
    expect(trunc("")).toBe("");
  });

  it("should return full string if shorter than limit", () => {
    expect(trunc("hello", 10)).toBe("hello");
  });

  it("should truncate and add ellipsis if longer than limit", () => {
    expect(trunc("hello world", 5)).toBe("hello…");
  });

  it("should use default limit of 200", () => {
    const long = "a".repeat(250);
    const result = trunc(long);
    expect(result.length).toBe(201); // 200 + ellipsis
    expect(result.endsWith("…")).toBe(true);
  });

  it("should convert to string if given non-string", () => {
    expect(trunc(12345, 3)).toBe("123…");
  });
});

describe("stripMd", () => {
  it("should remove bold markdown", () => {
    expect(stripMd("**hello**")).toBe("hello");
    expect(stripMd("**bold** text")).toBe("bold text");
  });

  it("should remove italic markdown", () => {
    expect(stripMd("*italic*")).toBe("italic");
  });

  it("should remove inline code backticks", () => {
    expect(stripMd("`code`")).toBe("code");
  });

  it("should remove heading markers", () => {
    expect(stripMd("# Heading 1")).toBe("Heading 1");
    expect(stripMd("## Heading 2")).toBe("Heading 2");
    expect(stripMd("### Heading 3")).toBe("Heading 3");
  });

  it("should convert list items to bullets", () => {
    expect(stripMd("- item 1")).toBe("  • item 1");
    expect(stripMd("* item 2")).toBe("  • item 2");
  });

  it("should remove link syntax and keep text", () => {
    expect(stripMd("[Google](https://google.com)")).toBe("Google");
  });

  it("should handle complex mixed markdown", () => {
    const input = "**Bold** and *italic* with `code` and [link](https://example.com)";
    const output = stripMd(input);
    expect(output).toContain("Bold");
    expect(output).toContain("italic");
    expect(output).toContain("code");
    expect(output).toContain("link");
  });
});

describe("toolSummary", () => {
  it("should extract Bash command description", () => {
    const result = toolSummary({
      name: "Bash",
      input: { description: "List files", command: "ls -la" },
    });
    expect(result).toBe("List files");
  });

  it("should fall back to command for Bash if no description", () => {
    const result = toolSummary({
      name: "Bash",
      input: { command: "echo hello" },
    });
    expect(result).toBe("echo hello");
  });

  it("should strip repo path from Read tool", () => {
    const result = toolSummary({
      name: "Read",
      input: { file_path: "/workspace/repo/src/main.ts" },
    });
    expect(result).toBe("src/main.ts");
  });

  it("should handle Glob pattern", () => {
    const result = toolSummary({
      name: "Glob",
      input: { pattern: "**/*.ts" },
    });
    expect(result).toBe("**/*.ts");
  });

  it("should handle Grep with pattern and path", () => {
    const result = toolSummary({
      name: "Grep",
      input: { pattern: "export function", glob: "**/*.ts" },
    });
    expect(result).toContain("export function");
    expect(result).toContain("**/*.ts");
  });

  it("should handle unknown tool with fallback", () => {
    const result = toolSummary({
      name: "UnknownTool",
      input: { foo: "bar", baz: "qux value" },
    });
    expect(result).toBeDefined();
  });
});

describe("parseSessionId", () => {
  it("should parse standard job name format", () => {
    const result = parseSessionId("agent-issue-743-step1-firemandecko-abc123");
    expect(result.issue).toBe("743");
    expect(result.step).toBe("1");
    expect(result.agent).toBe("firemandecko");
  });

  it("should handle job names without agent prefix", () => {
    const result = parseSessionId("issue-100-step2-loki-xyz");
    expect(result.issue).toBe("100");
    expect(result.step).toBe("2");
    expect(result.agent).toBe("loki");
  });

  it("should return defaults for malformed input", () => {
    const result = parseSessionId("invalid-job-name");
    expect(result.issue).toBe("?");
    expect(result.step).toBe("?");
    expect(result.agent).toBe("?");
  });
});

describe("formatLine", () => {
  it("should format system init message", () => {
    const obj = {
      type: "system",
      subtype: "init",
      model: "claude-opus-4-6",
    };
    const result = formatLine(obj);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("system");
    expect(result[0].icon).toBe("⚙");
    expect(result[0].content[0]).toContain("claude-opus-4-6");
  });

  it("should format assistant text message", () => {
    const obj = {
      type: "assistant",
      message: {
        content: [
          { type: "text", text: "Hello, world!" },
        ],
      },
    };
    const result = formatLine(obj);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("agent");
    expect(result[0].icon).toBe("🤖");
    expect(result[0].content[0]).toContain("Hello");
  });

  it("should format tool_use blocks", () => {
    const obj = {
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Bash",
            input: { description: "Run tests", command: "npm test" },
          },
        ],
      },
    };
    const result = formatLine(obj);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("tool");
    expect(result[0].icon).toBe("🔧");
  });

  it("should format tool_result", () => {
    const obj = {
      type: "tool_result",
      content: "Tests passed",
    };
    const result = formatLine(obj);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("result");
    expect(result[0].icon).toBe("←");
    expect(result[0].content[0]).toContain("Tests passed");
  });

  it("should format session result", () => {
    const obj = {
      type: "result",
      cost_usd: 0.5,
      duration_seconds: 120,
      num_turns: 5,
    };
    const result = formatLine(obj);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("session_complete");
    expect(result[0].icon).toBe("🏁");
    expect(result[0].content[0]).toContain("$0.50");
    expect(result[0].content[0]).toContain("2m");
    expect(result[0].content[0]).toContain("5");
  });

  it("should ignore messages without text content", () => {
    const obj = {
      type: "assistant",
      message: {
        content: [],
      },
    };
    const result = formatLine(obj);
    expect(result).toHaveLength(0);
  });
});

describe("processLogLine", () => {
  it("should return plain text for non-JSON lines", () => {
    const result = processLogLine("This is plain text");
    expect(result.type).toBe("plain");
    expect(result.content).toBe("This is plain text");
  });

  it("should parse and format valid JSONL", () => {
    const line = JSON.stringify({
      type: "system",
      subtype: "init",
      model: "test-model",
    });
    const result = processLogLine(line);
    expect(result.type).toBe("formatted");
    expect(result.fragments).toHaveLength(1);
    expect(result.fragments[0].type).toBe("system");
  });

  it("should handle malformed JSON", () => {
    const result = processLogLine("{invalid json");
    expect(result.type).toBe("error");
    expect(result.content).toContain("Failed to parse");
  });

  it("should handle empty lines", () => {
    const result = processLogLine("");
    expect(result.type).toBe("plain");
  });
});

describe("COLORS", () => {
  it("should define all required color constants", () => {
    expect(COLORS.reset).toBeDefined();
    expect(COLORS.agent).toBeDefined();
    expect(COLORS.tool).toBeDefined();
    expect(COLORS.result).toBeDefined();
    expect(COLORS.system).toBeDefined();
    expect(COLORS.error).toBeDefined();
  });

  it("should all be hex color codes", () => {
    Object.values(COLORS).forEach(color => {
      expect(typeof color).toBe("string");
      // Should be 6-digit hex format
      expect(/^#[0-9a-f]{6}$|^#[0-9a-f]{3}$/i.test(color)).toBe(true);
    });
  });
});
