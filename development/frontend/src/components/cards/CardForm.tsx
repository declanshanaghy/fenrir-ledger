"use client";

/**
 * CardForm — shared form for adding and editing credit cards.
 *
 * Used by both /cards/new and /cards/[id]/edit.
 * Uses react-hook-form + Zod for validation.
 * All money values are entered as dollars in the form but stored as cents.
 *
 * Sprint 3.1: householdId is now a required prop derived from the authenticated
 * session. The form no longer uses the hardcoded DEFAULT_HOUSEHOLD_ID constant.
 *
 * Issue #188: Refactored into 2-step wizard for new cards.
 * Edit mode bypasses wizard and shows all fields on single page.
 *
 * Issue #1682: Decomposed into useCardForm hook + step/action sub-components
 * to reduce cyclomatic complexity from 49 → <15.
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import type { Card } from "@/lib/types";
import { GleipnirBearSinews } from "@/components/cards/GleipnirBearSinews";

import { useCardForm } from "./useCardForm";
import { CardFormStep1 } from "./CardFormStep1";
import { CardFormStep2 } from "./CardFormStep2";
import { CardFormEditFields } from "./CardFormEditFields";
import { CardFormActions } from "./CardFormActions";

// ─── Animation constants ──────────────────────────────────────────────────────

const STEP_TRANSITION_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const stepVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir < 0 ? "30%" : "-30%", opacity: 0 }),
};

// ─── Component ────────────────────────────────────────────────────────────────

interface CardFormProps {
  /** If provided, the form is in edit mode with these initial values */
  initialValues?: Card;
  /**
   * The authenticated user's household ID (Google sub claim).
   * Required for all storage operations — must be derived from the session
   * by the parent page and passed down.
   */
  householdId: string;
}

export function CardForm({ initialValues, householdId }: CardFormProps) {
  const prefersReducedMotion = useReducedMotion();

  const {
    register,
    handleSubmit,
    setValue,
    errors,
    defaultValues,
    issuerId,
    creditLimit,
    bonusType,
    bonusSpendRequirement,
    bonusMet,
    currentStep,
    direction,
    goToStep,
    handleMoreDetails,
    onSubmit,
    handleDelete,
    handleClose,
    scrollToFirstError,
    deleteDialogOpen,
    setDeleteDialogOpen,
    closeDialogOpen,
    setCloseDialogOpen,
    isEditMode,
    isSubmitting,
    bearOpen,
    dismissBear,
  } = useCardForm({ initialValues, householdId });

  const stepTransition = prefersReducedMotion
    ? { duration: 0 }
    : {
        x: { duration: 0.25, ease: STEP_TRANSITION_EASE },
        opacity: { duration: 0.2 },
      };

  const sharedStepProps = { register, setValue, errors };

  return (
    <>
      <form
        onSubmit={handleSubmit(onSubmit, scrollToFirstError)}
        className="space-y-4"
      >
        {/* Step indicator — new cards only */}
        {!isEditMode && (
          <StepIndicator
            currentStep={currentStep}
            prefersReducedMotion={!!prefersReducedMotion}
            stepTransitionEase={STEP_TRANSITION_EASE}
            onAdvance={handleMoreDetails}
            onBack={() => goToStep(1)}
          />
        )}

        {/* Wizard mode — animated step content */}
        {!isEditMode && (
          <div className="overflow-hidden">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              {currentStep === 1 && (
                <motion.div
                  key="wizard-step-1"
                  custom={direction}
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={stepTransition}
                  className="space-y-4"
                >
                  <CardFormStep1
                    {...sharedStepProps}
                    issuerId={issuerId}
                    bonusType={bonusType}
                    bonusSpendRequirement={bonusSpendRequirement}
                    bonusMet={bonusMet ?? false}
                  />
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div
                  key="wizard-step-2"
                  custom={direction}
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={stepTransition}
                  className="space-y-4"
                >
                  <CardFormStep2
                    {...sharedStepProps}
                    creditLimit={creditLimit}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Edit mode — all fields, no animation */}
        {isEditMode && (
          <CardFormEditFields
            {...sharedStepProps}
            issuerId={issuerId}
            bonusType={bonusType}
            bonusSpendRequirement={bonusSpendRequirement}
            bonusMet={bonusMet ?? false}
            defaultStatus={defaultValues.status}
          />
        )}

        <CardFormActions
          isEditMode={isEditMode}
          isSubmitting={isSubmitting}
          currentStep={currentStep}
          initialValues={initialValues}
          deleteDialogOpen={deleteDialogOpen}
          setDeleteDialogOpen={setDeleteDialogOpen}
          closeDialogOpen={closeDialogOpen}
          setCloseDialogOpen={setCloseDialogOpen}
          onDelete={handleDelete}
          onClose={handleClose}
          onMoreDetails={handleMoreDetails}
          onGoBack={() => goToStep(1)}
        />
      </form>

      <GleipnirBearSinews open={bearOpen} onClose={dismissBear} />
    </>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

interface StepIndicatorProps {
  currentStep: 1 | 2;
  prefersReducedMotion: boolean;
  stepTransitionEase: [number, number, number, number];
  onAdvance: () => void;
  onBack: () => void;
}

function StepIndicator({
  currentStep,
  prefersReducedMotion,
  stepTransitionEase,
  onAdvance,
  onBack,
}: StepIndicatorProps) {
  const steps = [
    { step: 1 as const, title: "Card and Bonus Details" },
    { step: 2 as const, title: "Additional Information" },
  ];

  return (
    <nav role="tablist" aria-label="Card creation progress">
      <div className="flex items-center justify-center gap-4 py-4">
        {steps.map(({ step, title }) => {
          const isActive = currentStep === step;
          return (
            <button
              key={step}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`Step ${step} of 2: ${title}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => {
                if (step === 2 && currentStep === 1) onAdvance();
                else if (step === 1 && currentStep === 2) onBack();
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" && step === 1) {
                  e.preventDefault();
                  onAdvance();
                } else if (e.key === "ArrowLeft" && step === 2) {
                  e.preventDefault();
                  onBack();
                }
              }}
              className="relative w-11 h-11 flex items-center justify-center cursor-pointer focus:outline-none group"
            >
              <motion.div
                className={`w-2.5 h-2.5 rounded-full border-2 ${
                  isActive
                    ? "bg-gold border-gold"
                    : "bg-transparent border-muted-foreground"
                }`}
                animate={{ scale: isActive ? [1, 0.9, 1.2, 1] : 1 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : {
                        scale: {
                          duration: 0.3,
                          ease: stepTransitionEase,
                          times: [0, 0.3, 0.6, 1],
                        },
                      }
                }
              />
              <span className="absolute inset-0 rounded-full group-focus-visible:ring-2 group-focus-visible:ring-gold/40 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background" />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
