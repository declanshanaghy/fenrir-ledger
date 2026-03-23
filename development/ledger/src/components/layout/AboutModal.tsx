"use client";

/**
 * AboutModal — triggered by clicking the Fenrir logo in the TopBar.
 *
 * Dismiss by: clicking the X button, clicking outside, or the Close button.
 * Layout: 2-column on desktop (logo left, content right).
 *         On mobile: left column collapses into header; content fills full width.
 */

import { useEffect, useState } from "react";
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

const GITHUB_REPO = "https://github.com/declanshanaghy/fenrir-ledger";

const ROMAN = ["I", "II", "III", "IV", "V", "VI"] as const;

const TEAM = [
  {
    name: "Freya",
    role: "Product Owner",
    rune: "ᚠ",
    voice: "She decides what the wolf hunts next.",
  },
  {
    name: "Luna",
    role: "UX Designer",
    rune: "ᛚ",
    voice: "She shapes the shadows where the wolf walks.",
  },
  {
    name: "FiremanDecko",
    role: "Principal Engineer",
    rune: "ᚦ",
    voice: "He forged the chain. Then taught the wolf to wear it.",
  },
  {
    name: "Loki",
    role: "QA",
    rune: "ᛏ",
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

/** Reads all 6 Gleipnir fragment keys from localStorage on mount.
 *  Safe in SSR and private-mode environments — returns all-false on error. */
export function useGleipnirFragments(): { found: boolean[] } {
  const [found, setFound] = useState<boolean[]>([
    false, false, false, false, false, false,
  ]);

  useEffect(() => {
    try {
      const states = Array.from({ length: 6 }, (_, i) =>
        localStorage.getItem(`egg:gleipnir-${i + 1}`) === "1"
      );
      setFound(states);
    } catch {
      // localStorage unavailable (SSR, private mode) — keep all false
    }
  }, []);

  return { found };
}

function BuildInfo() {
  const rawCommit = process.env.NEXT_PUBLIC_APP_VERSION ?? "";
  const sha = rawCommit.slice(0, 7) || "unknown";
  const buildDate = process.env.NEXT_PUBLIC_BUILD_DATE ?? "";
  const env = process.env.NEXT_PUBLIC_ENV ?? process.env.NODE_ENV ?? "unknown";

  const formattedDate = buildDate
    ? new Date(buildDate).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "unknown";

  return (
    <div
      className="mt-2 flex flex-col gap-0.5 text-[11px] font-mono text-muted-foreground/60 w-full"
      data-testid="build-info"
    >
      {sha !== "unknown" ? (
        <span>
          <span className="text-muted-foreground/40">commit </span>
          <a
            href={`${GITHUB_REPO}/commit/${rawCommit}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gold transition-colors"
            title={rawCommit}
            data-testid="build-info-commit"
          >
            {sha}
          </a>
        </span>
      ) : (
        <span data-testid="build-info-commit">
          <span className="text-muted-foreground/40">commit </span>{sha}
        </span>
      )}
      <span data-testid="build-info-date">
        <span className="text-muted-foreground/40">built </span>{formattedDate}
      </span>
      <span
        className="capitalize"
        data-testid="build-info-env"
      >
        <span className="text-muted-foreground/40 normal-case">env </span>{env}
      </span>
    </div>
  );
}

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

  const { found } = useGleipnirFragments();
  const foundCount = found.filter(Boolean).length;
  const allFound = foundCount === 6;

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
        <div className="flex items-center gap-3 px-5 py-3 pr-10 border-b border-border shrink-0">
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
        <div className="flex flex-col md:grid md:grid-cols-[190px_1px_1fr] flex-1 overflow-hidden">

          {/* Left — logo / identity (desktop only) */}
          <div className="hidden md:flex flex-col items-center justify-center gap-3 px-5 py-6 text-center shrink-0">
            <span className="text-5xl text-gold leading-none" aria-hidden="true">
              ᛟ
            </span>
            <div>
              <p className="font-display text-gold tracking-widest uppercase text-sm">
                Fenrir Ledger
              </p>
              <p className="font-body text-muted-foreground text-xs italic mt-1">
                Break free. Harvest every reward.
              </p>
            </div>
            <p className="font-body text-muted-foreground text-[11px] italic leading-relaxed max-w-[150px]">
              &ldquo;The wolf watches what the issuers hope you forget.&rdquo;
            </p>

            {/* Build info — subtle, small, muted */}
            <BuildInfo />
          </div>

          {/* Vertical divider — desktop only */}
          <div className="hidden md:block border-l border-border" aria-hidden="true" />

          {/* Right — team & ingredients (scrollable) */}
          <div className="flex flex-col overflow-y-auto px-5 py-4 gap-0">

            {/* The Pack */}
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
              The Pack
            </p>
            <div className="flex flex-col gap-2 mb-4" data-testid="pack-list">
              {TEAM.map((member) => (
                <div key={member.name} className="flex items-start gap-2.5">
                  {/* Profile icon — 32×32 themed rune circle */}
                  <div
                    className="w-8 h-8 md:w-8 md:h-8 rounded-full border border-gold/40 flex items-center justify-center text-gold font-mono text-sm shrink-0 mt-0.5"
                    aria-hidden="true"
                    data-testid={`pack-icon-${member.name.toLowerCase()}`}
                  >
                    {member.rune}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="font-heading text-[11px] font-bold uppercase tracking-wide text-primary">
                        {member.name}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {member.role}
                      </span>
                    </div>
                    <p
                      className="font-body text-[11px] italic text-muted-foreground leading-snug mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis"
                      title={`"${member.voice}"`}
                    >
                      &ldquo;{member.voice}&rdquo;
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Separator */}
            <div className="border-t border-border mb-4" aria-hidden="true" />

            {/* Six Impossible Things */}
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
              Gleipnir was made of:
            </p>
            <ol className="flex flex-col gap-1.5 list-none" data-testid="gleipnir-list">
              {INGREDIENTS.map((ingredient, i) => {
                const isFound = found[i];
                return (
                  <li key={i} className="flex items-center gap-2.5">
                    {/* Roman numeral — gold at full brightness when found, muted when not */}
                    <span
                      className={`font-mono text-[11px] shrink-0 w-5 text-right ${
                        isFound ? "text-gold" : "text-gold/40"
                      }`}
                    >
                      {ROMAN[i]}
                    </span>

                    {/* Status indicator — 14×14px */}
                    <span
                      className={`font-mono text-[11px] shrink-0 leading-none ${
                        isFound ? "text-gold" : "text-muted-foreground/50"
                      }`}
                      aria-label={`fragment ${i + 1} ${isFound ? "found" : "not yet found"}`}
                      data-testid={`gleipnir-status-${i + 1}`}
                    >
                      {isFound ? "✓" : "ᛜ"}
                    </span>

                    {/* Ingredient text */}
                    {i === 1 ? (
                      /* Gleipnir fragment II — The Beard of a Woman.
                       * cursor-default hides the affordance; the wolf rewards curiosity. */
                      <button
                        type="button"
                        onClick={triggerBeard}
                        aria-label="The beard of a woman — easter egg trigger"
                        className={`font-body text-[12px] leading-snug bg-transparent border-0 p-0 text-left cursor-default transition-colors ${
                          isFound
                            ? "text-foreground"
                            : "text-foreground/35 italic"
                        }`}
                        style={{ cursor: "default" }}
                      >
                        {ingredient}
                      </button>
                    ) : (
                      <span
                        className={`font-body text-[12px] leading-snug ${
                          isFound
                            ? "text-foreground"
                            : "text-foreground/35 italic"
                        }`}
                      >
                        {ingredient}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>

            {/* Fragment progress counter */}
            <div className="mt-2 font-mono text-[10px] text-muted-foreground/60" data-testid="gleipnir-progress">
              <span>{foundCount} of 6 fragments found</span>
              {allFound && (
                <span
                  className="block text-gold animate-pulse mt-0.5"
                  data-testid="gleipnir-complete"
                >
                  ✦ Gleipnir is complete. The wolf stirs.
                </span>
              )}
            </div>

            {/* Separator */}
            <div className="border-t border-border mt-4 mb-4" aria-hidden="true" />

            {/* Wolf's Hunger — aggregate bonus summary */}
            <WolfHungerMeter />

          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <div className="flex justify-end px-5 py-2.5 border-t border-border shrink-0">
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
