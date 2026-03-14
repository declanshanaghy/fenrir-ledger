/**
 * Integration tests for generate-agent-report.mjs --publish mode.
 *
 * Creates a minimal agent log, runs the script with --publish,
 * and verifies the MDX output has correct frontmatter and structure.
 *
 * Refs: Issue #738
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockLog(): string {
  // Minimal stream-json log with entrypoint, system event, and one assistant turn
  const entrypoint = [
    "Session: issue-999-step1-fireman-abc123",
    "Branch: fix/issue-999-test",
    "Model: claude-opus-4-6",
    "",
  ].join("\n");

  const systemEvent = JSON.stringify({
    type: "system",
    subtype: "init",
    session_id: "abc123",
  });

  const assistantEvent = JSON.stringify({
    type: "assistant",
    message: {
      id: "msg_001",
      content: [
        { type: "text", text: "Hello, starting work on issue #999." },
        {
          type: "tool_use",
          id: "tu_001",
          name: "Read",
          input: { file_path: "/workspace/repo/README.md" },
        },
      ],
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 200,
      },
    },
  });

  const userEvent = JSON.stringify({
    type: "user",
    message: {
      content: [
        {
          type: "tool_result",
          tool_use_id: "tu_001",
          content: "# Fenrir Ledger\nA project readme.",
        },
      ],
    },
  });

  return [entrypoint, systemEvent, assistantEvent, userEvent].join("\n");
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("generate-agent-report --publish", () => {
  let tmpDir: string;
  let logFile: string;
  let blogDir: string;
  const scriptPath = join(
    process.cwd(),
    "../../.claude/skills/brandify-agent/scripts/generate-agent-report.mjs"
  );

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "agent-report-test-"));
    logFile = join(tmpDir, "issue-999-step1-fireman-abc123.log");
    blogDir = join(tmpDir, "blog");

    // Create blog dir and log file
    execSync(`mkdir -p "${blogDir}"`);
    writeFileSync(logFile, createMockLog());
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("generates MDX file with correct frontmatter", () => {
    execSync(
      `node "${scriptPath}" --input "${logFile}" --publish --blog-dir "${blogDir}"`,
      { timeout: 15000 }
    );

    // Find the generated MDX file
    const expectedSlug = "agent-issue-999-step1-fireman-abc123";
    const mdxPath = join(blogDir, `${expectedSlug}.mdx`);

    expect(existsSync(mdxPath)).toBe(true);

    const content = readFileSync(mdxPath, "utf-8");

    // Verify frontmatter fields
    expect(content).toMatch(/^---/);
    expect(content).toContain('category: "agent"');
    expect(content).toContain('rune: "ᚲ"');
    expect(content).toContain(`slug: "${expectedSlug}"`);
    expect(content).toContain("title:");
    expect(content).toContain("date:");
    expect(content).toContain("excerpt:");
  });

  it("generates MDX with chronicle-page wrapper", () => {
    const expectedSlug = "agent-issue-999-step1-fireman-abc123";
    const mdxPath = join(blogDir, `${expectedSlug}.mdx`);
    const content = readFileSync(mdxPath, "utf-8");

    expect(content).toContain('className="chronicle-page"');
    expect(content).toContain('className="agent-report"');
  });

  it("includes collapsible turns with details/summary elements", () => {
    const expectedSlug = "agent-issue-999-step1-fireman-abc123";
    const mdxPath = join(blogDir, `${expectedSlug}.mdx`);
    const content = readFileSync(mdxPath, "utf-8");

    expect(content).toContain('className="agent-turn"');
    expect(content).toContain("<details");
    expect(content).toContain("<summary");
  });

  it("includes agent stats grid", () => {
    const expectedSlug = "agent-issue-999-step1-fireman-abc123";
    const mdxPath = join(blogDir, `${expectedSlug}.mdx`);
    const content = readFileSync(mdxPath, "utf-8");

    expect(content).toContain('className="agent-stats"');
    expect(content).toContain("Turns");
    expect(content).toContain("Tool Calls");
  });

  it("includes agent report badge", () => {
    const expectedSlug = "agent-issue-999-step1-fireman-abc123";
    const mdxPath = join(blogDir, `${expectedSlug}.mdx`);
    const content = readFileSync(mdxPath, "utf-8");

    expect(content).toContain("Agent Report");
    expect(content).toContain('className="agent-report-badge"');
  });

  it("escapes JSX-unsafe characters in content", () => {
    const expectedSlug = "agent-issue-999-step1-fireman-abc123";
    const mdxPath = join(blogDir, `${expectedSlug}.mdx`);
    const content = readFileSync(mdxPath, "utf-8");

    // Curly braces should be escaped in MDX content
    // The tool input JSON would contain { and } which need escaping
    expect(content).not.toMatch(/\{[^"&]/); // No unescaped { except in className=""
  });
});
