"use client";

/**
 * HouseholdSettingsSection — Settings page section for household management.
 *
 * Handles all 4 household states:
 *   - Solo: user has no multi-member household → Join CTA
 *   - Owner (has space): shows members list + invite code + Regenerate button
 *   - Owner (full 3/3): shows members list + full banner (no invite code)
 *   - Member: shows members list + informational note (no invite code)
 *
 * Data is fetched from GET /api/household/members on mount.
 * Regenerate calls POST /api/household/invite and updates in-place.
 *
 * Issue #1123 — household invite code flow
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ensureFreshToken } from "@/lib/auth/refresh-session";
import { log } from "@/lib/logger";
import { MembersList } from "./MembersList";
import type { HouseholdMember } from "./MembersList";
import { InviteCodeDisplay } from "./InviteCodeDisplay";
import { HouseholdFullBanner } from "./HouseholdFullBanner";

// ─── API types ─────────────────────────────────────────────────────────────────

interface HouseholdData {
  householdId: string;
  householdName: string;
  memberCount: number;
  maxMembers: 3;
  isFull: boolean;
  isOwner: boolean;
  members: HouseholdMember[];
  inviteCode?: string;
  inviteCodeExpiresAt?: string;
}

// ─── Member badge ──────────────────────────────────────────────────────────────

function MemberCountBadge({
  count,
  max,
  isFull,
}: {
  count: number;
  max: number;
  isFull: boolean;
}) {
  return (
    <span
      className={[
        "border px-2 py-0.5 text-[11px]",
        isFull
          ? "border-amber-500/60 text-amber-400"
          : "border-border text-muted-foreground",
      ].join(" ")}
      aria-label={`${count} of ${max} household members`}
    >
      {count} / {max}{isFull ? " — Full" : ""}
    </span>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function HouseholdSettingsSection() {
  const router = useRouter();
  const [data, setData] = useState<HouseholdData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchHousehold = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const token = await ensureFreshToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      const res = await fetch("/api/household/members", {
        headers: { Authorization: `Bearer ${token}`, "Cache-Control": "no-cache" },
      });
      if (!res.ok) {
        if (res.status === 404) {
          // No user/household record yet — treat as solo
          setData(null);
        } else {
          setFetchError("Failed to load household data.");
        }
        setIsLoading(false);
        return;
      }
      const json = (await res.json()) as HouseholdData;
      setData(json);
    } catch (err) {
      log.error("HouseholdSettingsSection: fetch failed", { error: String(err) });
      setFetchError("Failed to load household data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHousehold();
  }, [fetchHousehold]);

  const handleRegenerate = useCallback(async () => {
    setIsRegenerating(true);
    try {
      const token = await ensureFreshToken();
      if (!token) return;
      const res = await fetch("/api/household/invite", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "regenerate" }),
      });
      if (!res.ok) {
        log.error("HouseholdSettingsSection: regenerate failed", { status: res.status });
        return;
      }
      const json = (await res.json()) as {
        inviteCode: string;
        inviteCodeExpiresAt: string;
      };
      // Update in-place — no page reload
      setData((prev) =>
        prev
          ? {
              ...prev,
              inviteCode: json.inviteCode,
              inviteCodeExpiresAt: json.inviteCodeExpiresAt,
            }
          : prev
      );
    } catch (err) {
      log.error("HouseholdSettingsSection: regenerate error", { error: String(err) });
    } finally {
      setIsRegenerating(false);
    }
  }, []);

  // ── Loading skeleton ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <section
        className="border border-border p-5 flex flex-col gap-4"
        aria-label="Household"
        aria-busy="true"
      >
        <div className="flex justify-between items-center border-b border-border pb-3">
          <h2 className="text-[15px] font-bold text-foreground">Household</h2>
        </div>
        <div className="text-[13px] text-muted-foreground italic animate-pulse">
          Loading household…
        </div>
      </section>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────────
  if (fetchError) {
    return (
      <section
        className="border border-border p-5 flex flex-col gap-4"
        aria-label="Household"
      >
        <h2 className="text-[15px] font-bold text-foreground border-b border-border pb-3">
          Household
        </h2>
        <p className="text-[13px] text-red-400" role="alert">
          {fetchError}
        </p>
      </section>
    );
  }

  // ── Solo state (no data or solo household) ────────────────────────────────────
  const isSolo =
    !data ||
    (data.memberCount === 1 && data.isOwner);

  if (isSolo) {
    return (
      <section
        className="border border-border p-5 flex flex-col gap-4"
        aria-label="Household"
      >
        <div className="flex justify-between items-center border-b border-border pb-3">
          <h2 className="text-[15px] font-bold text-foreground">Household</h2>
          <span className="border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
            Solo
          </span>
        </div>

        <div className="border border-dashed border-border p-4 flex flex-col gap-3 items-center text-center">
          <p className="text-[13px] text-foreground/90">
            You are currently managing cards solo.
          </p>
          <p className="text-[13px] text-muted-foreground">
            Join another household to share and merge your cards.
          </p>
          <button
            type="button"
            onClick={() => router.push("/ledger/join")}
            className="min-h-[44px] px-5 py-2 border-2 border-gold/60 text-gold font-bold hover:bg-gold/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Join a Household
          </button>
        </div>
      </section>
    );
  }

  // ── Multi-member household ────────────────────────────────────────────────────
  return (
    <section
      className="border border-border p-5 flex flex-col gap-4"
      aria-label="Household"
    >
      {/* Header */}
      <div className="flex justify-between items-center border-b border-border pb-3">
        <h2 className="text-[15px] font-bold text-foreground">Household</h2>
        <MemberCountBadge
          count={data.memberCount}
          max={data.maxMembers}
          isFull={data.isFull}
        />
      </div>

      {/* Members list */}
      <div className="flex flex-col gap-2">
        <div className="text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
          Members
        </div>
        <MembersList members={data.members} />
      </div>

      {/* Invite code section — owner only, hidden when full */}
      {data.isOwner && !data.isFull && data.inviteCode && data.inviteCodeExpiresAt && (
        <div className="flex flex-col gap-3">
          <InviteCodeDisplay
            inviteCode={data.inviteCode}
            inviteCodeExpiresAt={data.inviteCodeExpiresAt}
          />
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="min-h-[44px] px-4 py-2 border-2 border-gold/60 text-gold font-bold hover:bg-gold/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Regenerate invite code"
          >
            {isRegenerating ? "Regenerating…" : "Regenerate Code"}
          </button>
        </div>
      )}

      {/* Household full banner (owner) */}
      {data.isOwner && data.isFull && <HouseholdFullBanner />}

      {/* Member view — no invite code; show owner info */}
      {!data.isOwner && (
        <div className="border border-dashed border-border p-3 text-[12px] text-muted-foreground">
          {(() => {
            const owner = data.members.find((m) => m.role === "owner");
            return owner ? (
              <p>
                Ask <strong className="text-foreground">{owner.displayName}</strong> (Owner) for an
                invite code to share with others.
              </p>
            ) : (
              <p>Contact the household owner for an invite code.</p>
            );
          })()}
        </div>
      )}

      {/* Full banner (member view) */}
      {!data.isOwner && data.isFull && <HouseholdFullBanner />}
    </section>
  );
}
