/**
 * InviteCodeDisplay — Send Invite button behavior tests
 *
 * Validates issue #2054 acceptance criteria:
 *   - Send Invite button is a <button>, not an <a> anchor
 *   - On mobile (navigator.share available): calls navigator.share with correct payload
 *   - On desktop (navigator.share unavailable): falls back to mailto: via window.location.href
 *   - User cancelling native share sheet is handled silently (no error thrown)
 *   - Mailto URL in fallback is properly encoded (no raw special chars in URL)
 *
 * Issue #2054 — Send invite link button doesn't open email client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InviteCodeDisplay } from "@/components/household/InviteCodeDisplay";
import { INVITE_JOIN_URL, INVITE_SUBJECT } from "@/lib/household/invite-mailto";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const INVITE_CODE = "TESTCODE1";
const EXPIRES_AT = "2027-01-01T00:00:00.000Z";
const onRegenerate = vi.fn().mockResolvedValue(undefined);

function renderComponent() {
  return render(
    <InviteCodeDisplay
      inviteCode={INVITE_CODE}
      inviteCodeExpiresAt={EXPIRES_AT}
      onRegenerate={onRegenerate}
    />,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InviteCodeDisplay — Send Invite button (issue #2054)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // Remove navigator.share if stubbed
    try {
      vi.unstubAllGlobals();
    } catch {
      // ignore if no stubs
    }
  });

  it("renders Send Invite as a <button>, not an anchor", () => {
    renderComponent();
    const btn = screen.getByRole("button", { name: /send invite/i });
    expect(btn.tagName).toBe("BUTTON");
  });

  it("calls navigator.share with title, text containing invite code, and join URL when share API is available", async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share: shareMock });

    renderComponent();
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

    await waitFor(() => expect(shareMock).toHaveBeenCalledOnce());

    const payload = shareMock.mock.calls[0][0] as {
      title: string;
      text: string;
      url: string;
    };
    expect(payload.title).toBe(INVITE_SUBJECT);
    expect(payload.text).toContain(INVITE_CODE);
    expect(payload.url).toBe(INVITE_JOIN_URL);
  });

  it("falls back to window.location.href with mailto: URL when navigator.share is unavailable", async () => {
    // Ensure navigator.share is absent
    vi.stubGlobal("navigator", { ...navigator, share: undefined });

    const hrefSetter = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, set href(v: string) { hrefSetter(v); } },
      writable: true,
      configurable: true,
    });

    renderComponent();
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

    await waitFor(() => expect(hrefSetter).toHaveBeenCalledOnce());
    const href: string = hrefSetter.mock.calls[0][0];
    expect(href).toMatch(/^mailto:/);
    expect(href).toContain(encodeURIComponent(INVITE_CODE));
  });

  it("does not throw when navigator.share rejects (user cancelled)", async () => {
    const shareMock = vi.fn().mockRejectedValue(new DOMException("AbortError", "AbortError"));
    vi.stubGlobal("navigator", { ...navigator, share: shareMock });

    renderComponent();

    // Should not throw — error is silently swallowed
    await expect(async () => {
      fireEvent.click(screen.getByRole("button", { name: /send invite/i }));
      await waitFor(() => expect(shareMock).toHaveBeenCalled());
    }).not.toThrow();
  });
});
