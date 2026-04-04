import { useEffect, useRef } from "react";
import { useStdout } from "ink";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MousePressEvent {
  /** 1-based terminal column */
  x: number;
  /** 1-based terminal row */
  y: number;
  /** 0 = left, 1 = middle, 2 = right */
  button: number;
}

export type MousePressHandler = (event: MousePressEvent) => void;

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useMouseClick — enables xterm X10 mouse tracking and fires onPress on each
 * mouse-button-press event.
 *
 * Protocol: sends ESC [ ? 1 0 0 0 h to stdout to enable tracking; reads raw
 * ESC [ M <b> <x> <y> sequences from process.stdin.  Works in iTerm2,
 * Terminal.app, Alacritty, tmux, and most xterm-compatible emulators.
 *
 * Coordinates are 1-based: (x=1, y=1) is the top-left terminal cell.
 *
 * Only one component should call this hook at a time to avoid duplicate
 * listeners.
 *
 * The hook is a no-op when process.stdin is not a TTY (CI, pipes, tests).
 */
export function useMouseClick(onPress: MousePressHandler): void {
  const { stdout } = useStdout();

  // Use a ref so we always call the latest handler without restarting the
  // effect every render.
  const handlerRef = useRef<MousePressHandler>(onPress);
  handlerRef.current = onPress;

  useEffect(() => {
    if (!stdout || !process.stdin.isTTY) return;

    // Enable X10 mouse tracking (press events only — no drag/release noise).
    stdout.write("\x1b[?1000h");

    const handleData = (chunk: Buffer | string): void => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);

      // X10 encoding: ESC [ M <b+32> <x+32> <y+32>  (exactly 6 bytes per event)
      // Scan the whole chunk — multiple events can arrive in one read.
      let i = 0;
      while (i + 5 < buf.length) {
        if (
          buf[i] === 0x1b &&      // ESC
          buf[i + 1] === 0x5b &&  // [
          buf[i + 2] === 0x4d    // M
        ) {
          const rawButton = (buf[i + 3] ?? 32) - 32;
          const x = (buf[i + 4] ?? 32) - 32;
          const y = (buf[i + 5] ?? 32) - 32;

          // rawButton bits 0-1 encode the button number (0=left, 1=middle,
          // 2=right, 3=release in some terminals).  We only care about presses.
          const button = rawButton & 0x03;
          if (button !== 3) {
            // button === 3 signals a release in some terminals; skip it.
            handlerRef.current({ x, y, button });
          }
          i += 6;
          continue;
        }
        i++;
      }
    };

    process.stdin.on("data", handleData);

    return () => {
      // Disable X10 mouse tracking on cleanup.
      stdout.write("\x1b[?1000l");
      process.stdin.off("data", handleData);
    };
  }, [stdout]); // stdout is stable; handlerRef avoids re-registering on render
}
