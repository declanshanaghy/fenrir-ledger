/**
 * AboutModal.test.tsx
 *
 * Vitest suite for AboutModal build info section — Issue #1349.
 * Tests that build info (commit, build date, environment)
 * renders correctly in the left column with labels.
 *
 * Written by FiremanDecko, Principal Engineer.
 */

import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AboutModal } from "@/components/layout/AboutModal";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/components/shared/WolfHungerMeter", () => ({
  WolfHungerMeter: () => <div data-testid="wolf-hunger-meter">WolfHungerMeter</div>,
}));

vi.mock("@/components/cards/GleipnirWomansBeard", () => ({
  GleipnirWomansBeard: ({ open }: { open: boolean; onClose: () => void }) => (
    <div data-testid="gleipnir-womans-beard" data-open={String(open)}>
      GleipnirWomansBeard
    </div>
  ),
  useGleipnirFragment2: () => ({
    open: false,
    trigger: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderModal() {
  return render(<AboutModal open={true} onOpenChange={vi.fn()} />);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("AboutModal — build info section", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("renders the build-info container", () => {
    renderModal();
    const el = document.querySelector("[data-testid='build-info']");
    expect(el).toBeInTheDocument();
  });

  it("shows 'unknown' commit when NEXT_PUBLIC_APP_VERSION is not set", () => {
    delete process.env.NEXT_PUBLIC_APP_VERSION;
    renderModal();
    const commitEl = document.querySelector("[data-testid='build-info-commit']");
    expect(commitEl).toHaveTextContent("unknown");
  });

  it("shows 'commit' label before SHA", () => {
    process.env.NEXT_PUBLIC_APP_VERSION = "abcdef1234567890";
    renderModal();
    const commitEl = document.querySelector("[data-testid='build-info-commit']");
    expect(commitEl?.closest("span")).toHaveTextContent("commit");
  });

  it("truncates NEXT_PUBLIC_APP_VERSION to 7 chars for commit SHA", () => {
    process.env.NEXT_PUBLIC_APP_VERSION = "abcdef1234567890";
    renderModal();
    const commitEl = document.querySelector("[data-testid='build-info-commit']");
    expect(commitEl).toHaveTextContent("abcdef1");
  });

  it("commit SHA links to GitHub commit URL", () => {
    process.env.NEXT_PUBLIC_APP_VERSION = "abcdef1234567890";
    renderModal();
    const anchor = document.querySelector("[data-testid='build-info-commit']") as HTMLAnchorElement;
    expect(anchor.tagName.toLowerCase()).toBe("a");
    expect(anchor.href).toContain("/commit/abcdef1234567890");
  });

  it("shows 'unknown' date when NEXT_PUBLIC_BUILD_DATE is not set", () => {
    delete process.env.NEXT_PUBLIC_BUILD_DATE;
    renderModal();
    const dateEl = document.querySelector("[data-testid='build-info-date']");
    expect(dateEl).toHaveTextContent("unknown");
  });

  it("shows 'built' label before date", () => {
    process.env.NEXT_PUBLIC_BUILD_DATE = "2026-03-18T12:00:00.000Z";
    renderModal();
    const dateEl = document.querySelector("[data-testid='build-info-date']");
    expect(dateEl).toHaveTextContent("built");
  });

  it("formats date in locale format (not UTC)", () => {
    process.env.NEXT_PUBLIC_BUILD_DATE = "2026-03-18T12:00:00.000Z";
    renderModal();
    const dateEl = document.querySelector("[data-testid='build-info-date']");
    // Should NOT contain "UTC" — uses toLocaleString for local timezone
    expect(dateEl?.textContent).not.toContain("UTC");
    // Should contain the year
    expect(dateEl).toHaveTextContent("2026");
  });

  it("shows 'env' label before environment", () => {
    process.env.NEXT_PUBLIC_ENV = "staging";
    renderModal();
    const envEl = document.querySelector("[data-testid='build-info-env']");
    expect(envEl).toHaveTextContent("env");
    expect(envEl).toHaveTextContent("staging");
  });

  it("falls back to NODE_ENV when NEXT_PUBLIC_ENV is not set", () => {
    delete process.env.NEXT_PUBLIC_ENV;
    process.env.NODE_ENV = "test";
    renderModal();
    const envEl = document.querySelector("[data-testid='build-info-env']");
    expect(envEl).toHaveTextContent("test");
  });

  // ── Loki QA additions — gap coverage ─────────────────────────────────────

  it("unknown commit is a span, not a link", () => {
    delete process.env.NEXT_PUBLIC_APP_VERSION;
    renderModal();
    const commitEl = document.querySelector("[data-testid='build-info-commit']");
    expect(commitEl?.tagName.toLowerCase()).toBe("span");
  });

  it("commit link opens in new tab", () => {
    process.env.NEXT_PUBLIC_APP_VERSION = "abcdef1234567890";
    renderModal();
    const anchor = document.querySelector("[data-testid='build-info-commit']") as HTMLAnchorElement;
    expect(anchor.target).toBe("_blank");
  });

  it("commit link has rel=noopener noreferrer to prevent tabnapping", () => {
    process.env.NEXT_PUBLIC_APP_VERSION = "abcdef1234567890";
    renderModal();
    const anchor = document.querySelector("[data-testid='build-info-commit']") as HTMLAnchorElement;
    expect(anchor.rel).toContain("noopener");
    expect(anchor.rel).toContain("noreferrer");
  });
});
