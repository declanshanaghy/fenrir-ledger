/**
 * Tests for invite-mailto utility — issue #1793
 */

import { describe, it, expect } from "vitest";
import {
  buildInviteMailtoUrl,
  pickRandomIntro,
  INVITE_INTRO_POOL,
} from "@/lib/household/invite-mailto";

describe("pickRandomIntro", () => {
  it("returns an item from the pool", () => {
    const result = pickRandomIntro();
    expect(INVITE_INTRO_POOL).toContain(result);
  });

  it("pool has at least 5 variants", () => {
    expect(INVITE_INTRO_POOL.length).toBeGreaterThanOrEqual(5);
  });

  it("uses custom random function to pick deterministically", () => {
    // random() = 0 → index 0
    const first = pickRandomIntro(INVITE_INTRO_POOL, () => 0);
    expect(first).toBe(INVITE_INTRO_POOL[0]);

    // random() = 0.999 → last index
    const last = pickRandomIntro(INVITE_INTRO_POOL, () => 0.9999);
    expect(last).toBe(INVITE_INTRO_POOL[INVITE_INTRO_POOL.length - 1]);
  });

  it("can return all variants via sweep", () => {
    const seen = new Set<string>();
    for (let i = 0; i < INVITE_INTRO_POOL.length; i++) {
      const r = i / INVITE_INTRO_POOL.length;
      seen.add(pickRandomIntro(INVITE_INTRO_POOL, () => r));
    }
    expect(seen.size).toBe(INVITE_INTRO_POOL.length);
  });

  it("accepts a custom pool", () => {
    const customPool = ["alpha", "beta", "gamma"];
    expect(pickRandomIntro(customPool, () => 0)).toBe("alpha");
    expect(pickRandomIntro(customPool, () => 0.34)).toBe("beta");
    expect(pickRandomIntro(customPool, () => 0.67)).toBe("gamma");
  });
});

describe("buildInviteMailtoUrl", () => {
  const code = "ABC123";

  it("starts with mailto:your-friend@example.com?", () => {
    const url = buildInviteMailtoUrl(code);
    expect(url).toMatch(/^mailto:your-friend@example\.com\?/);
  });

  it("has placeholder recipient your-friend@example.com", () => {
    const url = buildInviteMailtoUrl(code);
    // mailto:your-friend@example.com?subject=... means placeholder recipient before the ?
    expect(url.startsWith("mailto:your-friend@example.com?")).toBe(true);
  });

  it("encodes the subject correctly", () => {
    const url = buildInviteMailtoUrl(code);
    expect(url).toContain(
      `subject=${encodeURIComponent("Join my Fenrir Ledger household")}`,
    );
  });

  it("body includes the invite code", () => {
    const url = buildInviteMailtoUrl(code, { random: () => 0 });
    const params = new URLSearchParams(url.replace("mailto:your-friend@example.com?", ""));
    const body = params.get("body") ?? "";
    expect(body).toContain(`Invite code: ${code}`);
  });

  it("body includes join instructions", () => {
    const url = buildInviteMailtoUrl(code, { random: () => 0 });
    const params = new URLSearchParams(url.replace("mailto:your-friend@example.com?", ""));
    const body = params.get("body") ?? "";
    expect(body).toContain("fenrirledger.com");
    expect(body).toContain("Settings > Household");
    expect(body).toContain("Join a Household");
  });

  it("body includes a Fenrir intro from the pool", () => {
    const url = buildInviteMailtoUrl(code, { random: () => 0 });
    const params = new URLSearchParams(url.replace("mailto:your-friend@example.com?", ""));
    const body = params.get("body") ?? "";
    expect(INVITE_INTRO_POOL.some((intro) => body.includes(intro))).toBe(true);
  });

  it("rotates intro based on random value", () => {
    const url0 = buildInviteMailtoUrl(code, { random: () => 0 });
    const url1 = buildInviteMailtoUrl(code, { random: () => 0.9999 });
    expect(url0).not.toBe(url1);
  });

  it("URL-encodes special characters in invite code", () => {
    const specialCode = "A B+C&D";
    const url = buildInviteMailtoUrl(specialCode, { random: () => 0 });
    // The body param must be URL-encoded — raw special chars should not appear unencoded in the URL
    const bodyParam = url.split("body=")[1];
    expect(bodyParam).not.toContain("A B+C&D");
    const decoded = decodeURIComponent(bodyParam);
    expect(decoded).toContain(`Invite code: ${specialCode}`);
  });
});
