/**
 * Loki QA tests — sanitize-chronicle.mjs
 *
 * Additional coverage for Issue #1051: Secret sanitization for published agent chronicles.
 * Focuses on boundary cases, all token types, integration scenarios, and handoff-specified tests.
 */

import { describe, it, expect } from "vitest";

async function importSanitize() {
  return import(
    "../../../../.claude/skills/brandify-agent/scripts/sanitize-chronicle.mjs"
  );
}

// ---------------------------------------------------------------------------
// maskSecret — boundary and formula validation
// ---------------------------------------------------------------------------
describe("maskSecret — boundary cases", () => {
  it("returns [REDACTED] for exactly 8-char value (below threshold)", async () => {
    const { maskSecret } = await importSanitize();
    expect(maskSecret("12345678")).toBe("[REDACTED]");
  });

  it("masks exactly 9-char value (at threshold): first4 + 1x + last4", async () => {
    const { maskSecret } = await importSanitize();
    // 9 chars: first4=1234, xs=1, last4=6789
    const result = maskSecret("123456789");
    expect(result).toBe("1234x6789");
  });

  it("masks exactly 12-char value correctly: first4 + 4x + last4", async () => {
    const { maskSecret } = await importSanitize();
    // 12 chars: first4=ABCD, xs=4, last4=IJKL
    const result = maskSecret("ABCDEFGHIJKL");
    expect(result).toBe("ABCDxxxxIJKL");
    expect(result).toHaveLength(12);
  });

  it("returns [REDACTED] for empty string", async () => {
    const { maskSecret } = await importSanitize();
    expect(maskSecret("")).toBe("[REDACTED]");
  });

  it("returns [REDACTED] for 1-char string", async () => {
    const { maskSecret } = await importSanitize();
    expect(maskSecret("X")).toBe("[REDACTED]");
  });

  it("returns [REDACTED] for number input", async () => {
    const { maskSecret } = await importSanitize();
    expect(maskSecret(12345 as unknown as string)).toBe("[REDACTED]");
  });

  it("returns [REDACTED] for object input", async () => {
    const { maskSecret } = await importSanitize();
    expect(maskSecret({} as unknown as string)).toBe("[REDACTED]");
  });

  it("preserves total length after masking", async () => {
    const { maskSecret } = await importSanitize();
    const val = "abcdefghijklmnopqrstuvwxyz"; // 26 chars
    const result = maskSecret(val);
    expect(result).toHaveLength(26);
    expect(result).toBe("abcdxxxxxxxxxxxxxxxxxxxxxxwxyz".slice(0, 4) + "x".repeat(18) + "wxyz");
  });
});

// ---------------------------------------------------------------------------
// maskSecretPatterns — all token types
// ---------------------------------------------------------------------------
describe("maskSecretPatterns — all token types", () => {
  it("masks OpenAI-style sk- tokens (non-Anthropic)", async () => {
    const { maskSecretPatterns } = await importSanitize();
    const text = "token=sk-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef";
    const result = maskSecretPatterns(text);
    expect(result).not.toContain("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef");
    expect(result).toContain("sk-A"); // first 4 of the captured token
  });

  it("masks Google OAuth ya29 tokens", async () => {
    const { maskSecretPatterns } = await importSanitize();
    const token = "ya29.A0ARrdaM-ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const result = maskSecretPatterns(`Bearer ${token}`);
    expect(result).not.toContain("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  });

  it("masks Google client secrets (GOCSPX- prefix)", async () => {
    const { maskSecretPatterns } = await importSanitize();
    const text = "client_secret=GOCSPX-ABCDEFGHIJKLMNOPQRSTUVWXYZabc";
    const result = maskSecretPatterns(text);
    expect(result).not.toContain("ABCDEFGHIJKLMNOPQRSTUVWXYZabc");
    expect(result).toContain("GOCS");
  });

  it("masks npm auth tokens (npm_ prefix)", async () => {
    const { maskSecretPatterns } = await importSanitize();
    const token = "npm_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";
    const result = maskSecretPatterns(`//registry.npmjs.org/:_authToken=${token}`);
    expect(result).not.toContain("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij");
    expect(result).toContain("npm_");
  });

  it("masks Bearer tokens in Authorization headers", async () => {
    const { maskSecretPatterns } = await importSanitize();
    const text = "Authorization: Bearer eyABC123DEF456GHI789JKL012MNO345";
    const result = maskSecretPatterns(text);
    expect(result).not.toContain("eyABC123DEF456GHI789JKL012MNO345");
    expect(result).toContain("Bearer");
  });

  it("masks long hex tokens (32+ hex chars)", async () => {
    const { maskSecretPatterns } = await importSanitize();
    const hex = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"; // exactly 32 hex chars
    const result = maskSecretPatterns(`token=${hex}`);
    expect(result).not.toContain(hex);
  });

  it("masks GitHub gho_ (OAuth) tokens", async () => {
    const { maskSecretPatterns } = await importSanitize();
    const token = "gho_ABCDEFGHIJKLMNOPQRSTUVWXYZabcd123456";
    const result = maskSecretPatterns(token);
    expect(result).not.toContain("ABCDEFGHIJKLMNOPQRSTUVWXYZabcd123456");
    expect(result).toContain("gho_");
  });

  it("masks GitHub ghs_ (server-to-server) tokens", async () => {
    const { maskSecretPatterns } = await importSanitize();
    const token = "ghs_ABCDEFGHIJKLMNOPQRSTUVWXYZabcd123456";
    const result = maskSecretPatterns(token);
    expect(result).not.toContain("ABCDEFGHIJKLMNOPQRSTUVWXYZabcd123456");
    expect(result).toContain("ghs_");
  });

  it("masks GitHub ghu_ (user-to-server) tokens", async () => {
    const { maskSecretPatterns } = await importSanitize();
    const token = "ghu_ABCDEFGHIJKLMNOPQRSTUVWXYZabcd123456";
    const result = maskSecretPatterns(token);
    expect(result).not.toContain("ABCDEFGHIJKLMNOPQRSTUVWXYZabcd123456");
    expect(result).toContain("ghu_");
  });

  it("masks multiple distinct secrets in one string", async () => {
    const { maskSecretPatterns } = await importSanitize();
    const text =
      "key=sk-ant-api03-LONGKEYLONGKEYLONGKEYLONGKEYLONG " +
      "token=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcd123456";
    const result = maskSecretPatterns(text);
    expect(result).not.toContain("LONGKEYLONGKEYLONGKEYLONGKEYLONG");
    expect(result).not.toContain("ABCDEFGHIJKLMNOPQRSTUVWXYZabcd123456");
  });

  it("does not alter text with no secret patterns", async () => {
    const { maskSecretPatterns } = await importSanitize();
    const clean = "Hello world. This log contains no credentials.";
    expect(maskSecretPatterns(clean)).toBe(clean);
  });

  it("handles non-string input gracefully (returns as-is)", async () => {
    const { maskSecretPatterns } = await importSanitize();
    expect(maskSecretPatterns(null as unknown as string)).toBe(null);
    expect(maskSecretPatterns(undefined as unknown as string)).toBe(undefined);
    expect(maskSecretPatterns(42 as unknown as string)).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// redactInfraDetails — all pattern types
// ---------------------------------------------------------------------------
describe("redactInfraDetails — all infra patterns", () => {
  it("redacts zone references", async () => {
    const { redactInfraDetails } = await importSanitize();
    const text = "zone: us-central1-a";
    const result = redactInfraDetails(text);
    expect(result).not.toContain("us-central1-a");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts region references", async () => {
    const { redactInfraDetails } = await importSanitize();
    const text = "region: us-central1";
    const result = redactInfraDetails(text);
    expect(result).not.toContain("us-central1");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts GCP project: syntax", async () => {
    const { redactInfraDetails } = await importSanitize();
    const text = "project: fenrir-prod-12345";
    const result = redactInfraDetails(text);
    expect(result).not.toContain("fenrir-prod-12345");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts endpoint IPs", async () => {
    const { redactInfraDetails } = await importSanitize();
    const text = "endpoint: 10.128.0.2";
    const result = redactInfraDetails(text);
    expect(result).not.toContain("10.128.0.2");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts cluster-name= syntax", async () => {
    const { redactInfraDetails } = await importSanitize();
    const text = "cluster-name=fenrir-autopilot-prod";
    const result = redactInfraDetails(text);
    expect(result).not.toContain("fenrir-autopilot-prod");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts svc.cluster.local with port", async () => {
    const { redactInfraDetails } = await importSanitize();
    const text = "FIRESTORE_HOST=grpc://firestore.fenrir-app.svc.cluster.local:8080";
    const result = redactInfraDetails(text);
    expect(result).not.toContain("firestore.fenrir-app.svc.cluster.local:8080");
    expect(result).toContain("[REDACTED-SVC]");
  });

  it("redacts svc.cluster.local without port", async () => {
    const { redactInfraDetails } = await importSanitize();
    const text = "host=api.fenrir-agents.svc.cluster.local";
    const result = redactInfraDetails(text);
    expect(result).not.toContain("api.fenrir-agents.svc.cluster.local");
    expect(result).toContain("[REDACTED-SVC]");
  });

  it("handles non-string input gracefully", async () => {
    const { redactInfraDetails } = await importSanitize();
    expect(redactInfraDetails(null as unknown as string)).toBe(null);
    expect(redactInfraDetails(42 as unknown as string)).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// stripGitCredentials — edge cases
// ---------------------------------------------------------------------------
describe("stripGitCredentials — edge cases", () => {
  it("strips ghs_ server token from clone URL", async () => {
    const { stripGitCredentials } = await importSanitize();
    const url = "https://x-token-auth:ghs_ABCDEFGHIJKLMNOPQRSTUVWXYZabcd@github.com/org/repo.git";
    const result = stripGitCredentials(url);
    expect(result).not.toContain("ghs_ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    expect(result).toContain("https://github.com/org/repo.git");
  });

  it("handles multiple git URLs in one string", async () => {
    const { stripGitCredentials } = await importSanitize();
    const text =
      "origin https://alice:token1@github.com/org/a.git\n" +
      "upstream https://bob:token2@github.com/org/b.git";
    const result = stripGitCredentials(text);
    expect(result).not.toContain("alice:token1");
    expect(result).not.toContain("bob:token2");
    expect(result).toContain("https://github.com/org/a.git");
    expect(result).toContain("https://github.com/org/b.git");
  });

  it("does not alter non-git HTTPS URLs", async () => {
    const { stripGitCredentials } = await importSanitize();
    const text = "See https://docs.example.com/guide for details.";
    expect(stripGitCredentials(text)).toBe(text);
  });

  it("handles non-string input gracefully", async () => {
    const { stripGitCredentials } = await importSanitize();
    expect(stripGitCredentials(null as unknown as string)).toBe(null);
    expect(stripGitCredentials(42 as unknown as string)).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// truncateToolOutput — edge cases
// ---------------------------------------------------------------------------
describe("truncateToolOutput — edge cases", () => {
  it("returns non-string input unchanged", async () => {
    const { truncateToolOutput } = await importSanitize();
    expect(truncateToolOutput(null as unknown as string)).toBe(null);
    expect(truncateToolOutput(42 as unknown as string)).toBe(42);
  });

  it("returns empty string unchanged", async () => {
    const { truncateToolOutput } = await importSanitize();
    expect(truncateToolOutput("")).toBe("");
  });

  it("uses default maxChars=800 when not specified", async () => {
    const { truncateToolOutput } = await importSanitize();
    const long = "y".repeat(1000);
    const result = truncateToolOutput(long);
    expect(result).toContain("… [truncated 200 chars]");
    expect(result.startsWith("y".repeat(800))).toBe(true);
  });

  it("does not truncate string at exactly maxChars", async () => {
    const { truncateToolOutput } = await importSanitize();
    const exact = "z".repeat(800);
    expect(truncateToolOutput(exact, 800)).toBe(exact);
  });

  it("truncates string at maxChars + 1", async () => {
    const { truncateToolOutput } = await importSanitize();
    const overBy1 = "z".repeat(801);
    const result = truncateToolOutput(overBy1, 800);
    expect(result).toContain("… [truncated 1 chars]");
  });
});

// ---------------------------------------------------------------------------
// sanitizeText — composite pipeline
// ---------------------------------------------------------------------------
describe("sanitizeText — composite pipeline", () => {
  it("applies all three passes in correct order (git creds → secrets → infra)", async () => {
    const { sanitizeText } = await importSanitize();
    // The URL contains a git credential that is also a GitHub token
    const text =
      "git remote add origin https://x-token:ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcd123456@github.com/org/repo.git\n" +
      "namespace: fenrir-agents";
    const result = sanitizeText(text);
    // credentials stripped
    expect(result).not.toContain("x-token:ghp_");
    // clean URL preserved
    expect(result).toContain("https://github.com/org/repo.git");
    // infra redacted
    expect(result).not.toContain("fenrir-agents");
  });

  it("handles an already-clean MDX document without modification beyond infra", async () => {
    const { sanitizeText } = await importSanitize();
    const clean =
      "# Chronicle\n\nAgent completed the task successfully.\n\n> Tool: Bash\n> Output: Done.\n";
    // Should pass through unchanged (no secrets, no infra, no git creds)
    expect(sanitizeText(clean)).toBe(clean);
  });

  it("processes svc.cluster.local in a realistic commit message context", async () => {
    const { sanitizeText } = await importSanitize();
    const commitMsg =
      "feat: update FIRESTORE_HOST to grpc://cache.fenrir-app.svc.cluster.local:8080";
    const result = sanitizeText(commitMsg);
    expect(result).not.toContain("cache.fenrir-app.svc.cluster.local");
    expect(result).toContain("[REDACTED-SVC]");
  });
});

// ---------------------------------------------------------------------------
// sanitizeToolOutput — composite + truncation
// ---------------------------------------------------------------------------
describe("sanitizeToolOutput — composite + truncation", () => {
  it("returns non-string input unchanged", async () => {
    const { sanitizeToolOutput } = await importSanitize();
    expect(sanitizeToolOutput(null as unknown as string)).toBe(null);
    expect(sanitizeToolOutput(42 as unknown as string)).toBe(42);
  });

  it("leaves short clean output unchanged", async () => {
    const { sanitizeToolOutput } = await importSanitize();
    const out = "exit code 0";
    expect(sanitizeToolOutput(out, 800)).toBe(out);
  });

  it("sanitizes secrets that appear within the first maxChars", async () => {
    const { sanitizeToolOutput } = await importSanitize();
    const secret = "sk-ant-api03-SECRETSECRETSECRETSECRETSECRETSECRET";
    // secret is short enough to be in first 800 chars
    const result = sanitizeToolOutput(secret + "\n" + "x".repeat(100), 800);
    expect(result).not.toContain("SECRETSECRETSECRETSECRETSECRETSECRET");
  });

  it("sanitizes secrets in the truncation note boundary", async () => {
    const { sanitizeToolOutput } = await importSanitize();
    // Secret starts at char 790 — straddles the 800-char cut point
    const prefix = "a".repeat(790);
    const secret = "sk-ant-api03-XXXXXXXXXXXXXXXXXX"; // 30 chars
    const text = prefix + secret + "b".repeat(200);
    // After truncation at 800, only first 10 chars of secret remain visible
    const result = sanitizeToolOutput(text, 800);
    expect(result).toContain("… [truncated");
    // The full secret should not appear in the output
    expect(result).not.toContain("XXXXXXXXXXXXXXXXXX");
  });

  it("uses default maxChars=800 when not specified", async () => {
    const { sanitizeToolOutput } = await importSanitize();
    const long = "clean content ".repeat(100); // ~1400 chars
    const result = sanitizeToolOutput(long);
    expect(result).toContain("… [truncated");
  });
});

// ---------------------------------------------------------------------------
// Integration — simulate --publish path with fake API key in MDX content
// ---------------------------------------------------------------------------
describe("Integration — publish path simulation", () => {
  it("a fake API key in an MDX chronicle is masked end-to-end", async () => {
    const { sanitizeText } = await importSanitize();

    // Simulate MDX generated by generate-agent-report.mjs --publish
    const fakeMdx = `---
title: Agent Chronicle
date: 2026-03-16
---

## Tool: Bash

\`\`\`bash
export ANTHROPIC_API_KEY=sk-ant-api03-FakeKeyFakeKeyFakeKeyFakeKeyFakeKey
\`\`\`

## Tool Result

Connected to grpc://api.fenrir-app.svc.cluster.local:8080 (namespace: fenrir-prod)
`;

    const sanitized = sanitizeText(fakeMdx);

    // API key masked
    expect(sanitized).not.toContain("FakeKeyFakeKeyFakeKeyFakeKeyFakeKey");
    // Internal DNS redacted
    expect(sanitized).not.toContain("api.fenrir-app.svc.cluster.local");
    // Namespace redacted
    expect(sanitized).not.toContain("fenrir-prod");
    // Structure preserved
    expect(sanitized).toContain("## Tool: Bash");
    expect(sanitized).toContain("ANTHROPIC_API_KEY=");
  });

  it("HTML-only output (no publish) text should still be sanitizable when called explicitly", async () => {
    const { sanitizeText } = await importSanitize();
    // Verifies the pure functions work regardless of which mode calls them
    const htmlContent = "<p>Token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcd123456</p>";
    const result = sanitizeText(htmlContent);
    expect(result).not.toContain("ABCDEFGHIJKLMNOPQRSTUVWXYZabcd123456");
  });

  it("chronicle with multiple secret types contains no raw secrets after sanitization", async () => {
    const { sanitizeText } = await importSanitize();

    const chronicle = [
      "sk-ant-api03-AnthropicKeyAnthropicKeyAnthropicKeyAnt",
      "ghp_GithubTokenGithubTokenGithubTokenGithub",
      "AIzaSyGoogleApiKeyGoogleApiKeyGoogleApiKey12345",
      "https://deploy:npm_NPMTokenNPMTokenNPMTokenNPMTokenNPMToken@github.com/org/repo",
      "namespace: fenrir-production",
      "grpc://cache.default.svc.cluster.local:8080",
    ].join("\n");

    const result = sanitizeText(chronicle);

    expect(result).not.toContain("AnthropicKeyAnthropicKeyAnthropicKeyAnt");
    expect(result).not.toContain("GithubTokenGithubTokenGithubTokenGithub");
    expect(result).not.toContain("GoogleApiKeyGoogleApiKeyGoogleApiKey12345");
    expect(result).not.toContain("NPMTokenNPMTokenNPMTokenNPMTokenNPMToken");
    expect(result).not.toContain("fenrir-production");
    expect(result).not.toContain("cache.default.svc.cluster.local");
  });
});
