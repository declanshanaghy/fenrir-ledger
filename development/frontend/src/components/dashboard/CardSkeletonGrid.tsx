"use client";

/**
 * CardSkeletonGrid — placeholder grid shown while card data is loading.
 *
 * Renders a fixed number of skeleton card tiles with a Norse gold shimmer
 * animation. Replaces the "The Norns are weaving..." text with a richer
 * loading state as specified in ux/interactions.md.
 *
 * CSS:
 *   .skeleton — defined in globals.css: saga-shimmer keyframe + gold gradient
 *
 * The number of skeleton tiles defaults to 6 (two full rows on desktop).
 */

interface CardSkeletonGridProps {
  /** Number of skeleton tiles to render. Defaults to 6. */
  count?: number;
}

/**
 * A single skeleton card tile — structural mirror of CardTile without data.
 */
function SkeletonTile() {
  return (
    <div className="border border-secondary rounded-sm p-4 h-[216px] flex flex-col gap-3">
      {/* Header row: issuer label + status badge */}
      <div className="flex items-start justify-between gap-2 pb-1">
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {/* Issuer name — narrow line */}
          <div className="skeleton h-3 w-24 rounded-sm" />
          {/* Card name — wider line */}
          <div className="skeleton h-4 w-40 rounded-sm" />
        </div>
        {/* Status badge placeholder */}
        <div className="skeleton h-5 w-16 rounded-sm shrink-0" />
      </div>

      {/* Data rows */}
      <div className="flex flex-col gap-2 mt-1">
        <div className="flex justify-between">
          <div className="skeleton h-3 w-20 rounded-sm" />
          <div className="skeleton h-3 w-16 rounded-sm" />
        </div>
        <div className="flex justify-between">
          <div className="skeleton h-3 w-16 rounded-sm" />
          <div className="skeleton h-3 w-12 rounded-sm" />
        </div>
        <div className="flex justify-between">
          <div className="skeleton h-3 w-12 rounded-sm" />
          <div className="skeleton h-3 w-20 rounded-sm" />
        </div>
        <div className="flex justify-between">
          <div className="skeleton h-3 w-14 rounded-sm" />
          <div className="skeleton h-3 w-24 rounded-sm" />
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a responsive skeleton grid matching the card grid layout.
 * Shows a Norn loading caption beneath the grid.
 */
export function CardSkeletonGrid({ count = 6 }: CardSkeletonGridProps) {
  return (
    <div data-testid="skeleton-grid">
      {/* Summary header skeleton */}
      <div className="flex items-center gap-6 mb-6">
        <div className="skeleton h-4 w-20 rounded-sm" />
        <div className="skeleton h-4 w-32 rounded-sm" />
      </div>

      {/* Skeleton card grid — mirrors the real grid breakpoints */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: count }, (_, i) => (
          <SkeletonTile key={i} />
        ))}
      </div>

      {/* Norn loading copy — from ux/interactions.md Loading Copy section */}
      <p className="mt-6 text-center text-base text-muted-foreground font-body italic">
        The Norns are weaving...
      </p>
    </div>
  );
}
