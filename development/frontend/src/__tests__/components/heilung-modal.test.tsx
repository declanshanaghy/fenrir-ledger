/**
 * HeilungModal — Component tests
 *
 * Validates the restored working state: trigger key, dismiss interactions,
 * content (HEILUNG title, Amplified History, band members, YouTube embed).
 *
 * Uses standard Vitest + Testing Library matchers (no jest-dom).
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

  const motion = { div: makeTag("div") };

  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function triggerHeilungKey() {
  fireEvent.keyDown(window, { key: "L", shiftKey: true, ctrlKey: true });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("HeilungModal", () => {
  beforeEach(() => {
    document.body.style.overflow = "";
  });

  // ── Open / close mechanics ───────────────────────────────────────────────

  it("is hidden by default", () => {
    render(<HeilungModal />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens on Ctrl+Shift+L", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("opens on Meta+Shift+L", () => {
    render(<HeilungModal />);
    act(() => {
      fireEvent.keyDown(window, { key: "L", shiftKey: true, metaKey: true });
    });
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("toggles closed on second Ctrl+Shift+L", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    act(() => triggerHeilungKey());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Escape key", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on X close button", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    fireEvent.click(screen.getByLabelText("Close Heilung modal"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on backdrop click", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog.parentElement!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does NOT close when clicking inside the modal", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("does not open when Ctrl+Shift+L is pressed in an INPUT", () => {
    render(
      <div>
        <input data-testid="field" />
        <HeilungModal />
      </div>
    );
    const input = screen.getByTestId("field");
    act(() => {
      fireEvent.keyDown(input, {
        key: "L", shiftKey: true, ctrlKey: true, target: input,
      });
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // ── Content ──────────────────────────────────────────────────────────────

  it("renders HEILUNG title", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    expect(screen.getByText("HEILUNG")).toBeDefined();
  });

  it("renders Amplified History subtitle", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    expect(screen.getByText("Amplified History")).toBeDefined();
  });

  it("renders bio text", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    expect(screen.getByText(/Heilung.*healing.*Norse experimental/i)).toBeDefined();
  });

  it("renders all three band members", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    expect(screen.getByText("Kai Uwe Faust")).toBeDefined();
    expect(screen.getByText("Maria Franz")).toBeDefined();
    expect(screen.getByText("Christopher Juul")).toBeDefined();
  });

  it("renders amplifiedhistory.com link", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const link = screen.getByRole("link") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://www.amplifiedhistory.com");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("renders YouTube iframe with correct src and title", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const iframe = screen.getByTitle("Heilung — Krigsgaldr LIFA") as HTMLIFrameElement;
    expect(iframe).toBeDefined();
    expect(iframe.getAttribute("src")).toContain("QRg_8NNPTD8");
    expect(iframe.getAttribute("src")).toContain("autoplay=1");
  });

  // ── Accessibility ────────────────────────────────────────────────────────

  it("dialog has aria-modal='true'", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });
});
