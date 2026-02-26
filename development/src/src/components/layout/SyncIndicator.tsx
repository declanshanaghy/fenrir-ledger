"use client";

/**
 * SyncIndicator — silent background sync indicator, fixed bottom-right.
 *
 * Visual: a small dot that pulses gold when syncing, near-invisible at rest.
 * Tooltip: reveals "The sound of a cat's footfall" on hover — Gleipnir fragment 1.
 * Click:   fires useGleipnirFragment1() if not yet discovered. No-op if already found.
 *
 * Sync pulses fire:
 *   - Immediately on mount (so there's something to see right away)
 *   - Every 45 s (fake periodic background sync)
 *   - On the "fenrir:sync" CustomEvent dispatched by storage.ts on real writes
 */

import { useCallback, useEffect, useState } from "react";
import {
  GleipnirCatFootfall,
  useGleipnirFragment1,
} from "@/components/cards/GleipnirCatFootfall";

const SYNC_DURATION_MS = 1500;
const SYNC_INTERVAL_MS = 45_000;

export function SyncIndicator() {
  const [syncing, setSyncing] = useState(false);
  const { open, trigger, dismiss } = useGleipnirFragment1();

  const pulse = useCallback(() => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), SYNC_DURATION_MS);
  }, []);

  useEffect(() => {
    // Fire immediately so the animation is visible on load
    pulse();

    // Periodic fake sync so the indicator stays alive
    const intervalId = setInterval(pulse, SYNC_INTERVAL_MS);

    // Real sync events dispatched by storage.ts on every card write
    window.addEventListener("fenrir:sync", pulse);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("fenrir:sync", pulse);
    };
  }, [pulse]);

  return (
    <>
      {/* Indicator + tooltip wrapper */}
      <div className="fixed bottom-4 right-4 z-50 group">

        {/* Tooltip — floats above the dot, fades in on hover */}
        <div
          className="absolute bottom-full right-0 mb-3
                     opacity-0 group-hover:opacity-100
                     transition-opacity duration-300
                     pointer-events-none whitespace-nowrap"
          aria-hidden="true"
        >
          <span className="font-mono text-[10px] tracking-wide text-[#c9920a]">
            The sound of a cat&apos;s footfall
          </span>
        </div>

        {/* Clickable indicator */}
        <button
          type="button"
          onClick={trigger}
          className="relative flex items-center justify-center w-5 h-5 cursor-default"
          aria-label="Background sync"
        >
          {/* Ping ring — only rendered while syncing */}
          {syncing && (
            <span
              className="absolute inline-flex h-full w-full rounded-full
                         bg-[#c9920a] opacity-40 animate-ping"
            />
          )}

          {/* Core dot — gold while syncing, dim iron at rest */}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full transition-colors duration-700 ${
              syncing ? "bg-[#c9920a]" : "bg-[#2a2d45]"
            }`}
          />
        </button>

      </div>

      {/* Easter egg modal — sibling not child, avoids stacking context issues */}
      <GleipnirCatFootfall open={open} onClose={dismiss} />
    </>
  );
}
