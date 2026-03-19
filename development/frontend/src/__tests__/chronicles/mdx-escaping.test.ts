/**
 * MDX content escaping tests — Issue #1452
 *
 * Validates that the JSON.stringify JSX expression approach used in
 * generate-agent-report.mjs correctly escapes MDX-special characters
 * ({, }, <, >) and triple backtick code fences so agent content never
 * breaks chronicle page rendering.
 *
 * Tests focus on the escaping contract (pure logic) and @mdx-js/mdx
 * compile behaviour — the two acceptance criteria that can be verified
 * without running the full CLI script.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// JSON.stringify escaping contract — pure unit tests
// ---------------------------------------------------------------------------

describe("JSON.stringify escaping contract for MDX JSX expressions", () => {
  it("encodes curly braces so they cannot break JSX expression syntax", () => {
    // Agent tool output with JSON objects: {"key": "value"}
    const dangerousContent = '{"tool": "Bash", "exit": 0, "output": {"ok": true}}';
    const encoded = JSON.stringify(dangerousContent);
    // Result must be a valid JS string literal (starts/ends with double quote)
    expect(encoded.startsWith('"')).toBe(true);
    expect(encoded.endsWith('"')).toBe(true);
    // The literal braces must be escaped so JSX sees a string, not an expression
    // JSON.stringify escapes nothing in this case — braces inside a JS string are safe
    // The key guarantee: when wrapped as {JSON.stringify(x)}, it is a JS string expression
    const jsxExpression = `{${encoded}}`;
    // Must not contain bare unquoted { or } that could confuse JSX
    // (The only braces should be the outer JSX expression delimiters)
    const inner = jsxExpression.slice(1, -1); // strip outer JSX { }
    expect(inner).toBe(encoded); // inner is the JS string literal
    expect(inner.startsWith('"')).toBe(true);
  });

  it("encodes angle brackets from TypeScript generics without breaking MDX", () => {
    // TypeScript code in tool output: const x: Record<string, number> = {}
    const tsCode = "const x: Record<string, number> = {}";
    const encoded = JSON.stringify(tsCode);
    // JSON.stringify does NOT escape < and > (they are safe in JSON strings)
    // but when embedded as {JSON.stringify(x)} in JSX they are safe because
    // JSX only interprets < as a tag at the START of an expression
    expect(encoded).toContain("<");
    expect(encoded).toContain(">");
    // The encoded value is a JS string literal — runtime renders the raw string
    // Verify the round-trip: JSON.parse(encoded) === original
    expect(JSON.parse(encoded)).toBe(tsCode);
  });

  it("encodes triple backtick code fences that would exit JSX string mode", () => {
    // The critical bug: raw triple backticks inside a JSX expression cause MDX remark
    // to exit JSX mode and re-interpret the rest as markdown — breaking the tree.
    const withCodeFence = "Here is code:\n```bash\necho hello\n```\nDone.";
    const encoded = JSON.stringify(withCodeFence);
    // JSON.stringify escapes newlines as \n — no raw newlines in the literal
    expect(encoded).not.toContain("\n```");
    expect(encoded).toContain("\\n");
    // Round-trip preserves content
    expect(JSON.parse(encoded)).toBe(withCodeFence);
  });

  it("encodes shell heredocs and template literals safely", () => {
    // Bash tool output with heredoc syntax
    const heredoc = "cat <<'EOF'\nkey=value\nEOF";
    const templateLiteral = "const msg = `Hello ${name}!`;";
    const encodedHeredoc = JSON.stringify(heredoc);
    const encodedTemplate = JSON.stringify(templateLiteral);
    // Both produce valid JS string literals
    expect(JSON.parse(encodedHeredoc)).toBe(heredoc);
    expect(JSON.parse(encodedTemplate)).toBe(templateLiteral);
    // Backticks in template literal — JSON.stringify does NOT need to escape them
    // (backticks are not special in JSON strings), but they cannot appear raw inside
    // a JSX string expression that uses JSON.stringify wrapping
    expect(encodedTemplate).toContain("`");
    // The safe way to embed: {JSON.stringify(content)} — the backtick is inside
    // a JS string literal, not interpreted as a template literal delimiter
  });
});

// ---------------------------------------------------------------------------
// @mdx-js/mdx compile behaviour — validates the AC-2 validation gate
// ---------------------------------------------------------------------------

async function compileMdx(source: string): Promise<void> {
  // @mdx-js/mdx is an ESM-only package available in development/frontend/node_modules
  const { compile } = await import("@mdx-js/mdx");
  await compile(source, { format: "mdx" });
}

describe("@mdx-js/mdx compile validation gate", () => {
  it("compiles MDX with JSON.stringify-wrapped JSON tool output without error", async () => {
    const jsonOutput = '{"exit": 0, "files": [{"path": "/tmp/x.ts", "size": 1024}]}';
    const mdxSource = `---
title: Test Chronicle
date: 2026-01-01
---

<div className="tool-block">
<pre>{${JSON.stringify(jsonOutput)}}</pre>
</div>
`;
    // Must not throw — the MDX compile gate should pass
    await expect(compileMdx(mdxSource)).resolves.toBeUndefined();
  });

  it("compiles MDX with JSON.stringify-wrapped TypeScript generics without error", async () => {
    const tsOutput =
      "const handler: Record<string, Array<() => void>> = {};\n" +
      "type Fn = <T extends object>(x: T) => T;";
    const mdxSource = `---
title: TS Chronicle
date: 2026-01-01
---

<div className="text-block">{${JSON.stringify(tsOutput)}}</div>
`;
    await expect(compileMdx(mdxSource)).resolves.toBeUndefined();
  });

  it("compiles MDX with JSON.stringify-wrapped triple backtick content without error", async () => {
    // This is the exact failure mode from issue #1452 — triple backticks caused
    // MDX remark to exit JSX mode when content was embedded raw or HTML-entity-encoded
    const codeBlockContent =
      "Here is the Bash output:\n```typescript\nconst x = 1;\n```\nSuccess.";
    const mdxSource = `---
title: Code Block Chronicle
date: 2026-01-01
---

<div className="thinking">{${JSON.stringify(codeBlockContent)}}</div>
`;
    await expect(compileMdx(mdxSource)).resolves.toBeUndefined();
  });
});
