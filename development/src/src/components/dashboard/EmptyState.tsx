/**
 * EmptyState — displayed on the dashboard when no cards exist.
 *
 * The Gleipnir empty state: before the first chain is forged,
 * Fenrir roams free. This is the brand's clearest voice.
 *
 * Gleipnir ingredient #6 (spittle of a bird) is embedded here
 * as a discoverable fragment of the Gleipnir Hunt easter egg.
 */

import Link from "next/link";

export function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-24 text-center"
      // Easter egg #1 — Gleipnir Hunt, ingredient 6 of 6
      aria-description="the spittle of a bird"
    >
      {/* Voice 2: atmospheric — kennings from copywriting.md empty states */}
      <h2 className="font-display text-2xl text-gold mb-3 tracking-wide">
        Before Gleipnir was forged, Fenrir roamed free.
      </h2>

      <p className="font-body text-muted-foreground mb-8 max-w-md italic leading-relaxed">
        Before your first card is added, no chain can be broken.
      </p>

      <Link
        href="/cards/new"
        className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-sm transition-colors bg-primary text-primary-foreground hover:bg-gold-bright h-10 px-6"
      >
        Add Card
      </Link>
    </div>
  );
}
