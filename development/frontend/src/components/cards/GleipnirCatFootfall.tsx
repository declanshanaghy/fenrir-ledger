"use client";

/**
 * GleipnirCatFootfall — Gleipnir Fragment 1 of 6
 *
 * Shown when the user discovers: "The Sound of a Cat's Footfall"
 * One of the six impossible things woven into Gleipnir — the ribbon that bound Fenrir.
 *
 * Trigger:  See design/easter-eggs.md #1 — The Gleipnir Hunt
 * Storage:  localStorage key "egg:gleipnir-1"
 * Image:    /easter-eggs/gleipnir-1.svg
 * z-index:  9653 (W-O-L-F on a phone keypad)
 */

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics/track";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "egg:gleipnir-1";
const TOTAL_FRAGMENTS = 6;

interface GleipnirCatFootfallProps {
  /** Control open state externally (e.g. from the trigger site). */
  open: boolean;
  onClose: () => void;
}

export function GleipnirCatFootfall({ open, onClose }: GleipnirCatFootfallProps) {
  const [found, setFound] = useState(0);

  useEffect(() => {
    if (open) {
      // Mark this fragment found
      localStorage.setItem(STORAGE_KEY, "1");

      // Count total found
      const count = Array.from({ length: TOTAL_FRAGMENTS }, (_, i) =>
        localStorage.getItem(`egg:gleipnir-${i + 1}`)
      ).filter(Boolean).length;
      setFound(count);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      {/*
       * Overrides: w-[92vw] max-w-[680px] override Dialog defaults.
       * p-0 gap-0 override p-6 gap-4.
       * z-index 9653 = W-O-L-F on a phone keypad (see copywriting.md Magic Numbers).
       */}
      <DialogContent
        className="w-[92vw] max-w-[680px] p-0 gap-0 flex flex-col
                   bg-[hsl(var(--egg-bg))] border border-[hsl(var(--egg-border))]
                   [&>button]:text-[hsl(var(--egg-text-muted))] [&>button]:hover:text-[hsl(var(--egg-text))]"
        style={{ zIndex: 9653 }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        {/* pr-10 clears the built-in X button */}
        <div className="px-6 pt-5 pb-4 pr-10 text-center border-b border-[hsl(var(--egg-border))]">
          <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--egg-accent))] mb-2">
            <span aria-hidden="true">ᚠ ᛖ ᚾ ᚱ</span>
            {" · "}Easter Egg Discovered{" · "}
            <span aria-hidden="true">ᛁ ᚱ ᛊ</span>
          </p>

          <DialogTitle className="font-display text-[clamp(1.1rem,3.5vw,1.6rem)] font-bold text-[hsl(var(--egg-title))] leading-tight">
            The Sound of a Cat&apos;s Footfall
          </DialogTitle>
        </div>

        {/* Accessible description */}
        <DialogDescription className="sr-only">
          You have found Gleipnir fragment 1 of 6: The Sound of a Cat&apos;s Footfall.
          One of the six impossible things woven into the ribbon that bound the great wolf.
        </DialogDescription>

        {/* ── Two-column body ─────────────────────────────────────────── */}
        {/*
         * Desktop: image left | divider | text right
         * Mobile:  stacked (image top, text bottom)
         */}
        <div className="flex flex-col md:grid md:grid-cols-[1fr_1px_1fr] bg-[hsl(var(--egg-bg-body))]">

          {/* Left — artifact image (SVG served from /public/easter-eggs/) */}
          <div className="flex items-center justify-center p-6 md:p-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/easter-eggs/gleipnir-1.svg"
              alt="The Sound of a Cat's Footfall — Gleipnir artifact"
              className="w-full max-w-[200px] md:max-w-[240px] aspect-square object-contain"
            />
          </div>

          {/* Vertical divider — desktop only */}
          <div
            className="hidden md:block"
            style={{
              background:
                "linear-gradient(to bottom, transparent, hsl(var(--egg-border)) 20%, hsl(var(--egg-border)) 80%, transparent)",
            }}
            aria-hidden="true"
          />

          {/* Right — discovery text */}
          <div className="flex flex-col justify-center gap-3 px-6 py-6 md:px-8">
            <p className="font-body text-base text-[hsl(var(--egg-text))] leading-relaxed">
              One of the six impossible things woven into{" "}
              <span className="text-[hsl(var(--egg-title))] italic">Gleipnir</span> — the only
              chain strong enough to bind the great wolf. Though it looks like silk
              ribbon, no chain is stronger.
            </p>

            <p className="font-body text-sm italic text-[hsl(var(--egg-text-muted))] leading-relaxed">
              &ldquo;The dwarves of Svartálfaheimr gathered six things that do not
              exist. From these they wove Gleipnir. When Fenrir felt its touch, he
              knew at last what true binding was.&rdquo;
            </p>

            <div className="border-t border-[hsl(var(--egg-border))] pt-3 mt-1">
              <p className="font-mono text-[0.7rem] text-[hsl(var(--egg-accent))]">
                Fragment {found} of {TOTAL_FRAGMENTS} found
              </p>
              {found === TOTAL_FRAGMENTS && (
                <p className="font-mono text-[0.65rem] text-[hsl(var(--egg-title))] mt-1 animate-pulse">
                  ✦ Gleipnir is complete. The wolf stirs.
                </p>
              )}
            </div>
          </div>

        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="flex justify-center px-6 py-4 border-t border-[hsl(var(--egg-border))]">
          <DialogClose asChild>
            <Button
              className="px-10 font-heading text-base font-semibold tracking-widest uppercase
                         bg-[hsl(var(--egg-btn-bg))] text-[hsl(var(--egg-btn-text))] hover:bg-[hsl(var(--egg-btn-hover))]
                         rounded-none min-h-[44px]"
            >
              OK
            </Button>
          </DialogClose>
        </div>

      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook — wire this at the trigger site.
 *
 * Usage:
 *   const { open, trigger, dismiss } = useGleipnirFragment1();
 *   // Call trigger() when the hidden ingredient text is discovered.
 *   // Render: <GleipnirCatFootfall open={open} onClose={dismiss} />
 *
 * Audio: plays /sounds/fenrir-growl.mp3 with fade-in on discovery and fade-out
 * on dismiss. The Audio constructor is called inside trigger() — the direct
 * user-gesture handler — so browsers permit playback without an autoplay
 * policy violation.
 */

const HOWL_TARGET_VOLUME = 0.25; // max volume during playback
const FADE_STEP_MS = 40;         // interval between volume steps

function fadeIn(audio: HTMLAudioElement) {
  audio.volume = 0;
  const step = HOWL_TARGET_VOLUME / (500 / FADE_STEP_MS); // reach target in ~500ms
  const id = setInterval(() => {
    const next = Math.min(audio.volume + step, HOWL_TARGET_VOLUME);
    audio.volume = next;
    if (next >= HOWL_TARGET_VOLUME) clearInterval(id);
  }, FADE_STEP_MS);
}

function fadeOut(audio: HTMLAudioElement, onDone: () => void) {
  const step = audio.volume / (600 / FADE_STEP_MS); // reach 0 in ~600ms
  const id = setInterval(() => {
    const next = Math.max(audio.volume - step, 0);
    audio.volume = next;
    if (next <= 0) {
      clearInterval(id);
      audio.pause();
      audio.currentTime = 0;
      onDone();
    }
  }, FADE_STEP_MS);
}

export function useGleipnirFragment1() {
  const [open, setOpen] = useState(false);
  const howlRef = useRef<HTMLAudioElement | null>(null);

  function trigger() {
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, "1");
      track("easter-egg", { fragment: 1, name: "cats-footfall" });
      setOpen(true);

      // Play within the user-gesture call stack so browsers allow it.
      try {
        const howl = new Audio("/sounds/fenrir-growl.mp3");
        howl.volume = 0;
        howl.play().catch(() => {/* silently ignore if still blocked */});
        fadeIn(howl);
        howlRef.current = howl;
      } catch {
        // Audio API unavailable (SSR guard, headless env, etc.)
      }
    }
  }

  function dismiss() {
    const howl = howlRef.current;
    if (howl) {
      howlRef.current = null;
      fadeOut(howl, () => {}); // fade then stop; setOpen runs immediately
    }
    setOpen(false);
  }

  return { open, trigger, dismiss };
}
