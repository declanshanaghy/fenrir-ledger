/**
 * GleipnirBirdSpittle — Hook + Component tests (Issue #1696)
 *
 * Tests the useGleipnirFragment6 hook and GleipnirBirdSpittle component:
 *   - trigger() sets egg:gleipnir-6 in localStorage and opens the modal
 *   - trigger() is a no-op when already found
 *   - dismiss() closes the modal
 *   - track() is called with correct metadata on first discovery
 *   - Component renders modal content when open=true
 *   - Component counts found fragments from localStorage
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, render, screen } from "@testing-library/react";
import {
  useGleipnirFragment6,
  GleipnirBirdSpittle,
} from "@/components/cards/GleipnirBirdSpittle";
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

// ── useGleipnirFragment6 ──────────────────────────────────────────────────────

describe("useGleipnirFragment6", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("starts with open=false", () => {
    const { result } = renderHook(() => useGleipnirFragment6());
    expect(result.current.open).toBe(false);
  });

  it("trigger() sets egg:gleipnir-6 in localStorage", () => {
    const { result } = renderHook(() => useGleipnirFragment6());
    act(() => {
      result.current.trigger();
    });
    expect(localStorage.getItem("egg:gleipnir-6")).toBe("1");
  });

  it("trigger() opens the modal on first call", () => {
    const { result } = renderHook(() => useGleipnirFragment6());
    act(() => {
      result.current.trigger();
    });
    expect(result.current.open).toBe(true);
  });

  it("trigger() is a no-op when egg:gleipnir-6 is already set", () => {
    localStorage.setItem("egg:gleipnir-6", "1");
    const { result } = renderHook(() => useGleipnirFragment6());
    act(() => {
      result.current.trigger();
    });
    expect(result.current.open).toBe(false);
  });

  it("dismiss() closes the modal after trigger", () => {
    const { result } = renderHook(() => useGleipnirFragment6());
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
    const { result } = renderHook(() => useGleipnirFragment6());
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

  it("trigger() fires track('easter-egg') with fragment 6 metadata on first discovery", () => {
    const { result } = renderHook(() => useGleipnirFragment6());
    act(() => {
      result.current.trigger();
    });
    expect(mockTrack).toHaveBeenCalledOnce();
    expect(mockTrack).toHaveBeenCalledWith("easter-egg", {
      fragment: 6,
      name: "bird-spittle",
    });
  });

  it("trigger() does NOT fire track() when fragment is already found", () => {
    localStorage.setItem("egg:gleipnir-6", "1");
    const { result } = renderHook(() => useGleipnirFragment6());
    act(() => {
      result.current.trigger();
    });
    expect(mockTrack).not.toHaveBeenCalled();
  });
});

// ── GleipnirBirdSpittle component ─────────────────────────────────────────────

describe("GleipnirBirdSpittle", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders nothing when open=false", () => {
    render(<GleipnirBirdSpittle open={false} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders modal when open=true", () => {
    render(<GleipnirBirdSpittle open={true} onClose={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("passes correct title to EasterEggModal", () => {
    render(<GleipnirBirdSpittle open={true} onClose={() => {}} />);
    expect(screen.getByTestId("modal-title").textContent).toBe(
      "The Spittle of a Bird"
    );
  });

  it("renders lore text about Gleipnir", () => {
    render(<GleipnirBirdSpittle open={true} onClose={() => {}} />);
    expect(screen.getByText(/woven into/i)).toBeInTheDocument();
  });

  it("shows fragment count when open=true (1 of 6 when only fragment 6 found)", () => {
    localStorage.setItem("egg:gleipnir-6", "1");
    render(<GleipnirBirdSpittle open={true} onClose={() => {}} />);
    expect(screen.getByText(/Fragment 1 of 6/)).toBeInTheDocument();
  });

  it("shows 'Gleipnir is complete' when all 6 fragments found", () => {
    for (let i = 1; i <= 6; i++) {
      localStorage.setItem(`egg:gleipnir-${i}`, "1");
    }
    render(<GleipnirBirdSpittle open={true} onClose={() => {}} />);
    expect(screen.getByText(/Gleipnir is complete/)).toBeInTheDocument();
  });

  it("does NOT show completion message when fragments are missing", () => {
    localStorage.setItem("egg:gleipnir-6", "1");
    render(<GleipnirBirdSpittle open={true} onClose={() => {}} />);
    expect(screen.queryByText(/Gleipnir is complete/)).not.toBeInTheDocument();
  });
});
