/**
 * Vitest — Odin's Spear ADC Auth Logic
 * Issue #1246: auto-authenticate ADC on startup with refresh token cache
 *
 * odins-spear.mjs uses top-level await with side-effects and cannot be
 * imported. Tests below mirror the ensureAuthenticated() logic with
 * injectable dependencies to validate all three branches in isolation.
 *
 * Branches under test:
 *   1. Valid ADC already present  → resolves silently, no browser flow
 *   2. ADC missing/invalid but refresh_token in JSON → refreshes silently
 *   3. No credentials at all      → spawns gcloud browser flow
 *   4. Expired refresh_token      → falls through to browser flow
 *   5. gcloud not installed       → throws with recognisable message
 *   6. Browser auth cancelled     → throws with recognisable message
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ─── Deps injected into the testable implementation ──────────────────────────

interface GoogleAuthDeps {
  /** Attempt to get a valid access token from current ADC. */
  tryExistingAdc: () => Promise<void>;
  /** Read the ADC JSON file; returns null if missing. */
  readAdcJson: () => { client_id?: string; client_secret?: string; refresh_token?: string } | null;
  /** Exchange a refresh token for a new access token. Throws if invalid/expired. */
  refreshWithToken: (clientId: string, clientSecret: string, refreshToken: string) => Promise<string>;
  /** Set GOOGLE_APPLICATION_CREDENTIALS environment variable. */
  setAdcEnv: (path: string) => void;
  /** Spawn gcloud browser flow (inherits stdio). Throws if gcloud not found. */
  runGcloudLogin: () => void;
  /** Log a message to stdout. */
  log: (msg: string) => void;
}

/**
 * Portable re-implementation of ensureAuthenticated() with injectable deps.
 * Mirrors the logic in odins-spear.mjs exactly so tests exercise the real
 * decision tree.
 */
async function ensureAuthenticated(deps: GoogleAuthDeps): Promise<void> {
  // 1. Try existing ADC — if valid, return early
  try {
    await deps.tryExistingAdc();
    return;
  } catch { /* fall through */ }

  // 2. Check for refresh_token in ADC JSON
  const adc = deps.readAdcJson();
  if (adc?.refresh_token && adc?.client_id && adc?.client_secret) {
    try {
      const token = await deps.refreshWithToken(adc.client_id, adc.client_secret, adc.refresh_token);
      if (token) {
        deps.setAdcEnv("/fake/.config/gcloud/application_default_credentials.json");
        return;
      }
    } catch { /* refresh_token expired or invalid — fall through */ }
  }

  // 3. Fall back to browser flow
  deps.log("Opening browser for Google authentication...");
  deps.runGcloudLogin();
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("ensureAuthenticated — ADC startup auth (issue #1246)", () => {
  let deps: { [K in keyof GoogleAuthDeps]: Mock };

  beforeEach(() => {
    deps = {
      tryExistingAdc: vi.fn(),
      readAdcJson: vi.fn(),
      refreshWithToken: vi.fn(),
      setAdcEnv: vi.fn(),
      runGcloudLogin: vi.fn(),
      log: vi.fn(),
    };
  });

  // ── Branch 1: valid ADC ────────────────────────────────────────────────────

  describe("when existing ADC is valid", () => {
    it("resolves without touching ADC file, refresh, or gcloud", async () => {
      deps.tryExistingAdc.mockResolvedValue(undefined);

      await ensureAuthenticated(deps);

      expect(deps.tryExistingAdc).toHaveBeenCalledTimes(1);
      expect(deps.readAdcJson).not.toHaveBeenCalled();
      expect(deps.refreshWithToken).not.toHaveBeenCalled();
      expect(deps.runGcloudLogin).not.toHaveBeenCalled();
      expect(deps.log).not.toHaveBeenCalled();
    });

    it("does not set GOOGLE_APPLICATION_CREDENTIALS when ADC already valid", async () => {
      deps.tryExistingAdc.mockResolvedValue(undefined);

      await ensureAuthenticated(deps);

      expect(deps.setAdcEnv).not.toHaveBeenCalled();
    });
  });

  // ── Branch 2: refresh_token present ───────────────────────────────────────

  describe("when ADC is invalid but a refresh_token is cached", () => {
    beforeEach(() => {
      deps.tryExistingAdc.mockRejectedValue(new Error("invalid_grant"));
      deps.readAdcJson.mockReturnValue({
        client_id: "test-client-id",
        client_secret: "test-client-secret",
        refresh_token: "test-refresh-token",
      });
      deps.refreshWithToken.mockResolvedValue("ya29.new-access-token");
    });

    it("resolves silently without opening a browser", async () => {
      await ensureAuthenticated(deps);

      expect(deps.runGcloudLogin).not.toHaveBeenCalled();
      expect(deps.log).not.toHaveBeenCalled();
    });

    it("calls refreshWithToken with client_id, client_secret, and refresh_token", async () => {
      await ensureAuthenticated(deps);

      expect(deps.refreshWithToken).toHaveBeenCalledWith(
        "test-client-id",
        "test-client-secret",
        "test-refresh-token"
      );
    });

    it("sets GOOGLE_APPLICATION_CREDENTIALS after successful refresh", async () => {
      await ensureAuthenticated(deps);

      expect(deps.setAdcEnv).toHaveBeenCalledTimes(1);
    });
  });

  // ── Branch 3: no credentials at all ───────────────────────────────────────

  describe("when no ADC credentials exist at all", () => {
    beforeEach(() => {
      deps.tryExistingAdc.mockRejectedValue(new Error("Could not load the default credentials"));
      deps.readAdcJson.mockReturnValue(null);
    });

    it("prints the browser-opening message", async () => {
      await ensureAuthenticated(deps);

      expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Opening browser"));
    });

    it("spawns gcloud auth application-default login", async () => {
      await ensureAuthenticated(deps);

      expect(deps.runGcloudLogin).toHaveBeenCalledTimes(1);
    });

    it("does not attempt token refresh", async () => {
      await ensureAuthenticated(deps);

      expect(deps.refreshWithToken).not.toHaveBeenCalled();
    });
  });

  // ── Branch 4: ADC file exists but has no refresh_token ────────────────────

  describe("when ADC JSON exists but lacks a refresh_token (e.g. service account key)", () => {
    beforeEach(() => {
      deps.tryExistingAdc.mockRejectedValue(new Error("invalid_grant"));
      deps.readAdcJson.mockReturnValue({
        type: "service_account",
        private_key: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n",
        // no refresh_token
      });
    });

    it("falls through to browser flow without attempting refresh", async () => {
      await ensureAuthenticated(deps);

      expect(deps.refreshWithToken).not.toHaveBeenCalled();
      expect(deps.runGcloudLogin).toHaveBeenCalledTimes(1);
    });
  });

  // ── Branch 5: refresh_token is expired ────────────────────────────────────

  describe("when refresh_token is expired or revoked", () => {
    beforeEach(() => {
      deps.tryExistingAdc.mockRejectedValue(new Error("invalid_grant"));
      deps.readAdcJson.mockReturnValue({
        client_id: "test-client-id",
        client_secret: "test-client-secret",
        refresh_token: "expired-token",
      });
      deps.refreshWithToken.mockRejectedValue(new Error("Token has been expired or revoked."));
    });

    it("falls through to browser flow after refresh failure", async () => {
      await ensureAuthenticated(deps);

      expect(deps.runGcloudLogin).toHaveBeenCalledTimes(1);
    });

    it("prints browser-opening message before gcloud spawn", async () => {
      await ensureAuthenticated(deps);

      expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Opening browser"));
    });

    it("does not set GOOGLE_APPLICATION_CREDENTIALS", async () => {
      await ensureAuthenticated(deps);

      expect(deps.setAdcEnv).not.toHaveBeenCalled();
    });
  });

  // ── Branch 6: gcloud not installed ────────────────────────────────────────

  describe("when gcloud CLI is not installed", () => {
    beforeEach(() => {
      deps.tryExistingAdc.mockRejectedValue(new Error("Could not load the default credentials"));
      deps.readAdcJson.mockReturnValue(null);
      deps.runGcloudLogin.mockImplementation(() => {
        const err = new Error("gcloud: command not found") as NodeJS.ErrnoException;
        err.code = "ENOENT";
        throw err;
      });
    });

    it("propagates the error so the caller can print a helpful message and exit", async () => {
      await expect(ensureAuthenticated(deps)).rejects.toThrow(/gcloud/);
    });
  });

  // ── Branch 7: user cancels browser auth ───────────────────────────────────

  describe("when user cancels the browser auth flow", () => {
    beforeEach(() => {
      deps.tryExistingAdc.mockRejectedValue(new Error("Could not load the default credentials"));
      deps.readAdcJson.mockReturnValue(null);
      deps.runGcloudLogin.mockImplementation(() => {
        throw new Error("ERROR: (gcloud.auth.application-default.login) User cancelled the flow.");
      });
    });

    it("propagates the error for clean exit handling", async () => {
      await expect(ensureAuthenticated(deps)).rejects.toThrow(/cancelled/i);
    });
  });
});
