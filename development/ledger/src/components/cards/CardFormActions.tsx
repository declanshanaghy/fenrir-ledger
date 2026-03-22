"use client";

/**
 * CardFormActions — action buttons + destructive dialogs for CardForm.
 *
 * Renders:
 *  - Left slot (edit mode only): Close Card dialog + Delete card dialog
 *  - Right slot: Cancel + wizard/edit-mode submit buttons
 *
 * Issue #1682: extracted from CardForm.tsx to reduce cyclomatic complexity.
 */

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import type { Card } from "@/lib/types";

interface CardFormActionsProps {
  isEditMode: boolean;
  isSubmitting: boolean;
  currentStep: 1 | 2;
  initialValues?: Card;
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: (open: boolean) => void;
  closeDialogOpen: boolean;
  setCloseDialogOpen: (open: boolean) => void;
  onDelete: () => void;
  onClose: (markBonusMet?: boolean) => void;
  onMoreDetails: () => void;
  onGoBack: () => void;
}

export function CardFormActions({
  isEditMode,
  isSubmitting,
  currentStep,
  initialValues,
  deleteDialogOpen,
  setDeleteDialogOpen,
  closeDialogOpen,
  setCloseDialogOpen,
  onDelete,
  onClose,
  onMoreDetails,
  onGoBack,
}: CardFormActionsProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-3 pt-2 md:flex-row md:items-center">
      {/* Left slot — destructive actions (edit mode only) */}
      <div className="flex gap-2">
        {isEditMode && initialValues?.status !== "closed" && (
          <div className="flex gap-2">
            <CloseCardDialog
              cardName={initialValues?.cardName}
              hasUnmetBonus={
                !!(initialValues?.signUpBonus && !initialValues.signUpBonus.met)
              }
              open={closeDialogOpen}
              onOpenChange={setCloseDialogOpen}
              onClose={onClose}
            />
            <DeleteCardDialog
              cardName={initialValues?.cardName}
              open={deleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
              onDelete={onDelete}
            />
          </div>
        )}

        {isEditMode && initialValues?.status === "closed" && (
          <DeleteCardDialog
            cardName={initialValues?.cardName}
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            onDelete={onDelete}
          />
        )}
      </div>

      {/* Right slot — Cancel + primary action */}
      <div className="flex flex-col gap-2 md:flex-row md:gap-3 md:ml-auto">
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px]"
          onClick={() => router.push("/ledger")}
        >
          Cancel
        </Button>

        {!isEditMode && currentStep === 1 && (
          <>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              onClick={onMoreDetails}
            >
              More Details
            </Button>
            <Button
              type="submit"
              className="min-h-[44px]"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              loadingText="Saving..."
            >
              Save Card
            </Button>
          </>
        )}

        {!isEditMode && currentStep === 2 && (
          <>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              onClick={onGoBack}
            >
              Back
            </Button>
            <Button
              type="submit"
              className="min-h-[44px]"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              loadingText="Saving..."
            >
              Save Card
            </Button>
          </>
        )}

        {isEditMode && (
          <Button
            type="submit"
            className="min-h-[44px]"
            disabled={isSubmitting}
            isLoading={isSubmitting}
            loadingText="Saving..."
          >
            Save changes
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface CloseCardDialogProps {
  cardName?: string;
  hasUnmetBonus: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: (markBonusMet?: boolean) => void;
}

function CloseCardDialog({
  cardName,
  hasUnmetBonus,
  open,
  onOpenChange,
  onClose,
}: CloseCardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="min-h-[44px]">
          Close Card
        </Button>
      </DialogTrigger>
      <DialogContent>
        {hasUnmetBonus ? (
          <>
            <DialogHeader>
              <DialogTitle>Has the minimum spend been met?</DialogTitle>
              <DialogDescription>
                <strong>{cardName}</strong> has a sign-up bonus that hasn&apos;t
                been marked as met. Has the minimum spend requirement been met?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="default" onClick={() => onClose(false)}>
                No, close card
              </Button>
              <Button variant="default" onClick={() => onClose(true)}>
                Yes, mark as met
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Close this card?</DialogTitle>
              <DialogDescription>
                <strong>{cardName}</strong> will be moved to Valhalla. Its
                record and rewards will be preserved.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="default" onClick={() => onClose()}>
                Close Card
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface DeleteCardDialogProps {
  cardName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
}

function DeleteCardDialog({
  cardName,
  open,
  onOpenChange,
  onDelete,
}: DeleteCardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="min-h-[44px]"
        >
          Delete card
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this card?</DialogTitle>
          <DialogDescription>
            This will permanently remove <strong>{cardName}</strong> from your
            portfolio. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
