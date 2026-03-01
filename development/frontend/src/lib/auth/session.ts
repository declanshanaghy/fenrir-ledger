/**
 * Session Management — Fenrir Ledger
 *
 * Reads and writes the FenrirSession to localStorage under the key "fenrir:auth".
 * All functions guard against SSR (typeof window === "undefined").
 *
 * Session shape: see FenrirSession in src/lib/types.ts
 */

import type { FenrirSession } from "@/lib/types";

/** localStorage key for the auth session */
const SESSION_KEY = "fenrir:auth";

/**
 * Returns the stored session, or null if absent, expired, or unparseable.
 * Also returns null during SSR.
 */
export function getSession(): FenrirSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as FenrirSession;
    return session;
  } catch {
    return null;
  }
}

/**
 * Persists the session to localStorage.
 */
export function setSession(session: FenrirSession): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/**
 * Removes the session from localStorage.
 */
export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Returns true if the stored session exists and has not expired.
 * A session is valid when expires_at > Date.now().
 */
export function isSessionValid(): boolean {
  const session = getSession();
  if (!session) return false;
  return session.expires_at > Date.now();
}
