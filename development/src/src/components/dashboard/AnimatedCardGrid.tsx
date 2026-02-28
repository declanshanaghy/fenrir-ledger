"use client";

/**
 * AnimatedCardGrid — Framer Motion wrapper for the dashboard card grid.
 *
 * Implements two animations from ux/interactions.md:
 *
 * 1. saga-enter stagger (page load)
 *    Each card animates in from opacity:0 + y:20 → opacity:1 + y:0.
 *    Cards stagger by index * 0.07s, up to a max delay cap so large
 *    portfolios do not feel sluggish.
 *    Timing: duration 0.4s, easing cubic-bezier(0.16, 1, 0.3, 1) (expo-out).
 *
 * 2. AnimatePresence card exit (delete / close)
 *    When a card is removed from the list, it animates out before unmounting.
 *    Exit: opacity:0, y:24, scale:0.95, sepia(1) brightness(0.4).
 *    Timing: duration 0.5s, ease-in ("descends to Valhalla").
 *
 * Implementation pattern:
 *    Per-card variant factory (makeCardVariants) builds a variant object where
 *    each state ("hidden" / "visible" / "exit") embeds its own `transition`.
 *    This is the Framer Motion-idiomatic way to have different durations and
 *    easings for enter vs exit on the same element.
 *
 * This component must live in a "use client" boundary because it uses
 * Framer Motion (per ADR-001 — client components for state-driven animations).
 */

import { AnimatePresence, motion, type Variants } from "framer-motion";
import type { Card } from "@/lib/types";

interface AnimatedCardGridProps {
  /** Ordered list of cards to display. */
  cards: Card[];
  /**
   * Render function for each card. Receives the card object and returns a
   * React node. Framer Motion wraps the output — do not add a motion.div
   * inside the render function.
   */
  renderCard: (card: Card) => React.ReactNode;
}

/** Maximum stagger delay (seconds) so large portfolios stay snappy. */
const MAX_STAGGER_DELAY_S = 0.56; // 8 cards × 0.07 s

/**
 * Expo-out easing vector — matches the saga-enter CSS timing function
 * in globals.css: cubic-bezier(0.16, 1, 0.3, 1).
 */
const EXPO_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Returns a Framer Motion Variants object for a single card.
 *
 * Each state embeds its own `transition` so enter and exit can have different
 * durations/easings on the same element.
 *
 * @param staggerDelay - Entrance delay in seconds (index * 0.07, capped).
 */
function makeCardVariants(staggerDelay: number): Variants {
  return {
    hidden: {
      opacity: 0,
      y: 20,
      scale: 1,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.4,
        delay: staggerDelay,
        ease: EXPO_OUT,
      },
    },
    exit: {
      opacity: 0,
      y: 24,
      scale: 0.95,
      // filter is an animatable CSS property Framer Motion forwards to the
      // element's inline style; the value is a valid CSS filter string.
      filter: "sepia(1) brightness(0.4)",
      transition: {
        duration: 0.5,
        ease: "easeIn",
      },
    },
  };
}

/**
 * AnimatedCardGrid renders the responsive card grid with Framer Motion
 * entrance stagger and exit animations.
 */
export function AnimatedCardGrid({ cards, renderCard }: AnimatedCardGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <AnimatePresence initial={true} mode="popLayout">
        {cards.map((card, index) => {
          const staggerDelay = Math.min(index * 0.07, MAX_STAGGER_DELAY_S);
          const variants = makeCardVariants(staggerDelay);

          return (
            <motion.div
              key={card.id}
              layout
              variants={variants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {renderCard(card)}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
