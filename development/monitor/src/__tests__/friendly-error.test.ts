/**
 * friendlyK8sError unit tests — issue #973
 *
 * Verifies that raw Kubernetes API error messages (containing HTTP status codes,
 * headers, and "Body: undefined") are converted to clean human-readable strings
 * before being sent to the monitor UI.
 *
 * AC tested:
 * - 404 errors show clean "job TTL expired" message, no raw HTTP details
 * - 403 errors show "access denied" message
 * - 401 errors show "authentication error" message
 * - 500 errors show "Kubernetes API error" message
 * - 503 errors show "unavailable" message
 * - Raw HTTP headers and "Body: undefined" are stripped from unknown errors
 * - Short, clean messages pass through unchanged
 */

import { describe, it, expect } from "vitest";
import { friendlyK8sError } from "../ws.js";

const SESSION = "issue-973-step1-fireman";

describe("friendlyK8sError — HTTP status code mapping", () => {
  it("maps 404 to a pod TTL-expired message", () => {
    const result = friendlyK8sError("HTTP status code 404", SESSION);
    expect(result).toContain("cleaned up");
    expect(result).toContain(SESSION);
    expect(result).not.toMatch(/\b404\b/);
    expect(result).not.toContain("HTTP status");
  });

  it("maps 404 from 'Not Found' phrasing to TTL-expired message", () => {
    const result = friendlyK8sError("404 Not Found\nBody: undefined", SESSION);
    expect(result).toContain("cleaned up");
    expect(result).not.toContain("Body: undefined");
  });

  it("maps 403 to an access-denied message", () => {
    const result = friendlyK8sError("HTTP status code 403", SESSION);
    expect(result).toContain("Access denied");
    expect(result).toContain(SESSION);
    expect(result).not.toMatch(/\b403\b/);
  });

  it("maps 401 to an authentication error message", () => {
    const result = friendlyK8sError("401 Unauthorized", SESSION);
    expect(result).toContain("Authentication error");
    expect(result).not.toMatch(/\b401\b/);
  });

  it("maps 500 to a Kubernetes API error message", () => {
    const result = friendlyK8sError("Internal Server Error 500", SESSION);
    expect(result).toContain("Kubernetes API error");
    expect(result).toContain(SESSION);
    expect(result).not.toMatch(/\b500\b/);
  });

  it("maps 503 to an unavailable message", () => {
    const result = friendlyK8sError("service unavailable 503", SESSION);
    expect(result).toContain("unavailable");
    expect(result).not.toMatch(/\b503\b/);
  });
});

describe("friendlyK8sError — raw HTTP artefact stripping", () => {
  it("strips 'Body: undefined' from unknown errors", () => {
    const result = friendlyK8sError(
      "Connection reset\nBody: undefined\nContent-Type: application/json",
      SESSION
    );
    expect(result).not.toContain("Body: undefined");
    expect(result).not.toContain("Content-Type");
  });

  it("strips Authorization headers from error messages", () => {
    const result = friendlyK8sError(
      "Request failed\nAuthorization: Bearer tok-xxxx\nsome detail",
      SESSION
    );
    expect(result).not.toContain("Authorization");
    expect(result).not.toContain("Bearer");
  });

  it("strips 'HTTP response body:' lines", () => {
    const result = friendlyK8sError(
      "Error\nHTTP response body: {\"message\":\"not found\"}",
      SESSION
    );
    expect(result).not.toContain("HTTP response body");
    expect(result).not.toContain("{");
  });

  it("returns a fallback message when cleaned string is empty", () => {
    const result = friendlyK8sError("Body: undefined", SESSION);
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toContain("Body: undefined");
  });

  it("passes through short, clean messages unchanged", () => {
    const clean = "network timeout while connecting to cluster";
    const result = friendlyK8sError(clean, SESSION);
    expect(result).toBe(clean);
  });
});
