"use client";

/**
 * ForgeMasterEgg — Easter Egg #9: The Forgemaster's Signature.
 *
 * Trigger:  `?` (Shift+/) pressed anywhere outside a form field.
 * Storage:  localStorage key "egg:forgemaster" — fires once only.
 * Audio:    fenrir-howl.mp3 plays unconditionally when the modal opens.
 *           The `?` keypress counts as a user gesture, bypassing autoplay
 *           restrictions.
 *
 * Content:
 *   - Inline forge/anvil SVG artifact
 *   - The Pack: all four team members + roles
 *   - Gleipnir fragment progress (N of 6 found)
 *
 * Listener is self-contained here. Mount this component once in AppShell.
 * If the egg has already been discovered (localStorage key set), pressing `?`
 * does nothing — no modal, no side effects.
 *
 * Modal rendering is delegated to EasterEggModal (shared shell for all eggs).
 */

import { useEffect, useState } from "react";
import { EasterEggModal } from "@/components/easter-eggs/EasterEggModal";

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "egg:forgemaster";
const TOTAL_FRAGMENTS = 6;

const TEAM = [
  { name: "Freya", role: "Product Owner" },
  { name: "Luna", role: "UX Designer" },
  { name: "FiremanDecko", role: "Principal Engineer" },
  { name: "Loki", role: "QA Tester" },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function ForgeMasterEgg() {
  const [open, setOpen] = useState(false);
  const [fragmentsFound, setFragmentsFound] = useState(0);

  // `?` keydown listener — fires once only (localStorage gate).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "?") return;

      // Skip if a form field has focus — same guard as KonamiHowl.tsx.
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // One-time gate: do nothing if already discovered.
      if (localStorage.getItem(STORAGE_KEY)) return;

      e.preventDefault();

      // Mark discovered.
      localStorage.setItem(STORAGE_KEY, "1");

      // Count Gleipnir fragments found so far.
      const count = Array.from({ length: TOTAL_FRAGMENTS }, (_, i) =>
        localStorage.getItem(`egg:gleipnir-${i + 1}`)
      ).filter(Boolean).length;
      setFragmentsFound(count);

      setOpen(true);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function dismiss() {
    setOpen(false);
  }

  return (
    <EasterEggModal
      open={open}
      onClose={dismiss}
      title="The Forgemaster's Signature"
      description="You have found Easter Egg 9: The Forgemaster's Signature. The four members of the Fenrir Ledger pack, and their Gleipnir fragment progress."
      image={
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/easter-eggs/forgemaster.svg"
          alt="The Forgemaster's Signature — forge anvil artifact"
          className="w-full max-w-[200px] md:max-w-[240px] aspect-square object-contain"
        />
      }
      audioSrc="/sounds/fenrir-howl.mp3"
    >
      {/* The Pack */}
      <div>
        <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#8a8578] mb-2.5">
          The Pack
        </p>
        <div className="flex flex-col gap-2">
          {TEAM.map((member) => (
            <div key={member.name} className="flex items-baseline gap-2">
              <span className="font-heading text-xs font-bold uppercase tracking-wide text-[#f0b429]">
                {member.name}
              </span>
              <span className="font-mono text-[10px] text-[#8a8578]">
                {member.role}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Lore line */}
      <p className="font-body text-xs italic text-[#8a8578] leading-relaxed">
        &ldquo;Forged in the fires of Muspelheim. No chain holds the wolf
        that built the chain.&rdquo;
      </p>

      {/* Gleipnir fragment count */}
      <div className="border-t border-[#1e2235] pt-3">
        <p className="font-mono text-[0.7rem] text-[#c9920a]">
          {fragmentsFound} of {TOTAL_FRAGMENTS} Gleipnir fragments found
        </p>
        {fragmentsFound === TOTAL_FRAGMENTS && (
          <p className="font-mono text-[0.65rem] text-[#f0b429] mt-1 animate-pulse">
            ✦ Gleipnir is complete. The wolf stirs.
          </p>
        )}
        {fragmentsFound === 0 && (
          <p className="font-mono text-[0.6rem] text-[#3d3d52] mt-1">
            Six impossible things wait to be found.
          </p>
        )}
      </div>
    </EasterEggModal>
  );
}
