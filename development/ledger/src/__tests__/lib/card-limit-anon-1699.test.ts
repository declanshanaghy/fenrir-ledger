/**
 * card-limit — anonymous user messaging tests (Issue #1699)
 *
 * Validates that canAddCard() returns trial-sign-in copy for anon users
 * and upgrade-to-Karl copy for signed-in Thrall users when the card limit
 * is hit.
 */

import { describe, it, expect } from "vitest";
import { canAddCard } from "@/lib/entitlement/card-limit";
import { THRALL_CARD_LIMIT } from "@/lib/entitlement/types";

describe("canAddCard — isAnonymous messaging (issue #1699)", () => {
  it("returns trial sign-in copy for anon user at limit", () => {
    const result = canAddCard("thrall", THRALL_CARD_LIMIT, false, true);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Sign in");
    expect(result.reason).toContain("free 30-day trial");
  });

  it("returns Karl upgrade copy for Thrall (signed-in) user at limit", () => {
    const result = canAddCard("thrall", THRALL_CARD_LIMIT, false, false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Karl");
    expect(result.reason).toContain("Upgrade");
  });

  it("defaults isAnonymous to false (backwards-compatible)", () => {
    const result = canAddCard("thrall", THRALL_CARD_LIMIT, false);
    expect(result.allowed).toBe(false);
    // Default message is the Thrall upgrade copy
    expect(result.reason).toContain("Karl");
    expect(result.reason).not.toContain("Sign in");
  });

  it("anon user below limit is still allowed", () => {
    const result = canAddCard("thrall", THRALL_CARD_LIMIT - 1, false, true);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("anon user with active trial is allowed past limit", () => {
    const result = canAddCard("thrall", THRALL_CARD_LIMIT, true, true);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBeNull();
  });
});
