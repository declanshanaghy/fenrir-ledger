"use client";

/**
 * Valhalla — Hall of the Honored Dead
 *
 * Displays all closed cards as tombstone entries. Closed cards are distinct
 * from deleted cards: they are honored in Valhalla, not erased. Deleted cards
 * (deletedAt set) do not appear here.
 *
 * Anonymous-first: accessible without a signed-in session.
 * Reads householdId from AuthContext (anonymous or authenticated) and loads
 * all closed cards from localStorage under the per-household key.
 *
 * Layout:
 *  - Sepia-tinted page wrapper (CSS filter: sepia(0.15))
 *  - Page heading: "Valhalla" / subhead: "Hall of the Honored Dead"
 *  - Filter bar: issuer dropdown + sort (closed date, alphabetical)
 *  - Tombstone card list: ᛏ rune + card title + closedAt + meta + plunder
 *  - Empty state: Gleipnir Hunt fragment #6 hidden aria-description
 *
 * Animation: saga-enter stagger via Framer Motion (same as AnimatedCardGrid).
 * Copy source: product/copywriting.md — Valhalla section, empty states.
 * Mythology: product/mythology-map.md — Valhalla = Hall of heroes, closed cards.
 * Wireframe: ux/wireframes/valhalla.html
 */

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { getClosedCards, initializeHousehold, migrateIfNeeded } from "@/lib/storage";
import { isGleipnirComplete } from "@/lib/gleipnir-utils";
import { GleipnirBirdSpittle, useGleipnirFragment6 } from "@/components/cards/GleipnirBirdSpittle";
import { formatDate, formatCurrency } from "@/lib/card-utils";
import { KNOWN_ISSUERS } from "@/lib/constants";
import { getRealmLabel } from "@/lib/realm-utils";
import type { Card } from "@/lib/types";

// ─── Animation constants (mirrors AnimatedCardGrid) ──────────────────────────

/** Maximum stagger delay so a long list stays snappy. */
const MAX_STAGGER_DELAY_S = 0.56; // 8 cards × 0.07 s

/**
 * Expo-out easing vector — matches saga-enter in globals.css:
 * cubic-bezier(0.16, 1, 0.3, 1)
 */
const EXPO_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the human-readable issuer name from the issuer ID.
 */
function getIssuerName(issuerId: string): string {
  const issuer = KNOWN_ISSUERS.find((i) => i.id === issuerId);
  return issuer?.name ?? issuerId;
}

/**
 * Computes the number of months between two ISO date strings.
 * Used for the "held N months / N years" meta line.
 *
 * @param startIso - Opening date ISO string
 * @param endIso - Closing date ISO string
 * @returns Human-readable held duration string
 */
function formatHeldDuration(startIso: string, endIso: string): string {
  if (!startIso || !endIso) return "";
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "";

  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const months = Math.floor(diffDays / 30);

  if (months < 1) return `${diffDays} day${diffDays !== 1 ? "s" : ""}`;
  if (months < 12) return `${months} month${months !== 1 ? "s" : ""}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} year${years !== 1 ? "s" : ""}`;
  return `${years} year${years !== 1 ? "s" : ""} ${rem} month${rem !== 1 ? "s" : ""}`;
}

// ─── Sort options ─────────────────────────────────────────────────────────────

type SortKey =
  | "closed_date_desc"
  | "closed_date_asc"
  | "alpha_asc"
  | "alpha_desc"
  | "rewards_desc"
  | "fee_avoided_desc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "closed_date_desc", label: "Sort: Closed date (newest)" },
  { value: "closed_date_asc", label: "Sort: Closed date (oldest)" },
  { value: "alpha_asc", label: "Sort: A → Z" },
  { value: "alpha_desc", label: "Sort: Z → A" },
  { value: "rewards_desc", label: "Sort: Rewards earned (highest)" },
  { value: "fee_avoided_desc", label: "Sort: Fee avoided (highest)" },
];

/**
 * Returns the cashback reward amount in cents for a card, or 0 if the bonus
 * was not earned or is not a cashback type. Points/miles have no comparable
 * monetary value in the data model and are treated as 0 for sort purposes.
 */
function getRewardsCents(card: Card): number {
  if (!card.signUpBonus || !card.signUpBonus.met) return 0;
  if (card.signUpBonus.type !== "cashback") return 0;
  return card.signUpBonus.amount;
}

function sortCards(cards: Card[], sort: SortKey): Card[] {
  const copy = [...cards];
  switch (sort) {
    case "closed_date_desc":
      return copy.sort((a, b) => {
        const aDate = a.closedAt ?? a.updatedAt;
        const bDate = b.closedAt ?? b.updatedAt;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });
    case "closed_date_asc":
      return copy.sort((a, b) => {
        const aDate = a.closedAt ?? a.updatedAt;
        const bDate = b.closedAt ?? b.updatedAt;
        return new Date(aDate).getTime() - new Date(bDate).getTime();
      });
    case "alpha_asc":
      return copy.sort((a, b) => a.cardName.localeCompare(b.cardName));
    case "alpha_desc":
      return copy.sort((a, b) => b.cardName.localeCompare(a.cardName));
    case "rewards_desc":
      return copy.sort((a, b) => getRewardsCents(b) - getRewardsCents(a));
    case "fee_avoided_desc":
      return copy.sort((a, b) => b.annualFee - a.annualFee);
  }
}

// ─── TombstoneCard component ──────────────────────────────────────────────────

interface TombstoneCardProps {
  card: Card;
  index: number;
}

/**
 * TombstoneCard — a single closed card entry in Valhalla.
 *
 * Visual: thick left border (stone-hel color), ᛏ rune, card title, closedAt
 * date, issuer/opened/held meta line, and a plunder row (annual fee avoided).
 */
function TombstoneCard({ card, index }: TombstoneCardProps) {
  const staggerDelay = Math.min(index * 0.07, MAX_STAGGER_DELAY_S);

  const issuerName = getIssuerName(card.issuerId);
  const openedFormatted = formatDate(card.openDate);
  const closedFormatted = card.closedAt ? formatDate(card.closedAt) : "—";
  const heldDuration = card.closedAt
    ? formatHeldDuration(card.openDate, card.closedAt)
    : "";

  // Plunder: annual fee avoided (0 if no-fee card)
  const feeAvoided = card.annualFee;

  // Sign-up bonus summary for the plunder row
  const bonusSummary = (() => {
    if (!card.signUpBonus) return null;
    const { type, amount, met } = card.signUpBonus;
    if (amount <= 0) return null;
    const label = met ? "Earned" : "Forfeited";
    if (type === "cashback") {
      return `${label}: ${formatCurrency(amount)} cashback`;
    }
    const unit = type === "miles" ? "mi" : "pts";
    return `${label}: ${amount.toLocaleString()} ${unit}`;
  })();

  // Net gain: cashback rewards earned + annual fee avoided.
  // Points/miles have no comparable monetary value in the data model;
  // net gain is only augmented by cashback bonuses that were earned.
  const cashbackEarned =
    card.signUpBonus?.type === "cashback" && card.signUpBonus.met
      ? card.signUpBonus.amount
      : 0;
  const netGainCents = cashbackEarned + feeAvoided;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: staggerDelay, ease: EXPO_OUT }}
      className={[
        "border border-border border-l-4 border-l-[#8a8578]",
        "bg-background/60 backdrop-blur-sm",
        "p-4 flex flex-col gap-2.5",
        "rounded-sm",
      ].join(" ")}
      aria-label={`Closed card: ${card.cardName}`}
    >
      {/* Header: rune + title + closed date */}
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span
            className="text-[#8a8578] text-lg shrink-0"
            aria-hidden="true"
            title={getRealmLabel("closed").sublabel}
          >
            ᛏ
          </span>
          <h2 className="font-heading text-sm font-semibold tracking-wide uppercase truncate text-foreground">
            {card.cardName}
          </h2>
        </div>
        <span className="text-xs text-muted-foreground shrink-0 font-mono">
          Closed {closedFormatted}
        </span>
      </div>

      {/* Meta: issuer · opened · held duration */}
      <p className="text-xs text-muted-foreground">
        {issuerName}
        {openedFormatted ? ` · Opened ${openedFormatted}` : ""}
        {heldDuration ? ` · Held ${heldDuration}` : ""}
      </p>

      {/* Hairline rule */}
      <hr className="border-border" />

      {/* Plunder row */}
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-xs">
        {bonusSummary && (
          <>
            <span className="text-muted-foreground">Rewards:</span>
            <span className="font-mono text-foreground">{bonusSummary}</span>
          </>
        )}
        <span className="text-muted-foreground">Fee avoided:</span>
        <span className="font-mono text-foreground">
          {feeAvoided > 0 ? formatCurrency(feeAvoided) : "$0 (no-fee card)"}
        </span>
        <span className="text-[#8a8578] font-semibold">Net gain:</span>
        <span className="font-mono font-semibold text-foreground">
          {formatCurrency(netGainCents)}
        </span>
      </div>

      {/* Epitaph — atmospheric voice, Norse-flavoured */}
      <p className="text-xs text-muted-foreground italic pt-0.5">
        {feeAvoided > 0
          ? `The chain is broken. ${formatCurrency(feeAvoided)} returned to the wolf.`
          : "The chain held no toll. Its rewards stand alone."}
      </p>

      {/* View full record */}
      <div className="pt-1">
        <Link
          href={`/cards/${card.id}/edit`}
          className={[
            "inline-block text-xs px-3 py-1.5 rounded-sm",
            "border border-[#8a8578]/40 text-[#8a8578]",
            "hover:border-[#8a8578] hover:text-foreground",
            "transition-colors font-mono",
          ].join(" ")}
        >
          View full record
        </Link>
      </div>
    </motion.article>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

/**
 * ValhallaEmptyState — shown when no closed cards exist.
 *
 * Per Story 3.5 spec:
 *   "No wolves have returned from the hunt. All chains still bind."
 *   Link back to dashboard.
 *
 * Gleipnir Hunt fragment #6 — The Spittle of a Bird:
 *   Triggers after 15 seconds of idle on the empty Valhalla page.
 */
function ValhallaEmptyState() {
  const { open: spittleOpen, trigger: triggerSpittle, dismiss: dismissSpittle } = useGleipnirFragment6();

  useEffect(() => {
    const timer = setTimeout(() => {
      triggerSpittle();
    }, 15_000);
    return () => clearTimeout(timer);
  }, [triggerSpittle]);

  return (
    <>
      <div
        className="border border-dashed border-border rounded-sm p-12 text-center flex flex-col items-center gap-4"
        aria-label="Valhalla is empty"
      >
        <span className="text-[#8a8578] text-3xl" aria-hidden="true">
          ᛏ
        </span>
        <p className="font-heading text-sm text-foreground">
          No wolves have returned from the hunt. All chains still bind.
        </p>
        <Link
          href="/"
          className="text-xs text-muted-foreground hover:text-gold transition-colors underline underline-offset-2"
        >
          Return to the Ledger of Fates
        </Link>
      </div>
      <GleipnirBirdSpittle open={spittleOpen} onClose={dismissSpittle} />
    </>
  );
}

// ─── Valhalla page ────────────────────────────────────────────────────────────

/**
 * ValhallaPage — the /valhalla route.
 *
 * Fetches closed cards from localStorage, applies issuer filter and sort,
 * renders tombstone entries with Framer Motion saga-enter stagger.
 */
export default function ValhallaPage() {
  const { householdId, status } = useAuth();
  const [allClosed, setAllClosed] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [issuerFilter, setIssuerFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("closed_date_desc");
  const [gleipnirComplete, setGleipnirComplete] = useState(false);

  // Load closed cards from localStorage on mount (after auth resolves)
  useEffect(() => {
    if (status === "loading") return;

    if (!householdId) {
      setIsLoading(false);
      return;
    }

    migrateIfNeeded();
    initializeHousehold(householdId);
    const loaded = getClosedCards(householdId);
    setAllClosed(loaded);
    setIsLoading(false);
  }, [householdId, status]);

  // Check Gleipnir completion on mount
  useEffect(() => {
    setGleipnirComplete(isGleipnirComplete());
  }, []);

  // Derive unique issuers present in closed cards for the filter dropdown
  const uniqueIssuers = useMemo(() => {
    const ids = [...new Set(allClosed.map((c) => c.issuerId))];
    return ids.map((id) => ({
      id,
      name: getIssuerName(id),
    }));
  }, [allClosed]);

  // Apply issuer filter and sort
  const displayCards = useMemo(() => {
    const filtered =
      issuerFilter === "all"
        ? allClosed
        : allClosed.filter((c) => c.issuerId === issuerFilter);
    return sortCards(filtered, sort);
  }, [allClosed, issuerFilter, sort]);

  return (
    /*
     * Sepia tint: per ux/wireframes.md Valhalla section — "slightly darker,
     * sepia-tinted variant of the main background". Applied as a CSS filter
     * on the page wrapper so the content column inherits it uniformly.
     */
    <div
      className="px-6 py-6 max-w-3xl"
      style={{ filter: "sepia(0.15) brightness(0.95)" }}
    >
      {/* Page heading — Voice 2: atmospheric (from product/copywriting.md) */}
      <header className="mb-6 border-b border-border pb-4">
        <h1 className="font-display text-xl text-gold tracking-wide mb-1">
          <a
            className="myth-link"
            href="https://en.wikipedia.org/wiki/Valhalla"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Valhalla on Wikipedia"
          >
            Valhalla
          </a>
          {" — "}Hall of the Honored Dead
        </h1>
        <p className="text-xs text-muted-foreground mt-2 font-body italic">
          The chains that were broken. The rewards that were harvested.
        </p>
      </header>

      {/* Filter / sort bar */}
      {!isLoading && allClosed.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-6">
          {/* Issuer filter */}
          <select
            aria-label="Filter by issuer"
            value={issuerFilter}
            onChange={(e) => setIssuerFilter(e.target.value)}
            className={[
              "border border-border rounded-sm px-3 py-1.5 text-xs",
              "bg-background text-foreground",
              "focus:outline-none focus:border-gold/50",
              "font-mono",
            ].join(" ")}
          >
            <option value="all">All issuers</option>
            {uniqueIssuers.map((iss) => (
              <option key={iss.id} value={iss.id}>
                {iss.name}
              </option>
            ))}
          </select>

          {/* Sort */}
          <select
            aria-label="Sort order"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className={[
              "border border-border rounded-sm px-3 py-1.5 text-xs",
              "bg-background text-foreground",
              "focus:outline-none focus:border-gold/50",
              "font-mono",
            ].join(" ")}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Content */}
      {isLoading || status === "loading" ? (
        <p className="text-sm text-muted-foreground italic font-body">
          Consulting the runes...
        </p>
      ) : allClosed.length === 0 ? (
        <ValhallaEmptyState />
      ) : displayCards.length === 0 ? (
        /* Filter produced no results */
        <p className="text-sm text-muted-foreground italic font-body">
          No cards bear this issuer&apos;s mark.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {gleipnirComplete && (
            <article
              className="border border-[#c9920a] border-l-4 border-l-[#f0b429] bg-background/60 backdrop-blur-sm p-4 flex flex-col gap-2.5 rounded-sm gleipnir-shimmer"
              aria-label="Gleipnir complete"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-[#f0b429] text-lg" aria-hidden="true">✦</span>
                <h2 className="font-heading text-sm font-semibold tracking-wide uppercase text-[#f0b429]">
                  Gleipnir
                </h2>
              </div>
              <p className="font-body text-xs italic text-[#e8e4d4] leading-relaxed">
                The six impossible things are found. The ribbon is woven. The wolf is bound — and content.
              </p>
              <p className="font-mono text-[0.65rem] text-[#c9920a]">
                All 6 fragments discovered
              </p>
            </article>
          )}
          <AnimatePresence initial={true}>
            {displayCards.map((card, index) => (
              <TombstoneCard key={card.id} card={card} index={index} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
