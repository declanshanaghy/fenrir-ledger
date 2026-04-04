"use client";

/**
 * InviteCodeDisplay — shows the household invite code with a copy button.
 *
 * States:
 *   idle — shows code + "Copy" button
 *   copied — shows "Copied!" tooltip for 2s, then resets to idle
 *
 * @see ux/wireframes/household/settings-household.html § Invite code block
 * Issue #1123
 */

import { useState, useCallback, useEffect } from "react";
import { buildInviteMailtoUrl, buildInviteSharePayload } from "@/lib/household/invite-mailto";

interface InviteCodeDisplayProps {
  inviteCode: string;
  inviteCodeExpiresAt: string;
  onRegenerate: () => Promise<void>;
  isRegenerating?: boolean;
}

function formatExpiry(isoString: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(isoString));
}

const COPIED_RESET_MS = 2000;

export function InviteCodeDisplay({
  inviteCode,
  inviteCodeExpiresAt,
  onRegenerate,
  isRegenerating = false,
}: InviteCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
    } catch {
      // Clipboard API unavailable — silently fail
    }
  }, [inviteCode]);

  const handleShare = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(buildInviteSharePayload(inviteCode));
      } catch {
        // User cancelled or share API failed — silently ignore
      }
    } else {
      window.location.href = buildInviteMailtoUrl(inviteCode);
    }
  }, [inviteCode]);

  return (
    <div className="relative border border-border p-4 flex flex-col gap-3 karl-bling-card">
      <h3 className="text-xs font-heading font-bold uppercase tracking-[0.08em] text-foreground">
        Invite Code
      </h3>

      {/* Code + copy + send invite — stacks vertically on mobile, row on sm+ */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div
          className="flex-1 border border-border px-4 py-2 text-center font-mono font-bold tracking-[0.2em] text-2xl text-foreground"
          aria-label={`Invite code: ${inviteCode.split("").join(" ")}`}
        >
          {inviteCode}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="min-h-[44px] px-4 py-2 border border-border text-sm font-heading text-foreground hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 whitespace-nowrap karl-bling-btn"
          aria-label={copied ? "Code copied to clipboard" : "Copy invite code"}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 border border-border text-sm font-heading text-foreground hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 whitespace-nowrap karl-bling-btn"
          aria-label="Send invite link"
        >
          Send Invite
        </button>
      </div>

      <p className="text-xs text-muted-foreground font-body">
        Expires {formatExpiry(inviteCodeExpiresAt)} &middot; Share this code out-of-band with your new member
      </p>

      <button
        type="button"
        onClick={onRegenerate}
        disabled={isRegenerating}
        className="min-h-[44px] w-full sm:w-auto px-4 py-2 border-2 border-border text-sm font-heading font-bold text-foreground hover:bg-muted/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 karl-bling-btn"
      >
        {isRegenerating ? "Regenerating…" : "Regenerate Code"}
      </button>
    </div>
  );
}
