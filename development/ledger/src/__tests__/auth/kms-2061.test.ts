/**
 * Unit tests for KMS envelope decrypt utility — Fenrir Ledger
 *
 * Tests the initJwtSecret / getJwtSecret lifecycle:
 *   - Dev mode: reads FENRIR_JWT_SECRET directly (no KMS call)
 *   - Prod mode: decrypts FENRIR_JWT_SECRET_CIPHERTEXT via Cloud KMS
 *   - Error paths: missing env vars, empty KMS response
 *
 * @see src/lib/auth/kms.ts
 * @ref #2061
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock @google-cloud/kms before importing the module under test.
// vi.hoisted ensures the mock variable is available when vi.mock factory runs.
// ---------------------------------------------------------------------------

const { mockDecrypt } = vi.hoisted(() => ({ mockDecrypt: vi.fn() }));

vi.mock("@google-cloud/kms", () => {
  class KeyManagementServiceClient {
    decrypt = mockDecrypt;
  }
  return { KeyManagementServiceClient };
});

// ---------------------------------------------------------------------------
// Import module under test (after mocks are registered)
// ---------------------------------------------------------------------------

import {
  initJwtSecret,
  getJwtSecret,
  _resetJwtSecretForTesting,
} from "@/lib/auth/kms";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

function setEnv(overrides: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("kms — development mode (NODE_ENV !== production)", () => {
  beforeEach(() => {
    _resetJwtSecretForTesting();
    setEnv({ NODE_ENV: "test" });
    mockDecrypt.mockReset();
  });

  afterEach(() => {
    setEnv({ NODE_ENV: ORIGINAL_NODE_ENV });
    _resetJwtSecretForTesting();
  });

  it("reads FENRIR_JWT_SECRET directly without calling KMS", async () => {
    setEnv({ FENRIR_JWT_SECRET: "dev-signing-secret-abc" });
    await initJwtSecret();
    expect(getJwtSecret()).toBe("dev-signing-secret-abc");
    expect(mockDecrypt).not.toHaveBeenCalled();
  });

  it("throws if FENRIR_JWT_SECRET is missing in dev", async () => {
    setEnv({ FENRIR_JWT_SECRET: undefined });
    await expect(initJwtSecret()).rejects.toThrow("FENRIR_JWT_SECRET");
  });

  it("is idempotent — second call is a no-op", async () => {
    setEnv({ FENRIR_JWT_SECRET: "dev-secret" });
    await initJwtSecret();
    await initJwtSecret(); // second call — should not re-read env
    expect(getJwtSecret()).toBe("dev-secret");
  });
});

describe("kms — production mode (NODE_ENV === production)", () => {
  beforeEach(() => {
    _resetJwtSecretForTesting();
    setEnv({ NODE_ENV: "production" });
    mockDecrypt.mockReset();
  });

  afterEach(() => {
    setEnv({ NODE_ENV: ORIGINAL_NODE_ENV });
    _resetJwtSecretForTesting();
  });

  it("decrypts ciphertext via KMS and caches the result", async () => {
    const plaintext = Buffer.from("prod-jwt-secret-xyz");
    mockDecrypt.mockResolvedValue([{ plaintext }]);

    setEnv({
      FENRIR_JWT_SECRET_CIPHERTEXT: Buffer.from("fake-ciphertext").toString("base64"),
      KMS_KEY_NAME: "projects/proj/locations/us-central1/keyRings/fenrir-keys/cryptoKeys/fenrir-envelope",
    });

    await initJwtSecret();

    expect(mockDecrypt).toHaveBeenCalledOnce();
    expect(mockDecrypt).toHaveBeenCalledWith({
      name: "projects/proj/locations/us-central1/keyRings/fenrir-keys/cryptoKeys/fenrir-envelope",
      ciphertext: expect.any(Buffer),
    });
    expect(getJwtSecret()).toBe("prod-jwt-secret-xyz");
  });

  it("trims trailing whitespace from plaintext", async () => {
    const plaintext = Buffer.from("trimmed-secret  \n");
    mockDecrypt.mockResolvedValue([{ plaintext }]);
    setEnv({
      FENRIR_JWT_SECRET_CIPHERTEXT: "dGVzdA==",
      KMS_KEY_NAME: "projects/proj/locations/us-central1/keyRings/r/cryptoKeys/k",
    });
    await initJwtSecret();
    expect(getJwtSecret()).toBe("trimmed-secret");
  });

  it("is idempotent — KMS is called only once even if initJwtSecret is called twice", async () => {
    const plaintext = Buffer.from("once-secret");
    mockDecrypt.mockResolvedValue([{ plaintext }]);
    setEnv({
      FENRIR_JWT_SECRET_CIPHERTEXT: "dGVzdA==",
      KMS_KEY_NAME: "projects/proj/locations/us-central1/keyRings/r/cryptoKeys/k",
    });
    await initJwtSecret();
    await initJwtSecret();
    expect(mockDecrypt).toHaveBeenCalledOnce();
  });

  it("throws if FENRIR_JWT_SECRET_CIPHERTEXT is missing", async () => {
    setEnv({
      FENRIR_JWT_SECRET_CIPHERTEXT: undefined,
      KMS_KEY_NAME: "projects/proj/locations/us-central1/keyRings/r/cryptoKeys/k",
    });
    await expect(initJwtSecret()).rejects.toThrow("FENRIR_JWT_SECRET_CIPHERTEXT");
  });

  it("throws if KMS_KEY_NAME is missing", async () => {
    setEnv({
      FENRIR_JWT_SECRET_CIPHERTEXT: "dGVzdA==",
      KMS_KEY_NAME: undefined,
    });
    await expect(initJwtSecret()).rejects.toThrow("KMS_KEY_NAME");
  });

  it("throws if KMS returns empty plaintext", async () => {
    mockDecrypt.mockResolvedValue([{ plaintext: null }]);
    setEnv({
      FENRIR_JWT_SECRET_CIPHERTEXT: "dGVzdA==",
      KMS_KEY_NAME: "projects/proj/locations/us-central1/keyRings/r/cryptoKeys/k",
    });
    await expect(initJwtSecret()).rejects.toThrow("empty plaintext");
  });
});

describe("getJwtSecret — before init", () => {
  beforeEach(() => {
    _resetJwtSecretForTesting();
  });

  it("throws a descriptive error if called before initJwtSecret", () => {
    expect(() => getJwtSecret()).toThrow("not initialised");
  });
});

describe("kms — production mode: KMS client failure", () => {
  beforeEach(() => {
    _resetJwtSecretForTesting();
    setEnv({
      NODE_ENV: "production",
      FENRIR_JWT_SECRET_CIPHERTEXT: "dGVzdA==",
      KMS_KEY_NAME: "projects/proj/locations/us-central1/keyRings/r/cryptoKeys/k",
    });
    mockDecrypt.mockReset();
  });

  afterEach(() => {
    setEnv({ NODE_ENV: ORIGINAL_NODE_ENV });
    _resetJwtSecretForTesting();
  });

  it("propagates KMS network errors so pod startup fails loudly", async () => {
    mockDecrypt.mockRejectedValue(new Error("UNAVAILABLE: DNS resolution failed"));
    await expect(initJwtSecret()).rejects.toThrow("UNAVAILABLE: DNS resolution failed");
  });

  it("propagates KMS IAM/permission errors", async () => {
    mockDecrypt.mockRejectedValue(
      new Error("PERMISSION_DENIED: Permission denied on resource")
    );
    await expect(initJwtSecret()).rejects.toThrow("PERMISSION_DENIED");
  });

  it("leaves cache empty after a failed decrypt — next call retries KMS", async () => {
    mockDecrypt.mockRejectedValueOnce(new Error("transient error"));
    await expect(initJwtSecret()).rejects.toThrow("transient error");

    // After failure the secret is still null — second attempt should retry KMS
    const plaintext = Buffer.from("retry-secret");
    mockDecrypt.mockResolvedValueOnce([{ plaintext }]);
    await initJwtSecret();
    expect(getJwtSecret()).toBe("retry-secret");
    expect(mockDecrypt).toHaveBeenCalledTimes(2);
  });
});
