/**
 * sanitize-chronicle tests
 *
 * Validates all sanitization passes for the chronicle publish pipeline.
 * Covers Issue #1051: Secret sanitization for published agent chronicles.
 */

import { describe, it, expect } from "vitest";

// Dynamic import of ESM module from the brandify-agent skill
async function importSanitize() {
  return import(
    "../../../../.claude/skills/brandify-agent/scripts/sanitize-chronicle.mjs"
  );
}

// ---------------------------------------------------------------------------
// maskSecret
// ---------------------------------------------------------------------------
describe("maskSecret", () => {
  it("masks a value >= 9 chars with first4 + xs + last4", async () => {
    const { maskSecret } = await importSanitize();
    const result = maskSecret("abcdefghij"); // 10 chars
    expect(result).toBe("abcdxx" + "ghij"); // 2 xs
  });

  it("returns [REDACTED] for values shorter than 9 chars", async () => {
    const { maskSecret } = await importSanitize();
    expect(maskSecret("short")).toBe("[REDACTED]");
    expect(maskSecret("12345678")).toBe("[REDACTED]"); // exactly 8
  });

  it("returns [REDACTED] for non-string input", async () => {
    const { maskSecret } = await importSanitize();
    expect(maskSecret(null as unknown as string)).toBe("[REDACTED]");
    expect(maskSecret(undefined as unknown as string)).toBe("[REDACTED]");
  });

  it("masks a 32-char value correctly", async () => {
    const { maskSecret } = await importSanitize();
    const val = "a".repeat(32);
    const result = maskSecret(val);
    expect(result).toHaveLength(32);
    expect(result.startsWith("aaaa")).toBe(true);
    expect(result.endsWith("aaaa")).toBe(true);
    expect(result.slice(4, 28)).toBe("x".repeat(24));
  });
});

// ---------------------------------------------------------------------------
// maskSecretPatterns
// ---------------------------------------------------------------------------
describe("maskSecretPatterns", () => {
  it("masks Anthropic API keys", async () => {
    const { maskSecretPatterns } = await importSanitize();
    const text = "API key is sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456";
    const result = maskSecretPatterns(text);
    expect(result).not.toContain("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    expect(result).toContain("sk-a");
  });

  it("masks GitHub personal access tokens", async () => {
    const { maskSecretPatterns } = await importSanitize();
    const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcd123456";
    const text = `GITHUB_TOKEN=${token}`;
    const result = maskSecretPatterns(text);
    expect(result).not.toContain("ABCDEFGHIJKLMNOPQRSTUVWXYZabcd123456");
    expect(result).toContain("ghp_");
  });

  it("masks Google API keys (AIzaSy prefix)", async () => {
    const { maskSecretPatterns } = await importSanitize();
    const text = "key=AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ12345678";
    const result = maskSecretPatterns(text);
    expect(result).not.toContain("ABCDEFGHIJKLMNOPQRSTUVWXYZ12345678");
  });

  it("masks JWTs", async () => {
    const { maskSecretPatterns } = await importSanitize();
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    const result = maskSecretPatterns(jwt);
    expect(result).not.toBe(jwt);
    // The JWT should be partially masked
    expect(result).toContain("eyJh");
  });

  it("passes through clean text unchanged", async () => {
    const { maskSecretPatterns } = await importSanitize();
    const text = "This is a normal sentence with no secrets.";
    expect(maskSecretPatterns(text)).toBe(text);
  });

  it("handles empty string", async () => {
    const { maskSecretPatterns } = await importSanitize();
    expect(maskSecretPatterns("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// redactInfraDetails
// ---------------------------------------------------------------------------
describe("redactInfraDetails", () => {
  it("redacts K8s namespace references", async () => {
    const { redactInfraDetails } = await importSanitize();
    const text = "namespace: fenrir-app";
    const result = redactInfraDetails(text);
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("fenrir-app");
  });

  it("redacts GKE cluster names", async () => {
    const { redactInfraDetails } = await importSanitize();
    const text = "cluster: fenrir-prod-cluster";
    const result = redactInfraDetails(text);
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("fenrir-prod-cluster");
  });

  it("redacts internal service DNS", async () => {
    const { redactInfraDetails } = await importSanitize();
    const text = "redis://redis.fenrir-app.svc.cluster.local:6379";
    const result = redactInfraDetails(text);
    expect(result).not.toContain("redis.fenrir-app.svc.cluster.local");
    expect(result).toContain("[REDACTED-SVC]");
  });

  it("redacts --project flags", async () => {
    const { redactInfraDetails } = await importSanitize();
    const text = "gcloud container clusters list --project my-gcp-project-id";
    const result = redactInfraDetails(text);
    expect(result).not.toContain("my-gcp-project-id");
    expect(result).toContain("[REDACTED]");
  });

  it("passes through text with no infra details", async () => {
    const { redactInfraDetails } = await importSanitize();
    const text = "Normal log output with no infra references.";
    expect(redactInfraDetails(text)).toBe(text);
  });
});

// ---------------------------------------------------------------------------
// stripGitCredentials
// ---------------------------------------------------------------------------
describe("stripGitCredentials", () => {
  it("strips credentials from HTTPS git URLs", async () => {
    const { stripGitCredentials } = await importSanitize();
    const text = "remote: https://user:ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123@github.com/org/repo.git";
    const result = stripGitCredentials(text);
    expect(result).not.toContain("user:ghp_");
    expect(result).toContain("https://github.com/org/repo.git");
  });

  it("preserves public HTTPS URLs", async () => {
    const { stripGitCredentials } = await importSanitize();
    const text = "clone from https://github.com/org/repo.git";
    expect(stripGitCredentials(text)).toBe(text);
  });
});

// ---------------------------------------------------------------------------
// truncateToolOutput
// ---------------------------------------------------------------------------
describe("truncateToolOutput", () => {
  it("truncates output exceeding maxChars", async () => {
    const { truncateToolOutput } = await importSanitize();
    const long = "x".repeat(1000);
    const result = truncateToolOutput(long, 200);
    expect(result.length).toBeLessThan(long.length);
    expect(result).toContain("… [truncated");
  });

  it("leaves short output unchanged", async () => {
    const { truncateToolOutput } = await importSanitize();
    const short = "short output";
    expect(truncateToolOutput(short, 800)).toBe(short);
  });

  it("truncates to exactly maxChars before the notice", async () => {
    const { truncateToolOutput } = await importSanitize();
    const text = "a".repeat(900);
    const result = truncateToolOutput(text, 800);
    expect(result.startsWith("a".repeat(800))).toBe(true);
    expect(result).toContain("100 chars");
  });
});

// ---------------------------------------------------------------------------
// sanitizeText (composite)
// ---------------------------------------------------------------------------
describe("sanitizeText", () => {
  it("strips git credentials AND masks secrets in one pass", async () => {
    const { sanitizeText } = await importSanitize();
    const text =
      "Pushed to https://user:ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcd123456@github.com/org/repo";
    const result = sanitizeText(text);
    expect(result).not.toContain("user:ghp_");
    expect(result).toContain("https://github.com");
  });

  it("redacts infra details that slip through in task prompts", async () => {
    const { sanitizeText } = await importSanitize();
    const text =
      "SANDBOX RULES: namespace: fenrir-agents, cluster: fenrir-prod";
    const result = sanitizeText(text);
    expect(result).not.toContain("fenrir-agents");
    expect(result).not.toContain("fenrir-prod");
  });

  it("returns non-string input unchanged", async () => {
    const { sanitizeText } = await importSanitize();
    expect(sanitizeText(42 as unknown as string)).toBe(42);
    expect(sanitizeText(null as unknown as string)).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// sanitizeToolOutput (composite + truncation)
// ---------------------------------------------------------------------------
describe("sanitizeToolOutput", () => {
  it("truncates and sanitizes in one call", async () => {
    const { sanitizeToolOutput } = await importSanitize();
    const secret = "sk-ant-api03-" + "Z".repeat(40);
    const long = secret + " ".repeat(900);
    const result = sanitizeToolOutput(long, 800);
    expect(result).toContain("… [truncated");
    // Secret (in the first 800 chars) should be masked
    expect(result).not.toContain("Z".repeat(40));
  });
});
