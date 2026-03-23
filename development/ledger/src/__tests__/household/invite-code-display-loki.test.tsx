/**
 * Loki QA — InviteCodeDisplay: Send Invite mailto button
 *
 * Issue #1793 — Add Send Invite mailto button for household invites
 *
 * Tests the "Send Invite" anchor rendered by InviteCodeDisplay:
 * - Present in the DOM
 * - href is a valid mailto: URL with no recipient
 * - Subject matches spec
 * - aria-label is accessible
 * - Invite code appears in the email body
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InviteCodeDisplay } from "@/components/household/InviteCodeDisplay";

const defaultProps = {
  inviteCode: "WOLF42",
  inviteCodeExpiresAt: "2026-06-01T00:00:00.000Z",
  onRegenerate: vi.fn(),
};

function renderComponent(inviteCode = "WOLF42") {
  return render(
    <InviteCodeDisplay
      {...defaultProps}
      inviteCode={inviteCode}
    />,
  );
}

describe("InviteCodeDisplay — Send Invite link (issue #1793)", () => {
  it("renders a 'Send Invite' link", () => {
    renderComponent();
    const link = screen.getByRole("link", { name: /send invite via email/i });
    expect(link).toBeDefined();
  });

  it("link text reads 'Send Invite'", () => {
    renderComponent();
    expect(screen.getByText("Send Invite")).toBeDefined();
  });

  it("link has aria-label 'Send invite via email'", () => {
    renderComponent();
    const link = screen.getByRole("link", { name: "Send invite via email" });
    expect(link).toBeDefined();
  });

  it("href starts with 'mailto:?'  — no recipient pre-filled", () => {
    renderComponent();
    const link = screen.getByRole("link", { name: /send invite via email/i }) as HTMLAnchorElement;
    expect(link.href).toMatch(/^mailto:\?/);
  });

  it("href encodes the correct subject", () => {
    renderComponent();
    const link = screen.getByRole("link", { name: /send invite via email/i }) as HTMLAnchorElement;
    expect(link.href).toContain(encodeURIComponent("Join my Fenrir Ledger household"));
  });

  it("href body includes the invite code", () => {
    renderComponent("WOLF42");
    const link = screen.getByRole("link", { name: /send invite via email/i }) as HTMLAnchorElement;
    const bodyParam = link.href.split("body=")[1] ?? "";
    const decoded = decodeURIComponent(bodyParam);
    expect(decoded).toContain("WOLF42");
  });

  it("href body includes join instructions", () => {
    renderComponent();
    const link = screen.getByRole("link", { name: /send invite via email/i }) as HTMLAnchorElement;
    const bodyParam = link.href.split("body=")[1] ?? "";
    const decoded = decodeURIComponent(bodyParam);
    expect(decoded).toContain("fenrirledger.com");
    expect(decoded).toContain("Settings > Household");
  });

  it("updates href when inviteCode prop changes", () => {
    const { rerender } = render(<InviteCodeDisplay {...defaultProps} inviteCode="WOLF42" />);
    const link1 = screen.getByRole("link", { name: /send invite via email/i }) as HTMLAnchorElement;
    const href1 = link1.href;

    rerender(<InviteCodeDisplay {...defaultProps} inviteCode="NEWCO" />);
    const link2 = screen.getByRole("link", { name: /send invite via email/i }) as HTMLAnchorElement;
    const href2 = link2.href;

    expect(href1).not.toBe(href2);
    const decoded2 = decodeURIComponent(href2.split("body=")[1] ?? "");
    expect(decoded2).toContain("NEWCO");
  });
});
