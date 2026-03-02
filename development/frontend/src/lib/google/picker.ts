/**
 * Google Picker API Wrapper — Fenrir Ledger
 *
 * Dynamically loads the Google API client library and provides a Promise-based
 * wrapper for the Google Picker, filtered to Google Sheets only.
 *
 * Used by Path B ("Browse the Archives") to let users select a spreadsheet
 * from their Google Drive without making it public.
 */

// ── Google Picker TypeScript Declarations ───────────────────────────────────
// Using interface augmentation instead of namespace to satisfy eslint

interface PickerDocument {
  id: string;
  name: string;
  mimeType: string;
}

interface PickerResponseObject {
  action: string;
  docs?: PickerDocument[];
}

interface PickerView {
  __brand: "PickerView";
}

interface PickerInstance {
  setVisible(visible: boolean): void;
}

interface PickerBuilderApi {
  addView(view: PickerView): PickerBuilderApi;
  enableFeature(feature: string): PickerBuilderApi;
  setOAuthToken(token: string): PickerBuilderApi;
  setDeveloperKey(key: string): PickerBuilderApi;
  setCallback(callback: (data: PickerResponseObject) => void): PickerBuilderApi;
  setSize(width: number, height: number): PickerBuilderApi;
  build(): PickerInstance;
}

interface GooglePickerApi {
  ViewId: { SPREADSHEETS: string };
  Feature: { NAV_HIDDEN: string };
  Action: { PICKED: string; CANCEL: string };
  DocsView: new (viewId: string) => PickerView;
  PickerBuilder: new () => PickerBuilderApi;
}

declare global {
  interface Window {
    gapi?: {
      load: (api: string, callback: () => void) => void;
    };
  }
  // eslint-disable-next-line no-var
  var google: {
    picker: GooglePickerApi;
  } | undefined;
}

// ── Script Loading ──────────────────────────────────────────────────────────

const GAPI_SCRIPT_URL = "https://apis.google.com/js/api.js";

let gapiLoadPromise: Promise<void> | null = null;
let pickerApiLoaded = false;

/**
 * Dynamically loads the Google API client library.
 * Returns a cached promise on subsequent calls.
 */
function loadGapiScript(): Promise<void> {
  if (gapiLoadPromise) return gapiLoadPromise;

  gapiLoadPromise = new Promise<void>((resolve, reject) => {
    if (window.gapi) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = GAPI_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gapiLoadPromise = null;
      reject(new PickerError("SCRIPT_LOAD_FAILED", "Failed to load Google API client"));
    };
    document.head.appendChild(script);
  });

  return gapiLoadPromise;
}

/**
 * Loads the Picker API via gapi.load('picker', ...).
 * Only loads once; subsequent calls resolve immediately.
 */
async function loadPickerApi(): Promise<void> {
  if (pickerApiLoaded) return;

  await loadGapiScript();

  if (!window.gapi) {
    throw new PickerError("SCRIPT_LOAD_FAILED", "Google API client not available");
  }

  return new Promise<void>((resolve, reject) => {
    window.gapi!.load("picker", () => {
      if (typeof google !== "undefined" && google?.picker) {
        pickerApiLoaded = true;
        resolve();
      } else {
        reject(new PickerError("SCRIPT_LOAD_FAILED", "Google Picker API failed to initialize"));
      }
    });
  });
}

// ── Error Types ─────────────────────────────────────────────────────────────

export type PickerErrorCode =
  | "SCRIPT_LOAD_FAILED"
  | "PICKER_CANCELLED"
  | "NO_SELECTION";

export class PickerError extends Error {
  readonly code: PickerErrorCode;

  constructor(code: PickerErrorCode, message: string) {
    super(message);
    this.name = "PickerError";
    this.code = code;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface PickerResult {
  /** The selected spreadsheet's Google Drive file ID */
  id: string;
  /** The spreadsheet name */
  name: string;
}

/**
 * Opens the Google Picker filtered to spreadsheets.
 *
 * @param accessToken - OAuth2 access token with drive.file scope
 * @param apiKey - Google API key (GOOGLE_PICKER_API_KEY, served via /api/config/picker)
 * @returns The selected spreadsheet info, or null if cancelled
 */
export async function openPicker(
  accessToken: string,
  apiKey: string
): Promise<PickerResult | null> {
  await loadPickerApi();

  const pickerApi = google?.picker;
  if (!pickerApi) {
    throw new PickerError("SCRIPT_LOAD_FAILED", "Google Picker API not available");
  }

  return new Promise((resolve, reject) => {
    try {
      const view = new pickerApi.DocsView(pickerApi.ViewId.SPREADSHEETS);

      const picker = new pickerApi.PickerBuilder()
        .addView(view)
        .enableFeature(pickerApi.Feature.NAV_HIDDEN)
        .setOAuthToken(accessToken)
        .setDeveloperKey(apiKey)
        .setCallback((data: PickerResponseObject) => {
          if (data.action === pickerApi.Action.PICKED && data.docs?.[0]) {
            resolve({
              id: data.docs[0].id,
              name: data.docs[0].name,
            });
          } else if (data.action === pickerApi.Action.CANCEL) {
            resolve(null);
          }
        })
        .setSize(600, 400)
        .build();

      picker.setVisible(true);
    } catch (err) {
      reject(
        new PickerError(
          "SCRIPT_LOAD_FAILED",
          err instanceof Error ? err.message : "Failed to open Google Picker"
        )
      );
    }
  });
}
