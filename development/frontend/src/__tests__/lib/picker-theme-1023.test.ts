/**
 * picker-theme-1023 — Unit tests for Google Picker theme & UX improvements
 *
 * Issue #1023: Picker dialog had broken thumbnails, dark-theme clash, and
 * truncated file names. Fixes applied in picker.ts:
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
 */
function makePickerApi(opts: { hasTheme?: boolean } = {}) {
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

  const pickerApi = {
    ViewId: { SPREADSHEETS: "spreadsheets" },
    Feature: { NAV_HIDDEN: "nav_hidden", SUPPORT_DRIVES: "support_drives" },
    Action: { PICKED: "picked", CANCEL: "cancel" },
    DocsView,
    DocsViewMode: { GRID: "grid", LIST: "list" },
    PickerBuilder,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Theme: opts.hasTheme === false ? (undefined as any) : { DARK: "dark", LIGHT: "light" },
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

describe("buildPickerInstance — DocsView grid mode (issue #1023)", () => {
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
});

// ── Dark Theme ────────────────────────────────────────────────────────────────

describe("buildPickerInstance — Dark theme (issue #1023)", () => {
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
});

// ── Dialog Size ───────────────────────────────────────────────────────────────

describe("buildPickerInstance — Larger dialog size (issue #1023)", () => {
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
});

// ── Title ─────────────────────────────────────────────────────────────────────

describe("buildPickerInstance — Contextual title (issue #1023)", () => {
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
});

// ── Callback & Return Value ───────────────────────────────────────────────────

describe("buildPickerInstance — Callback wiring (regression guard)", () => {
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
});
