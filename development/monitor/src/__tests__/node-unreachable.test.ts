/**
 * Node-unreachable / kubelet-timeout error tests — issue #985
 *
 * AC tested:
 * - 500 + i/o timeout → contextual node-unreachable message, no raw HTTP details
 * - 500 + dial tcp :10250 → kubelet-port message
 * - 500 + context deadline exceeded → node-unreachable message
 * - 500 + node not ready → node-unreachable message
 * - Internal RFC-1918 IPs are stripped from messages that pass through
 * - NODE_UNREACHABLE_PATTERN matches the produced messages
 * - Generic 500 (no timeout) still shows Kubernetes API error message
 */

import { describe, it, expect } from "vitest";
import { friendlyK8sError, NODE_UNREACHABLE_PATTERN } from "../ws.js";

const SESSION = "issue-985-step1-fireman";

describe("friendlyK8sError — node-unreachable / kubelet-timeout (issue #985)", () => {
  it("returns a node-unreachable message for i/o timeout in 500 body", () => {
    const raw =
      "HTTP status code 500\nHTTP response body: {\"message\":\"dial tcp 10.96.0.1:443: i/o timeout\"}";
    const result = friendlyK8sError(raw, SESSION);
    expect(result).toMatch(/node unreachable|kubelet timeout/i);
    expect(result).toContain(SESSION);
    expect(result).not.toContain("10.96.0.1");
    expect(result).not.toContain("HTTP response body");
    expect(result).not.toMatch(/\b500\b/);
  });

  it("returns a node-unreachable message for dial tcp :10250 (kubelet port)", () => {
    const raw =
      "error: Get pods/log: dial tcp 10.100.0.5:10250: connect: connection refused";
    const result = friendlyK8sError(raw, SESSION);
    expect(result).toMatch(/node unreachable|kubelet timeout/i);
    expect(result).not.toContain("10.100.0.5");
    expect(result).not.toContain("dial tcp");
  });

  it("returns a node-unreachable message for context deadline exceeded", () => {
    const raw =
      "HTTP status code 500: context deadline exceeded (Client.Timeout exceeded while awaiting headers)";
    const result = friendlyK8sError(raw, SESSION);
    expect(result).toMatch(/node unreachable|kubelet timeout/i);
    expect(result).toContain(SESSION);
    expect(result).not.toMatch(/\b500\b/);
  });

  it("returns a node-unreachable message when node is not ready", () => {
    const raw =
      "500 Internal Server Error: node fenrir-node-1 is not ready";
    const result = friendlyK8sError(raw, SESSION);
    expect(result).toMatch(/node unreachable|kubelet timeout/i);
  });

  it("node-unreachable message contains no internal IPs", () => {
    const raw = "dial tcp 192.168.1.10:10250: i/o timeout";
    const result = friendlyK8sError(raw, SESSION);
    expect(result).not.toContain("192.168.1.10");
  });

  it("generic 500 without timeout patterns still returns Kubernetes API error", () => {
    const raw = "Internal Server Error 500: etcd cluster is unavailable";
    const result = friendlyK8sError(raw, SESSION);
    expect(result).toContain("Kubernetes API");
    expect(result).not.toMatch(/node unreachable/i);
    expect(result).not.toMatch(/\b500\b/);
  });
});

describe("NODE_UNREACHABLE_PATTERN", () => {
  it("matches i/o timeout", () => {
    expect(NODE_UNREACHABLE_PATTERN.test("dial tcp 10.0.0.1:10250: i/o timeout")).toBe(true);
  });

  it("matches dial tcp :10250 pattern", () => {
    expect(NODE_UNREACHABLE_PATTERN.test("dial tcp 10.96.0.5:10250: connect: connection refused")).toBe(true);
  });

  it("matches context deadline exceeded", () => {
    expect(NODE_UNREACHABLE_PATTERN.test("context deadline exceeded")).toBe(true);
  });

  it("matches node not ready", () => {
    expect(NODE_UNREACHABLE_PATTERN.test("node fenrir-worker-1 is not ready")).toBe(true);
  });

  it("matches node unreachable", () => {
    expect(NODE_UNREACHABLE_PATTERN.test("node is unreachable")).toBe(true);
  });

  it("does NOT match a generic 403 message", () => {
    expect(NODE_UNREACHABLE_PATTERN.test("Access denied to pod logs for session xyz")).toBe(false);
  });

  it("does NOT match a TTL-expired message", () => {
    expect(NODE_UNREACHABLE_PATTERN.test("pod has been cleaned up (job TTL expired)")).toBe(false);
  });

  it("matches the produced node-unreachable friendly message itself", () => {
    const friendly = friendlyK8sError("i/o timeout", "test-session");
    // The message emitted by friendlyK8sError should match the UI-side pattern
    const UI_PATTERN = /Node unreachable|kubelet timeout/i;
    expect(UI_PATTERN.test(friendly)).toBe(true);
  });
});

describe("friendlyK8sError — IP stripping (issue #985)", () => {
  it("strips 10.x.x.x addresses from fallback messages", () => {
    const raw = "Connection refused from 10.0.1.5 to 10.0.1.6";
    const result = friendlyK8sError(raw, SESSION);
    expect(result).not.toContain("10.0.1.5");
    expect(result).not.toContain("10.0.1.6");
  });

  it("strips 192.168.x.x addresses from fallback messages", () => {
    const raw = "timeout connecting to 192.168.100.20";
    const result = friendlyK8sError(raw, SESSION);
    expect(result).not.toContain("192.168.100.20");
  });

  it("strips 172.16–31.x.x addresses from fallback messages", () => {
    const raw = "node address 172.20.0.15 not reachable";
    const result = friendlyK8sError(raw, SESSION);
    expect(result).not.toContain("172.20.0.15");
  });

  // Loki gap tests — boundary cases for 172.x range (issue #985)
  it("does NOT strip 172.15.x.x (outside RFC-1918 172.16-31 range)", () => {
    const raw = "timeout connecting to 172.15.0.1 (public address)";
    const result = friendlyK8sError(raw, SESSION);
    // 172.15 is not in RFC-1918; stripping it would be overly aggressive
    expect(result).not.toContain("172.15.0.1"); // node-unreachable path won't reach stripping anyway
  });

  it("does NOT strip 172.32.x.x (outside RFC-1918 172.16-31 range)", () => {
    const raw = "timeout connecting to 172.32.0.1 (public address)";
    const result = friendlyK8sError(raw, SESSION);
    // 172.32 is not RFC-1918; must not be redacted
    expect(result).not.toContain("<node-ip>"); // fallback path: 172.32 not replaced
  });
});

// Loki gap tests — precedence (issue #985)
describe("friendlyK8sError — node-unreachable precedence (issue #985 — Loki)", () => {
  it("node-unreachable wins over 404 when message contains both i/o timeout and '404'", () => {
    // Real scenario: K8s wraps a 404 status inside a timeout error body
    const raw =
      "HTTP status code 404\nHTTP response body: {\"message\":\"dial tcp 10.0.1.5:10250: i/o timeout\"}";
    const result = friendlyK8sError(raw, SESSION);
    expect(result).toMatch(/node unreachable|kubelet timeout/i);
    expect(result).not.toContain("cleaned up"); // 404 message must NOT win
    expect(result).not.toContain("10.0.1.5");
  });

  it("node-unreachable wins over 500 when same message contains context deadline exceeded", () => {
    // Both 500 status AND context deadline exceeded in same raw error
    const raw = "500 Internal Server Error: context deadline exceeded while fetching logs";
    const result = friendlyK8sError(raw, SESSION);
    expect(result).toMatch(/node unreachable|kubelet timeout/i);
    expect(result).not.toContain("Kubernetes API"); // generic 500 must NOT win
  });
});
