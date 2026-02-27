"use client";

/**
 * EasterEggModal — shared dialog shell for all Fenrir Ledger easter eggs.
 *
 * Renders the full Saga Ledger modal layout:
 *   - Eyebrow label (rune sigils + "Easter Egg Discovered")
 *   - Cinzel Decorative title
 *   - Two-column body: image left | divider | children right
 *   - Footer "So it is written" dismiss button
 *   - Optional howl: pass audioSrc="/sounds/fenrir-howl.mp3" to play on open
 *
 * Accessibility:
 *   - DialogTitle maps to the supplied `title` prop (screen-reader visible).
 *   - DialogDescription is sr-only, set via the `description` prop.
 *   - Focus returns to the trigger element on close (shadcn Dialog default).
 *
 * z-index: 9653 (W-O-L-F on a phone keypad) — above KonamiHowl.
 *
 * Usage:
 * ```tsx
 * <EasterEggModal
 *   open={open}
 *   onClose={dismiss}
 *   title="The Forgemaster's Signature"
 *   description="You have found Easter Egg 9."
 *   image={<ForgeAnvilArtifact />}
 *   audioSrc="/sounds/fenrir-howl.mp3"
 * >
 *   <p className="font-body text-xs">...</p>
 * </EasterEggModal>
 * ```
 */

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface EasterEggModalProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called when the dialog should close. */
  onClose: () => void;
  /** Cinzel Decorative headline — the egg's name. */
  title: string;
  /**
   * sr-only description for assistive technologies.
   * Defaults to "You have found a hidden easter egg."
   */
  description?: string;
  /** Artifact image or SVG rendered in the left column. */
  image?: ReactNode;
  /**
   * Path to an audio file played when the modal opens.
   * The caller's keypress counts as a user gesture, bypassing autoplay
   * restrictions. Pass undefined to suppress audio.
   * Example: "/sounds/fenrir-howl.mp3"
   */
  audioSrc?: string;
  /** Discovery text, lore, and reward details — rendered in the right column. */
  children: ReactNode;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function EasterEggModal({
  open,
  onClose,
  title,
  description = "You have found a hidden easter egg.",
  image,
  audioSrc,
  children,
}: EasterEggModalProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play the howl whenever the modal opens.
  useEffect(() => {
    if (!open || !audioSrc) return;

    // Re-use the same Audio instance across re-renders to avoid GC churn.
    if (!audioRef.current) {
      audioRef.current = new Audio(audioSrc);
    }

    const audio = audioRef.current;
    // Reset to the start in case it was partially played.
    audio.currentTime = 0;

    // play() returns a Promise in modern browsers. Swallow AbortError —
    // it fires when the component unmounts before playback starts.
    audio.play().catch((err: unknown) => {
      if (err instanceof DOMException && err.name === "AbortError") return;
      // Log other errors without throwing; audio failure is non-fatal.
      console.warn("[EasterEggModal] audio playback error:", err);
    });

    return () => {
      // Pause on close so the howl doesn't outlast the modal.
      audio.pause();
    };
  }, [open, audioSrc]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      {/*
       * Overrides: w-[92vw] max-w-[680px] override Dialog defaults.
       * p-0 gap-0 override p-6 gap-4.
       * z-index 9653 = W-O-L-F on a phone keypad (see copywriting.md).
       */}
      <DialogContent
        className="w-[92vw] max-w-[680px] p-0 gap-0 flex flex-col
                   bg-[#0f1018] border border-[#2a2d45]
                   [&>button]:text-[#8a8578] [&>button]:hover:text-[#e8e4d4]"
        style={{ zIndex: 9653 }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        {/* pr-10 clears the built-in X button */}
        <div className="px-6 pt-5 pb-4 pr-10 text-center border-b border-[#1e2235]">
          <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#c9920a] mb-2">
            <span aria-hidden="true">ᚠ ᛖ ᚾ ᚱ</span>
            {" · "}Easter Egg Discovered{" · "}
            <span aria-hidden="true">ᛁ ᚱ ᛊ</span>
          </p>

          <DialogTitle className="font-display text-[clamp(1.1rem,3.5vw,1.6rem)] font-bold text-[#f0b429] leading-tight">
            {title}
          </DialogTitle>
        </div>

        {/* Accessible description — screen readers only */}
        <DialogDescription className="sr-only">{description}</DialogDescription>

        {/* ── Two-column body ─────────────────────────────────────────── */}
        {/*
         * Desktop: image left | divider | children right
         * Mobile:  stacked (image top, children bottom)
         */}
        <div className="flex flex-col md:grid md:grid-cols-[1fr_1px_1fr] bg-[#13151f]">

          {/* Left — artifact image / SVG */}
          <div className="flex items-center justify-center p-6 md:p-8">
            {image ?? (
              <span
                aria-hidden="true"
                className="font-mono text-4xl text-[#c9920a] opacity-30"
              >
                ᚠ
              </span>
            )}
          </div>

          {/* Vertical divider — desktop only */}
          <div
            className="hidden md:block"
            style={{
              background:
                "linear-gradient(to bottom, transparent, #2a2d45 20%, #2a2d45 80%, transparent)",
            }}
            aria-hidden="true"
          />

          {/* Right — discovery text (caller-supplied) */}
          <div className="flex flex-col justify-center gap-4 px-6 py-6 md:px-8">
            {children}
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="flex justify-center px-6 py-4 border-t border-[#1e2235]">
          <DialogClose asChild>
            <Button
              className="px-10 font-heading text-sm font-semibold tracking-widest uppercase
                         bg-[#c9920a] text-[#07070d] hover:bg-[#f0b429]
                         rounded-none min-h-[44px]"
            >
              So it is written
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
