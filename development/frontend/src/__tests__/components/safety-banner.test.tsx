/**
 * SafetyBanner — Component tests
 *
 * Issue #1021: compact variant must always show full warning details
 * (no collapsible Details/Hide toggle).
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SafetyBanner } from "@/components/sheets/SafetyBanner";

// ── compact variant ───────────────────────────────────────────────────────────

describe("SafetyBanner compact — always-visible details (issue #1021)", () => {
  it("renders the data safety reminder note", () => {
    render(<SafetyBanner variant="compact" />);
    const note = screen.getByRole("note", { name: "Data safety reminder" });
    expect(note).toBeDefined();
  });

  it("shows the top-line warning text immediately", () => {
    render(<SafetyBanner variant="compact" />);
    expect(
      screen.getByText(/Never share card numbers, CVVs, or SSNs/i)
    ).toBeDefined();
  });

  it("shows 'Safe to include' heading without any interaction", () => {
    render(<SafetyBanner variant="compact" />);
    expect(screen.getByText("Safe to include")).toBeDefined();
  });

  it("shows 'Never include' heading without any interaction", () => {
    render(<SafetyBanner variant="compact" />);
    expect(screen.getByText("Never include")).toBeDefined();
  });

  it("shows all safe-to-include items immediately", () => {
    render(<SafetyBanner variant="compact" />);
    expect(screen.getByText("Card names and issuers")).toBeDefined();
    expect(screen.getByText("Open dates and annual fees")).toBeDefined();
    expect(screen.getByText("Credit limits")).toBeDefined();
    expect(screen.getByText("Sign-up bonus details")).toBeDefined();
  });

  it("shows all never-include items immediately", () => {
    render(<SafetyBanner variant="compact" />);
    expect(screen.getByText("Full card numbers")).toBeDefined();
    expect(screen.getByText("CVV / security codes")).toBeDefined();
    expect(screen.getByText("Social Security numbers")).toBeDefined();
    expect(screen.getByText("Passwords or PINs")).toBeDefined();
  });

  it("does NOT render a Details or Hide toggle button", () => {
    render(<SafetyBanner variant="compact" />);
    expect(screen.queryByRole("button", { name: /details/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /hide/i })).toBeNull();
  });

  it("does NOT render any button at all", () => {
    render(<SafetyBanner variant="compact" />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

// ── full variant (unchanged baseline) ────────────────────────────────────────

describe("SafetyBanner full — always-visible (baseline)", () => {
  it("renders with role=alert", () => {
    render(<SafetyBanner variant="full" />);
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("shows 'Protect Your Secrets' heading", () => {
    render(<SafetyBanner variant="full" />);
    expect(screen.getByText("Protect Your Secrets")).toBeDefined();
  });

  it("shows both column headings", () => {
    render(<SafetyBanner variant="full" />);
    expect(screen.getByText("Safe to include")).toBeDefined();
    expect(screen.getByText("Never include")).toBeDefined();
  });
});

// ── sensitive-data variant (baseline) ────────────────────────────────────────

describe("SafetyBanner sensitive-data — baseline", () => {
  it("renders with role=alert", () => {
    render(<SafetyBanner variant="sensitive-data" />);
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("shows Sensitive Data Detected heading", () => {
    render(<SafetyBanner variant="sensitive-data" />);
    expect(screen.getByText("Sensitive Data Detected")).toBeDefined();
  });
});

// ── post-share variant (baseline) ────────────────────────────────────────────

describe("SafetyBanner post-share — baseline", () => {
  it("renders post-import revocation reminder", () => {
    render(<SafetyBanner variant="post-share" />);
    expect(
      screen.getByText(/revoking public access to your spreadsheet/i)
    ).toBeDefined();
  });
});
