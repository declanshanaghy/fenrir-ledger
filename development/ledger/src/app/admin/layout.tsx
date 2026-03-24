/**
 * Admin Layout — /admin/*
 *
 * Auth-gated admin layout. Wraps all /admin/* routes with:
 * 1. Google login redirect for unauthenticated users
 * 2. Admin whitelist check (ADMIN_EMAILS env var)
 * 3. 403 page for non-admin authenticated users
 * 4. Side navigation designed to grow (only "Pack Status" for now)
 *
 * Forces dark theme for the Norse war-room aesthetic.
 * No link to /admin anywhere on the public site.
 *
 * @see #654
 */

"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { buildSignInUrl } from "@/lib/auth/sign-in-url";
import { ensureFreshToken } from "@/lib/auth/refresh-session";

type AdminGateState =
  | { phase: "loading" }
  | { phase: "redirecting" }
  | { phase: "forbidden" }
  | { phase: "granted" };

const NAV_ITEMS = [
  { label: "Pack Status", href: "/admin", icon: "⚔" },
] as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useAuth();
  const [gate, setGate] = useState<AdminGateState>({ phase: "loading" });

  const checkAdmin = useCallback(async () => {
    const token = await ensureFreshToken();
    if (!token) {
      setGate({ phase: "forbidden" });
      return;
    }
    try {
      const res = await fetch("/api/admin/pack-status", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 403) {
        setGate({ phase: "forbidden" });
        return;
      }

      if (res.ok) {
        setGate({ phase: "granted" });
        return;
      }

      // Other errors — treat as forbidden
      setGate({ phase: "forbidden" });
    } catch {
      setGate({ phase: "forbidden" });
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "anonymous" || !session) {
      // Redirect to sign-in, returning to /admin after
      setGate({ phase: "redirecting" });
      const signInUrl = buildSignInUrl("/admin");
      window.location.href = signInUrl;
      return;
    }

    // Authenticated — check admin status via API probe (token refreshed inside checkAdmin)
    checkAdmin();
  }, [status, session, checkAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Loading state
  if (gate.phase === "loading" || gate.phase === "redirecting") {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#07070d", color: "#c9920a" }}
        aria-label="Admin console loading"
      >
        <p className="font-heading text-lg italic tracking-wide animate-pulse">
          {gate.phase === "redirecting"
            ? "Summoning the Allfather's gate..."
            : "The ravens scout ahead..."}
        </p>
      </div>
    );
  }

  // Forbidden state
  if (gate.phase === "forbidden") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-6"
        style={{ backgroundColor: "#07070d", color: "#e8e4d4" }}
        aria-label="Admin access denied"
      >
        <div className="text-center max-w-md px-4">
          <h1
            className="font-display text-4xl tracking-wide mb-4"
            style={{ color: "#c9920a" }}
          >
            ᚠ 403 ᚠ
          </h1>
          <p className="font-heading text-xl mb-2" style={{ color: "#c9920a" }}>
            You are not of the Allfather&apos;s council.
          </p>
          <p className="text-sm opacity-60 font-body italic">
            This hall is warded. Only those named in the sacred scrolls may enter.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { window.location.href = "/ledger"; }}
          className="px-6 py-3 border rounded-sm text-sm font-heading tracking-wide transition-colors"
          style={{
            borderColor: "#3a3530",
            color: "#c9920a",
            backgroundColor: "transparent",
            minHeight: 44,
          }}
        >
          Return to the Ledger
        </button>
      </div>
    );
  }

  // Granted — render admin shell
  return (
    <div
      className="min-h-screen flex flex-col md:flex-row"
      style={{ backgroundColor: "#07070d", color: "#e8e4d4" }}
      aria-label="Admin console"
    >
      {/* Side nav — collapses to top bar on mobile */}
      <nav
        className="flex md:flex-col gap-1 p-3 md:p-4 md:w-56 md:min-h-screen border-b md:border-b-0 md:border-r shrink-0"
        style={{ borderColor: "#1a1a2e" }}
        aria-label="Admin navigation"
      >
        <div className="hidden md:block mb-6">
          <h1
            className="font-display text-lg tracking-wide"
            style={{ color: "#c9920a" }}
          >
            Odin&apos;s War Room
          </h1>
          <p className="text-xs opacity-40 font-body mt-1">Admin Console</p>
        </div>

        {/* Mobile header */}
        <span
          className="md:hidden font-display text-sm tracking-wide mr-auto"
          style={{ color: "#c9920a" }}
        >
          War Room
        </span>

        {NAV_ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex items-center gap-2 px-3 py-2 rounded-sm text-sm font-heading tracking-wide transition-colors"
            style={{
              backgroundColor: "#c9920a15",
              color: "#c9920a",
              minHeight: 44,
            }}
            aria-label={item.label}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </nav>

      {/* Main content area */}
      <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto" aria-label="Admin content">
        {children}
      </main>
    </div>
  );
}
