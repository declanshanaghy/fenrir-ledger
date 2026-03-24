/**
 * Vitest validation tests for shared test fixtures — issue #1858
 *
 * Validates that every builder:
 *   - Returns an object satisfying the required schema
 *   - Applies overrides correctly
 *   - Has consistent cross-fixture defaults (householdId, userId, etc.)
 */

import { describe, it, expect } from "vitest";
import { makeCard, makeDeletedCard } from "./cards";
import { makeUser } from "./users";
import { makeHousehold } from "./households";
import { makeJsonResponse, makeErrorResponse } from "./responses";

// ── makeCard ───────────────────────────────────────────────────────────────

describe("makeCard", () => {
  it("returns an object with all required Card fields", () => {
    const card = makeCard();
    expect(card.id).toMatch(/^card-\d+$/);
    expect(card.householdId).toBe("hh-test");
    expect(card.issuerId).toBe("chase");
    expect(card.cardName).toBe("Test Card");
    expect(card.openDate).toBe("2025-01-01T00:00:00.000Z");
    expect(card.creditLimit).toBe(5000);   // dollars
    expect(card.annualFee).toBe(0);
    expect(card.annualFeeDate).toBe("");
    expect(card.promoPeriodMonths).toBe(0);
    expect(card.signUpBonus).toBeNull();
    expect(card.status).toBe("active");
    expect(card.notes).toBe("");
    expect(card.createdAt).toBe("2025-01-01T00:00:00.000Z");
    expect(card.updatedAt).toBe("2025-01-01T00:00:00.000Z");
    expect(card.deletedAt).toBeUndefined();
  });

  it("produces unique ids on successive calls", () => {
    const a = makeCard();
    const b = makeCard();
    expect(a.id).not.toBe(b.id);
  });

  it("applies a single field override without mutating defaults", () => {
    const card = makeCard({ cardName: "Sapphire Preferred", creditLimit: 1000000 });
    expect(card.cardName).toBe("Sapphire Preferred");
    expect(card.creditLimit).toBe(1000000);
    expect(card.householdId).toBe("hh-test"); // unchanged
  });

  it("overrides id when provided", () => {
    const card = makeCard({ id: "my-specific-id" });
    expect(card.id).toBe("my-specific-id");
  });

  it("allows status to be set to closed", () => {
    const card = makeCard({ status: "closed", closedAt: "2026-01-01T00:00:00.000Z" });
    expect(card.status).toBe("closed");
    expect(card.closedAt).toBe("2026-01-01T00:00:00.000Z");
  });
});

// ── makeDeletedCard ────────────────────────────────────────────────────────

describe("makeDeletedCard", () => {
  it("sets deletedAt to a non-empty ISO string", () => {
    const card = makeDeletedCard();
    expect(card.deletedAt).toBeDefined();
    expect(typeof card.deletedAt).toBe("string");
    expect(card.deletedAt!.length).toBeGreaterThan(0);
  });

  it("preserves other defaults from makeCard", () => {
    const card = makeDeletedCard();
    expect(card.householdId).toBe("hh-test");
    expect(card.status).toBe("active");
  });

  it("forwards overrides past the deletedAt default", () => {
    const card = makeDeletedCard({ cardName: "Deleted Chase", householdId: "hh-other" });
    expect(card.cardName).toBe("Deleted Chase");
    expect(card.householdId).toBe("hh-other");
    expect(card.deletedAt).toBeDefined();
  });

  it("allows caller to override deletedAt", () => {
    const card = makeDeletedCard({ deletedAt: "2025-06-15T00:00:00.000Z" });
    expect(card.deletedAt).toBe("2025-06-15T00:00:00.000Z");
  });
});

// ── makeUser ───────────────────────────────────────────────────────────────

describe("makeUser", () => {
  it("returns an object with all required FirestoreUser fields", () => {
    const user = makeUser();
    expect(user.userId).toBe("user-001");
    expect(user.email).toBe("test@example.com");
    expect(user.displayName).toBe("Test User");
    expect(user.householdId).toBe("hh-test");
    expect(user.role).toBe("owner");
    expect(user.createdAt).toBe("2025-01-01T00:00:00.000Z");
    expect(user.updatedAt).toBe("2025-01-01T00:00:00.000Z");
    expect(user.stripeCustomerId).toBeUndefined();
  });

  it("applies overrides correctly", () => {
    const user = makeUser({ role: "member", userId: "user-002", email: "member@example.com" });
    expect(user.role).toBe("member");
    expect(user.userId).toBe("user-002");
    expect(user.email).toBe("member@example.com");
    expect(user.householdId).toBe("hh-test"); // unchanged
  });

  it("supports optional stripeCustomerId override", () => {
    const user = makeUser({ stripeCustomerId: "cus_abc123" });
    expect(user.stripeCustomerId).toBe("cus_abc123");
  });
});

// ── makeHousehold ──────────────────────────────────────────────────────────

describe("makeHousehold", () => {
  it("returns an object with all required FirestoreHousehold fields", () => {
    const hh = makeHousehold();
    expect(hh.id).toBe("hh-test");
    expect(hh.name).toBe("Test Household");
    expect(hh.ownerId).toBe("user-001");
    expect(hh.memberIds).toContain("user-001");
    expect(hh.inviteCode).toBe("ABCDEF");
    expect(typeof hh.inviteCodeExpiresAt).toBe("string");
    expect(hh.createdAt).toBe("2025-01-01T00:00:00.000Z");
    expect(hh.updatedAt).toBe("2025-01-01T00:00:00.000Z");
  });

  it("applies overrides correctly", () => {
    const hh = makeHousehold({ name: "The Shanaghys", id: "hh-456" });
    expect(hh.name).toBe("The Shanaghys");
    expect(hh.id).toBe("hh-456");
    expect(hh.ownerId).toBe("user-001"); // unchanged
  });

  it("inviteCodeExpiresAt is in the future", () => {
    const hh = makeHousehold();
    const expiresAt = new Date(hh.inviteCodeExpiresAt).getTime();
    expect(expiresAt).toBeGreaterThan(Date.now());
  });

  it("memberIds can be overridden with multiple members", () => {
    const hh = makeHousehold({ memberIds: ["user-001", "user-002"] });
    expect(hh.memberIds).toHaveLength(2);
    expect(hh.memberIds).toContain("user-002");
  });
});

// ── Cross-fixture consistency ──────────────────────────────────────────────

describe("fixture cross-consistency", () => {
  it("makeCard default householdId matches makeHousehold default id", () => {
    const card = makeCard();
    const hh = makeHousehold();
    expect(card.householdId).toBe(hh.id);
  });

  it("makeUser default householdId matches makeHousehold default id", () => {
    const user = makeUser();
    const hh = makeHousehold();
    expect(user.householdId).toBe(hh.id);
  });

  it("makeHousehold ownerId matches makeUser default userId", () => {
    const user = makeUser();
    const hh = makeHousehold();
    expect(hh.ownerId).toBe(user.userId);
  });

  it("makeHousehold memberIds includes makeUser default userId", () => {
    const user = makeUser();
    const hh = makeHousehold();
    expect(hh.memberIds).toContain(user.userId);
  });
});

// ── makeJsonResponse ───────────────────────────────────────────────────────

describe("makeJsonResponse", () => {
  it("returns a 200 response with JSON content-type by default", () => {
    const res = makeJsonResponse({ ok: true });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");
  });

  it("body parses to the provided data object", async () => {
    const res = makeJsonResponse({ cards: [], total: 0 });
    const body = await res.json();
    expect(body).toEqual({ cards: [], total: 0 });
  });

  it("accepts a custom status code", () => {
    const res = makeJsonResponse({ created: true }, 201);
    expect(res.status).toBe(201);
  });
});

// ── makeErrorResponse ──────────────────────────────────────────────────────

describe("makeErrorResponse", () => {
  it("returns a 400 response by default", () => {
    const res = makeErrorResponse("invalid_request");
    expect(res.status).toBe(400);
  });

  it("body contains error and error_description fields", async () => {
    const res = makeErrorResponse("unauthorized", "Token expired");
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
    expect(body.error_description).toBe("Token expired");
  });

  it("error_description defaults to empty string", async () => {
    const res = makeErrorResponse("not_found");
    const body = await res.json();
    expect(body.error_description).toBe("");
  });

  it("accepts a custom status code", () => {
    const res = makeErrorResponse("forbidden", "Access denied", 403);
    expect(res.status).toBe(403);
  });
});
