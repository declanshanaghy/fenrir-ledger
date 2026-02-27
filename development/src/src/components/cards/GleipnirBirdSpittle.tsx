"use client";

/**
 * GleipnirBirdSpittle — Gleipnir Fragment 6 of 6
 *
 * Shown when the user discovers: "The Spittle of a Bird"
 * One of the six impossible things woven into Gleipnir — the ribbon that bound Fenrir.
 *
 * Trigger:  TBD — more UI elements need to be finished (see design/easter-eggs.md)
 * Storage:  localStorage key "egg:gleipnir-6"
 * Image:    /easter-eggs/gleipnir-6.svg
 */

import { useEffect, useState } from "react";
import { EasterEggModal } from "@/components/easter-eggs/EasterEggModal";

const STORAGE_KEY = "egg:gleipnir-6";
const TOTAL_FRAGMENTS = 6;

interface GleipnirBirdSpittleProps {
  /** Control open state externally (e.g. from the trigger site). */
  open: boolean;
  onClose: () => void;
}

export function GleipnirBirdSpittle({ open, onClose }: GleipnirBirdSpittleProps) {
  const [found, setFound] = useState(0);

  useEffect(() => {
    if (open) {
      // Count total found (this fragment was already written by the hook's trigger()).
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
      title="The Spittle of a Bird"
      description="You have found Gleipnir fragment 6 of 6: The Spittle of a Bird. One of the six impossible things woven into the ribbon that bound the great wolf."
      image={
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/easter-eggs/gleipnir-6.svg"
          alt="The Spittle of a Bird — Gleipnir artifact"
          className="w-full max-w-[200px] md:max-w-[240px] aspect-square object-contain"
        />
      }
      audioSrc="/sounds/fenrir-howl.mp3"
    >
      <p className="font-body text-sm text-[#e8e4d4] leading-relaxed">
        One of the six impossible things woven into{" "}
        <span className="text-[#f0b429] italic">Gleipnir</span> — the only
        chain strong enough to bind the great wolf. Though it looks like silk
        ribbon, no chain is stronger.
      </p>

      <p className="font-body text-xs italic text-[#8a8578] leading-relaxed">
        &ldquo;The dwarves of Svartálfaheimr gathered six things that do not
        exist. From these they wove Gleipnir. When Fenrir felt its touch, he
        knew at last what true binding was.&rdquo;
      </p>

      <div className="border-t border-[#1e2235] pt-3 mt-1">
        <p className="font-mono text-[0.7rem] text-[#c9920a]">
          Fragment {found} of {TOTAL_FRAGMENTS} found
        </p>
        {found === TOTAL_FRAGMENTS && (
          <p className="font-mono text-[0.65rem] text-[#f0b429] mt-1 animate-pulse">
            ✦ Gleipnir is complete. The wolf stirs.
          </p>
        )}
      </div>
    </EasterEggModal>
  );
}

/**
 * Hook — wire this at the trigger site.
 *
 * Usage:
 *   const { open, trigger, dismiss } = useGleipnirFragment6();
 *   // Call trigger() when the hidden ingredient is discovered.
 *   // Render: <GleipnirBirdSpittle open={open} onClose={dismiss} />
 *
 * Trigger location: TBD — more UI elements need to be finished.
 *
 * Audio and modal structure are handled by EasterEggModal — do not add them here.
 * The trigger() call is the user-gesture entry point; browsers allow audio from there.
 */
export function useGleipnirFragment6() {
  const [open, setOpen] = useState(false);

  function trigger() {
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, "1");
      setOpen(true);
    }
  }

  function dismiss() {
    setOpen(false);
  }

  return { open, trigger, dismiss };
}
