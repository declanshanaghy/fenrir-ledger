/**
 * EasterEggModal — audioFade prop tests (Issue #1817)
 *
 * Verifies that:
 *   - audioFade=true starts audio at volume 0 and fades in to 0.25 over ~500ms
 *   - audioFade=false plays audio at default volume (no fade)
 *   - audioFade=true fades audio out over ~600ms when modal closes
 *   - audio.pause() is called at the end of fade-out
 *   - Without audioSrc, no Audio instance is created
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { EasterEggModal } from "@/components/easter-eggs/EasterEggModal";
import React from "react";

// ── Radix Dialog mock ─────────────────────────────────────────────────────────

vi.mock("@radix-ui/react-dialog", async (importOriginal) => {
  const React = await import("react");
  const actual = await importOriginal<typeof import("@radix-ui/react-dialog")>();

  const Overlay = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => <div ref={ref} className={className} {...props} />
  );
  Overlay.displayName = "Overlay";

  const Content = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, children, ...props }, ref) => (
      <div ref={ref} role="dialog" className={className} {...props}>
        {children}
      </div>
    )
  );
  Content.displayName = "Content";

  const Close = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ children, ...props }, ref) => (
      <button ref={ref} aria-label="Close" {...props}>{children}</button>
    )
  );
  Close.displayName = "Close";

  const Title = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ children, ...props }, ref) => <h2 ref={ref} {...props}>{children}</h2>
  );
  Title.displayName = "Title";

  const Description = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ children, ...props }, ref) => <p ref={ref} {...props}>{children}</p>
  );
  Description.displayName = "Description";

  return {
    ...actual,
    Root: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
      open !== false ? <>{children}</> : null,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Overlay,
    Content,
    Close,
    Title,
    Description,
  };
});

// ── Audio mock ────────────────────────────────────────────────────────────────
//
// vi.fn() produces a non-constructable spy, so we use a real class stub and
// track constructor calls manually.

let audioCtorCallCount = 0;
let mockPlay: ReturnType<typeof vi.fn>;
let mockPause: ReturnType<typeof vi.fn>;
let mockVolume = 1;
let mockPaused = true;
let mockCurrentTime = 0;

// We expose a plain object so tests can read / write audio state after render.
const audioProxy = {
  get play() { return mockPlay; },
  get pause() { return mockPause; },
  get volume() { return mockVolume; },
  set volume(v: number) { mockVolume = v; },
  get paused() { return mockPaused; },
  set paused(v: boolean) { mockPaused = v; },
  get currentTime() { return mockCurrentTime; },
  set currentTime(v: number) { mockCurrentTime = v; },
};

// Real class constructor — usable with `new Audio(src)`.
class FakeAudio {
  get play() { return mockPlay; }
  get pause() { return mockPause; }
  get volume() { return mockVolume; }
  set volume(v: number) { mockVolume = v; }
  get paused() { return mockPaused; }
  set paused(v: boolean) { mockPaused = v; }
  get currentTime() { return mockCurrentTime; }
  set currentTime(v: number) { mockCurrentTime = v; }

  constructor(_src: string) {
    audioCtorCallCount++;
    // Reassign mock fns so each construct gets fresh call tracking
    mockPlay = vi.fn().mockResolvedValue(undefined);
    mockPause = vi.fn();
    mockVolume = 1;
    mockPaused = true;
    mockCurrentTime = 0;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function modalJsx(props: Partial<Parameters<typeof EasterEggModal>[0]> = {}) {
  return (
    <EasterEggModal
      open={props.open ?? false}
      onClose={props.onClose ?? (() => {})}
      title={props.title ?? "Test Egg"}
      audioSrc={props.audioSrc}
      audioFade={props.audioFade}
    >
      <p>lore text</p>
    </EasterEggModal>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("EasterEggModal — audioFade prop", () => {
  beforeEach(() => {
    audioCtorCallCount = 0;
    mockPlay = vi.fn().mockResolvedValue(undefined);
    mockPause = vi.fn();
    mockVolume = 1;
    mockPaused = true;
    mockCurrentTime = 0;
    vi.useFakeTimers();
    vi.stubGlobal("Audio", FakeAudio);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // Suppress the proxy variable lint warning — it's used for type-checking readability
  void audioProxy;

  // ── No audio ────────────────────────────────────────────────────────────────

  it("does not create an Audio instance when audioSrc is not provided", () => {
    render(modalJsx({ open: true }));
    expect(audioCtorCallCount).toBe(0);
  });

  // ── audioFade=false (default) ────────────────────────────────────────────────

  it("audioFade=false: plays audio immediately when modal opens (no fade)", () => {
    render(modalJsx({ open: true, audioSrc: "/sounds/test.mp3", audioFade: false }));
    expect(mockPlay).toHaveBeenCalledOnce();
    // volume is NOT set to 0 — stays at initial value of 1
    expect(mockVolume).toBe(1);
  });

  it("audioFade=false: pauses audio immediately when modal closes", () => {
    const { rerender } = render(modalJsx({ open: true, audioSrc: "/sounds/test.mp3", audioFade: false }));

    // Simulate the audio actually playing (play() mock doesn't flip paused)
    mockPaused = false;

    act(() => {
      rerender(modalJsx({ open: false, audioSrc: "/sounds/test.mp3", audioFade: false }));
    });

    expect(mockPause).toHaveBeenCalled();
  });

  // ── audioFade=true — fade-in ────────────────────────────────────────────────

  it("audioFade=true: sets volume to 0 before calling play() on open", () => {
    render(modalJsx({ open: true, audioSrc: "/sounds/test.mp3", audioFade: true }));

    // Effect sets volume=0 then calls play(); no timers have advanced yet
    expect(mockPlay).toHaveBeenCalledOnce();
    expect(mockVolume).toBe(0);
  });

  it("audioFade=true: volume increases after one fade step (~40ms)", () => {
    render(modalJsx({ open: true, audioSrc: "/sounds/test.mp3", audioFade: true }));
    expect(mockVolume).toBe(0);

    act(() => {
      vi.advanceTimersByTime(40);
    });

    expect(mockVolume).toBeGreaterThan(0);
    expect(mockVolume).toBeLessThan(0.25);
  });

  it("audioFade=true: volume reaches 0.25 after full 500ms fade-in", () => {
    render(modalJsx({ open: true, audioSrc: "/sounds/test.mp3", audioFade: true }));
    expect(mockVolume).toBe(0);

    act(() => {
      vi.advanceTimersByTime(600); // overshoot to ensure completion
    });

    expect(mockVolume).toBeCloseTo(0.25, 5);
  });

  // ── audioFade=true — fade-out ───────────────────────────────────────────────

  it("audioFade=true: fade-out decreases volume when modal closes", () => {
    const { rerender } = render(modalJsx({ open: true, audioSrc: "/sounds/test.mp3", audioFade: true }));

    // Simulate audio is playing at target volume
    mockPaused = false;
    mockVolume = 0.25;

    act(() => {
      rerender(modalJsx({ open: false, audioSrc: "/sounds/test.mp3", audioFade: true }));
    });

    // Advance one step — volume should drop
    act(() => {
      vi.advanceTimersByTime(40);
    });

    expect(mockVolume).toBeLessThan(0.25);
  });

  it("audioFade=true: pause() is called after full 600ms fade-out", () => {
    const { rerender } = render(modalJsx({ open: true, audioSrc: "/sounds/test.mp3", audioFade: true }));

    mockPaused = false;
    mockVolume = 0.25;

    act(() => {
      rerender(modalJsx({ open: false, audioSrc: "/sounds/test.mp3", audioFade: true }));
    });

    act(() => {
      vi.advanceTimersByTime(800); // overshoot to ensure completion
    });

    expect(mockPause).toHaveBeenCalled();
    expect(mockVolume).toBeCloseTo(0, 5);
  });

  it("audioFade=true: re-opening mid-fade-out restarts fade-in from volume 0", () => {
    const { rerender } = render(modalJsx({ open: true, audioSrc: "/sounds/test.mp3", audioFade: true }));

    mockPaused = false;
    mockVolume = 0.25;

    // Close → partial fade-out
    act(() => {
      rerender(modalJsx({ open: false, audioSrc: "/sounds/test.mp3", audioFade: true }));
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const volDuringFadeOut = mockVolume;
    expect(volDuringFadeOut).toBeGreaterThan(0);
    expect(volDuringFadeOut).toBeLessThan(0.25);

    // Re-open — should cancel fade-out and restart fade-in at volume 0
    act(() => {
      rerender(modalJsx({ open: true, audioSrc: "/sounds/test.mp3", audioFade: true }));
    });

    expect(mockVolume).toBe(0);
    expect(mockPlay).toHaveBeenCalledTimes(2);
  });
});
