"use client";

/**
 * EasterEggModal -- shared dialog shell for all Fenrir Ledger easter eggs.
 *
 * Renders the full Saga Ledger modal layout:
 *   - Eyebrow label (rune sigils + "Easter Egg Discovered")
 *   - Cinzel Decorative title
 *   - Two-column body: image left | divider | children right
 *   - Footer "So it is written" dismiss button
 *   - Optional howl: pass audioSrc="/sounds/fenrir-growl.mp3" to play on open
 *
 * Accessibility:
 *   - DialogTitle maps to the supplied `title` prop (screen-reader visible).
 *   - DialogDescription is sr-only, set via the `description` prop.
 *   - Focus returns to the trigger element on close (shadcn Dialog default).
 *
 * z-index: 9653 (W-O-L-F on a phone keypad) -- above KonamiHowl.
 *
 * All colors use CSS variables (--egg-*) for theme support.
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

// -- Types --

export interface EasterEggModalProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called when the dialog should close. */
  onClose: () => void;
  /** Cinzel Decorative headline -- the egg's name. */
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
   */
  audioSrc?: string;
  /** Discovery text, lore, and reward details -- rendered in the right column. */
  children: ReactNode;
}

// -- Component --

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

    if (!audioRef.current) {
      audioRef.current = new Audio(audioSrc);
    }

    const audio = audioRef.current;
    audio.currentTime = 0;

    audio.play().catch((err: unknown) => {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.warn("[EasterEggModal] audio playback error:", err);
    });

    return () => {
      audio.pause();
    };
  }, [open, audioSrc]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="w-[92vw] max-w-[680px] p-0 gap-0 flex flex-col
                   bg-[hsl(var(--egg-bg))] border border-[hsl(var(--egg-border))]
                   [&>button]:text-[hsl(var(--egg-text-muted))] [&>button]:hover:text-[hsl(var(--egg-text))]"
        style={{ zIndex: 9653 }}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 pr-10 text-center border-b border-[hsl(var(--egg-border))]">
          <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--egg-accent))] mb-2">
            <span aria-hidden="true">&#5765; &#5766; &#5790; &#5793;</span>
            {" \u00B7 "}Easter Egg Discovered{" \u00B7 "}
            <span aria-hidden="true">&#5769; &#5793; &#5765;</span>
          </p>

          <DialogTitle className="font-display text-[clamp(1.1rem,3.5vw,1.6rem)] font-bold text-[hsl(var(--egg-title))] leading-tight">
            {title}
          </DialogTitle>
        </div>

        {/* Accessible description -- screen readers only */}
        <DialogDescription className="sr-only">{description}</DialogDescription>

        {/* Two-column body */}
        <div className="flex flex-col md:grid md:grid-cols-[1fr_1px_1fr] bg-[hsl(var(--egg-bg-body))]">

          {/* Left -- artifact image / SVG */}
          <div className="flex items-center justify-center p-6 md:p-8">
            {image ?? (
              <span
                aria-hidden="true"
                className="font-mono text-4xl text-[hsl(var(--egg-accent))] opacity-30"
              >
                &#5765;
              </span>
            )}
          </div>

          {/* Vertical divider -- desktop only */}
          <div
            className="hidden md:block"
            style={{
              background:
                "linear-gradient(to bottom, transparent, hsl(var(--egg-border)) 20%, hsl(var(--egg-border)) 80%, transparent)",
            }}
            aria-hidden="true"
          />

          {/* Right -- discovery text (caller-supplied) */}
          <div className="flex flex-col justify-center gap-4 px-6 py-6 md:px-8">
            {children}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-center px-6 py-4 border-t border-[hsl(var(--egg-border))]">
          <DialogClose asChild>
            <Button
              className="px-10 font-heading text-sm font-semibold tracking-widest uppercase
                         bg-[hsl(var(--egg-btn-bg))] text-[hsl(var(--egg-btn-text))] hover:bg-[hsl(var(--egg-btn-hover))]
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
