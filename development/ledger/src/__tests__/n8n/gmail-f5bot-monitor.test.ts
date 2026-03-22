/**
 * gmail-f5bot-monitor.test.ts
 *
 * Validates the gmail-f5bot-monitor n8n workflow (issue #1788):
 *  1. Structural assertions on the parsed workflow JSON
 *  2. Code-node logic tests for "Extract — Reddit Links" using sample inputs
 *
 * No readFileSync-on-raw-string assertions — all checks operate on parsed JSON.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(process.cwd(), "../..");
const WORKFLOW_PATH = path.join(
  REPO_ROOT,
  "infrastructure/n8n/workflows/gmail-f5bot-monitor.json"
);

type N8nNode = {
  id: string;
  name: string;
  type: string;
  parameters: Record<string, unknown>;
  credentials?: Record<string, { id: string; name: string }>;
};

type N8nWorkflow = {
  nodes: N8nNode[];
  connections: Record<string, Record<string, unknown[][]>>;
};

function loadWorkflow(): N8nWorkflow {
  return JSON.parse(readFileSync(WORKFLOW_PATH, "utf-8")) as N8nWorkflow;
}

function getNodeByName(wf: N8nWorkflow, name: string): N8nNode | undefined {
  return wf.nodes.find((n) => n.name === name);
}

const REQUIRED_NODE_NAMES = [
  "Manual Trigger",
  "Gmail — Fetch F5Bot Alerts",
  "Filter — F5Bot Emails",
  "Extract — Reddit Links",
  "Filter — Has Links?",
  "HTTP — Get Reddit Post",
  "Extract — Post Content",
  "Claude API — Draft Reply",
  "Merge — Context + Draft",
  "Gmail — Create Draft",
  "No Emails Found",
  "No Reddit Links",
];

// ---------------------------------------------------------------------------
// Code-node runner
// Executes the "Extract — Reddit Links" jsCode against mock $input items.
// ---------------------------------------------------------------------------

type N8nItem = { json: Record<string, unknown> };

function runExtractRedditLinks(mockItems: N8nItem[]): N8nItem[] {
  const wf = loadWorkflow();
  const node = getNodeByName(wf, "Extract — Reddit Links");
  if (!node) throw new Error("Extract — Reddit Links node not found");
  const jsCode = node.parameters.jsCode as string;
  // eslint-disable-next-line no-new-func
  const fn = new Function("$input", jsCode) as (
    $input: { all: () => N8nItem[] }
  ) => N8nItem[];
  return fn({ all: () => mockItems });
}

function makeEmailItem(subject: string, html: string): N8nItem {
  return { json: { id: "test-email-1", Subject: subject, html } };
}

// ---------------------------------------------------------------------------
// Structural tests
// ---------------------------------------------------------------------------

describe("gmail-f5bot-monitor — workflow structure", () => {
  it("has exactly 12 nodes and all required node names", () => {
    const wf = loadWorkflow();
    expect(wf.nodes).toHaveLength(12);
    const names = wf.nodes.map((n) => n.name);
    for (const required of REQUIRED_NODE_NAMES) {
      expect(names).toContain(required);
    }
  });

  it("all connections reference valid node names", () => {
    const wf = loadWorkflow();
    const nodeNames = new Set(wf.nodes.map((n) => n.name));
    for (const [sourceName, outputs] of Object.entries(wf.connections)) {
      expect(nodeNames.has(sourceName), `source node "${sourceName}" not found`).toBe(true);
      for (const branches of Object.values(outputs)) {
        for (const branch of branches) {
          for (const conn of branch as Array<{ node: string }>) {
            expect(nodeNames.has(conn.node), `target node "${conn.node}" not found`).toBe(true);
          }
        }
      }
    }
  });

  it("Gmail fetch node has simple: false and correct credential ID", () => {
    const wf = loadWorkflow();
    const node = getNodeByName(wf, "Gmail — Fetch F5Bot Alerts");
    expect(node).toBeDefined();
    expect(node!.parameters.simple).toBe(false);
    expect(node!.credentials?.gmailOAuth2?.id).toBe("Eck5j1Xj1x6zyc9A");
  });

  it("HTTP Reddit node sends User-Agent: fenrir-ledger-n8n/1.0", () => {
    const wf = loadWorkflow();
    const node = getNodeByName(wf, "HTTP — Get Reddit Post");
    expect(node).toBeDefined();
    const params = node!.parameters as {
      headerParameters: { parameters: Array<{ name: string; value: string }> };
    };
    const ua = params.headerParameters.parameters.find((h) => h.name === "User-Agent");
    expect(ua).toBeDefined();
    expect(ua!.value).toBe("fenrir-ledger-n8n/1.0");
  });

  it("Claude API node uses model claude-3-5-haiku-20241022", () => {
    const wf = loadWorkflow();
    const node = getNodeByName(wf, "Claude API — Draft Reply");
    expect(node).toBeDefined();
    // jsonBody is an n8n expression string; model field has no template expressions
    const jsonBody = node!.parameters.jsonBody as string;
    const modelMatch = jsonBody.match(/"model":\s*"([^"]+)"/);
    expect(modelMatch).not.toBeNull();
    expect(modelMatch![1]).toBe("claude-3-5-haiku-20241022");
  });
});

// ---------------------------------------------------------------------------
// Code-node logic tests — Extract — Reddit Links
// ---------------------------------------------------------------------------

describe("Extract — Reddit Links code node", () => {
  const POST_URL = "https://reddit.com/r/churning/comments/abc123/some_title";
  const COMMENT_URL =
    "https://reddit.com/r/churning/comments/abc123/some_title/cmt999";

  it("emits 0 items when HTML body has no Reddit URLs", () => {
    const result = runExtractRedditLinks([
      makeEmailItem("F5Bot found something: churning", "No links here at all."),
    ]);
    expect(result).toHaveLength(0);
  });

  it("emits 1 item with correct keyword for a single Reddit URL", () => {
    const result = runExtractRedditLinks([
      makeEmailItem(
        "F5Bot found something: churning",
        `Check this out: ${POST_URL}/`
      ),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].json.keyword).toBe("churning");
    expect(result[0].json.redditUrl).toBe(POST_URL);
  });

  it("emits N items for multiple distinct Reddit URLs", () => {
    const url1 = "https://reddit.com/r/churning/comments/abc123/post_a/";
    const url2 = "https://reddit.com/r/creditcards/comments/xyz789/post_b/";
    const result = runExtractRedditLinks([
      makeEmailItem("F5Bot found something: churning", `${url1} ${url2}`),
    ]);
    expect(result).toHaveLength(2);
  });

  it("deduplicates URLs within a single email", () => {
    const dupeUrl = `${POST_URL}/`;
    const result = runExtractRedditLinks([
      makeEmailItem(
        "F5Bot found something: churning",
        `${dupeUrl} ${dupeUrl} ${dupeUrl}`
      ),
    ]);
    expect(result).toHaveLength(1);
  });

  it("marks comment URL (6+ path segments) as isComment true, post URL as false", () => {
    const html = `${POST_URL}/ ${COMMENT_URL}/`;
    const result = runExtractRedditLinks([
      makeEmailItem("F5Bot found something: churning", html),
    ]);
    expect(result).toHaveLength(2);
    const postItem = result.find((r) => (r.json.redditUrl as string).includes("cmt999") === false);
    const commentItem = result.find((r) => (r.json.redditUrl as string).includes("cmt999"));
    expect(postItem?.json.isComment).toBe(false);
    expect(commentItem?.json.isComment).toBe(true);
  });
});
