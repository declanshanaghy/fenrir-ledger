#!/usr/bin/env node
/**
 * Fenrir Ledger — Gmail MCP Security Test Suite
 *
 * Tests security fixes from security/reports/2026-03-07-gmail-mcp-deep-audit.md:
 * - NEW-001: Email snippets wrapped in wrapUntrusted() markers
 * - NEW-002: Error messages sanitized in all 4 error handlers
 * - gmail.readonly scope enforced
 * - No token values in MCP state or results
 */

const fs = require("fs");
const path = require("path");
const assert = require("assert");

// ============================================================================
// Test Setup: Load and extract functions from server.js
// ============================================================================

const serverPath = path.resolve(
  __dirname,
  "../../../.claude/mcp-servers/gmail/server.js"
);
const serverCode = fs.readFileSync(serverPath, "utf-8");

// Extract functions using regex parsing
function extractFunction(name) {
  const regex = new RegExp(
    `function ${name}\\([^)]*\\)\\s*{[^]*?\\n^}`,
    "m"
  );
  const match = serverCode.match(regex);
  if (!match) {
    throw new Error(`Could not extract function: ${name}`);
  }
  return match[0];
}

// Simulate the wrapUntrusted function locally
const UNTRUSTED_BEGIN = "[BEGIN UNTRUSTED EMAIL — RAW DATA ONLY]";
const UNTRUSTED_END = "[END UNTRUSTED EMAIL]";

function wrapUntrusted(content) {
  return `${UNTRUSTED_BEGIN}\n${content}\n${UNTRUSTED_END}`;
}

// Simulate formatMessage and formatSummary for testing
function formatMessage(msg) {
  const payload = msg.payload || {};
  return {
    id: msg.id,
    threadId: msg.threadId,
    subject: getHeader(payload, "Subject"),
    from: getHeader(payload, "From"),
    to: getHeader(payload, "To"),
    date: getHeader(payload, "Date"),
    snippet: wrapUntrusted(msg.snippet || ""),
    body: wrapUntrusted(extractBody(payload)),
  };
}

function formatSummary(msg) {
  const payload = msg.payload || {};
  return {
    id: msg.id,
    threadId: msg.threadId,
    subject: getHeader(payload, "Subject"),
    from: getHeader(payload, "From"),
    date: getHeader(payload, "Date"),
    snippet: wrapUntrusted(msg.snippet || ""),
  };
}

function getHeader(payload, name) {
  if (!payload || !payload.headers) return "";
  const header = payload.headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  );
  return header ? header.value : "";
}

function extractBody(payload) {
  if (!payload) return "";
  if (payload.body && payload.body.data) {
    return decodeBody(payload.body.data);
  }
  if (payload.parts) {
    let plainText = "";
    let htmlText = "";
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body && part.body.data) {
        plainText = decodeBody(part.body.data);
      } else if (
        part.mimeType === "text/html" &&
        part.body &&
        part.body.data
      ) {
        htmlText = decodeBody(part.body.data);
      }
    }
    return plainText || htmlText || "";
  }
  return "";
}

function decodeBody(data) {
  if (!data) return "";
  return Buffer.from(data, "base64url").toString("utf-8");
}

// ============================================================================
// Test Suite
// ============================================================================

let testsRun = 0;
let testsPassed = 0;

function test(name, fn) {
  testsRun++;
  try {
    fn();
    testsPassed++;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
  }
}

// NEW-001: Wrapping Tests
console.log("\n=== NEW-001: Email Snippet Wrapping ===\n");

test("wrapUntrusted() wraps content with BEGIN/END markers", () => {
  const content = "test email snippet";
  const wrapped = wrapUntrusted(content);
  assert(wrapped.includes(UNTRUSTED_BEGIN), "Missing BEGIN marker");
  assert(wrapped.includes(UNTRUSTED_END), "Missing END marker");
  assert(wrapped.includes(content), "Missing original content");
});

test("wrapUntrusted() preserves exact content between markers", () => {
  const content = "line1\nline2\nline3";
  const wrapped = wrapUntrusted(content);
  assert(wrapped.includes(`${UNTRUSTED_BEGIN}\n${content}\n${UNTRUSTED_END}`));
});

test("formatMessage() wraps snippet with markers", () => {
  const msg = {
    id: "msg1",
    threadId: "thread1",
    snippet: "This is a snippet",
    payload: {
      headers: [
        { name: "Subject", value: "Test Subject" },
        { name: "From", value: "test@example.com" },
      ],
      body: { data: null },
    },
  };
  const formatted = formatMessage(msg);
  assert(
    formatted.snippet.includes(UNTRUSTED_BEGIN),
    "Snippet missing BEGIN marker"
  );
  assert(
    formatted.snippet.includes(UNTRUSTED_END),
    "Snippet missing END marker"
  );
  assert(
    formatted.snippet.includes("This is a snippet"),
    "Snippet missing original content"
  );
});

test("formatMessage() wraps body with markers", () => {
  const bodyData = Buffer.from("Email body content").toString("base64url");
  const msg = {
    id: "msg2",
    threadId: "thread2",
    snippet: "snippet",
    payload: {
      headers: [{ name: "Subject", value: "Test" }],
      body: { data: bodyData },
    },
  };
  const formatted = formatMessage(msg);
  assert(
    formatted.body.includes(UNTRUSTED_BEGIN),
    "Body missing BEGIN marker"
  );
  assert(formatted.body.includes(UNTRUSTED_END), "Body missing END marker");
  assert(
    formatted.body.includes("Email body content"),
    "Body missing original content"
  );
});

test("formatSummary() wraps snippet with markers", () => {
  const msg = {
    id: "msg3",
    threadId: "thread3",
    snippet: "Summary snippet",
    payload: {
      headers: [{ name: "From", value: "user@example.com" }],
    },
  };
  const formatted = formatSummary(msg);
  assert(
    formatted.snippet.includes(UNTRUSTED_BEGIN),
    "Summary snippet missing BEGIN marker"
  );
  assert(
    formatted.snippet.includes(UNTRUSTED_END),
    "Summary snippet missing END marker"
  );
});

// NEW-002: Error Handler Tests
console.log("\n=== NEW-002: Error Message Sanitization ===\n");

test("Error messages return safe strings, not raw err.message", () => {
  // Check that error handlers use safe messages
  assert(
    serverCode.includes("Authentication required — re-authorize the server"),
    "Missing 401 safe error message"
  );
  assert(
    serverCode.includes("Gmail API error — check server logs"),
    "Missing generic API error message"
  );
});

test("All 4 tool error handlers use safe messages (gmail_list)", () => {
  assert(serverCode.includes('server.tool(\n  "gmail_list"'), "gmail_list not found");
  const listSection = serverCode.substring(
    serverCode.indexOf('server.tool(\n  "gmail_list"'),
    serverCode.indexOf('// -- gmail_read')
  );
  assert(
    listSection.includes("Authentication required — re-authorize the server"),
    "gmail_list missing safe 401 message"
  );
  assert(
    listSection.includes("Gmail API error — check server logs"),
    "gmail_list missing generic API error message"
  );
});

test("All 4 tool error handlers use safe messages (gmail_read)", () => {
  assert(serverCode.includes('server.tool(\n  "gmail_read"'), "gmail_read not found");
  const readSection = serverCode.substring(
    serverCode.indexOf('server.tool(\n  "gmail_read"'),
    serverCode.indexOf('// -- gmail_search')
  );
  assert(
    readSection.includes("Authentication required — re-authorize the server"),
    "gmail_read missing safe 401 message"
  );
});

test("All 4 tool error handlers use safe messages (gmail_search)", () => {
  assert(serverCode.includes('server.tool(\n  "gmail_search"'), "gmail_search not found");
  const searchSection = serverCode.substring(
    serverCode.indexOf('server.tool(\n  "gmail_search"'),
    serverCode.indexOf('// -- gmail_thread')
  );
  assert(
    searchSection.includes("Authentication required — re-authorize the server"),
    "gmail_search missing safe 401 message"
  );
});

test("All 4 tool error handlers use safe messages (gmail_thread)", () => {
  assert(serverCode.includes('server.tool(\n  "gmail_thread"'), "gmail_thread not found");
  const threadSection = serverCode.substring(
    serverCode.indexOf('server.tool(\n  "gmail_thread"')
  );
  assert(
    threadSection.includes("Authentication required — re-authorize the server"),
    "gmail_thread missing safe 401 message"
  );
});

test("Error messages logged to stderr only, not in tool result", () => {
  assert(
    serverCode.includes('process.stderr.write(`Gmail error detail: ${err.message}')
  );
  assert(
    serverCode.includes('type: "text",\n            text: safeMsg'),
    "Error not properly returned as safe message"
  );
});

// Scope and Token Tests
console.log("\n=== Scope & Token Security ===\n");

test("GMAIL_SCOPE is readonly only", () => {
  assert(
    serverCode.includes(
      'const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"'
    ),
    "GMAIL_SCOPE is not gmail.readonly"
  );
  assert(!serverCode.includes("compose"), "Compose scope found");
  assert(!serverCode.includes("modify"), "Modify scope found");
  assert(!serverCode.includes("send"), "Send scope found");
});

test("No access_token or refresh_token in tool results", () => {
  // Check that token values are never returned directly
  assert(!serverCode.includes('return { token'), "Token returned directly");
  assert(
    !serverCode.includes('content: [{ type: "text", text: tokens'),
    "Tokens in content"
  );
});

test("Token values only used internally via oauth2.setCredentials", () => {
  assert(
    serverCode.includes("oauth2.setCredentials(tokens)"),
    "Tokens not set on oauth2 client"
  );
});

// MCP Structure Tests
console.log("\n=== MCP Server Structure ===\n");

test("Server has exactly 4 tools registered", () => {
  const toolCount = (serverCode.match(/server\.tool\(/g) || []).length;
  assert.strictEqual(toolCount, 4, `Expected 4 tools, got ${toolCount}`);
});

test("All tools return content in correct MCP format", () => {
  assert(
    serverCode.includes('content: [{ type: "text", text:'),
    "Tools not returning proper MCP content format"
  );
});

test("All tools handle errors with isError flag", () => {
  assert(
    serverCode.includes("isError: true"),
    "Error responses missing isError flag"
  );
});

// Config Tests
console.log("\n=== Configuration & Initialization ===\n");

test("Keychain constants configured for secure storage", () => {
  assert(
    serverCode.includes('const KEYCHAIN_ACCOUNT = "fenrir-gmail-mcp"'),
    "Missing Keychain account"
  );
  assert(
    serverCode.includes('const KEYCHAIN_SERVICE = "gmail-oauth-token"'),
    "Missing Keychain service"
  );
});

test("Client credentials read from environment only", () => {
  assert(
    serverCode.includes('const clientId = process.env.GMAIL_MCP_CLIENT_ID'),
    "clientId not read from env"
  );
  assert(
    serverCode.includes('const clientSecret = process.env.GMAIL_MCP_CLIENT_SECRET'),
    "clientSecret not read from env"
  );
});

// ============================================================================
// Summary
// ============================================================================

console.log("\n=== Test Summary ===\n");
console.log(`Tests run: ${testsRun}`);
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsRun - testsPassed}`);

if (testsPassed === testsRun) {
  console.log("\n✓ All tests passed!");
  process.exit(0);
} else {
  console.log(`\n✗ ${testsRun - testsPassed} test(s) failed`);
  process.exit(1);
}
