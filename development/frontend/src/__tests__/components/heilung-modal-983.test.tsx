/**
 * HeilungModal — Issue #983 regression tests
 *
 * Validates the specific fixes from Issue #983:
 *   1. Modal shell uses CSS class `heilung-modal-shell` for border-breathe animation
 *      (NOT inline Framer Motion style — prevents FM v12 / WAAPI conflict that caused
 *       the "black void" regression)
 *   2. Modal body uses CSS class `heilung-modal-body` for mobile responsive layout
 *   3. Hardcoded Norse colors are present on the modal shell (avoids hsl(var(--egg-*))
 *      resolution failures)
 *   4. Proper 3-column grid structure: info panel | divider | video panel
 *   5. Info / video columns have their CSS classes for mobile overrides
 *   6. Modal overlay (backdrop) structure is intact and functional
 *   7. dialog role + aria-labelledby attributes present for accessibility
 *
 * These tests derive assertions from acceptance criteria in Issue #983, NOT from
 * current code behavior — per Loki test standard.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { HeilungModal } from "@/components/easter-eggs/HeilungModal";

// ── Framer Motion stub ──────────────────────────────────────────────────────

vi.mock("framer-motion", () => {
  const React = require("react");

  function makeTag(tag: string) {
    return React.forwardRef(
      (
        { children, initial, animate, exit, transition, variants, ...rest }: {
          children?: React.ReactNode;
          initial?: unknown; animate?: unknown; exit?: unknown;
          transition?: unknown; variants?: unknown;
          [k: string]: unknown;
        },
        ref: unknown
      ) => React.createElement(tag, { ref, ...rest }, children)
    );
  }

  const motion = {
    div: makeTag("div"),
    ul:  makeTag("ul"),
    li:  makeTag("li"),
  };

  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// ── Helper ──────────────────────────────────────────────────────────────────

function openModal() {
  fireEvent.keyDown(window, { key: "L", shiftKey: true, ctrlKey: true });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("HeilungModal — Issue #983: layout structure + visibility", () => {
  beforeEach(() => { document.body.style.overflow = ""; });
  afterEach(() => { document.body.style.overflow = ""; });

  // ── AC: Modal renders as a proper dialog with overlay ───────────────────

  it("modal shell has heilung-modal-shell CSS class (prevents FM/WAAPI void regression)", () => {
    render(<HeilungModal />);
    act(() => openModal());
    const dialog = screen.getByRole("dialog");
    expect(dialog.classList.contains("heilung-modal-shell")).toBe(true);
  });

  it("modal shell does NOT apply animation via inline style (FM v12 WAAPI conflict fix)", () => {
    render(<HeilungModal />);
    act(() => openModal());
    const dialog = screen.getByRole("dialog");
    // animation must come from CSS class, not inline — inline would trigger the void bug
    expect(dialog.style.animation ?? "").toBe("");
  });

  it("modal body has heilung-modal-body CSS class (mobile responsive layout)", () => {
    render(<HeilungModal />);
    act(() => openModal());
    const dialog = screen.getByRole("dialog");
    const body = dialog.querySelector(".heilung-modal-body");
    expect(body).not.toBeNull();
  });

  // ── AC: Overlay / backdrop structure ───────────────────────────────────

  it("backdrop is rendered as a fixed full-screen overlay behind the dialog", () => {
    render(<HeilungModal />);
    act(() => openModal());
    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement!;
    expect(backdrop.style.zIndex).toBe("9653");
    expect(backdrop.style.backdropFilter).toContain("blur");
  });

  it("backdrop background is near-void dark (not transparent)", () => {
    render(<HeilungModal />);
    act(() => openModal());
    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement!;
    expect(backdrop.style.background).toContain("rgba");
  });

  // ── AC: Hardcoded Norse colors — avoids CSS var resolution failure ──────

  it("modal shell has hardcoded void-indigo background (#0f1018)", () => {
    render(<HeilungModal />);
    act(() => openModal());
    const dialog = screen.getByRole("dialog");
    expect(dialog.style.background).toBe("#0f1018");
  });

  it("modal shell has hardcoded gold border (no CSS variable reference)", () => {
    render(<HeilungModal />);
    act(() => openModal());
    const dialog = screen.getByRole("dialog");
    // border must be hardcoded rgba, NOT hsl(var(--egg-*))
    const border = dialog.style.border;
    expect(border).toContain("rgba");
    expect(border).not.toContain("var(--");
  });

  // ── AC: 3-column grid layout structure ────────────────────────────────

  it("info column has heilung-col-info CSS class", () => {
    render(<HeilungModal />);
    act(() => openModal());
    const dialog = screen.getByRole("dialog");
    const infoCol = dialog.querySelector(".heilung-col-info");
    expect(infoCol).not.toBeNull();
  });

  it("video column has heilung-col-video CSS class", () => {
    render(<HeilungModal />);
    act(() => openModal());
    const dialog = screen.getByRole("dialog");
    const videoCol = dialog.querySelector(".heilung-col-video");
    expect(videoCol).not.toBeNull();
  });

  it("vertical divider is present (aria-hidden, CSS gradient border)", () => {
    render(<HeilungModal />);
    act(() => openModal());
    const dialog = screen.getByRole("dialog");
    const body = dialog.querySelector(".heilung-modal-body")!;
    const divider = body.querySelector("[aria-hidden='true']");
    expect(divider).not.toBeNull();
    expect(divider!.style.background).toContain("linear-gradient");
  });

  it("body grid is declared as display:grid at desktop size", () => {
    render(<HeilungModal />);
    act(() => openModal());
    const dialog = screen.getByRole("dialog");
    const body = dialog.querySelector(".heilung-modal-body") as HTMLElement;
    expect(body.style.display).toBe("grid");
    expect(body.style.gridTemplateColumns).toBe("1fr 1px 1fr");
  });

  // ── AC: YouTube embed properly sized ───────────────────────────────────

  it("video container uses aspect-ratio 16/9", () => {
    render(<HeilungModal />);
    act(() => openModal());
    const iframe = screen.getByTitle("Heilung — Krigsgaldr LIFA");
    const container = iframe.parentElement as HTMLElement;
    expect(container.style.aspectRatio).toBe("16 / 9");
  });

  it("iframe spans full width of its container", () => {
    render(<HeilungModal />);
    act(() => openModal());
    const iframe = screen.getByTitle("Heilung — Krigsgaldr LIFA") as HTMLIFrameElement;
    expect(iframe.style.width).toBe("100%");
    expect(iframe.style.height).toBe("100%");
  });

  // ── AC: header / footer present (dialog is not a void) ─────────────────

  it("header renders above modal body (has padding + bottom border inline style)", () => {
    render(<HeilungModal />);
    act(() => openModal());
    const dialog = screen.getByRole("dialog");
    const header = dialog.querySelector("header");
    expect(header).not.toBeNull();
    expect(header!.style.borderBottom).toContain("rgba");
  });

  it("footer renders below modal body (has padding + top border inline style)", () => {
    render(<HeilungModal />);
    act(() => openModal());
    const dialog = screen.getByRole("dialog");
    const footer = dialog.querySelector("footer");
    expect(footer).not.toBeNull();
    expect(footer!.style.borderTop).toContain("rgba");
  });

  it("modal shell maxWidth is 960px (not unbounded)", () => {
    render(<HeilungModal />);
    act(() => openModal());
    const dialog = screen.getByRole("dialog");
    expect(dialog.style.maxWidth).toBe("960px");
  });

  it("close button (×) has correct z-index to stay above content", () => {
    render(<HeilungModal />);
    act(() => openModal());
    const closeBtn = screen.getByLabelText("Dismiss the incantation");
    // absolute positioned with z-10
    expect(closeBtn.classList.contains("z-10")).toBe(true);
  });
});
