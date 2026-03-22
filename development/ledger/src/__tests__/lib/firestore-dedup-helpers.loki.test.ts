/**
 * Loki QA — Firestore dedup helpers: isEventProcessed / markEventProcessed
 *
 * Unit tests for the Firestore deduplication helpers added in issue #1518.
 * Tests the business logic directly (TTL, data shape, Firestore path).
 *
 * Covers:
 *   - isEventProcessed returns false when doc does not exist
 *   - isEventProcessed returns true when doc exists
 *   - markEventProcessed writes to correct collection path
 *   - markEventProcessed writes eventId, processedAt, expiresAt fields
 *   - markEventProcessed expiresAt is exactly 24h after processedAt
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock Firestore Admin SDK ──────────────────────────────────────────────────

const mockDocSet = vi.hoisted(() => vi.fn());
const mockDocGet = vi.hoisted(() => vi.fn());
const mockDoc = vi.hoisted(() => vi.fn());

vi.mock("@google-cloud/firestore", () => {
  function MockFirestore() {
    return { doc: mockDoc };
  }
  return { Firestore: MockFirestore };
});

vi.stubEnv("FIRESTORE_PROJECT_ID", "fenrir-test-project");

// Import the real helpers (not mocked) after the SDK mock is in place
import { isEventProcessed, markEventProcessed, _resetFirestoreForTests } from "@/lib/firebase/firestore";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("isEventProcessed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetFirestoreForTests();
    mockDoc.mockReturnValue({ get: mockDocGet, set: mockDocSet });
  });

  it("returns false when the processedEvents doc does not exist", async () => {
    mockDocGet.mockResolvedValue({ exists: false });

    const result = await isEventProcessed("evt_nonexistent");

    expect(result).toBe(false);
  });

  it("returns true when the processedEvents doc exists", async () => {
    mockDocGet.mockResolvedValue({ exists: true });

    const result = await isEventProcessed("evt_seen_before");

    expect(result).toBe(true);
  });

  it("reads from processedEvents/{eventId} path", async () => {
    mockDocGet.mockResolvedValue({ exists: false });

    await isEventProcessed("evt_path_read_check");

    expect(mockDoc).toHaveBeenCalledWith("processedEvents/evt_path_read_check");
  });
});

describe("markEventProcessed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetFirestoreForTests();
    mockDoc.mockReturnValue({ get: mockDocGet, set: mockDocSet });
    mockDocSet.mockResolvedValue(undefined);
  });

  it("writes to processedEvents/{eventId} path", async () => {
    await markEventProcessed("evt_write_path");

    expect(mockDoc).toHaveBeenCalledWith("processedEvents/evt_write_path");
  });

  it("writes eventId, processedAt, and expiresAt fields", async () => {
    const before = new Date();
    await markEventProcessed("evt_structure_check");
    const after = new Date();

    expect(mockDocSet).toHaveBeenCalledTimes(1);
    const written = mockDocSet.mock.calls[0]![0];

    expect(written.eventId).toBe("evt_structure_check");
    expect(typeof written.processedAt).toBe("string");
    expect(written.expiresAt).toBeInstanceOf(Date);

    const processedAt = new Date(written.processedAt);
    expect(processedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(processedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("sets expiresAt to exactly 24 hours after processedAt", async () => {
    await markEventProcessed("evt_ttl_check");

    const written = mockDocSet.mock.calls[0]![0];
    const processedAt = new Date(written.processedAt as string);
    const expiresAt: Date = written.expiresAt;

    const diffMs = expiresAt.getTime() - processedAt.getTime();
    const expectedTtlMs = 24 * 60 * 60 * 1000;

    expect(diffMs).toBe(expectedTtlMs);
  });

  it("calls Firestore set (not update or create), enabling idempotent writes", async () => {
    await markEventProcessed("evt_idempotent");

    // Must use .set() not .update() to ensure idempotency (safe for concurrent delivery)
    expect(mockDocSet).toHaveBeenCalledTimes(1);
    expect(mockDocGet).not.toHaveBeenCalled();
  });
});
