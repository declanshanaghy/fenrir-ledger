/**
 * Google OAuth 2.0 — single-user lockdown for Odin's Throne.
 *
 * Flow:
 *   GET /auth/login      → redirect to Google consent screen
 *   GET /auth/callback   → exchange code, verify email, set session cookie
 *   GET /auth/logout     → clear session cookie, redirect to /auth/login
 *
 * Session: signed HMAC-SHA256 cookie (HTTP-only, Secure, SameSite=Lax).
 * All routes except /healthz and the /auth/* flow are protected by
 * requireSession() — see index.ts.
 */

import { createHmac, randomBytes } from "node:crypto";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";

// ── Constants ─────────────────────────────────────────────────────────────────

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export const SESSION_COOKIE = "odin_session";
const STATE_COOKIE = "odin_oauth_state";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

// ── Env helpers ───────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

/** Derive callback URL from the incoming request when OAUTH_REDIRECT_URI is unset. */
function callbackUrl(c: Context): string {
  const override = process.env.OAUTH_REDIRECT_URI;
  if (override) return override;
  const proto = c.req.header("x-forwarded-proto") ?? "http";
  const host = c.req.header("host") ?? "localhost";
  return `${proto}://${host}/auth/callback`;
}

// ── HMAC session tokens ───────────────────────────────────────────────────────

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function createSessionToken(email: string): string {
  const secret = requireEnv("SESSION_SECRET");
  const payload = `${email}:${Date.now()}`;
  const sig = signPayload(payload, secret);
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifySessionToken(token: string): string | null {
  try {
    const secret = requireEnv("SESSION_SECRET");
    const allowedEmail = requireEnv("ALLOWED_EMAIL");
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const dotIdx = decoded.lastIndexOf(".");
    if (dotIdx === -1) return null;

    const payload = decoded.slice(0, dotIdx);
    const sig = decoded.slice(dotIdx + 1);

    // Constant-time signature check
    const expected = signPayload(payload, secret);
    if (!timingSafeEqual(sig, expected)) return null;

    // payload = "email:timestamp"
    const colonIdx = payload.indexOf(":");
    if (colonIdx === -1) return null;
    const email = payload.slice(0, colonIdx);
    const ts = parseInt(payload.slice(colonIdx + 1), 10);

    if (isNaN(ts) || Date.now() - ts > SESSION_TTL_MS) return null;
    if (email !== allowedEmail) return null;

    return email;
  } catch {
    return null;
  }
}

/** Timing-safe string comparison (hex strings are same length when valid). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ── Cookie helpers ────────────────────────────────────────────────────────────

export function setSessionCookie(c: Context, email: string): void {
  const token = createSessionToken(email);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

// ── OAuth route handlers ──────────────────────────────────────────────────────

/** GET /auth/login — redirect to Google consent screen. */
export async function handleLogin(c: Context): Promise<Response> {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const state = randomBytes(16).toString("hex");

  // Store state in short-lived cookie for CSRF validation on callback
  setCookie(c, STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/auth",
    maxAge: 600, // 10 minutes
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl(c),
    response_type: "code",
    scope: "openid email",
    state,
    access_type: "online",
    prompt: "select_account",
  });

  return c.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}

/** GET /auth/callback — exchange code, verify email, set session. */
export async function handleCallback(c: Context): Promise<Response> {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");
  const allowedEmail = requireEnv("ALLOWED_EMAIL");

  const code = c.req.query("code");
  const stateParam = c.req.query("state");
  const errorParam = c.req.query("error");

  if (errorParam) {
    return c.html(loginErrorPage(`Google returned: ${errorParam}`), 401);
  }

  if (!code || !stateParam) {
    return c.html(loginErrorPage("Missing code or state parameter."), 400);
  }

  // Verify CSRF state
  const storedState = getCookie(c, STATE_COOKIE);
  if (!storedState || storedState !== stateParam) {
    return c.html(loginErrorPage("Invalid state — possible CSRF attempt."), 403);
  }

  // Exchange code for tokens
  let accessToken: string;
  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl(c),
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error("[oauth] token exchange failed:", body);
      return c.html(loginErrorPage("Token exchange failed."), 502);
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      return c.html(loginErrorPage("No access token in response."), 502);
    }
    accessToken = tokenData.access_token;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[oauth] token exchange error:", msg);
    return c.html(loginErrorPage("Token exchange error."), 502);
  }

  // Fetch user email
  let email: string;
  try {
    const userRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      return c.html(loginErrorPage("Could not fetch user info."), 502);
    }

    const userData = (await userRes.json()) as { email?: string };
    if (!userData.email) {
      return c.html(loginErrorPage("No email in user info."), 502);
    }
    email = userData.email;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[oauth] userinfo error:", msg);
    return c.html(loginErrorPage("User info fetch error."), 502);
  }

  // Enforce single-user whitelist
  if (email !== allowedEmail) {
    console.warn("[oauth] blocked unauthorized email attempt");
    return c.html(loginErrorPage("Access denied — this tool is private."), 403);
  }

  setSessionCookie(c, email);
  deleteCookie(c, STATE_COOKIE, { path: "/auth" });
  console.log("[oauth] authenticated user");
  return c.redirect("/");
}

/** GET /auth/logout — clear session and redirect to login. */
export function handleLogout(c: Context): Response {
  clearSessionCookie(c);
  return c.redirect("/auth/login");
}

// ── HTML templates ────────────────────────────────────────────────────────────

export function loginPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Odin's Throne — Sign In</title>
  <style>
    :root { --gold: #c8a44a; --bg: #0a0a0f; --fg: #e8e0d0; --dim: #6b6460; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--fg); font-family: 'Cinzel', Georgia, serif;
           min-height: 100vh; display: flex; flex-direction: column;
           align-items: center; justify-content: center; gap: 2rem; }
    h1 { color: var(--gold); font-size: 2rem; letter-spacing: 0.15em; }
    p { color: var(--dim); font-size: 0.9rem; }
    a.btn { display: inline-block; padding: 0.75rem 2rem;
            background: var(--gold); color: #0a0a0f; font-family: inherit;
            font-weight: 600; letter-spacing: 0.08em; text-decoration: none;
            border-radius: 4px; font-size: 0.95rem; }
    a.btn:hover { opacity: 0.85; }
  </style>
</head>
<body>
  <h1>Odin&#8217;s Throne</h1>
  <p>Restricted access — authorised personnel only.</p>
  <a class="btn" href="/auth/login">Sign in with Google</a>
</body>
</html>`;
}

function loginErrorPage(reason: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Odin's Throne — Access Denied</title>
  <style>
    :root { --gold: #c8a44a; --bg: #0a0a0f; --fg: #e8e0d0; --dim: #6b6460; --red: #c84a4a; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--fg); font-family: 'Cinzel', Georgia, serif;
           min-height: 100vh; display: flex; flex-direction: column;
           align-items: center; justify-content: center; gap: 1.5rem; }
    h1 { color: var(--red); font-size: 1.8rem; letter-spacing: 0.1em; }
    p { color: var(--dim); font-size: 0.85rem; max-width: 380px; text-align: center; }
    a { color: var(--gold); text-decoration: none; border-bottom: 1px solid var(--gold); }
  </style>
</head>
<body>
  <h1>Access Denied</h1>
  <p>${reason}</p>
  <a href="/auth/login">Try again</a>
</body>
</html>`;
}
