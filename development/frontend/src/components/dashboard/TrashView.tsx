"use client";

/**
 * TrashView — Trash tab panel for the dashboard.
 *
 * Renders deleted cards (deletedAt set) with Restore and Expunge actions.
 * Thrall gate is handled upstream in Dashboard.tsx — this component always
 * renders for Karl/trial users.
 *
 * Layout (per wireframe trash-tab.html):
 *   - Header bar: title + subtitle + "Empty Trash" button (when cards > 0)
 *   - Card list: article per card, name/issuer/last-4/deletedAt, Restore + Expunge buttons
 *   - Empty state: "The Void is Empty" — Ginnungagap reference
 *   - Expunge single confirmation dialog (Section D)
 *   - Empty Trash confirmation dialog (Section E)
 *
 * Karl bling: trash cards inherit .karl-bling-card (reduced opacity ~0.30)
 * via karl-bling.css cascade — no per-component JS needed.
 *
 * Accessibility: WCAG 2.1 AA — aria-labels, focus trap in dialogs,
 * focus returns to trigger after dialog close, AnimatePresence exit animations.
 *
 * Wireframe: ux/wireframes/cards/trash-tab.html
 * Interaction spec: ux/wireframes/cards/trash-tab-interaction-spec.md
 * Issue: #1127
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getIssuerBadgeChar } from "@/lib/issuer-utils";
import type { Card } from "@/lib/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Formats a deletedAt ISO timestamp as "Mar 13, 2026 · 3 days ago".
 */
function formatDeletedAt(deletedAt: string): string {
  const date = new Date(deletedAt);
  const now = new Date();

  const absolute = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let relative: string;
  if (diffDays === 0) {
    relative = "today";
  } else if (diffDays === 1) {
    relative = "1 day ago";
  } else {
    relative = `${diffDays} days ago`;
  }

  return `${absolute} · ${relative}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TrashViewProps {
  /** Soft-deleted cards for this household, sorted by deletedAt desc. */
  trashedCards: Card[];
  /** Called when user restores a card — parent must refresh card lists. */
  onRestore: (cardId: string) => void;
  /** Called when user expunges a single card permanently. */
  onExpunge: (cardId: string) => void;
  /** Called when user empties the entire trash. */
  onEmptyTrash: () => void;
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

interface ExpungeDialogProps {
  card: Card | null;
  onConfirm: () => void;
  onCancel: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

/** Single-card expunge confirmation dialog (Section D in wireframe). */
function ExpungeDialog({ card, onConfirm, onCancel, triggerRef }: ExpungeDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Return focus to trigger button when dialog closes
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        onCancel();
        // defer focus restore after dialog animation
        setTimeout(() => triggerRef.current?.focus(), 50);
      }
    },
    [onCancel, triggerRef]
  );

  return (
    <Dialog open={!!card} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-[440px] border-2 border-border bg-background p-0 gap-0"
        aria-label="Expunge confirmation"
      >
        <div className="flex flex-col gap-4 p-6">
          <DialogTitle className="text-base font-display font-bold uppercase tracking-wide">
            Expunge {card?.cardName ?? "Card"}?
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground font-body leading-relaxed">
            This card will be permanently removed from this device&apos;s local storage.
            Cloud records (if any) are not affected — only this device will be cleared.
            This action cannot be undone.
          </DialogDescription>
          <div className="flex gap-3 justify-end pt-2">
            <button
              ref={cancelRef}
              type="button"
              autoFocus
              onClick={onCancel}
              className="text-sm border border-border px-4 py-2 cursor-pointer font-body hover:text-foreground hover:border-foreground/30 transition-colors min-h-[44px] inline-flex items-center"
            >
              Cancel
            </button>
            <Button
              type="button"
              onClick={onConfirm}
              className="text-sm font-bold border-2 border-destructive bg-transparent text-destructive hover:bg-destructive hover:text-destructive-foreground min-h-[44px]"
            >
              <span aria-hidden="true" style={{ fontFamily: "serif" }}>ᛟ </span>
              Expunge Forever
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface EmptyTrashDialogProps {
  open: boolean;
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

/** Empty Trash confirmation dialog (Section E in wireframe). */
function EmptyTrashDialog({ open, count, onConfirm, onCancel, triggerRef }: EmptyTrashDialogProps) {
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        onCancel();
        setTimeout(() => triggerRef.current?.focus(), 50);
      }
    },
    [onCancel, triggerRef]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-[440px] border-2 border-border bg-background p-0 gap-0"
        aria-label="Empty Trash confirmation"
      >
        <div className="flex flex-col gap-4 p-6">
          <DialogTitle className="text-base font-display font-bold uppercase tracking-wide">
            Empty the Void?
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground font-body leading-relaxed">
            {count} deleted card{count !== 1 ? "s" : ""} will be permanently removed from this
            device. Cloud records (if any) are not affected. This action cannot be undone.
          </DialogDescription>
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              autoFocus
              onClick={onCancel}
              className="text-sm border border-border px-4 py-2 cursor-pointer font-body hover:text-foreground hover:border-foreground/30 transition-colors min-h-[44px] inline-flex items-center"
            >
              Cancel
            </button>
            <Button
              type="button"
              onClick={onConfirm}
              className="text-sm font-bold border-2 border-destructive bg-transparent text-destructive hover:bg-destructive hover:text-destructive-foreground min-h-[44px]"
            >
              <span aria-hidden="true" style={{ fontFamily: "serif" }}>ᛞ </span>
              Empty Trash ({count})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function TrashEmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        className="flex flex-col items-center gap-3 py-12 px-6 border border-dashed border-border text-center"
        aria-label="Trash is empty"
      >
        <span
          aria-hidden="true"
          className="text-4xl leading-none text-muted-foreground/50 select-none"
          style={{ fontFamily: "serif" }}
        >
          ᛞ
        </span>
        <p className="text-base font-display font-bold uppercase tracking-wide text-muted-foreground">
          The Void is Empty
        </p>
        <p className="text-sm text-muted-foreground/70 font-body max-w-xs">
          Ginnungagap — the primordial void. No deleted cards rest here.
        </p>
      </div>
    </motion.div>
  );
}

// ─── TrashCard row ────────────────────────────────────────────────────────────

interface TrashCardRowProps {
  card: Card;
  onRestore: () => void;
  onExpunge: () => void;
  expungeTriggerRef: React.RefObject<HTMLButtonElement | null>;
}

function TrashCardRow({ card, onRestore, onExpunge, expungeTriggerRef }: TrashCardRowProps) {
  const deletedLabel = card.deletedAt ? formatDeletedAt(card.deletedAt) : "Unknown";
  const issuerBadgeChar = getIssuerBadgeChar(card.issuerId);

  return (
    <article
      className={cn(
        "relative border border-border p-3.5 flex gap-4 items-start",
        "trash-card karl-bling-card",
        // Mobile: column layout
        "flex-col sm:flex-row"
      )}
      aria-label={`Deleted card: ${card.cardName}, deleted ${deletedLabel}`}
    >
      {/* Karl rune corners — decorative, aria-hidden */}
      <span aria-hidden="true" className="karl-rune-corner karl-rune-tl trash-rune-corner">ᚠ</span>
      <span aria-hidden="true" className="karl-rune-corner karl-rune-tr trash-rune-corner">ᚱ</span>
      <span aria-hidden="true" className="karl-rune-corner karl-rune-bl trash-rune-corner">ᛁ</span>
      <span aria-hidden="true" className="karl-rune-corner karl-rune-br trash-rune-corner">ᚾ</span>

      {/* Card body */}
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-2">
          {/* Issuer badge */}
          <span
            className="w-7 h-7 border border-border flex items-center justify-center text-xs font-bold shrink-0 text-muted-foreground"
            aria-hidden="true"
          >
            {issuerBadgeChar}
          </span>
          <span className="text-sm font-heading font-bold truncate">{card.cardName}</span>
        </div>
        {/* Issuer */}
        <p className="text-xs text-muted-foreground font-body">
          {card.issuerId ?? "Unknown issuer"}
        </p>
        {/* Deleted date */}
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70">
          Deleted: {deletedLabel}
        </p>
      </div>

      {/* Actions — column on desktop (flex-end), row on mobile (flex:1) */}
      <div
        className={cn(
          "flex gap-2 shrink-0",
          "flex-row self-stretch sm:flex-col sm:self-auto sm:items-end"
        )}
      >
        <button
          type="button"
          onClick={onRestore}
          className={cn(
            "text-xs font-bold uppercase tracking-wide",
            "border border-border px-3 py-1.5 cursor-pointer",
            "hover:border-foreground/40 hover:text-foreground transition-colors",
            "min-h-[36px] whitespace-nowrap flex-1 sm:flex-none"
          )}
          aria-label={`Restore ${card.cardName} — move back to active cards`}
        >
          <span aria-hidden="true" style={{ fontFamily: "serif" }}>ᚢ </span>
          Restore
        </button>
        <button
          ref={expungeTriggerRef}
          type="button"
          onClick={onExpunge}
          className={cn(
            "text-xs font-bold uppercase tracking-wide",
            "border border-dashed border-border px-3 py-1.5 cursor-pointer",
            "hover:border-destructive/60 hover:text-destructive transition-colors",
            "min-h-[36px] whitespace-nowrap flex-1 sm:flex-none"
          )}
          aria-label={`Expunge ${card.cardName} — permanently delete from this device`}
        >
          <span aria-hidden="true" style={{ fontFamily: "serif" }}>ᛟ </span>
          Expunge
        </button>
      </div>
    </article>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TrashView({ trashedCards, onRestore, onExpunge, onEmptyTrash }: TrashViewProps) {
  // Which card is pending single expunge (null = dialog closed)
  const [expungeTarget, setExpungeTarget] = useState<Card | null>(null);
  // Whether empty-trash dialog is open
  const [emptyDialogOpen, setEmptyDialogOpen] = useState(false);

  // Refs for focus restoration after dialogs close
  const expungeTriggerRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const emptyTrashBtnRef = useRef<HTMLButtonElement>(null);

  // Per-card expunge trigger ref setter
  const getExpungeTriggerRef = useCallback(
    (cardId: string): React.RefObject<HTMLButtonElement | null> => {
      // Return a stable ref object keyed by cardId
      return {
        get current() {
          return expungeTriggerRefs.current.get(cardId) ?? null;
        },
        set current(el: HTMLButtonElement | null) {
          expungeTriggerRefs.current.set(cardId, el);
        },
      };
    },
    []
  );

  // Cleanup removed card refs
  useEffect(() => {
    const activeIds = new Set(trashedCards.map((c) => c.id));
    for (const id of expungeTriggerRefs.current.keys()) {
      if (!activeIds.has(id)) {
        expungeTriggerRefs.current.delete(id);
      }
    }
  }, [trashedCards]);

  const handleExpungeConfirm = useCallback(() => {
    if (!expungeTarget) return;
    onExpunge(expungeTarget.id);
    setExpungeTarget(null);
  }, [expungeTarget, onExpunge]);

  const handleExpungeCancel = useCallback(() => {
    setExpungeTarget(null);
  }, []);

  const handleEmptyConfirm = useCallback(() => {
    onEmptyTrash();
    setEmptyDialogOpen(false);
  }, [onEmptyTrash]);

  const handleEmptyCancel = useCallback(() => {
    setEmptyDialogOpen(false);
  }, []);

  return (
    <div aria-label="Trash" className="flex flex-col gap-0">
      {/* Header bar */}
      <div
        className={cn(
          "flex items-center justify-between py-3 border-b border-border",
          "flex-row gap-3",
          // Mobile: column
          "flex-col sm:flex-row sm:items-center"
        )}
      >
        <div className="flex flex-col gap-0.5 self-start sm:self-auto">
          <p className="text-sm font-display font-bold uppercase tracking-wide">
            Trash
          </p>
          <p className="text-xs text-muted-foreground font-body">
            Deleted cards live here. Restore to return them; expunge to erase forever.
          </p>
        </div>
        {trashedCards.length > 0 && (
          <button
            ref={emptyTrashBtnRef}
            type="button"
            onClick={() => setEmptyDialogOpen(true)}
            className={cn(
              "text-xs font-bold uppercase tracking-wide",
              "border border-border px-3.5 py-1.5 cursor-pointer shrink-0",
              "hover:border-destructive/60 hover:text-destructive transition-colors",
              "min-h-[36px] self-stretch sm:self-auto text-center"
            )}
            aria-label={`Empty trash — permanently delete all ${trashedCards.length} deleted cards`}
          >
            <span aria-hidden="true" style={{ fontFamily: "serif" }}>ᛞ </span>
            Empty Trash
          </button>
        )}
      </div>

      {/* Card list or empty state */}
      <div className="flex flex-col gap-3 pt-4">
        {trashedCards.length === 0 ? (
          <TrashEmptyState />
        ) : (
          <AnimatePresence>
            {trashedCards.map((card) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                style={{ overflow: "hidden" }}
              >
                <TrashCardRow
                  card={card}
                  onRestore={() => onRestore(card.id)}
                  onExpunge={() => setExpungeTarget(card)}
                  expungeTriggerRef={getExpungeTriggerRef(card.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Expunge single card dialog */}
      <ExpungeDialog
        card={expungeTarget}
        onConfirm={handleExpungeConfirm}
        onCancel={handleExpungeCancel}
        triggerRef={
          expungeTarget
            ? getExpungeTriggerRef(expungeTarget.id)
            : { current: null }
        }
      />

      {/* Empty Trash dialog */}
      <EmptyTrashDialog
        open={emptyDialogOpen}
        count={trashedCards.length}
        onConfirm={handleEmptyConfirm}
        onCancel={handleEmptyCancel}
        triggerRef={emptyTrashBtnRef}
      />
    </div>
  );
}
