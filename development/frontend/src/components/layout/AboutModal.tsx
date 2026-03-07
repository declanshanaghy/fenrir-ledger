"use client";

/**
 * AboutModal — triggered by clicking the Fenrir logo in the TopBar.
 *
 * Dismiss by: clicking the X button, clicking outside, or the Close button.
 * Layout: 2-column on desktop (logo left, content right).
 *         On mobile: left column collapses into header; content fills full width.
 */

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  GleipnirWomansBeard,
  useGleipnirFragment2,
} from "@/components/cards/GleipnirWomansBeard";
import { WolfHungerMeter } from "@/components/shared/WolfHungerMeter";

const ROMAN = ["I", "II", "III", "IV", "V", "VI"] as const;

const TEAM = [
  {
    name: "Freya",
    role: "Product Owner",
    voice: "She decides what the wolf hunts next.",
  },
  {
    name: "Luna",
    role: "UX Designer",
    voice: "She shapes the shadows where the wolf walks.",
  },
  {
    name: "FiremanDecko",
    role: "Principal Engineer",
    voice: "He forged the chain. Then taught the wolf to wear it willingly.",
  },
  {
    name: "Loki",
    role: "QA",
    voice: "He tests every lock. He is, after all, the reason locks exist.",
  },
] as const;

const INGREDIENTS = [
  "The sound of a cat's footfall",
  "The beard of a woman",
  "The roots of a mountain",
  "The sinews of a bear",
  "The breath of a fish",
  "The spittle of a bird",
] as const;

interface AboutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutModal({ open, onOpenChange }: AboutModalProps) {
  const {
    open: beardOpen,
    trigger: triggerBeard,
    dismiss: dismissBeard,
  } = useGleipnirFragment2();

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
       * Override DialogContent defaults via tailwind-merge:
       *   max-w-[680px] overrides max-w-lg
       *   p-0 gap-0 override p-6 gap-4
       *   flex flex-col overrides grid
       *   max-h-[90vh] + overflow-hidden enables inner scrolling
       */}
      <DialogContent className="w-[92vw] max-w-[680px] p-0 gap-0 flex flex-col max-h-[90vh] overflow-hidden">

        {/* ── Header ────────────────────────────────────────────────── */}
        {/* pr-10 keeps title clear of the built-in X close button      */}
        <div className="flex items-center gap-3 px-5 py-3.5 pr-10 border-b border-border shrink-0">
          {/* Rune: visible only on mobile where the left column is hidden */}
          <span className="text-2xl text-gold leading-none md:hidden" aria-hidden="true">
            ᛟ
          </span>
          <DialogTitle className="font-heading text-sm font-bold uppercase tracking-[0.14em] text-gold">
            About Fenrir Ledger
          </DialogTitle>
        </div>

        {/* Accessible description — screen readers only */}
        <DialogDescription className="sr-only">
          The Fenrir Ledger team and the six impossible things woven into
          Gleipnir — the chain that bound the great wolf.
        </DialogDescription>

        {/* ── Two-column body ───────────────────────────────────────── */}
        <div className="flex flex-col md:grid md:grid-cols-[200px_1px_1fr] flex-1 overflow-hidden">

          {/* Left — logo / identity (desktop only) */}
          <div className="hidden md:flex flex-col items-center justify-center gap-4 px-6 py-8 text-center shrink-0">
            <span className="text-6xl text-gold leading-none" aria-hidden="true">
              ᛟ
            </span>
            <div>
              <p className="font-display text-gold tracking-widest uppercase text-base">
                Fenrir Ledger
              </p>
              <p className="font-body text-muted-foreground text-sm italic mt-1">
                Break free. Harvest every reward.
              </p>
            </div>
            <p className="font-body text-muted-foreground text-[13px] italic leading-relaxed max-w-[160px]">
              &ldquo;The wolf watches what the issuers hope you forget.&rdquo;
            </p>
          </div>

          {/* Vertical divider — desktop only */}
          <div className="hidden md:block border-l border-border" aria-hidden="true" />

          {/* Right — team & ingredients (scrollable) */}
          <div className="flex flex-col overflow-y-auto px-5 py-5 gap-0">

            {/* The Pack */}
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">
              The Pack
            </p>
            <div className="flex flex-col gap-3.5 mb-5">
              {TEAM.map((member) => (
                <div key={member.name}>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-heading text-sm font-bold uppercase tracking-wide text-primary">
                      {member.name}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {member.role}
                    </span>
                  </div>
                  <p className="font-body text-base italic text-muted-foreground leading-snug mt-0.5">
                    &ldquo;{member.voice}&rdquo;
                  </p>
                </div>
              ))}
            </div>

            {/* Separator */}
            <div className="border-t border-border mb-5" aria-hidden="true" />

            {/* Six Impossible Things */}
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">
              Gleipnir was made of:
            </p>
            <ol className="flex flex-col gap-2 list-none">
              {INGREDIENTS.map((ingredient, i) => (
                <li key={i} className="flex items-baseline gap-3">
                  <span className="font-mono text-xs text-gold shrink-0 w-5 text-right">
                    {ROMAN[i]}
                  </span>
                  {i === 1 ? (
                    /* Gleipnir fragment II — The Beard of a Woman.
                     * Intentionally indistinguishable from the surrounding text.
                     * cursor-default hides the affordance; the wolf rewards curiosity. */
                    <button
                      type="button"
                      onClick={triggerBeard}
                      className="font-body text-base text-foreground leading-snug bg-transparent border-0 p-0 text-left cursor-default hover:text-gold transition-colors"
                    >
                      {ingredient}
                    </button>
                  ) : (
                    <span className="font-body text-base text-foreground leading-snug">
                      {ingredient}
                    </span>
                  )}
                </li>
              ))}
            </ol>

            {/* Separator */}
            <div className="border-t border-border mt-5 mb-5" aria-hidden="true" />

            {/* Wolf's Hunger — aggregate bonus summary */}
            <WolfHungerMeter />

          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <div className="flex justify-end px-5 py-3 border-t border-border shrink-0">
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              Close
            </Button>
          </DialogClose>
        </div>

      </DialogContent>
    </Dialog>

    {/* Gleipnir fragment II — rendered outside the About Dialog to avoid
        stacking context conflicts. Opens on top of the About modal (z-index 9653). */}
    <GleipnirWomansBeard open={beardOpen} onClose={dismissBeard} />
    </>
  );
}
