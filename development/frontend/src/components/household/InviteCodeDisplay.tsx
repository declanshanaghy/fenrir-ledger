"use client";

/**
 * InviteCodeDisplay — Shows the 6-char invite code with copy button and expiry.
 *
 * - Copy button: copies code to clipboard, shows "Copied!" for 2s then resets.
 * - Responsive: on mobile, code and copy button stack vertically.
 * - Owner-only: component itself has no role check — caller is responsible.
 *
 * Issue #1123 — household invite code flow
 */

import { useState, useCallback, useEffect } from "react";

interface InviteCodeDisplayProps {
  inviteCode: string;
  inviteCodeExpiresAt: string;
}

function formatExpiry(isoDate: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(isoDate));
}

export function InviteCodeDisplay({
  inviteCode,
  inviteCodeExpiresAt,
}: InviteCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  // Reset "Copied!" tooltip after 2s
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
    } catch {
      // Clipboard API unavailable — silently ignore
    }
  }, [inviteCode]);

  return (
    <div className="border border-border p-4 flex flex-col gap-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
        Invite Code
      </div>

      {/* Code + copy button — row on desktop, column on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div
          className="border border-border px-4 py-2 text-2xl sm:text-[22px] font-bold font-mono tracking-[0.2em] text-foreground text-center flex-1"
          aria-label={`Invite code: ${inviteCode.split("").join(" ")}`}
        >
          {inviteCode}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="sm:w-auto w-full min-h-[44px] px-4 py-2 border border-border text-sm font-body hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={copied ? "Code copied to clipboard" : "Copy invite code to clipboard"}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Expires {formatExpiry(inviteCodeExpiresAt)} · Share this code out-of-band with your new member
      </p>
    </div>
  );
}
