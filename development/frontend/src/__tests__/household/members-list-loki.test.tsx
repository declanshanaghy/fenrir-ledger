/**
 * Loki QA tests for MembersList component and InviteCodeDisplay component
 *
 * Tests DOM structure, "(you)" suffix, role badges, and initials generation.
 * Issue #1123 — Household invite code flow
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MembersList } from "@/components/household/MembersList";
import { InviteCodeDisplay } from "@/components/household/InviteCodeDisplay";

// ── MembersList ───────────────────────────────────────────────────────────────

describe("MembersList — behaviour", () => {
  const members = [
    {
      clerkUserId: "u_thor",
      displayName: "Thorvald Eriksen",
      email: "thor@example.com",
      role: "owner" as const,
      isCurrentUser: false,
    },
    {
      clerkUserId: "u_me",
      displayName: "Björn Andersen",
      email: "bjorn@example.com",
      role: "member" as const,
      isCurrentUser: true,
    },
  ];

  it("renders a listitem for each member", () => {
    render(<MembersList members={members} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
  });

  it("shows (you) suffix for isCurrentUser member", () => {
    render(<MembersList members={members} />);
    expect(screen.getByText("(you)")).toBeDefined();
  });

  it("does not show (you) for non-current members", () => {
    const nonCurrentMembers = members.map((m) => ({ ...m, isCurrentUser: false }));
    render(<MembersList members={nonCurrentMembers} />);
    expect(screen.queryByText("(you)")).toBeNull();
  });

  it("renders 'Owner' role badge for owner", () => {
    render(<MembersList members={members} />);
    expect(screen.getByText("Owner")).toBeDefined();
  });

  it("renders 'Member' role badge for member", () => {
    render(<MembersList members={members} />);
    expect(screen.getByText("Member")).toBeDefined();
  });

  it("renders initials for two-word name (first + last)", () => {
    render(<MembersList members={members} />);
    expect(screen.getByText("TE")).toBeDefined(); // Thorvald Eriksen
  });

  it("renders initials for single-word name (first 2 chars)", () => {
    const singleName = [
      {
        clerkUserId: "u_odin",
        displayName: "Odin",
        email: "odin@valhalla.com",
        role: "member" as const,
        isCurrentUser: false,
      },
    ];
    render(<MembersList members={singleName} />);
    expect(screen.getByText("OD")).toBeDefined();
  });

  it("renders member email", () => {
    render(<MembersList members={members} />);
    expect(screen.getByText("thor@example.com")).toBeDefined();
  });
});

// ── InviteCodeDisplay ─────────────────────────────────────────────────────────

describe("InviteCodeDisplay — behaviour", () => {
  const defaultProps = {
    inviteCode: "X7K2NP",
    inviteCodeExpiresAt: "2026-04-16T00:00:00.000Z",
    onRegenerate: vi.fn().mockResolvedValue(undefined),
    isRegenerating: false,
  };

  it("renders the invite code text", () => {
    render(<InviteCodeDisplay {...defaultProps} />);
    expect(screen.getByText("X7K2NP")).toBeDefined();
  });

  it("renders Copy button", () => {
    render(<InviteCodeDisplay {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Copy invite code" })).toBeDefined();
  });

  it("renders Regenerate Code button", () => {
    render(<InviteCodeDisplay {...defaultProps} />);
    expect(screen.getByRole("button", { name: /regenerate code/i })).toBeDefined();
  });

  it("shows Regenerating… when isRegenerating is true", () => {
    render(<InviteCodeDisplay {...defaultProps} isRegenerating={true} />);
    expect(screen.getByText("Regenerating…")).toBeDefined();
  });

  it("Regenerate button is disabled when isRegenerating", () => {
    render(<InviteCodeDisplay {...defaultProps} isRegenerating={true} />);
    const btn = screen.getByRole("button", { name: /regenerating/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("calls onRegenerate when Regenerate Code is clicked", async () => {
    const onRegenerate = vi.fn().mockResolvedValue(undefined);
    render(<InviteCodeDisplay {...defaultProps} onRegenerate={onRegenerate} />);
    const btn = screen.getByRole("button", { name: /regenerate code/i });
    fireEvent.click(btn);
    await waitFor(() => expect(onRegenerate).toHaveBeenCalledTimes(1));
  });
});
