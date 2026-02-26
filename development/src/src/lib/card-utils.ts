/**
 * Fenrir Ledger — Card Utility Functions
 *
 * Pure functions for card status computation and display formatting.
 * All functions are deterministic and accept an optional `today` parameter
 * to make them fully testable without mocking Date.
 */

import type { Card, CardStatus } from "@/lib/types";
import { FEE_APPROACHING_DAYS, PROMO_EXPIRING_DAYS } from "@/lib/constants";

/**
 * Computes the number of days until a future date.
 *
 * @param isoDate - Date string in YYYY-MM-DD format
 * @param today - Reference date (defaults to current date). Accepts Date or string.
 * @returns Number of days until the date. Negative means the date is in the past.
 */
export function daysUntil(isoDate: string, today?: Date): number {
  if (!isoDate) return Infinity;
  const target = new Date(isoDate + "T00:00:00");
  const reference = today ?? new Date();
  const referenceDate = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate()
  );
  const diffMs = target.getTime() - referenceDate.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Computes the display status for a card based on its dates.
 *
 * Status priority:
 * 1. "closed" — if explicitly set
 * 2. "fee_approaching" — annual fee within FEE_APPROACHING_DAYS days
 * 3. "promo_expiring" — sign-up bonus deadline within PROMO_EXPIRING_DAYS days
 * 4. "active" — otherwise
 *
 * @param card - The card to evaluate
 * @param today - Reference date for calculation (defaults to current date)
 * @returns The computed CardStatus
 */
export function computeCardStatus(card: Card, today?: Date): CardStatus {
  if (card.status === "closed") {
    return "closed";
  }

  // Check annual fee approaching
  if (card.annualFeeDate && card.annualFee > 0) {
    const daysToFee = daysUntil(card.annualFeeDate, today);
    if (daysToFee >= 0 && daysToFee <= FEE_APPROACHING_DAYS) {
      return "fee_approaching";
    }
  }

  // Check sign-up bonus deadline approaching
  if (card.signUpBonus && !card.signUpBonus.met && card.signUpBonus.deadline) {
    const daysToDeadline = daysUntil(card.signUpBonus.deadline, today);
    if (daysToDeadline >= 0 && daysToDeadline <= PROMO_EXPIRING_DAYS) {
      return "promo_expiring";
    }
  }

  return "active";
}

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
 * Formats a YYYY-MM-DD date string as a human-readable date.
 *
 * @param isoDate - Date string in YYYY-MM-DD format
 * @returns Formatted date string (e.g. "Jan 15, 2026"). Empty string for empty input.
 */
export function formatDate(isoDate: string): string {
  if (!isoDate) return "";
  // Parse as local date to avoid timezone shift.
  // Default values satisfy noUncheckedIndexedAccess — format is guaranteed YYYY-MM-DD.
  const [year = 0, month = 0, day = 0] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
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
