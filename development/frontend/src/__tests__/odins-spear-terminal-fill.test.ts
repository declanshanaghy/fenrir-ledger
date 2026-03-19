/**
 * Vitest — Odin's Spear: REPL fills full terminal window
 * Issue #1440: Terminal size detection and resize handling
 *
 * odins-spear.mjs uses top-level await with side-effects and cannot be imported.
 * Tests mirror the terminal-size logic with injectable dependencies.
 *
 * Suites:
 *   1. Terminal size initialization — stdout.columns/rows with fallback chain
 *   2. Resize handler — updates dimensions from stdout or process.stdout
 *   3. Resize handler cleanup — removes listener on unmount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Terminal size helpers (mirroring SpearApp initialisation) ─────────────────
//
// Mirrors:
//   const [termSize, setTermSize] = useState({
//     columns: stdout?.columns ?? process.stdout.columns ?? 80,
//     rows:    stdout?.rows    ?? process.stdout.rows    ?? 24,
//   });

interface MockStdout {
  columns?: number;
  rows?: number;
  on: (event: string, fn: () => void) => void;
  off: (event: string, fn: () => void) => void;
}

function getInitialTermSize(
  stdout: MockStdout | null,
  processStdout: { columns?: number; rows?: number }
): { columns: number; rows: number } {
  return {
    columns: stdout?.columns ?? processStdout?.columns ?? 80,
    rows:    stdout?.rows    ?? processStdout?.rows    ?? 24,
  };
}

function buildResizeHandler(
  stdout: MockStdout | null,
  processStdout: { columns?: number; rows?: number },
  setTermSize: (size: { columns: number; rows: number }) => void
): () => void {
  return function onResize() {
    setTermSize({
      columns: stdout?.columns ?? processStdout?.columns ?? 80,
      rows:    stdout?.rows    ?? processStdout?.rows    ?? 24,
    });
  };
}

// ─── 1. Terminal size initialization ─────────────────────────────────────────

describe("terminal size initialization — stdout.columns/rows fallback chain (issue #1440)", () => {
  it("uses stdout.columns and stdout.rows when both are provided", () => {
    const stdout: MockStdout = { columns: 220, rows: 55, on: vi.fn(), off: vi.fn() };
    const size = getInitialTermSize(stdout, { columns: 80, rows: 24 });
    expect(size).toEqual({ columns: 220, rows: 55 });
  });

  it("falls back to process.stdout values when stdout is null", () => {
    const size = getInitialTermSize(null, { columns: 132, rows: 40 });
    expect(size).toEqual({ columns: 132, rows: 40 });
  });

  it("falls back to defaults (80x24) when both stdout and process.stdout are undefined", () => {
    const size = getInitialTermSize(null, {});
    expect(size).toEqual({ columns: 80, rows: 24 });
  });

  it("falls back to process.stdout when stdout.columns is undefined", () => {
    const stdout: MockStdout = { rows: 50, on: vi.fn(), off: vi.fn() };
    const size = getInitialTermSize(stdout, { columns: 100, rows: 30 });
    // columns falls back to process.stdout.columns; rows taken from stdout.rows
    expect(size.columns).toBe(100);
    expect(size.rows).toBe(50);
  });

  it("falls back to process.stdout when stdout.rows is undefined", () => {
    const stdout: MockStdout = { columns: 200, on: vi.fn(), off: vi.fn() };
    const size = getInitialTermSize(stdout, { columns: 80, rows: 35 });
    expect(size.columns).toBe(200);
    expect(size.rows).toBe(35);
  });

  it("uses default 80 columns when stdout is null and process.stdout.columns is undefined", () => {
    const size = getInitialTermSize(null, { rows: 30 });
    expect(size.columns).toBe(80);
  });

  it("uses default 24 rows when stdout is null and process.stdout.rows is undefined", () => {
    const size = getInitialTermSize(null, { columns: 100 });
    expect(size.rows).toBe(24);
  });
});

// ─── 2. Resize handler — updates dimensions ────────────────────────────────

describe("resize handler — reflects new terminal dimensions (issue #1440)", () => {
  it("calls setTermSize with stdout dimensions on resize", () => {
    const stdout: MockStdout = { columns: 300, rows: 80, on: vi.fn(), off: vi.fn() };
    const setTermSize = vi.fn();
    const onResize = buildResizeHandler(stdout, {}, setTermSize);
    onResize();
    expect(setTermSize).toHaveBeenCalledOnce();
    expect(setTermSize).toHaveBeenCalledWith({ columns: 300, rows: 80 });
  });

  it("falls back to process.stdout on resize when stdout is null", () => {
    const setTermSize = vi.fn();
    const onResize = buildResizeHandler(null, { columns: 120, rows: 40 }, setTermSize);
    onResize();
    expect(setTermSize).toHaveBeenCalledWith({ columns: 120, rows: 40 });
  });

  it("uses defaults on resize when both sources are undefined", () => {
    const setTermSize = vi.fn();
    const onResize = buildResizeHandler(null, {}, setTermSize);
    onResize();
    expect(setTermSize).toHaveBeenCalledWith({ columns: 80, rows: 24 });
  });

  it("reflects updated stdout dimensions across multiple resize events", () => {
    const stdout: MockStdout = { columns: 100, rows: 30, on: vi.fn(), off: vi.fn() };
    const setTermSize = vi.fn();
    const onResize = buildResizeHandler(stdout, {}, setTermSize);

    onResize();
    stdout.columns = 200;
    stdout.rows = 60;
    onResize();

    expect(setTermSize).toHaveBeenCalledTimes(2);
    expect(setTermSize.mock.calls[0][0]).toEqual({ columns: 100, rows: 30 });
    expect(setTermSize.mock.calls[1][0]).toEqual({ columns: 200, rows: 60 });
  });
});

// ─── 3. Resize handler cleanup ────────────────────────────────────────────────
//
// Mirrors:
//   process.stdout.on("resize", onResize);
//   return () => process.stdout.off("resize", onResize);

describe("resize handler cleanup — removes listener on unmount (issue #1440)", () => {
  let onListeners: Map<string, Set<() => void>>;
  let mockProcessStdout: { on: (event: string, fn: () => void) => void; off: (event: string, fn: () => void) => void };

  beforeEach(() => {
    onListeners = new Map();
    mockProcessStdout = {
      on: vi.fn((event: string, fn: () => void) => {
        if (!onListeners.has(event)) onListeners.set(event, new Set());
        onListeners.get(event)!.add(fn);
      }),
      off: vi.fn((event: string, fn: () => void) => {
        onListeners.get(event)?.delete(fn);
      }),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers a 'resize' listener on mount", () => {
    const setTermSize = vi.fn();
    const onResize = buildResizeHandler(null, {}, setTermSize);
    mockProcessStdout.on("resize", onResize);
    expect(mockProcessStdout.on).toHaveBeenCalledWith("resize", onResize);
  });

  it("removes the 'resize' listener on cleanup", () => {
    const setTermSize = vi.fn();
    const onResize = buildResizeHandler(null, {}, setTermSize);
    mockProcessStdout.on("resize", onResize);

    // Simulate unmount cleanup
    mockProcessStdout.off("resize", onResize);
    expect(mockProcessStdout.off).toHaveBeenCalledWith("resize", onResize);
    expect(onListeners.get("resize")?.has(onResize)).toBe(false);
  });

  it("cleanup does not call setTermSize after removal", () => {
    const setTermSize = vi.fn();
    const onResize = buildResizeHandler(null, { columns: 80, rows: 24 }, setTermSize);
    mockProcessStdout.on("resize", onResize);
    mockProcessStdout.off("resize", onResize);

    // No more resize events should fire setTermSize
    onListeners.get("resize")?.forEach((fn) => fn());
    expect(setTermSize).not.toHaveBeenCalled();
  });
});
