"use client";

/**
 * GleipnirFishBreath -- Gleipnir Fragment 5 of 6
 *
 * Shown when the user discovers: "The Breath of a Fish"
 * One of the six impossible things woven into Gleipnir -- the ribbon that bound Fenrir.
 *
 * Trigger:  Footer -- hover on the (c) symbol (see design/easter-eggs.md)
 * Storage:  localStorage key "egg:gleipnir-5"
 * Image:    /easter-eggs/gleipnir-5.svg
 *
 * All colors use CSS variables (--egg-*) for theme support.
 */

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics/track";
import { EasterEggModal } from "@/components/easter-eggs/EasterEggModal";

const STORAGE_KEY = "egg:gleipnir-5";
const TOTAL_FRAGMENTS = 6;

interface GleipnirFishBreathProps {
  /** Control open state externally (e.g. from the trigger site). */
  open: boolean;
  onClose: () => void;
}

export function GleipnirFishBreath({ open, onClose }: GleipnirFishBreathProps) {
  const [found, setFound] = useState(0);

  useEffect(() => {
    if (open) {
      const count = Array.from({ length: TOTAL_FRAGMENTS }, (_, i) =>
        localStorage.getItem(`egg:gleipnir-${i + 1}`)
      ).filter(Boolean).length;
      setFound(count);
    }
  }, [open]);

  return (
    <EasterEggModal
      open={open}
      onClose={onClose}
      title="The Breath of a Fish"
      description="You have found Gleipnir fragment 5 of 6: The Breath of a Fish. One of the six impossible things woven into the ribbon that bound the great wolf."
      image={
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/easter-eggs/gleipnir-5.svg"
          alt="The Breath of a Fish -- Gleipnir artifact"
          className="w-full max-w-[200px] md:max-w-[240px] aspect-square object-contain"
        />
      }
      audioSrc="/sounds/fenrir-growl.mp3"
    >
      <p className="font-body text-base text-[hsl(var(--egg-text))] leading-relaxed">
        One of the six impossible things woven into{" "}
        <a
          className="myth-link"
          href="https://en.wikipedia.org/wiki/Gleipnir"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Gleipnir on Wikipedia"
          style={{ color: "hsl(var(--egg-title))", fontStyle: "italic" }}
        >
          Gleipnir
        </a>{" "}
        -- the only chain strong enough to bind the great wolf. Though it looks
        like silk ribbon, no chain is stronger.
      </p>

      <p className="font-body text-sm italic text-[hsl(var(--egg-text-muted))] leading-relaxed">
        &ldquo;The dwarves of{" "}
        <a
          className="myth-link"
          href="https://en.wikipedia.org/wiki/Svartal%C3%A1fheim"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Svartalfaheimr on Wikipedia"
        >
          Svartalfaheimr
        </a>{" "}
        gathered six things that do not exist. From these they wove{" "}
        <a
          className="myth-link"
          href="https://en.wikipedia.org/wiki/Gleipnir"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Gleipnir on Wikipedia"
        >
          Gleipnir
        </a>
        . When{" "}
        <a
          className="myth-link"
          href="https://en.wikipedia.org/wiki/Fenrir"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Fenrir on Wikipedia"
        >
          Fenrir
        </a>{" "}
        felt its touch, he knew at last what true binding was.&rdquo;
      </p>

      <div className="border-t border-[hsl(var(--egg-border))] pt-3 mt-1">
        <p className="font-mono text-[0.7rem] text-[hsl(var(--egg-accent))]">
          Fragment {found} of {TOTAL_FRAGMENTS} found
        </p>
        {found === TOTAL_FRAGMENTS && (
          <p className="font-mono text-[0.65rem] text-[hsl(var(--egg-title))] mt-1 animate-pulse">
            &#10022; Gleipnir is complete. The wolf stirs.
          </p>
        )}
      </div>
    </EasterEggModal>
  );
}

/**
 * Hook -- wire this at the trigger site.
 */
export function useGleipnirFragment5() {
  const [open, setOpen] = useState(false);

  function trigger() {
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, "1");
      track("easter-egg", { fragment: 5, name: "fish-breath" });
      setOpen(true);
    }
  }

  function dismiss() {
    setOpen(false);
  }

  return { open, trigger, dismiss };
}
