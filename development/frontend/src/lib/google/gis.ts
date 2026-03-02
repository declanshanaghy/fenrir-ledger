/**
 * Google Identity Services (GIS) Token Client — Fenrir Ledger
 *
 * Dynamically loads the GIS script and provides a Promise-based wrapper
 * around google.accounts.oauth2.initTokenClient() for incremental consent.
 *
 * Used by Path B ("Browse the Archives") to request Drive-scoped access
 * tokens without disrupting the existing PKCE session flow.
 */

// ── GIS TypeScript Declarations ─────────────────────────────────────────────

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken: (opts?: { prompt?: string }) => void;
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
  error_callback?: (error: { type: string; message: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: TokenClientConfig) => TokenClient;
        };
      };
    };
  }
}

// ── Script Loading ──────────────────────────────────────────────────────────

const GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client";

let gisLoadPromise: Promise<void> | null = null;

/**
 * Dynamically loads the Google Identity Services script.
 * Returns a cached promise on subsequent calls.
 */
function loadGisScript(): Promise<void> {
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoadPromise = null;
      reject(new GisError("SCRIPT_LOAD_FAILED", "Failed to load Google Identity Services"));
    };
    document.head.appendChild(script);
  });

  return gisLoadPromise;
}

// ── Error Types ─────────────────────────────────────────────────────────────

export type GisErrorCode =
  | "SCRIPT_LOAD_FAILED"
  | "CONSENT_DECLINED"
  | "POPUP_CLOSED"
  | "TOKEN_ERROR";

export class GisError extends Error {
  readonly code: GisErrorCode;

  constructor(code: GisErrorCode, message: string) {
    super(message);
    this.name = "GisError";
    this.code = code;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Drive scopes needed for Path B */
const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
].join(" ");

/**
 * Requests a Drive-scoped access token via the GIS popup.
 *
 * @param clientId - Google OAuth 2.0 client ID
 * @returns The access token and expiry, or throws GisError on failure
 */
export async function requestDriveAccessToken(
  clientId: string
): Promise<{ access_token: string; expires_in: number }> {
  await loadGisScript();

  if (!window.google?.accounts?.oauth2) {
    throw new GisError("SCRIPT_LOAD_FAILED", "Google Identity Services not available");
  }

  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPES,
      callback: (response: TokenResponse) => {
        if (response.error) {
          if (response.error === "access_denied") {
            reject(new GisError("CONSENT_DECLINED", "Google Drive access was not granted"));
          } else {
            reject(
              new GisError(
                "TOKEN_ERROR",
                response.error_description || `Token error: ${response.error}`
              )
            );
          }
          return;
        }
        resolve({
          access_token: response.access_token,
          expires_in: response.expires_in,
        });
      },
      error_callback: (error) => {
        if (error.type === "popup_closed") {
          reject(new GisError("POPUP_CLOSED", "The consent popup was closed"));
        } else {
          reject(new GisError("TOKEN_ERROR", error.message || "GIS error"));
        }
      },
    });

    client.requestAccessToken({ prompt: "" });
  });
}
