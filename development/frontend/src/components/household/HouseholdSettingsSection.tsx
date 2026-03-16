"use client";

/**
 * HouseholdSettingsSection — settings page section for household management.
 *
 * States (see wireframe settings-household.html):
 *   loading  — skeleton while fetching
 *   solo     — user is in a single-member household → Join CTA
 *   owner    — user owns a multi-member household → invite code + member list
 *   member   — user is a non-owner member → member list, no invite code
 *   full     — household at 3/3 → full banner instead of invite code
 *
 * Issue #1123
 */

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MembersList } from "./MembersList";
import { InviteCodeDisplay } from "./InviteCodeDisplay";
import { HouseholdFullBanner } from "./HouseholdFullBanner";
import { ensureFreshToken } from "@/lib/auth/refresh-session";

interface HouseholdMember {
  clerkUserId: string;
  displayName: string;
  email: string;
  role: "owner" | "member";
  isCurrentUser: boolean;
}

interface HouseholdData {
  householdId: string;
  householdName: string;
  ownerId: string;
  memberCount: number;
  maxMembers: number;
  isSolo: boolean;
  isFull: boolean;
  isOwner: boolean;
  inviteCode?: string;
  inviteCodeExpiresAt?: string;
  members: HouseholdMember[];
}

const MAX_HOUSEHOLD_MEMBERS = 3;

export function HouseholdSettingsSection() {
  const router = useRouter();

  const [data, setData] = useState<HouseholdData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHousehold = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await ensureFreshToken();
      if (!token) {
        setIsLoading(false);
        return; // Not signed in — silently hide
      }
      const res = await fetch("/api/household/members", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 401) return; // Not signed in — silently hide
        setError("Could not load household data.");
        return;
      }
      const json = (await res.json()) as HouseholdData;
      setData(json);
    } catch {
      setError("Could not load household data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHousehold();
  }, [fetchHousehold]);

  const handleRegenerate = useCallback(async () => {
    setIsRegenerating(true);
    try {
      const token = await ensureFreshToken();
      const res = await fetch("/api/household/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "regenerate" }),
      });
      if (!res.ok) return;
      const json = (await res.json()) as { inviteCode: string; inviteCodeExpiresAt: string };
      setData((prev) =>
        prev
          ? { ...prev, inviteCode: json.inviteCode, inviteCodeExpiresAt: json.inviteCodeExpiresAt }
          : prev
      );
    } catch {
      // Silently fail — UI keeps showing old code
    } finally {
      setIsRegenerating(false);
    }
  }, []);

  if (isLoading) {
    return (
      <section
        className="relative border border-border p-5 flex flex-col gap-3 animate-pulse karl-bling-card"
        aria-label="Household"
        aria-busy="true"
      >
        <div className="h-4 bg-muted/40 rounded w-24" />
        <div className="h-3 bg-muted/30 rounded w-48" />
        <div className="h-3 bg-muted/30 rounded w-40" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="relative border border-border p-5 flex flex-col gap-3 karl-bling-card" aria-label="Household">
        <h2 className="text-sm font-heading font-bold uppercase tracking-[0.08em] text-foreground">
          Household
        </h2>
        <p className="text-xs text-destructive font-body">{error}</p>
      </section>
    );
  }

  if (!data) return null;

  const isOwner = data.isOwner;
  const maxMembers = data.maxMembers ?? MAX_HOUSEHOLD_MEMBERS;
  const badgeLabel = data.isSolo
    ? "Solo"
    : `${data.memberCount} / ${maxMembers} members`;

  return (
    <section
      className="relative border border-border p-5 flex flex-col gap-4 karl-bling-card"
      aria-label="Household"
    >
      {/* Karl rune corners */}
      <span className="karl-rune-corner karl-rune-tl" aria-hidden="true">ᚠ</span>
      <span className="karl-rune-corner karl-rune-tr" aria-hidden="true">ᚱ</span>
      <span className="karl-rune-corner karl-rune-bl" aria-hidden="true">ᛁ</span>
      <span className="karl-rune-corner karl-rune-br" aria-hidden="true">ᚾ</span>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h2 className="text-sm font-heading font-bold text-foreground">
          Household
        </h2>
        <span
          className={[
            "border px-2 py-0.5 text-[11px] font-heading",
            data.isFull
              ? "border-destructive text-destructive"
              : "border-border text-muted-foreground",
          ].join(" ")}
          aria-label={`Household size: ${badgeLabel}`}
          aria-live="polite"
        >
          {badgeLabel}
        </span>
      </div>

      {/* Solo user: Join CTA */}
      {data.isSolo && (
        <div
          className="border border-dashed border-border p-4 text-center flex flex-col gap-3 items-center"
          role="region"
          aria-label="Join a household"
        >
          <p className="text-sm text-foreground/90 font-body">
            You are currently managing cards solo.
          </p>
          <p className="text-xs text-muted-foreground font-body">
            Join another household to share and merge your cards.
          </p>
          <button
            type="button"
            onClick={() => router.push("/ledger/join")}
            className="min-h-[44px] px-5 py-2 border-2 border-border text-sm font-heading font-bold text-foreground hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 karl-bling-btn"
          >
            Join a Household
          </button>
        </div>
      )}

      {/* Multi-member household: show members list */}
      {!data.isSolo && (
        <>
          <div>
            <p className="text-xs font-heading font-bold uppercase tracking-[0.08em] text-muted-foreground mb-2">
              Members
            </p>
            <MembersList members={data.members} />
          </div>

          {/* Owner: invite code or full banner */}
          {isOwner && (
            data.isFull ? (
              <HouseholdFullBanner />
            ) : data.inviteCode && data.inviteCodeExpiresAt ? (
              <InviteCodeDisplay
                inviteCode={data.inviteCode}
                inviteCodeExpiresAt={data.inviteCodeExpiresAt}
                onRegenerate={handleRegenerate}
                isRegenerating={isRegenerating}
              />
            ) : null
          )}

          {/* Member: informational note — owner name for context */}
          {!isOwner && (
            <div className="border border-dashed border-border p-3 text-xs text-muted-foreground font-body">
              Ask{" "}
              <strong className="text-foreground">
                {data.members.find((m) => m.role === "owner")?.displayName ?? "the owner"}
              </strong>{" "}
              for an invite code to share with others.
            </div>
          )}
        </>
      )}
    </section>
  );
}
