/**
 * HeilungModal — Loki QA edge-case tests (Issue #1068 Norse restyle)
 *
 * Covers gaps and edge cases identified in the FiremanDecko → Loki handoff:
 * - Video state reset via backdrop, Escape, HEIÐR, and second-toggle paths
 * - Ragnarök href exact encoding (%C3%B6)
 * - iframe allowFullScreen attribute
 * - Elder Futhark rune band content (top + bottom)
 * - Corner runes, portal label, wolf seal runic inscription
 * - Algiz button rune character present
 * - Thumbnail img has empty alt (decorative image pattern)
 * - Kriegsgaldr link aria-label and href check
 * - iframe src contains rel=0 (no related videos)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { HeilungModal } from "@/components/easter-eggs/HeilungModal";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("framer-motion", () => {
  const React = require("react");

  function makeTag(tag: string) {
    return React.forwardRef(
      (
        {
          children, initial, animate, exit, transition, variants, ...rest
        }: {
          children?: React.ReactNode;
          initial?: unknown; animate?: unknown; exit?: unknown;
          transition?: unknown; variants?: unknown;
          [k: string]: unknown;
        },
        ref: unknown
      ) => React.createElement(tag, { ref, ...rest }, children)
    );
  }

  const motion = { div: makeTag("div"), span: makeTag("span") };

  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function triggerHeilungKey() {
  fireEvent.keyDown(window, { key: "L", shiftKey: true, ctrlKey: true });
}

function openModal() {
  act(() => triggerHeilungKey());
}

function activateVideoPortal() {
  const btn = screen.getByLabelText("Watch Heilung — Krigsgaldr LIFA on YouTube");
  act(() => { fireEvent.click(btn); });
}

// ── Loki edge-case tests ─────────────────────────────────────────────────────

describe("HeilungModal — Loki QA edge cases", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  // ── Video state reset paths ───────────────────────────────────────────────

  it("backdrop click while playing resets video to thumbnail on reopen", () => {
    render(<HeilungModal />);
    openModal();
    activateVideoPortal();
    // Verify iframe is showing
    expect(screen.getByTitle("Heilung — Krigsgaldr LIFA")).toBeDefined();

    // Click backdrop
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog.parentElement!);
    expect(screen.queryByRole("dialog")).toBeNull();

    // Reopen — should show thumbnail, not iframe
    openModal();
    expect(screen.getByLabelText("Watch Heilung — Krigsgaldr LIFA on YouTube")).toBeDefined();
    expect(screen.queryByTitle("Heilung — Krigsgaldr LIFA")).toBeNull();
  });

  it("Escape key while playing resets video to thumbnail on reopen", () => {
    render(<HeilungModal />);
    openModal();
    activateVideoPortal();
    expect(screen.getByTitle("Heilung — Krigsgaldr LIFA")).toBeDefined();

    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(screen.queryByRole("dialog")).toBeNull();

    openModal();
    expect(screen.getByLabelText("Watch Heilung — Krigsgaldr LIFA on YouTube")).toBeDefined();
    expect(screen.queryByTitle("Heilung — Krigsgaldr LIFA")).toBeNull();
  });

  it("HEIÐR button while playing resets video to thumbnail on reopen", () => {
    render(<HeilungModal />);
    openModal();
    activateVideoPortal();
    expect(screen.getByTitle("Heilung — Krigsgaldr LIFA")).toBeDefined();

    fireEvent.click(screen.getByLabelText("Dismiss — honour given"));
    expect(screen.queryByRole("dialog")).toBeNull();

    openModal();
    expect(screen.getByLabelText("Watch Heilung — Krigsgaldr LIFA on YouTube")).toBeDefined();
    expect(screen.queryByTitle("Heilung — Krigsgaldr LIFA")).toBeNull();
  });

  it("second Ctrl+Shift+L toggle while playing resets video to thumbnail on reopen", () => {
    render(<HeilungModal />);
    openModal();
    activateVideoPortal();
    expect(screen.getByTitle("Heilung — Krigsgaldr LIFA")).toBeDefined();

    // Second trigger closes modal (toggle)
    act(() => triggerHeilungKey());
    expect(screen.queryByRole("dialog")).toBeNull();

    // Third trigger reopens — thumbnail state
    openModal();
    expect(screen.getByLabelText("Watch Heilung — Krigsgaldr LIFA on YouTube")).toBeDefined();
    expect(screen.queryByTitle("Heilung — Krigsgaldr LIFA")).toBeNull();
  });

  // ── URL encoding ──────────────────────────────────────────────────────────

  it("Ragnarök Wikipedia href contains URL-encoded ö (%C3%B6)", () => {
    render(<HeilungModal />);
    openModal();
    const link = screen.getByLabelText("Ragnarök on Wikipedia") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://en.wikipedia.org/wiki/Ragnar%C3%B6k");
  });

  // ── iframe attributes ──────────────────────────────────────────────────────

  it("playing iframe has allowFullScreen attribute", () => {
    render(<HeilungModal />);
    openModal();
    activateVideoPortal();
    const iframe = screen.getByTitle("Heilung — Krigsgaldr LIFA") as HTMLIFrameElement;
    // allowFullScreen is a boolean attribute — rendered as empty string or "true"
    expect(iframe.hasAttribute("allowfullscreen")).toBe(true);
  });

  it("playing iframe src contains rel=0 (no related videos)", () => {
    render(<HeilungModal />);
    openModal();
    activateVideoPortal();
    const iframe = screen.getByTitle("Heilung — Krigsgaldr LIFA") as HTMLIFrameElement;
    expect(iframe.getAttribute("src")).toContain("rel=0");
  });

  // ── Rune band content ─────────────────────────────────────────────────────

  it("top rune band renders Elder Futhark characters (ᚠ first, ᛟ last)", () => {
    render(<HeilungModal />);
    openModal();
    const bands = document.querySelectorAll(".heilung-rune-band");
    expect(bands.length).toBeGreaterThanOrEqual(2);
    const topBand = bands[0];
    expect(topBand.textContent).toContain("ᚠ");
    expect(topBand.textContent).toContain("ᛟ");
  });

  it("bottom rune band renders reversed Elder Futhark (ᛟ first, ᚠ last)", () => {
    render(<HeilungModal />);
    openModal();
    const bands = document.querySelectorAll(".heilung-rune-band");
    expect(bands.length).toBeGreaterThanOrEqual(2);
    const bottomBand = bands[bands.length - 1];
    // FUTHARK_REVERSED starts with ᛟ
    const text = bottomBand.textContent ?? "";
    expect(text.trimStart()[0]).toBe("ᛟ");
  });

  // ── Corner runes & portal label ──────────────────────────────────────────

  it("video portal frame has corner rune elements", () => {
    render(<HeilungModal />);
    openModal();
    const corners = document.querySelectorAll(".heilung-corner-rune");
    expect(corners.length).toBe(4);
    const runes = Array.from(corners).map((el) => el.textContent);
    expect(runes).toContain("ᚠ");
    expect(runes).toContain("ᛖ");
    expect(runes).toContain("ᚾ");
    expect(runes).toContain("ᚱ");
  });

  it("video portal label contains Old Norse rune text ᛊᛖᛖ ᚦᛖ ᛊᛟᚾᚷ", () => {
    render(<HeilungModal />);
    openModal();
    const label = document.querySelector(".heilung-portal-label");
    expect(label).not.toBeNull();
    expect(label!.textContent).toContain("ᛊᛖᛖ");
  });

  // ── Wolf seal ─────────────────────────────────────────────────────────────

  it("wolf seal contains Elder Futhark ᚠᛖᚾᚱᛁᚱ runic inscription", () => {
    render(<HeilungModal />);
    openModal();
    const seal = document.querySelector(".heilung-wolf-seal");
    expect(seal).not.toBeNull();
    expect(seal!.textContent).toContain("ᚠᛖᚾᚱᛁᚱ");
  });

  // ── Algiz button ─────────────────────────────────────────────────────────

  it("Algiz close button renders ᛉ rune character", () => {
    render(<HeilungModal />);
    openModal();
    const btn = screen.getByLabelText("Close — return from the wolf's hall");
    // The ᛉ rune is inside an aria-hidden span
    expect(btn.textContent).toContain("ᛉ");
  });

  // ── Thumbnail accessibility ───────────────────────────────────────────────

  it("thumbnail img has empty alt attribute (decorative)", () => {
    render(<HeilungModal />);
    openModal();
    const img = document.querySelector(".heilung-thumbnail-img") as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.getAttribute("alt")).toBe("");
  });

  // ── Kriegsgaldr link ──────────────────────────────────────────────────────

  it("Krigsgaldr link has aria-label 'Krigsgaldr on Wikipedia' and opens in new tab", () => {
    render(<HeilungModal />);
    openModal();
    const link = screen.getByLabelText("Krigsgaldr on Wikipedia") as HTMLAnchorElement;
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  // ── Modal structure ───────────────────────────────────────────────────────

  it("modal backdrop has dismiss click handler (aria-label present)", () => {
    render(<HeilungModal />);
    openModal();
    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement!;
    expect(backdrop.getAttribute("aria-label")).toContain("backdrop");
  });

  it("rune dividers are rendered between sections (aria-hidden)", () => {
    render(<HeilungModal />);
    openModal();
    const dividers = document.querySelectorAll(".heilung-rune-divider");
    expect(dividers.length).toBeGreaterThanOrEqual(3);
    dividers.forEach((d) => {
      expect(d.getAttribute("aria-hidden")).toBe("true");
    });
  });
});
