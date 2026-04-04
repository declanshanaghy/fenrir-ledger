/**
 * Tests for Next.js instrumentation startup hook — Fenrir Ledger
 *
 * Validates that register() correctly guards the KMS init call behind
 * the Node.js runtime check (NEXT_RUNTIME === 'nodejs').
 *
 * @see src/instrumentation.ts
 * @ref #2061
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock the kms module so register() can be tested in isolation
// ---------------------------------------------------------------------------

const mockInitJwtSecret = vi.fn();

vi.mock("@/lib/auth/kms", () => ({
  initJwtSecret: mockInitJwtSecret,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const ORIGINAL_NEXT_RUNTIME = process.env.NEXT_RUNTIME;

describe("instrumentation register() — runtime guard", () => {
  beforeEach(() => {
    mockInitJwtSecret.mockReset();
    mockInitJwtSecret.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (ORIGINAL_NEXT_RUNTIME === undefined) {
      delete process.env.NEXT_RUNTIME;
    } else {
      process.env.NEXT_RUNTIME = ORIGINAL_NEXT_RUNTIME;
    }
  });

  it("calls initJwtSecret when NEXT_RUNTIME is nodejs", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    // Re-import to pick up the current env state
    const { register } = await import("../instrumentation");
    await register();
    expect(mockInitJwtSecret).toHaveBeenCalledOnce();
  });

  it("does NOT call initJwtSecret when NEXT_RUNTIME is edge", async () => {
    process.env.NEXT_RUNTIME = "edge";
    const { register } = await import("../instrumentation");
    await register();
    expect(mockInitJwtSecret).not.toHaveBeenCalled();
  });

  it("does NOT call initJwtSecret when NEXT_RUNTIME is undefined", async () => {
    delete process.env.NEXT_RUNTIME;
    const { register } = await import("../instrumentation");
    await register();
    expect(mockInitJwtSecret).not.toHaveBeenCalled();
  });
});
