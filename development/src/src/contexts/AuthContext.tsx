"use client";

/**
 * AuthContext — Fenrir Ledger
 *
 * React context that owns the client-side auth state. Replaces Auth.js v5
 * SessionProvider entirely — no cookies, no server round-trips.
 *
 * On mount:
 *  - Reads "fenrir:auth" from localStorage.
 *  - If missing or expired → status = "unauthenticated", redirect to /sign-in.
 *  - If valid → status = "authenticated", session = FenrirSession.
 *
 * Exposes:
 *  - session: FenrirSession | null
 *  - status:  "loading" | "authenticated" | "unauthenticated"
 *  - signOut: clears localStorage, redirects to /sign-in
 *
 * No polling / automatic token refresh — session is valid until expires_at.
 * Google access tokens are typically valid for 1 hour.
 *
 * See ADR-005 for the auth migration rationale.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { getSession, clearSession, isSessionValid } from "@/lib/auth/session";
import type { FenrirSession } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthContextValue {
  session: FenrirSession | null;
  status: AuthStatus;
  signOut: () => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Public routes — no redirect needed ────────────────────────────────────────

const PUBLIC_PATHS = ["/sign-in", "/auth/callback"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

// ── Provider ──────────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<FenrirSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const pathname = usePathname();

  // Evaluate the stored session once on mount (client-only).
  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = getSession();

    if (stored && isSessionValid()) {
      setSession(stored);
      setStatus("authenticated");
    } else {
      setSession(null);
      setStatus("unauthenticated");

      // Only redirect if we're not already on a public path.
      if (!isPublicPath(pathname)) {
        const callbackUrl = encodeURIComponent(pathname);
        window.location.href = `/sign-in?callbackUrl=${callbackUrl}`;
      }
    }
    // Run only on mount — pathname intentionally excluded from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    window.location.href = "/sign-in";
  }, []);

  return (
    <AuthContext.Provider value={{ session, status, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

/**
 * useAuthContext — returns the raw AuthContextValue.
 * Throws if used outside <AuthProvider>.
 */
export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within <AuthProvider>");
  }
  return ctx;
}
