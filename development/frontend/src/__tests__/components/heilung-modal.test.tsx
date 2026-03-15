/**
 * HeilungModal — Component tests (Issue #955)
 *
 * Validates wolf-voice restyle: copy, accessibility attributes,
 * trigger key handling, dismiss interactions, and scroll lock.
 *
 * Uses standard Vitest + Testing Library matchers (no jest-dom).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function triggerHeilungKey() {
  fireEvent.keyDown(window, { key: "L", shiftKey: true, ctrlKey: true });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("HeilungModal — Issue #955 wolf-voice restyle", () => {
  beforeEach(() => {
    document.body.style.overflow = "";
  });

  afterEach(() => {
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
    expect(screen.getByRole("dialog")).toBeDefined();
    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on HEIÐR dismiss button", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    fireEvent.click(screen.getByText("HEIÐR"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on × close button (aria-label: Dismiss the incantation)", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    fireEvent.click(screen.getByLabelText("Dismiss the incantation"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on backdrop click", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const dialog = screen.getByRole("dialog");
    // Backdrop is the outer div (parent of dialog)
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

  // ── Copy & accessibility ─────────────────────────────────────────────────

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

  it("renders INCANTATION FOUND eyebrow with correct aria-label", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const eyebrow = screen.getByLabelText("Incantation found");
    expect(eyebrow).toBeDefined();
    expect(screen.getByText("Incantation Found")).toBeDefined();
  });

  it("renders wolf-voice incantation paragraphs", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    expect(
      screen.getByText(/They speak in iron and root/i)
    ).toBeDefined();
    expect(
      screen.getByText(/Three voices carry what others let fall/i)
    ).toBeDefined();
  });

  it("renders THE VOICES section label", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    expect(screen.getByText("THE VOICES")).toBeDefined();
  });

  it("renders all three band members with wolf-voice roles", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    expect(screen.getByText("Kai Uwe Faust")).toBeDefined();
    expect(screen.getByText("Chant, throat — the low frequencies")).toBeDefined();
    expect(screen.getByText("Maria Franz")).toBeDefined();
    expect(screen.getByText("Voice — the oldest tones remembered")).toBeDefined();
    expect(screen.getByText("Christopher Juul")).toBeDefined();
    expect(screen.getByText("Percussion — the ritual architecture")).toBeDefined();
  });

  it("renders amplifiedhistory.com link with correct attributes", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const link = screen.getByLabelText("amplifiedhistory.com, opens in new tab") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://www.amplifiedhistory.com");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders embedded YouTube iframe with correct src and title", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const iframe = screen.getByTitle("Heilung — Krigsgaldr LIFA") as HTMLIFrameElement;
    expect(iframe).toBeDefined();
    expect(iframe.getAttribute("src")).toContain("QRg_8NNPTD8");
    expect(iframe.getAttribute("src")).toContain("autoplay=1");
  });

  it("modal has aria-labelledby='heilung-title' and aria-modal='true'", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-labelledby")).toBe("heilung-title");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("title element has id='heilung-title'", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const title = screen.getByText("HEILUNG");
    expect(title.getAttribute("id")).toBe("heilung-title");
  });

  it("band members list has aria-label='Band members'", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const list = screen.getByLabelText("Band members");
    expect(list).toBeDefined();
    expect(list.tagName.toLowerCase()).toBe("ul");
  });

  it("incantation div has aria-label=\"Wolf's testimony\"", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const incantation = screen.getByLabelText("Wolf's testimony");
    expect(incantation).toBeDefined();
  });

  // ── Scroll lock ──────────────────────────────────────────────────────────

  it("locks body scroll when open", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("unlocks body scroll when closed via Escape", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(document.body.style.overflow).toBe("");
  });
});
