/**
 * Fenrir Ledger — Card Utility Functions
 *
 * Pure functions for card status computation and display formatting.
 * All functions are deterministic and accept an optional `today` parameter
 * to make them fully testable without mocking Date.
 *
 * Date storage convention: all date fields (openDate, annualFeeDate,
 * signUpBonus.deadline, createdAt, updatedAt) are full UTC ISO 8601 strings,
 * e.g. "2025-03-15T00:00:00.000Z". The display layer converts to local
 * timezone using isoToLocalDateString() / formatDate().
 */

import type { Card, CardStatus } from "@/lib/types";
import { FEE_APPROACHING_DAYS, PROMO_EXPIRING_DAYS } from "@/lib/constants";

// ─── Date Conversion Helpers ──────────────────────────────────────────────────

/**
 * Converts a full UTC ISO 8601 string to a YYYY-MM-DD string in the user's
 * local timezone. Used to populate HTML <input type="date"> elements.
 *
 * @param iso - Full UTC ISO 8601 string (e.g. "2025-03-15T00:00:00.000Z")
 * @returns YYYY-MM-DD string in local timezone, or "" if input is empty/invalid
 */
export function isoToLocalDateString(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Converts a YYYY-MM-DD string (as entered by an HTML date picker in local
 * timezone) to a full UTC ISO 8601 string at midnight UTC for that local date.
 *
 * The conversion treats the date as a local-timezone date at 00:00:00 local,
 * then converts to UTC. This preserves the user's intended calendar date
 * regardless of their timezone offset.
 *
 * @param dateStr - YYYY-MM-DD string from a date input
 * @returns Full UTC ISO 8601 string, or "" if input is empty/invalid
 */
export function localDateStringToIso(dateStr: string): string {
  if (!dateStr) return "";
  // Parse as local date by constructing with time component to avoid UTC shift.
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return d.toISOString();
}

// ─── Date Calculation Helpers ─────────────────────────────────────────────────

/**
 * Computes the number of days until a future date.
 *
 * Accepts both full UTC ISO 8601 strings ("2025-03-15T00:00:00.000Z") and
 * legacy YYYY-MM-DD strings for backward compatibility with any data that was
 * stored before the ISO 8601 migration.
 *
 * @param isoDate - Date string (full ISO 8601 UTC or YYYY-MM-DD)
 * @param today - Reference date (defaults to current date). Accepts Date or string.
 * @returns Number of days until the date. Negative means the date is in the past.
 */
export function daysUntil(isoDate: string, today?: Date): number {
  if (!isoDate) return Infinity;

  let target: Date;
  // Detect legacy YYYY-MM-DD format (10 chars, no T separator)
  if (isoDate.length === 10 && !isoDate.includes("T")) {
    // Parse as local date to avoid timezone-induced day shift
    target = new Date(isoDate + "T00:00:00");
  } else {
    target = new Date(isoDate);
  }

  if (isNaN(target.getTime())) return Infinity;

  const reference = today ?? new Date();
  // Compare at day resolution in local timezone
  const referenceDate = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate()
  );
  // Target day in local timezone
  const targetDate = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  );

  const diffMs = targetDate.getTime() - referenceDate.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// ─── Status Predicates ────────────────────────────────────────────────────────

/** Returns true if the card is explicitly closed. */
export function isClosed(card: Card): boolean {
  return card.status === "closed" || !!(card.closedAt && card.closedAt !== "");
}

/** Returns true if the sign-up bonus minimum spend has been met. */
export function isGraduated(card: Card): boolean {
  return !!card.signUpBonus?.met;
}

/** Returns true if the annual fee due date is in the past. */
export function isOverdue(card: Card, today?: Date): boolean {
  if (!card.annualFeeDate || card.annualFee <= 0) return false;
  return daysUntil(card.annualFeeDate, today) < 0;
}

/** Returns true if the annual fee is due within FEE_APPROACHING_DAYS days. */
export function isFeeApproaching(card: Card, today?: Date): boolean {
  if (!card.annualFeeDate || card.annualFee <= 0) return false;
  const days = daysUntil(card.annualFeeDate, today);
  return days >= 0 && days <= FEE_APPROACHING_DAYS;
}

/** Returns true if the sign-up bonus deadline is within PROMO_EXPIRING_DAYS days. */
export function isPromoExpiring(card: Card, today?: Date): boolean {
  if (!card.signUpBonus || card.signUpBonus.met || !card.signUpBonus.deadline) return false;
  const days = daysUntil(card.signUpBonus.deadline, today);
  return days >= 0 && days <= PROMO_EXPIRING_DAYS;
}

/** Returns true if the card is in an open sign-up bonus earning window. */
export function isBonusOpen(card: Card, today?: Date): boolean {
  if (!card.signUpBonus || card.signUpBonus.met || !card.signUpBonus.deadline) return false;
  return daysUntil(card.signUpBonus.deadline, today) > 0;
}

// ─── Status Computation ───────────────────────────────────────────────────────

/**
 * Computes the display status for a card based on its dates.
 *
 * Status priority (highest to lowest):
 * 1. "closed" — if explicitly set
 * 2. "graduated" — sign-up bonus minimum spend met (auto-graduates to Valhalla)
 * 3. "overdue" — annual fee date is in the past
 * 4. "fee_approaching" — annual fee within FEE_APPROACHING_DAYS days
 * 5. "promo_expiring" — sign-up bonus deadline within PROMO_EXPIRING_DAYS days
 * 6. "bonus_open" — in bonus window, not yet met
 * 7. "active" — otherwise
 *
 * @param card - The card to evaluate
 * @param today - Reference date for calculation (defaults to current date)
 * @returns The computed CardStatus
 */
export function computeCardStatus(card: Card, today?: Date): CardStatus {
  if (isClosed(card)) return "closed";
  if (isGraduated(card)) return "graduated";
  if (isOverdue(card, today)) return "overdue";
  if (isFeeApproaching(card, today)) return "fee_approaching";
  if (isPromoExpiring(card, today)) return "promo_expiring";
  if (isBonusOpen(card, today)) return "bonus_open";
  return "active";
}

// ─── Display Formatters ───────────────────────────────────────────────────────

/**
 * Formats a number of cents as a USD currency string.
 *
 * @param cents - Integer cents value (e.g. 9500 → "$95.00")
 * @returns Formatted currency string
 */
export function formatCurrency(cents: number): string {
  if (cents === 0) return "$0";
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Formats a date string as a human-readable date in the user's local timezone.
 *
 * Accepts both full UTC ISO 8601 strings and legacy YYYY-MM-DD strings for
 * backward compatibility.
 *
 * @param isoDate - Full UTC ISO 8601 string or YYYY-MM-DD string
 * @returns Formatted date string (e.g. "Jan 15, 2026"). Empty string for empty input.
 */
export function formatDate(isoDate: string): string {
  if (!isoDate) return "";

  let date: Date;
  // Detect legacy YYYY-MM-DD format (10 chars, no T separator)
  if (isoDate.length === 10 && !isoDate.includes("T")) {
    // Parse as local date to avoid timezone-induced day shift
    const [year = 0, month = 0, day = 0] = isoDate.split("-").map(Number);
    date = new Date(year, month - 1, day);
  } else {
    date = new Date(isoDate);
  }

  if (isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/**
 * Returns a human-readable urgency label for a number of days.
 *
 * @param days - Days until the event
 * @returns Human-readable string like "in 3 days", "today", "1 day ago"
 */
export function formatDaysUntil(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "in 1 day";
  if (days > 1) return `in ${days} days`;
  if (days === -1) return "1 day ago";
  return `${Math.abs(days)} days ago`;
}

// ─── ID Generation ────────────────────────────────────────────────────────────

/**
 * Generates a UUID v4. Uses crypto.randomUUID() when available (HTTPS / secure
 * contexts) and falls back to crypto.getRandomValues() which works everywhere.
 */
export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: manual UUID v4 via getRandomValues (works in non-secure contexts)
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant bits
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

// ─── Money Conversion Helpers ─────────────────────────────────────────────────

/**
 * Converts a dollar string entered in a form input to integer cents.
 * Handles inputs like "95", "95.00", "95.5".
 *
 * @param dollarString - Dollar amount as a string from a form input
 * @returns Integer cents, or 0 if input is invalid
 */
export function dollarsToCents(dollarString: string): number {
  const parsed = parseFloat(dollarString);
  if (isNaN(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

/**
 * Converts integer cents to a dollar string for display in form inputs.
 *
 * @param cents - Integer cents
 * @returns Dollar amount as a string (e.g. 9500 → "95")
 */
export function centsToDollars(cents: number): string {
  if (cents === 0) return "";
  const dollars = cents / 100;
  // Avoid trailing zeros: 9500 → "95", 9550 → "95.5"
  return dollars % 1 === 0 ? String(dollars) : dollars.toFixed(2);
}
