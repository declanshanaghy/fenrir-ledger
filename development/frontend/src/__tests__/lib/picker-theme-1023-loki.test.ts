/**
 * picker-theme-1023-loki — QA validation tests for Google Picker theme & UX improvements
 *
 * Issue #1023: Picker dialog had broken thumbnails, dark-theme clash, and
 * truncated file names.
 *
 * This file adds additional coverage beyond the FiremanDecko baseline tests
 * (picker-theme-1023.test.ts), targeting gaps identified during QA review:
 *
 *   - addView receives the DocsView instance
 *   - NAV_HIDDEN feature is enabled
 *   - setOrigin is called with a non-empty string
 *   - setTitle uses exactly PICKER_CONFIG.title
 *   - PICKER_CONFIG constants are exact (900, 550, correct title substring)
 *   - PickerError message property is set
 *   - All three PickerErrorCode values work
 *   - Theme guard handles falsy DARK (empty string) — not just undefined Theme
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { buildPickerInstance, PICKER_CONFIG, PickerError } from "@/lib/google/picker";

// ── Types ─────────────────────────────────────────────────────────────────────

type BuilderCall = { method: string; args: unknown[] };

// ── Mock Factory ──────────────────────────────────────────────────────────────

function makePickerApi(opts: { hasTheme?: boolean; darkValue?: string } = {}) {
  const builderCalls: BuilderCall[] = [];
  let capturedCallback: ((data: { action: string; docs?: { id: string; name: string }[] }) => void) | null = null;

  const pickerInstance = { setVisible: vi.fn() };

  const docsViewInstance = {
    setMode: vi.fn().mockReturnThis(),
    setIncludeFolders: vi.fn().mockReturnThis(),
    setEnableDrives: vi.fn().mockReturnThis(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DocsView = vi.fn(function (this: any) {
    return docsViewInstance;
  });

  const builder: Record<string, (...args: unknown[]) => unknown> = {};
  ["addView", "enableFeature", "setOAuthToken", "setDeveloperKey", "setOrigin", "setTitle", "setSize", "setTheme"].forEach(
    (method) => {
      builder[method] = (...args: unknown[]) => {
        builderCalls.push({ method, args });
        return builder;
      };
    }
  );
  builder.setCallback = (cb: unknown) => {
    capturedCallback = cb as typeof capturedCallback;
    return builder;
  };
  builder.build = () => pickerInstance;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const PickerBuilder = vi.fn(function (this: any) {
    return builder;
  });

  // Allow testing with explicitly falsy DARK value (e.g. empty string)
  let theme: { DARK: string; LIGHT: string } | undefined;
  if (opts.hasTheme === false) {
    theme = undefined;
  } else if (opts.darkValue !== undefined) {
    theme = { DARK: opts.darkValue, LIGHT: "light" };
  } else {
    theme = { DARK: "dark", LIGHT: "light" };
  }

  const pickerApi = {
    ViewId: { SPREADSHEETS: "spreadsheets" },
    Feature: { NAV_HIDDEN: "nav_hidden", SUPPORT_DRIVES: "support_drives" },
    Action: { PICKED: "picked", CANCEL: "cancel" },
    DocsView,
    DocsViewMode: { GRID: "grid", LIST: "list" },
    PickerBuilder,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Theme: theme as any,
  };

  return {
    pickerApi,
    builderCalls,
    capturedCallback: () => capturedCallback,
    pickerInstance,
    docsViewInstance,
    DocsView,
  };
}

const noopCallback = vi.fn();

afterEach(() => {
  vi.restoreAllMocks();
});

// ── View wiring ───────────────────────────────────────────────────────────────

describe("buildPickerInstance — addView wiring (issue #1023 QA)", () => {
  it("calls addView with the DocsView instance", () => {
    const { pickerApi, builderCalls, docsViewInstance } = makePickerApi();
    buildPickerInstance(pickerApi, "token", "apikey", noopCallback);

    const addViewCall = builderCalls.find((c) => c.method === "addView");
    expect(addViewCall).toBeDefined();
    expect(addViewCall?.args[0]).toBe(docsViewInstance);
  });
});

// ── NAV_HIDDEN feature ────────────────────────────────────────────────────────

describe("buildPickerInstance — NAV_HIDDEN feature (issue #1023 QA)", () => {
  it("enables NAV_HIDDEN feature to hide nav panel", () => {
    const { pickerApi, builderCalls } = makePickerApi();
    buildPickerInstance(pickerApi, "token", "apikey", noopCallback);

    const featureCalls = builderCalls.filter((c) => c.method === "enableFeature");
    expect(featureCalls.length).toBeGreaterThan(0);
    expect(featureCalls.some((c) => c.args[0] === "nav_hidden")).toBe(true);
  });
});

// ── Origin ────────────────────────────────────────────────────────────────────

describe("buildPickerInstance — setOrigin (issue #1023 QA)", () => {
  it("calls setOrigin with a non-empty string", () => {
    const { pickerApi, builderCalls } = makePickerApi();
    buildPickerInstance(pickerApi, "token", "apikey", noopCallback);

    const originCall = builderCalls.find((c) => c.method === "setOrigin");
    expect(originCall).toBeDefined();
    expect(typeof originCall?.args[0]).toBe("string");
    expect((originCall?.args[0] as string).length).toBeGreaterThan(0);
  });
});

// ── Title exactness ───────────────────────────────────────────────────────────

describe("buildPickerInstance — title uses PICKER_CONFIG.title (issue #1023 QA)", () => {
  it("setTitle receives exactly PICKER_CONFIG.title", () => {
    const { pickerApi, builderCalls } = makePickerApi();
    buildPickerInstance(pickerApi, "token", "apikey", noopCallback);

    const titleCall = builderCalls.find((c) => c.method === "setTitle");
    expect(titleCall?.args[0]).toBe(PICKER_CONFIG.title);
  });

  it("PICKER_CONFIG.title mentions spreadsheet context", () => {
    expect(PICKER_CONFIG.title.toLowerCase()).toMatch(/spreadsheet/i);
  });
});

// ── PICKER_CONFIG exact values ────────────────────────────────────────────────

describe("PICKER_CONFIG exact values (issue #1023 QA)", () => {
  it("width is exactly 900", () => {
    expect(PICKER_CONFIG.width).toBe(900);
  });

  it("height is exactly 550", () => {
    expect(PICKER_CONFIG.height).toBe(550);
  });
});

// ── Dark theme edge cases ─────────────────────────────────────────────────────

describe("buildPickerInstance — dark theme edge cases (issue #1023 QA)", () => {
  it("skips setTheme when Theme.DARK is empty string (falsy)", () => {
    // Older bundles may expose Theme object but with an empty DARK key
    const { pickerApi, builderCalls } = makePickerApi({ darkValue: "" });
    buildPickerInstance(pickerApi, "token", "apikey", noopCallback);

    const themeCall = builderCalls.find((c) => c.method === "setTheme");
    expect(themeCall).toBeUndefined();
  });

  it("applies setTheme when Theme.DARK is 'DARK' (alternate casing)", () => {
    const { pickerApi, builderCalls } = makePickerApi({ darkValue: "DARK" });
    buildPickerInstance(pickerApi, "token", "apikey", noopCallback);

    const themeCall = builderCalls.find((c) => c.method === "setTheme");
    expect(themeCall).toBeDefined();
    expect(themeCall?.args[0]).toBe("DARK");
  });
});

// ── PickerError completeness ──────────────────────────────────────────────────

describe("PickerError — message and all error codes (issue #1023 QA)", () => {
  it("stores the message", () => {
    const err = new PickerError("SCRIPT_LOAD_FAILED", "network error");
    expect(err.message).toBe("network error");
  });

  it("accepts SCRIPT_LOAD_FAILED code", () => {
    const err = new PickerError("SCRIPT_LOAD_FAILED", "msg");
    expect(err.code).toBe("SCRIPT_LOAD_FAILED");
  });

  it("accepts PICKER_CANCELLED code", () => {
    const err = new PickerError("PICKER_CANCELLED", "msg");
    expect(err.code).toBe("PICKER_CANCELLED");
  });

  it("accepts NO_SELECTION code", () => {
    const err = new PickerError("NO_SELECTION", "msg");
    expect(err.code).toBe("NO_SELECTION");
  });
});

// ── setSize called once ───────────────────────────────────────────────────────

describe("buildPickerInstance — setSize called exactly once (issue #1023 QA)", () => {
  it("setSize is called exactly once (no duplicate size calls)", () => {
    const { pickerApi, builderCalls } = makePickerApi();
    buildPickerInstance(pickerApi, "token", "apikey", noopCallback);

    const sizeCalls = builderCalls.filter((c) => c.method === "setSize");
    expect(sizeCalls.length).toBe(1);
  });
});
