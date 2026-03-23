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
import { getSession } from "@/lib/auth/session";
import { setAllCards } from "@/lib/storage";
import Link from "next/link";

interface HouseholdMember {
  userId: string;
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
  /** true when the household has an active Karl subscription — issue #1780 */
  isKarl: boolean;
  inviteCode?: string;
  inviteCodeExpiresAt?: string;
  members: HouseholdMember[];
}

const MAX_HOUSEHOLD_MEMBERS = 3;

export function HouseholdSettingsSection() {
  const router = useRouter();

  const [data, setData] = useState<HouseholdData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [kickTarget, setKickTarget] = useState<HouseholdMember | null>(null);
  const [isKicking, setIsKicking] = useState(false);
  const [kickError, setKickError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHousehold = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await ensureFreshToken();
      if (!token) {
        setIsSignedIn(false);
        setIsLoading(false);
        return;
      }
      const res = await fetch("/api/household/members", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 401) {
          setIsSignedIn(false);
          setIsLoading(false);
          return;
        }
        setError("Could not load household data.");
        return;
      }
      setIsSignedIn(true);
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

  const handleLeave = useCallback(async () => {
    setIsLeaving(true);
    setLeaveError(null);
    try {
      const token = await ensureFreshToken();
      if (!token) {
        setLeaveError("Authentication error. Please sign in again.");
        setIsLeaving(false);
        return;
      }
      const res = await fetch("/api/household/leave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirm: true }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error_description?: string };
        setLeaveError(json.error_description ?? "Failed to leave household. Please try again.");
        setIsLeaving(false);
        return;
      }
      // Clear local card cache so dashboard shows the empty solo household
      const session = getSession();
      if (session?.user?.sub) {
        setAllCards(session.user.sub, []);
      }
      // Navigate back to dashboard — fresh pull will reflect the new solo household
      router.push("/ledger");
    } catch {
      setLeaveError("Connection error. Please try again.");
      setIsLeaving(false);
    }
  }, [router]);

  const handleKickConfirm = useCallback(async () => {
    if (!kickTarget) return;
    setIsKicking(true);
    setKickError(null);
    try {
      const token = await ensureFreshToken();
      if (!token) {
        setKickError("Authentication error. Please sign in again.");
        setIsKicking(false);
        return;
      }
      const res = await fetch("/api/household/kick", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ memberId: kickTarget.userId }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error_description?: string };
        setKickError(json.error_description ?? "Failed to remove member. Please try again.");
        setIsKicking(false);
        return;
      }
      setKickTarget(null);
      await fetchHousehold();
    } catch {
      setKickError("Connection error. Please try again.");
      setIsKicking(false);
    }
  }, [kickTarget, fetchHousehold]);

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

  if (isSignedIn === false) {
    return (
      <section
        className="relative border border-border p-5 flex flex-col gap-4 karl-bling-card opacity-80"
        aria-label="Household"
        data-testid="household-locked"
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
            className="border border-border px-2 py-0.5 text-[11px] font-heading text-muted-foreground"
            aria-label="Household: sign in required"
          >
            Locked
          </span>
        </div>

        {/* Locked body */}
        <div
          className="border border-dashed border-border p-4 flex flex-col gap-3 items-center text-center"
          role="region"
          aria-label="Sign in to manage your household"
        >
          <span className="text-2xl" aria-hidden="true">ᛜ</span>
          <p className="text-sm text-foreground/90 font-body">
            Share and sync cards across your household — up to three members.
          </p>
          <p className="text-xs text-muted-foreground font-body">
            Sign in to manage your household.
          </p>
          <Link
            href="/ledger/sign-in"
            className="inline-flex items-center justify-center min-h-[44px] px-5 py-2 text-sm font-heading font-bold bg-gold text-primary-foreground border-2 border-gold hover:bg-primary hover:brightness-110 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 karl-bling-btn"
            aria-label="Sign in to manage your household"
          >
            Sign in to get started
          </Link>
        </div>
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

      {/* Solo view: primary CTA for Thrall solo users.
          Skipped for Karl owners — they get the invite code view + secondary join button.
          — issue #1780 */}
      {data.isSolo && !(isOwner && data.isKarl) && (
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
            aria-label="Join a Household"
          >
            Join a Household
          </button>
        </div>
      )}

      {/* Karl owner (solo or multi-member): show members list + invite code.
          isSolo && isOwner && isKarl — chicken-and-egg fix: owner can see invite code
          before anyone has joined. — issue #1780 */}
      {(!data.isSolo || (isOwner && data.isKarl)) && (
        <>
          <div>
            <p className="text-xs font-heading font-bold uppercase tracking-[0.08em] text-muted-foreground mb-2">
              Members
            </p>
            <MembersList
              members={data.members}
              onKick={isOwner ? (member) => { setKickTarget(member); setKickError(null); } : undefined}
            />
          </div>

          {/* Owner: kick confirmation dialog */}
          {isOwner && kickTarget && (
            <div
              className="border border-destructive/60 p-3 flex flex-col gap-3"
              role="alertdialog"
              aria-label={`Confirm removing ${kickTarget.displayName}`}
            >
              <p className="text-sm font-heading font-bold text-destructive">
                Remove {kickTarget.displayName} from your household?
              </p>
              <p className="text-xs text-muted-foreground font-body">
                They will be moved to a new solo household. Their cards will remain with this household.
              </p>
              {kickError && (
                <p className="text-xs text-destructive font-body" role="alert">
                  {kickError}
                </p>
              )}
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleKickConfirm}
                  disabled={isKicking}
                  className="min-h-[44px] px-4 py-2 border border-destructive text-sm font-heading text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={`Confirm removing ${kickTarget.displayName}`}
                >
                  {isKicking ? "Removing…" : "Confirm Remove"}
                </button>
                <button
                  type="button"
                  onClick={() => { setKickTarget(null); setKickError(null); }}
                  disabled={isKicking}
                  className="min-h-[44px] px-4 py-2 border border-border text-sm font-heading text-foreground hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
                  aria-label="Cancel removing member"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

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

          {/* Member: informational note + Leave Household button */}
          {!isOwner && (
            <>
              <div className="border border-dashed border-border p-3 text-xs text-muted-foreground font-body">
                Ask{" "}
                <strong className="text-foreground">
                  {data.members.find((m) => m.role === "owner")?.displayName ?? "the owner"}
                </strong>{" "}
                for an invite code to share with others.
              </div>

              {/* Leave Household — member only */}
              {!showLeaveConfirm ? (
                <div className="border border-dashed border-destructive/40 p-3 flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground font-body">
                    Leaving will remove you from this household. A new solo household will be created for you.
                    Your shared cards will remain with this household.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setShowLeaveConfirm(true); setLeaveError(null); }}
                    className="self-start min-h-[44px] px-4 py-2 border border-destructive/60 text-sm font-heading text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label="Leave this household"
                  >
                    Leave Household
                  </button>
                </div>
              ) : (
                <div
                  className="border border-destructive/60 p-3 flex flex-col gap-3"
                  role="alertdialog"
                  aria-label="Confirm leaving household"
                >
                  <p className="text-sm font-heading font-bold text-destructive">
                    Are you sure you want to leave?
                  </p>
                  <p className="text-xs text-muted-foreground font-body">
                    You will lose access to all shared cards. This cannot be undone.
                  </p>
                  {leaveError && (
                    <p className="text-xs text-destructive font-body" role="alert">
                      {leaveError}
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleLeave}
                      disabled={isLeaving}
                      className="min-h-[44px] px-4 py-2 border border-destructive text-sm font-heading text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Confirm leaving the household"
                    >
                      {isLeaving ? "Leaving…" : "Confirm Leave"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowLeaveConfirm(false); setLeaveError(null); }}
                      disabled={isLeaving}
                      className="min-h-[44px] px-4 py-2 border border-border text-sm font-heading text-foreground hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
                      aria-label="Cancel leaving the household"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Solo Karl owner: secondary Join CTA — can still join another household */}
          {data.isSolo && isOwner && data.isKarl && (
            <div className="border border-dashed border-border p-3 flex flex-col gap-2 items-start">
              <p className="text-xs text-muted-foreground font-body">
                You can also join an existing household instead.
              </p>
              <button
                type="button"
                onClick={() => router.push("/ledger/join")}
                className="min-h-[44px] px-4 py-2 border border-border text-sm font-heading text-foreground hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Join a Household"
              >
                Join a Household
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
