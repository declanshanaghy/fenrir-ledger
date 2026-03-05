"use client";

/**
 * UnlinkConfirmDialog — Fenrir Ledger
 *
 * Confirmation dialog for unlinking the Patreon account.
 * Uses role="alertdialog" because this is a consequential action.
 *
 * Wireframe reference: designs/ux-design/wireframes/patreon-subscription/unlink-confirmation.html
 *
 * Key design decisions (from wireframe):
 *   - All copy is Voice 1 (functional, plain English) — no Norse
 *   - Two consequences stated clearly:
 *     1. Premium features are locked
 *     2. Patreon membership continues on Patreon
 *   - Button layout: [Cancel] [Unlink Patreon]
 *   - Mobile: buttons stack vertically, full-width
 *   - Escape dismisses (same as Cancel)
 *
 * @module entitlement/UnlinkConfirmDialog
 */

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface UnlinkConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when the dialog is closed without unlinking */
  onCancel: () => void;
  /** Callback when the user confirms the unlink action */
  onConfirm: () => void;
  /** Whether the unlink operation is in progress */
  isUnlinking?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Confirmation dialog for disconnecting Patreon from Fenrir Ledger.
 *
 * @param props - Open state, cancel/confirm callbacks, loading state
 */
export function UnlinkConfirmDialog({
  open,
  onCancel,
  onConfirm,
  isUnlinking = false,
}: UnlinkConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent
        className="w-[92vw] max-w-[440px] border-2 border-border bg-background p-0 gap-0"
        role="alertdialog"
        aria-labelledby="unlink-heading"
        aria-describedby="unlink-body"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
          <DialogTitle
            id="unlink-heading"
            className="text-lg font-heading font-bold text-saga"
          >
            Unlink Patreon?
          </DialogTitle>
        </div>

        {/* Body */}
        <DialogDescription asChild>
          <div id="unlink-body" className="px-5 py-4 flex flex-col gap-3">
            <p className="text-sm text-saga/90 leading-relaxed font-body">
              Your Patreon account will be disconnected from Fenrir Ledger.
              You will lose access to premium features, but your card data
              will not be affected.
            </p>
            <p className="text-sm text-saga/90 leading-relaxed font-body">
              If you have an active Patreon membership, it will continue on
              Patreon until you cancel it there.
            </p>
          </div>
        </DialogDescription>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 px-5 pt-3 pb-4 border-t border-border">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isUnlinking}
            className="min-h-[44px] sm:min-h-[40px] w-full sm:w-auto font-heading"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isUnlinking}
            className="min-h-[44px] sm:min-h-[40px] w-full sm:w-auto font-heading border-2 border-destructive"
          >
            {isUnlinking ? "Unlinking..." : "Unlink Patreon"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
