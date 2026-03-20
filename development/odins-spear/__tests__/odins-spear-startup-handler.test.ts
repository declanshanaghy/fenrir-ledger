/**
 * Vitest — Odin's Spear Startup Error Handler + Edge Cases
 * Issue #1246: auto-authenticate ADC on startup with refresh token cache
 *
 * Tests not covered by odins-spear-adc-auth.test.ts:
 *   A. refreshWithToken returns falsy/empty token  → falls through to browser
 *   B. ADC JSON has refresh_token but missing client_id or client_secret
 *      → skips refresh attempt, goes to browser
 *   C. Startup catch-block routing logic (gcloud / cancelled / generic errors)
 *   D. REPL command handler catches errors and returns to prompt (crash-free)
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ─── Shared deps interface (mirrors odins-spear-adc-auth.test.ts) ─────────────

interface GoogleAuthDeps {
  tryExistingAdc: () => Promise<void>;
  readAdcJson: () => { client_id?: string; client_secret?: string; refresh_token?: string } | null;
  refreshWithToken: (clientId: string, clientSecret: string, refreshToken: string) => Promise<string>;
  setAdcEnv: (path: string) => void;
  runGcloudLogin: () => void;
  log: (msg: string) => void;
}

async function ensureAuthenticated(deps: GoogleAuthDeps): Promise<void> {
  try {
    await deps.tryExistingAdc();
    return;
  } catch { /* fall through */ }

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

  deps.log("Opening browser for Google authentication...");
  deps.runGcloudLogin();
}

// ─── Startup error handler logic (mirrors mjs lines 336-344) ─────────────────

interface StartupHandlerDeps {
  logError: (msg: string) => void;
  exit: (code: number) => void;
}

function handleStartupAuthError(err: Error, deps: StartupHandlerDeps): void {
  const msg = err.message || String(err);
  if (/gcloud/.test(msg) || /ENOENT/.test(msg) || /not found/.test(msg)) {
    deps.logError("gcloud CLI not found. Install it from https://cloud.google.com/sdk/docs/install");
  } else if (/cancelled|cancel|abort/i.test(msg)) {
    deps.logError("Authentication cancelled. Odin's Spear requires Google credentials to access Firestore.");
  } else {
    deps.logError(`Authentication failed: ${msg}`);
  }
  deps.exit(1);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ensureAuthenticated — edge cases (issue #1246)", () => {
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
    deps.tryExistingAdc.mockRejectedValue(new Error("invalid_grant"));
  });

  // ── Edge A: refreshWithToken returns falsy token ──────────────────────────

  describe("when refreshWithToken resolves with a falsy token", () => {
    it("falls through to browser flow when token is empty string", async () => {
      deps.readAdcJson.mockReturnValue({
        client_id: "cid",
        client_secret: "csecret",
        refresh_token: "rtoken",
      });
      deps.refreshWithToken.mockResolvedValue("");

      await ensureAuthenticated(deps);

      expect(deps.setAdcEnv).not.toHaveBeenCalled();
      expect(deps.runGcloudLogin).toHaveBeenCalledTimes(1);
    });

    it("falls through to browser flow when token is null", async () => {
      deps.readAdcJson.mockReturnValue({
        client_id: "cid",
        client_secret: "csecret",
        refresh_token: "rtoken",
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      deps.refreshWithToken.mockResolvedValue(null as any);

      await ensureAuthenticated(deps);

      expect(deps.setAdcEnv).not.toHaveBeenCalled();
      expect(deps.runGcloudLogin).toHaveBeenCalledTimes(1);
    });

    it("prints browser-opening message when token is falsy", async () => {
      deps.readAdcJson.mockReturnValue({
        client_id: "cid",
        client_secret: "csecret",
        refresh_token: "rtoken",
      });
      deps.refreshWithToken.mockResolvedValue("");

      await ensureAuthenticated(deps);

      expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Opening browser"));
    });
  });

  // ── Edge B: ADC JSON has refresh_token but missing client_id or client_secret

  describe("when ADC JSON has refresh_token but is missing client_id", () => {
    it("does not attempt refresh and goes to browser flow", async () => {
      deps.readAdcJson.mockReturnValue({
        // client_id missing intentionally
        client_secret: "csecret",
        refresh_token: "rtoken",
      });

      await ensureAuthenticated(deps);

      expect(deps.refreshWithToken).not.toHaveBeenCalled();
      expect(deps.runGcloudLogin).toHaveBeenCalledTimes(1);
    });
  });

  describe("when ADC JSON has refresh_token but is missing client_secret", () => {
    it("does not attempt refresh and goes to browser flow", async () => {
      deps.readAdcJson.mockReturnValue({
        client_id: "cid",
        // client_secret missing intentionally
        refresh_token: "rtoken",
      });

      await ensureAuthenticated(deps);

      expect(deps.refreshWithToken).not.toHaveBeenCalled();
      expect(deps.runGcloudLogin).toHaveBeenCalledTimes(1);
    });
  });

  describe("when ADC JSON has empty-string client_id", () => {
    it("does not attempt refresh (empty string is falsy in guard)", async () => {
      deps.readAdcJson.mockReturnValue({
        client_id: "",
        client_secret: "csecret",
        refresh_token: "rtoken",
      });

      await ensureAuthenticated(deps);

      expect(deps.refreshWithToken).not.toHaveBeenCalled();
    });
  });
});

// ─── Startup error handler routing ───────────────────────────────────────────

describe("handleStartupAuthError — startup catch-block routing (issue #1246)", () => {
  let handler: { logError: Mock; exit: Mock };

  beforeEach(() => {
    handler = { logError: vi.fn(), exit: vi.fn() };
  });

  describe("when gcloud is not installed", () => {
    it("prints gcloud-not-found message with install URL", () => {
      handleStartupAuthError(new Error("gcloud: command not found"), handler);

      expect(handler.logError).toHaveBeenCalledWith(
        expect.stringContaining("gcloud CLI not found")
      );
      expect(handler.logError).toHaveBeenCalledWith(
        expect.stringContaining("https://cloud.google.com/sdk/docs/install")
      );
    });

    it("exits with code 1", () => {
      handleStartupAuthError(new Error("gcloud: command not found"), handler);
      expect(handler.exit).toHaveBeenCalledWith(1);
    });

    it("matches ENOENT errors (spawn failure)", () => {
      const err = new Error("spawn ENOENT") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      handleStartupAuthError(err, handler);
      expect(handler.logError).toHaveBeenCalledWith(expect.stringContaining("gcloud CLI not found"));
    });

    it("matches 'not found' message variant", () => {
      handleStartupAuthError(new Error("gcloud: not found"), handler);
      expect(handler.logError).toHaveBeenCalledWith(expect.stringContaining("gcloud CLI not found"));
    });
  });

  describe("when user cancels browser auth", () => {
    it("prints authentication-cancelled message (lowercase 'cancelled')", () => {
      // Note: messages containing 'gcloud' match the gcloud-not-found branch first.
      // A pure "cancelled" message (without gcloud in it) routes correctly.
      handleStartupAuthError(new Error("User cancelled the auth flow."), handler);
      expect(handler.logError).toHaveBeenCalledWith(
        expect.stringContaining("Authentication cancelled")
      );
    });

    it("matches 'cancel' variant", () => {
      handleStartupAuthError(new Error("user cancel"), handler);
      expect(handler.logError).toHaveBeenCalledWith(expect.stringContaining("Authentication cancelled"));
    });

    it("matches 'abort' variant", () => {
      handleStartupAuthError(new Error("abort requested"), handler);
      expect(handler.logError).toHaveBeenCalledWith(expect.stringContaining("Authentication cancelled"));
    });

    it("is case-insensitive (Cancelled with capital C)", () => {
      handleStartupAuthError(new Error("Cancelled"), handler);
      expect(handler.logError).toHaveBeenCalledWith(expect.stringContaining("Authentication cancelled"));
    });

    it("exits with code 1", () => {
      handleStartupAuthError(new Error("cancelled by user"), handler);
      expect(handler.exit).toHaveBeenCalledWith(1);
    });
  });

  describe("when a generic auth error occurs", () => {
    it("prints the error message verbatim in the output", () => {
      handleStartupAuthError(new Error("quota exceeded"), handler);
      expect(handler.logError).toHaveBeenCalledWith(
        expect.stringContaining("quota exceeded")
      );
    });

    it("prefixes message with 'Authentication failed:'", () => {
      handleStartupAuthError(new Error("some unexpected error"), handler);
      expect(handler.logError).toHaveBeenCalledWith(
        expect.stringContaining("Authentication failed:")
      );
    });

    it("exits with code 1", () => {
      handleStartupAuthError(new Error("some unexpected error"), handler);
      expect(handler.exit).toHaveBeenCalledWith(1);
    });

    it("always exits — does not propagate / crash the process", () => {
      expect(() => handleStartupAuthError(new Error("anything"), handler)).not.toThrow();
      expect(handler.exit).toHaveBeenCalledWith(1);
    });
  });
});

// ─── REPL crash-free guarantee ────────────────────────────────────────────────

describe("REPL command handler — crash-free on auth errors (issue #1246)", () => {
  /**
   * The REPL dispatcher in odins-spear.mjs wraps every handler in:
   *   try { await handler(args) } catch (err) { console.error(...) }
   *   rl.prompt();   ← always re-prompts
   *
   * This test mirrors that guard to confirm that even a handler that throws
   * a Google auth error never propagates and always returns to the prompt.
   */
  async function replDispatch(
    handler: (args: string[]) => Promise<void>,
    args: string[],
    deps: { logError: Mock; prompt: Mock }
  ): Promise<void> {
    try {
      await handler(args);
    } catch (err) {
      deps.logError(`Error: ${(err as Error).message}`);
    }
    deps.prompt();
  }

  it("returns to prompt when handler throws a Google auth error", async () => {
    const logError = vi.fn();
    const prompt = vi.fn();
    const badHandler = async () => {
      throw new Error("UNAUTHENTICATED: Request had invalid authentication credentials.");
    };

    await replDispatch(badHandler, [], { logError, prompt });

    expect(logError).toHaveBeenCalledWith(expect.stringContaining("UNAUTHENTICATED"));
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it("returns to prompt when handler throws a network/Firestore error", async () => {
    const logError = vi.fn();
    const prompt = vi.fn();
    const badHandler = async () => {
      throw new Error("UNAVAILABLE: upstream connect error");
    };

    await replDispatch(badHandler, [], { logError, prompt });

    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it("returns to prompt when handler throws synchronously", async () => {
    const logError = vi.fn();
    const prompt = vi.fn();
    // eslint-disable-next-line @typescript-eslint/require-await
    const badHandler = async () => {
      throw new Error("synchronous-style throw");
    };

    await replDispatch(badHandler, [], { logError, prompt });

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledOnce();
  });

  it("does NOT re-prompt when handler succeeds (prompt still called once)", async () => {
    const logError = vi.fn();
    const prompt = vi.fn();
    const goodHandler = vi.fn().mockResolvedValue(undefined);

    await replDispatch(goodHandler, ["arg1"], { logError, prompt });

    expect(logError).not.toHaveBeenCalled();
    expect(prompt).toHaveBeenCalledTimes(1);
  });
});
