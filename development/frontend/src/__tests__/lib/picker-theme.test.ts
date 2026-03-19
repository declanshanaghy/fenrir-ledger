/**
 * picker-theme — Canonical unit tests for Google Picker theme & UX improvements
 *
 * Covers the fixes applied in picker.ts for issue #1023:
 *   - DocsViewMode.GRID  (tile layout, thumbnails more prominent)
 *   - Theme.DARK         (applied when runtime API exposes it)
 *   - setSize(900, 550)  (wider dialog, fewer truncated names)
 *   - setTitle(...)      (contextual title matching app language)
 *
 * We test `buildPickerInstance()` directly — a synchronous, exported helper
 * that encapsulates all Picker configuration. This avoids async gapi/iframe
 * mocking and makes assertions straightforward.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { buildPickerInstance, PICKER_CONFIG, PickerError } from "@/lib/google/picker";

// ── Types ─────────────────────────────────────────────────────────────────────

type BuilderCall = { method: string; args: unknown[] };

// ── Mock Factory ──────────────────────────────────────────────────────────────

/**
 * Creates a fully-mocked `google.picker` API.
 * DocsView and PickerBuilder use regular functions (constructor-compatible).
 * Supports hasTheme and darkValue options for theme edge-case testing.
 */
function makePickerApi(opts: { hasTheme?: boolean; darkValue?: string } = {}) {
  const builderCalls: BuilderCall[] = [];
  let capturedCallback: ((data: { action: string; docs?: { id: string; name: string }[] }) => void) | null = null;

  const pickerInstance = { setVisible: vi.fn() };

  const docsViewInstance = {
    setMode: vi.fn().mockReturnThis(),
    setIncludeFolders: vi.fn().mockReturnThis(),
    setEnableDrives: vi.fn().mockReturnThis(),
  };

  // Regular function so it's constructor-compatible (new DocsView(...))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DocsView = vi.fn(function (this: any) {
    return docsViewInstance;
  });

  // Chainable builder
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

/** Noop callback for tests that don't care about picker response */
const noopCallback = vi.fn();

afterEach(() => {
  vi.restoreAllMocks();
});

// ── DocsView Configuration ────────────────────────────────────────────────────

describe("buildPickerInstance — DocsView grid mode", () => {
  it("creates DocsView with SPREADSHEETS view ID", () => {
    const { pickerApi, DocsView } = makePickerApi();
    buildPickerInstance(pickerApi, "token", "apikey", noopCallback);
    expect(DocsView).toHaveBeenCalledWith("spreadsheets");
  });

  it("sets GRID mode for tile layout (better thumbnail display)", () => {
    const { pickerApi, docsViewInstance } = makePickerApi();
    buildPickerInstance(pickerApi, "token", "apikey", noopCallback);
    expect(docsViewInstance.setMode).toHaveBeenCalledWith("grid");
  });

  it("excludes folders (only spreadsheets shown)", () => {
    const { pickerApi, docsViewInstance } = makePickerApi();
    buildPickerInstance(pickerApi, "token", "apikey", noopCallback);
    expect(docsViewInstance.setIncludeFolders).toHaveBeenCalledWith(false);
  });

  it("calls addView with the DocsView instance", () => {
    const { pickerApi, builderCalls, docsViewInstance } = makePickerApi();
    buildPickerInstance(pickerApi, "token", "apikey", noopCallback);

    const addViewCall = builderCalls.find((c) => c.method === "addView");
    expect(addViewCall).toBeDefined();
    expect(addViewCall?.args[0]).toBe(docsViewInstance);
  });
});

// ── NAV_HIDDEN feature ────────────────────────────────────────────────────────

describe("buildPickerInstance — NAV_HIDDEN feature", () => {
  it("enables NAV_HIDDEN feature to hide nav panel", () => {
    const { pickerApi, builderCalls } = makePickerApi();
    buildPickerInstance(pickerApi, "token", "apikey", noopCallback);

    const featureCalls = builderCalls.filter((c) => c.method === "enableFeature");
    expect(featureCalls.length).toBeGreaterThan(0);
    expect(featureCalls.some((c) => c.args[0] === "nav_hidden")).toBe(true);
  });
});

// ── Origin ────────────────────────────────────────────────────────────────────

describe("buildPickerInstance — setOrigin", () => {
  it("calls setOrigin with a non-empty string", () => {
    const { pickerApi, builderCalls } = makePickerApi();
    buildPickerInstance(pickerApi, "token", "apikey", noopCallback);

    const originCall = builderCalls.find((c) => c.method === "setOrigin");
    expect(originCall).toBeDefined();
    expect(typeof originCall?.args[0]).toBe("string");
    expect((originCall?.args[0] as string).length).toBeGreaterThan(0);
  });
});

// ── Dark Theme ────────────────────────────────────────────────────────────────

describe("buildPickerInstance — Dark theme", () => {
  it("applies Theme.DARK when the runtime Picker API exposes it", () => {
    const { pickerApi, builderCalls } = makePickerApi({ hasTheme: true });
    buildPickerInstance(pickerApi, "token", "apikey", noopCallback);

    const themeCall = builderCalls.find((c) => c.method === "setTheme");
    expect(themeCall).toBeDefined();
    expect(themeCall?.args[0]).toBe("dark");
  });

  it("skips setTheme when Theme API is absent (older cached bundle)", () => {
    const { pickerApi, builderCalls } = makePickerApi({ hasTheme: false });
    buildPickerInstance(pickerApi, "token", "apikey", noopCallback);

    const themeCall = builderCalls.find((c) => c.method === "setTheme");
    expect(themeCall).toBeUndefined();
  });

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

// ── Dialog Size ───────────────────────────────────────────────────────────────

describe("buildPickerInstance — Larger dialog size", () => {
  it(`uses ${PICKER_CONFIG.width}×${PICKER_CONFIG.height} dialog to reduce filename truncation`, () => {
    const { pickerApi, builderCalls } = makePickerApi();
    buildPickerInstance(pickerApi, "token", "apikey", noopCallback);

    const sizeCall = builderCalls.find((c) => c.method === "setSize");
    expect(sizeCall).toBeDefined();
    expect(sizeCall?.args).toEqual([PICKER_CONFIG.width, PICKER_CONFIG.height]);
  });

  it("dialog width >= 800 (meaningful improvement over 600px default)", () => {
    expect(PICKER_CONFIG.width).toBeGreaterThanOrEqual(800);
  });

  it("dialog height >= 500 (meaningful improvement over 400px default)", () => {
    expect(PICKER_CONFIG.height).toBeGreaterThanOrEqual(500);
  });

  it("setSize is called exactly once (no duplicate size calls)", () => {
    const { pickerApi, builderCalls } = makePickerApi();
    buildPickerInstance(pickerApi, "token", "apikey", noopCallback);

    const sizeCalls = builderCalls.filter((c) => c.method === "setSize");
    expect(sizeCalls.length).toBe(1);
  });
});

// ── PICKER_CONFIG exact values ────────────────────────────────────────────────

describe("PICKER_CONFIG exact values", () => {
  it("width is exactly 900", () => {
    expect(PICKER_CONFIG.width).toBe(900);
  });

  it("height is exactly 550", () => {
    expect(PICKER_CONFIG.height).toBe(550);
  });
});

// ── Title ─────────────────────────────────────────────────────────────────────

describe("buildPickerInstance — Contextual title", () => {
  it("sets a non-empty title matching app design language", () => {
    const { pickerApi, builderCalls } = makePickerApi();
    buildPickerInstance(pickerApi, "token", "apikey", noopCallback);

    const titleCall = builderCalls.find((c) => c.method === "setTitle");
    expect(titleCall).toBeDefined();
    expect(typeof titleCall?.args[0]).toBe("string");
    expect((titleCall?.args[0] as string).trim().length).toBeGreaterThan(0);
  });

  it("PICKER_CONFIG.title is non-empty", () => {
    expect(PICKER_CONFIG.title.trim().length).toBeGreaterThan(0);
  });

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

// ── Callback & Return Value ───────────────────────────────────────────────────

describe("buildPickerInstance — Callback wiring", () => {
  it("passes callback to builder.setCallback", () => {
    const { pickerApi, capturedCallback } = makePickerApi();
    const cb = vi.fn();
    buildPickerInstance(pickerApi, "token", "apikey", cb);

    expect(capturedCallback()).toBe(cb);
  });

  it("returns the picker instance from builder.build()", () => {
    const { pickerApi, pickerInstance } = makePickerApi();
    const result = buildPickerInstance(pickerApi, "token", "apikey", noopCallback);
    expect(result).toBe(pickerInstance);
  });

  it("passes access token via setOAuthToken", () => {
    const { pickerApi, builderCalls } = makePickerApi();
    buildPickerInstance(pickerApi, "my-access-token", "apikey", noopCallback);

    const tokenCall = builderCalls.find((c) => c.method === "setOAuthToken");
    expect(tokenCall?.args[0]).toBe("my-access-token");
  });

  it("passes api key via setDeveloperKey", () => {
    const { pickerApi, builderCalls } = makePickerApi();
    buildPickerInstance(pickerApi, "token", "my-api-key", noopCallback);

    const keyCall = builderCalls.find((c) => c.method === "setDeveloperKey");
    expect(keyCall?.args[0]).toBe("my-api-key");
  });
});

// ── PickerError class ─────────────────────────────────────────────────────────

describe("PickerError", () => {
  it("sets the code property", () => {
    const err = new PickerError("SCRIPT_LOAD_FAILED", "test");
    expect(err.code).toBe("SCRIPT_LOAD_FAILED");
  });

  it("sets name to PickerError", () => {
    const err = new PickerError("NO_SELECTION", "test");
    expect(err.name).toBe("PickerError");
  });

  it("is an instance of Error", () => {
    expect(new PickerError("PICKER_CANCELLED", "test")).toBeInstanceOf(Error);
  });

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
