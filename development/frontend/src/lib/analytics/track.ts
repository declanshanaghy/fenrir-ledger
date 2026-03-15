/**
 * Fenrir Ledger — Analytics Tracking Utility
 *
 * Typed wrapper around Umami's client-side `window.umami.track()` API.
 * All 8 custom event categories are defined here with strict prop types.
 *
 * Umami is loaded via <UmamiScript> (issue #782). When Umami is not present
 * (SSR, headless, or missing NEXT_PUBLIC_UMAMI_WEBSITE_ID), calls are
 * silently no-ops — analytics must never block the user experience.
 *
 * Usage:
 *   import { track } from "@/lib/analytics/track";
 *   track("card-save", { method: "manual" });
 *   track("easter-egg", { fragment: 3, name: "mountain-roots" });
 *
 * Issue: #783
 */

// ── Umami global type augmentation ──────────────────────────────────────────

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, props?: Record<string, unknown>) => void;
    };
  }
}

// ── Event prop types ─────────────────────────────────────────────────────────

export interface CardSaveProps {
  method: "manual" | "import";
}

export interface SheetImportProps {
  method: "url" | "picker" | "csv";
}

export interface SubscriptionConvertProps {
  tier: "karl";
}

export interface EasterEggProps {
  fragment: 1 | 2 | 3 | 4 | 5 | 6;
  name:
    | "cats-footfall"
    | "womans-beard"
    | "mountain-roots"
    | "bear-sinews"
    | "fish-breath"
    | "bird-spittle";
}

// ── Event map — ties event names to their prop types ─────────────────────────

export interface TrackEventMap {
  "card-save": CardSaveProps;
  "sheet-import": SheetImportProps;
  "subscription-convert": SubscriptionConvertProps;
  "easter-egg": EasterEggProps;
  "auth-signup": Record<string, never>;
  "auth-login": Record<string, never>;
  "valhalla-visit": Record<string, never>;
  "settings-visit": Record<string, never>;
}

export type TrackEventName = keyof TrackEventMap;

// ── track() — the public API ─────────────────────────────────────────────────

/**
 * Fire a typed Umami custom event.
 *
 * - No-op when `window.umami` is unavailable (SSR, headless, or script not loaded).
 * - Props with `Record<string, never>` can be omitted entirely.
 */
export function track<T extends TrackEventName>(
  ...[eventName, props]: TrackEventMap[T] extends Record<string, never>
    ? [T, Record<string, never>?]
    : [T, TrackEventMap[T]]
): void {
  if (typeof window === "undefined") return;
  if (!window.umami) return;

  window.umami.track(eventName, props as Record<string, unknown> | undefined);
}
