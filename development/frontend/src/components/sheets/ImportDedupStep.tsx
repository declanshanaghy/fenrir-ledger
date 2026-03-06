"use client";

import { KNOWN_ISSUERS } from "@/lib/constants";
import type { DuplicateMatch } from "@/lib/sheets/dedup";

interface ImportDedupStepProps {
  duplicates: DuplicateMatch[];
  uniqueCount: number;
  onSkipDuplicates: () => void;
  onImportAll: () => void;
  onCancel: () => void;
}

export function ImportDedupStep({
  duplicates,
  uniqueCount,
  onSkipDuplicates,
  onImportAll,
  onCancel,
}: ImportDedupStepProps) {
  const dupCount = duplicates.length;

  function issuerName(issuerId: string): string {
    return KNOWN_ISSUERS.find((i) => i.id === issuerId)?.name ?? issuerId;
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <h2 className="font-display text-gold tracking-wide text-xl">
          Duplicates Found
        </h2>
        <span className="inline-flex items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-mono text-sm font-bold px-2 py-0.5 border border-amber-500/30">
          {dupCount} duplicate{dupCount !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex flex-col gap-3 overflow-hidden flex-1">
        <p className="font-body text-muted-foreground text-base">
          {dupCount} card{dupCount !== 1 ? "s" : ""} already exist in your ledger.
          Choose how to proceed.
        </p>

        {/* Duplicate pairs list */}
        <div className="overflow-y-auto flex-1 min-h-0 max-h-[40vh] flex flex-col gap-2 pr-1">
          {duplicates.map((match, i) => (
            <div
              key={i}
              className="rounded-sm border border-amber-500/40 bg-amber-500/5 px-4 py-3 flex flex-col gap-2"
            >
              {/* Imported card */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-heading text-sm text-amber-400 tracking-wide uppercase">
                    Importing
                  </span>
                  <span className="font-heading text-base text-foreground tracking-wide truncate">
                    {match.imported.cardName}
                  </span>
                  <span className="font-body text-sm text-muted-foreground">
                    {issuerName(match.imported.issuerId)}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-2">
                <div className="flex-1 border-t border-border" />
                <span className="font-mono text-xs text-muted-foreground">
                  matches existing
                </span>
                <div className="flex-1 border-t border-border" />
              </div>

              {/* Existing card */}
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-heading text-sm text-muted-foreground tracking-wide uppercase">
                  In Ledger
                </span>
                <span className="font-heading text-base text-foreground tracking-wide truncate">
                  {match.existing.cardName}
                </span>
                <span className="font-body text-sm text-muted-foreground">
                  {issuerName(match.existing.issuerId)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-2">
          {/* Primary: skip duplicates, import unique only */}
          {uniqueCount > 0 && (
            <button
              type="button"
              onClick={onSkipDuplicates}
              className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-base transition-colors bg-primary text-primary-foreground hover:bg-gold-bright h-11 px-6 min-w-[44px] w-full"
            >
              Skip {dupCount} duplicate{dupCount !== 1 ? "s" : ""} and import {uniqueCount} new
            </button>
          )}

          {/* Secondary: import all anyway */}
          <button
            type="button"
            onClick={onImportAll}
            className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-base transition-colors border border-amber-500/40 text-amber-400 hover:border-amber-500 hover:text-amber-300 h-11 px-6 min-w-[44px] w-full"
          >
            Import all anyway ({dupCount + uniqueCount} card{dupCount + uniqueCount !== 1 ? "s" : ""})
          </button>

          {/* Cancel */}
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-base transition-colors border border-border text-muted-foreground hover:border-gold/50 hover:text-gold h-11 px-6 min-w-[44px] w-full"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
