/**
 * HeilungModal — Component tests (Issue #1068 Norse restyle)
 *
 * Validates: trigger key, dismiss interactions, Norse content, Wikipedia links,
 * click-to-play video portal, Algiz close button, HEIÐR dismiss, accessibility.
 *
 * Uses @testing-library/jest-dom for DOM assertions (issue #1371).
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

// ── Tests ────────────────────────────────────────────────────────────────────

describe("HeilungModal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  // ── Open / close mechanics ───────────────────────────────────────────────

  it("is hidden by default", () => {
    render(<HeilungModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens on Ctrl+Shift+L", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens on Meta+Shift+L", () => {
    render(<HeilungModal />);
    act(() => {
      fireEvent.keyDown(window, { key: "L", shiftKey: true, metaKey: true });
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("toggles closed on second Ctrl+Shift+L", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    act(() => triggerHeilungKey());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape key", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Algiz close button (ᛉ)", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    fireEvent.click(screen.getByLabelText("Close — return from the wolf's hall"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on HEIÐR dismiss button", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    fireEvent.click(screen.getByLabelText("Dismiss — honour given"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on backdrop click", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog.parentElement!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does NOT close when clicking inside the modal", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
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
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not open when Ctrl+Shift+L is pressed in a TEXTAREA", () => {
    render(
      <div>
        <textarea data-testid="textarea" />
        <HeilungModal />
      </div>
    );
    const textarea = screen.getByTestId("textarea");
    act(() => {
      fireEvent.keyDown(textarea, {
        key: "L", shiftKey: true, ctrlKey: true, target: textarea,
      });
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not open when Ctrl+Shift+L is pressed in a SELECT", () => {
    render(
      <div>
        <select data-testid="select"><option>x</option></select>
        <HeilungModal />
      </div>
    );
    const select = screen.getByTestId("select");
    act(() => {
      fireEvent.keyDown(select, {
        key: "L", shiftKey: true, ctrlKey: true, target: select,
      });
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // ── Content ──────────────────────────────────────────────────────────────

  it("renders Old Norse title 'Heyra Norðupo'", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    expect(screen.getByText("Heyra Norðupo")).toBeInTheDocument();
  });

  it("renders Norse title with correct aria-label (with English translation)", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const title = screen.getByLabelText("Heyra Norðupo — Hear the Invocation");
    expect(title).toBeInTheDocument();
  });

  it("renders HEILUNG · Amplified History subtitle", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    expect(screen.getByText("HEILUNG · Amplified History")).toBeInTheDocument();
  });

  it("renders wolf's invitation copy with Fenrir reference", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    expect(screen.getByText(/Fenrir remembers/)).toBeInTheDocument();
  });

  it("renders Wolf's invitation section with correct aria-label", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    expect(screen.getByLabelText("Wolf's invitation")).toBeInTheDocument();
  });

  it("renders wolf seal inscription with aria-label", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    expect(
      screen.getByLabelText("Fenrir seal — The wolf remembers what the world forgot")
    ).toBeInTheDocument();
  });

  it("renders HEIÐR dismiss button", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    expect(screen.getByText("HEIÐR")).toBeInTheDocument();
  });

  // ── Wikipedia links ───────────────────────────────────────────────────────

  it("renders Wikipedia link for Yggdrasil", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const link = screen.getByLabelText("Yggdrasil on Wikipedia") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://en.wikipedia.org/wiki/Yggdrasil");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders Wikipedia link for Heilung", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const links = screen.getAllByLabelText("Heilung on Wikipedia") as HTMLAnchorElement[];
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].getAttribute("href")).toBe("https://en.wikipedia.org/wiki/Heilung");
  });

  it("renders Wikipedia link for Ragnarök", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const link = screen.getByLabelText("Ragnarök on Wikipedia") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toContain("Ragnar");
  });

  it("renders amplifiedhistory.com external link", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const link = screen.getByLabelText("amplifiedhistory.com, opens in new tab") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://www.amplifiedhistory.com");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  // ── Video portal (click-to-play) ──────────────────────────────────────────

  it("shows thumbnail portal button initially (not iframe)", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const portalBtn = screen.getByLabelText("Watch Heilung — Norupo LIFA on YouTube");
    expect(portalBtn).toBeInTheDocument();
    expect(screen.queryByTitle("Heilung — Norupo LIFA")).not.toBeInTheDocument();
  });

  it("shows YouTube thumbnail image in portal state A", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const img = document.querySelector(".heilung-thumbnail-img") as HTMLImageElement | null;
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", expect.stringContaining("2wy-W-pYlds"));
  });

  it("clicking portal thumbnail shows iframe (state B)", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const portalBtn = screen.getByLabelText("Watch Heilung — Norupo LIFA on YouTube");
    act(() => { fireEvent.click(portalBtn); });
    const iframe = screen.getByTitle("Heilung — Norupo LIFA") as HTMLIFrameElement;
    expect(iframe).toBeInTheDocument();
    expect(iframe.getAttribute("src")).toContain("autoplay=1");
    expect(iframe.getAttribute("src")).toContain("2wy-W-pYlds");
  });

  it("Enter key on portal thumbnail shows iframe", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const portalBtn = screen.getByLabelText("Watch Heilung — Norupo LIFA on YouTube");
    act(() => { fireEvent.keyDown(portalBtn, { key: "Enter" }); });
    expect(screen.getByTitle("Heilung — Norupo LIFA")).toBeInTheDocument();
  });

  it("Space key on portal thumbnail shows iframe", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const portalBtn = screen.getByLabelText("Watch Heilung — Norupo LIFA on YouTube");
    act(() => { fireEvent.keyDown(portalBtn, { key: " " }); });
    expect(screen.getByTitle("Heilung — Norupo LIFA")).toBeInTheDocument();
  });

  it("dismissing modal resets video to thumbnail state", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const portalBtn = screen.getByLabelText("Watch Heilung — Norupo LIFA on YouTube");
    act(() => { fireEvent.click(portalBtn); });
    expect(screen.getByTitle("Heilung — Norupo LIFA")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Close — return from the wolf's hall"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => triggerHeilungKey());
    expect(screen.getByLabelText("Watch Heilung — Norupo LIFA on YouTube")).toBeInTheDocument();
    expect(screen.queryByTitle("Heilung — Norupo LIFA")).not.toBeInTheDocument();
  });

  // ── Accessibility ─────────────────────────────────────────────────────────

  it("dialog has role='dialog' and aria-modal='true'", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("dialog is named by heilung-title element (aria-labelledby)", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-labelledby")).toBe("heilung-title");
  });

  it("Algiz close button has correct aria-label", () => {
    render(<HeilungModal />);
    act(() => triggerHeilungKey());
    const btn = screen.getByLabelText("Close — return from the wolf's hall");
    expect(btn).toBeInTheDocument();
  });
});
