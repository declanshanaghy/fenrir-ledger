/**
 * GleipnirCatFootfall — Hook + Component tests (Issue #1817)
 *
 * Tests the useGleipnirFragment1 hook and GleipnirCatFootfall component:
 *   - trigger() sets egg:gleipnir-1 in localStorage and opens the modal
 *   - trigger() is a no-op when already found
 *   - dismiss() closes the modal
 *   - track() is called with correct metadata on first discovery
 *   - Component renders modal content when open=true
 *   - Component counts found fragments from localStorage
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, render, screen } from "@testing-library/react";
import {
  useGleipnirFragment1,
  GleipnirCatFootfall,
} from "@/components/cards/GleipnirCatFootfall";
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

// ── useGleipnirFragment1 ──────────────────────────────────────────────────────

describe("useGleipnirFragment1", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("starts with open=false", () => {
    const { result } = renderHook(() => useGleipnirFragment1());
    expect(result.current.open).toBe(false);
  });

  it("trigger() sets egg:gleipnir-1 in localStorage", () => {
    const { result } = renderHook(() => useGleipnirFragment1());
    act(() => {
      result.current.trigger();
    });
    expect(localStorage.getItem("egg:gleipnir-1")).toBe("1");
  });

  it("trigger() opens the modal on first call", () => {
    const { result } = renderHook(() => useGleipnirFragment1());
    act(() => {
      result.current.trigger();
    });
    expect(result.current.open).toBe(true);
  });

  it("trigger() is a no-op when egg:gleipnir-1 is already set", () => {
    localStorage.setItem("egg:gleipnir-1", "1");
    const { result } = renderHook(() => useGleipnirFragment1());
    act(() => {
      result.current.trigger();
    });
    expect(result.current.open).toBe(false);
  });

  it("dismiss() closes the modal after trigger", () => {
    const { result } = renderHook(() => useGleipnirFragment1());
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
    const { result } = renderHook(() => useGleipnirFragment1());
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

  it("trigger() fires track('easter-egg') with fragment 1 metadata on first discovery", () => {
    const { result } = renderHook(() => useGleipnirFragment1());
    act(() => {
      result.current.trigger();
    });
    expect(mockTrack).toHaveBeenCalledOnce();
    expect(mockTrack).toHaveBeenCalledWith("easter-egg", {
      fragment: 1,
      name: "cats-footfall",
    });
  });

  it("trigger() does NOT fire track() when fragment is already found", () => {
    localStorage.setItem("egg:gleipnir-1", "1");
    const { result } = renderHook(() => useGleipnirFragment1());
    act(() => {
      result.current.trigger();
    });
    expect(mockTrack).not.toHaveBeenCalled();
  });
});

// ── GleipnirCatFootfall component ─────────────────────────────────────────────

describe("GleipnirCatFootfall", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders nothing when open=false", () => {
    render(<GleipnirCatFootfall open={false} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders modal when open=true", () => {
    render(<GleipnirCatFootfall open={true} onClose={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("passes correct title to EasterEggModal", () => {
    render(<GleipnirCatFootfall open={true} onClose={() => {}} />);
    expect(screen.getByTestId("modal-title").textContent).toBe(
      "The Sound of a Cat's Footfall"
    );
  });

  it("renders lore text about Gleipnir", () => {
    render(<GleipnirCatFootfall open={true} onClose={() => {}} />);
    expect(screen.getByText(/woven into/i)).toBeInTheDocument();
  });

  it("shows fragment count when open=true (1 of 6 when only fragment 1 found)", () => {
    localStorage.setItem("egg:gleipnir-1", "1");
    render(<GleipnirCatFootfall open={true} onClose={() => {}} />);
    expect(screen.getByText(/Fragment 1 of 6/)).toBeInTheDocument();
  });

  it("shows 'Gleipnir is complete' when all 6 fragments found", () => {
    for (let i = 1; i <= 6; i++) {
      localStorage.setItem(`egg:gleipnir-${i}`, "1");
    }
    render(<GleipnirCatFootfall open={true} onClose={() => {}} />);
    expect(screen.getByText(/Gleipnir is complete/)).toBeInTheDocument();
  });

  it("calls onClose when the close button is pressed", () => {
    const onClose = vi.fn();
    render(<GleipnirCatFootfall open={true} onClose={onClose} />);
    screen.getByRole("button", { name: /close/i }).click();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
