/**
 * GleipnirWomansBeard — Hook + Component tests (Issue #1817)
 *
 * Tests the useGleipnirFragment2 hook and GleipnirWomansBeard component:
 *   - trigger() sets egg:gleipnir-2 in localStorage and opens the modal
 *   - trigger() is a no-op when already found
 *   - dismiss() closes the modal
 *   - track() is called with correct metadata on first discovery
 *   - Component renders modal content when open=true
 *   - Component counts found fragments from localStorage
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, render, screen } from "@testing-library/react";
import {
  useGleipnirFragment2,
  GleipnirWomansBeard,
} from "@/components/cards/GleipnirWomansBeard";
import { track } from "@/lib/analytics/track";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/analytics/track", () => ({
  track: vi.fn(),
}));

// Stub EasterEggModal — expose open state via data-testid
vi.mock("@/components/easter-eggs/EasterEggModal", () => ({
  EasterEggModal: ({
    open,
    onClose,
    title,
    children,
  }: {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
  }) =>
    open ? (
      <div role="dialog" data-testid="easter-egg-modal">
        <span data-testid="modal-title">{title}</span>
        <button onClick={onClose}>close</button>
        {children}
      </div>
    ) : null,
}));

import React from "react";

const mockTrack = vi.mocked(track);

// ── useGleipnirFragment2 ──────────────────────────────────────────────────────

describe("useGleipnirFragment2", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("starts with open=false", () => {
    const { result } = renderHook(() => useGleipnirFragment2());
    expect(result.current.open).toBe(false);
  });

  it("trigger() sets egg:gleipnir-2 in localStorage", () => {
    const { result } = renderHook(() => useGleipnirFragment2());
    act(() => {
      result.current.trigger();
    });
    expect(localStorage.getItem("egg:gleipnir-2")).toBe("1");
  });

  it("trigger() opens the modal on first call", () => {
    const { result } = renderHook(() => useGleipnirFragment2());
    act(() => {
      result.current.trigger();
    });
    expect(result.current.open).toBe(true);
  });

  it("trigger() is a no-op when egg:gleipnir-2 is already set", () => {
    localStorage.setItem("egg:gleipnir-2", "1");
    const { result } = renderHook(() => useGleipnirFragment2());
    act(() => {
      result.current.trigger();
    });
    expect(result.current.open).toBe(false);
  });

  it("dismiss() closes the modal after trigger", () => {
    const { result } = renderHook(() => useGleipnirFragment2());
    act(() => {
      result.current.trigger();
    });
    expect(result.current.open).toBe(true);
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.open).toBe(false);
  });

  it("calling trigger() twice: second call is no-op (key already in storage)", () => {
    const { result } = renderHook(() => useGleipnirFragment2());
    act(() => {
      result.current.trigger();
    });
    act(() => {
      result.current.dismiss();
    });
    act(() => {
      result.current.trigger();
    });
    expect(result.current.open).toBe(false);
  });

  it("trigger() fires track('easter-egg') with fragment 2 metadata on first discovery", () => {
    const { result } = renderHook(() => useGleipnirFragment2());
    act(() => {
      result.current.trigger();
    });
    expect(mockTrack).toHaveBeenCalledOnce();
    expect(mockTrack).toHaveBeenCalledWith("easter-egg", {
      fragment: 2,
      name: "womans-beard",
    });
  });

  it("trigger() does NOT fire track() when fragment is already found", () => {
    localStorage.setItem("egg:gleipnir-2", "1");
    const { result } = renderHook(() => useGleipnirFragment2());
    act(() => {
      result.current.trigger();
    });
    expect(mockTrack).not.toHaveBeenCalled();
  });
});

// ── GleipnirWomansBeard component ─────────────────────────────────────────────

describe("GleipnirWomansBeard", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders nothing when open=false", () => {
    render(<GleipnirWomansBeard open={false} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders modal when open=true", () => {
    render(<GleipnirWomansBeard open={true} onClose={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("passes correct title to EasterEggModal", () => {
    render(<GleipnirWomansBeard open={true} onClose={() => {}} />);
    expect(screen.getByTestId("modal-title").textContent).toBe(
      "The Beard of a Woman"
    );
  });

  it("renders lore text about Gleipnir", () => {
    render(<GleipnirWomansBeard open={true} onClose={() => {}} />);
    expect(screen.getByText(/woven into/i)).toBeInTheDocument();
  });

  it("shows fragment count when open=true (1 of 6 when only fragment 2 found)", () => {
    localStorage.setItem("egg:gleipnir-2", "1");
    render(<GleipnirWomansBeard open={true} onClose={() => {}} />);
    expect(screen.getByText(/Fragment 1 of 6/)).toBeInTheDocument();
  });

  it("shows 'Gleipnir is complete' when all 6 fragments found", () => {
    for (let i = 1; i <= 6; i++) {
      localStorage.setItem(`egg:gleipnir-${i}`, "1");
    }
    render(<GleipnirWomansBeard open={true} onClose={() => {}} />);
    expect(screen.getByText(/Gleipnir is complete/)).toBeInTheDocument();
  });

  it("calls onClose when the close button is pressed", () => {
    const onClose = vi.fn();
    render(<GleipnirWomansBeard open={true} onClose={onClose} />);
    screen.getByRole("button", { name: /close/i }).click();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
