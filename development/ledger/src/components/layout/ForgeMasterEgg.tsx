"use client";

/**
 * ForgeMasterEgg — Easter Egg #9: The Forgemaster's Signature.
 *
 * Trigger:  `?` (Shift+/) pressed anywhere outside a form field.
 * Storage:  localStorage key "egg:forgemaster" — fires once only.
 * Audio:    fenrir-growl.mp3 plays unconditionally when the modal opens.
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
import { WolfHungerMeter } from "@/components/shared/WolfHungerMeter";

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
      audioSrc="/sounds/fenrir-growl.mp3"
    >
      {/* The Pack */}
      <div>
        <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--egg-text-muted))] mb-2.5">
          The Pack
        </p>
        <div className="flex flex-col gap-2">
          {TEAM.map((member) => (
            <div key={member.name} className="flex items-baseline gap-2">
              <span className="font-heading text-sm font-bold uppercase tracking-wide text-[hsl(var(--egg-title))]">
                {member.name}
              </span>
              <span className="font-mono text-xs text-[hsl(var(--egg-text-muted))]">
                {member.role}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Lore line */}
      <p className="font-body text-sm italic text-[hsl(var(--egg-text-muted))] leading-relaxed">
        &ldquo;Forged in the fires of Muspelheim. No chain holds the wolf
        that built the chain.&rdquo;
      </p>

      {/* Gleipnir fragment count */}
      <div className="border-t border-[hsl(var(--egg-border))] pt-3">
        <p className="font-mono text-[0.7rem] text-[hsl(var(--egg-accent))]">
          {fragmentsFound} of {TOTAL_FRAGMENTS} Gleipnir fragments found
        </p>
        {fragmentsFound === TOTAL_FRAGMENTS && (
          <p className="font-mono text-[0.65rem] text-[hsl(var(--egg-title))] mt-1 animate-pulse">
            ✦ Gleipnir is complete. The wolf stirs.
          </p>
        )}
        {fragmentsFound === 0 && (
          <p className="font-mono text-[0.6rem] text-muted-foreground/50 mt-1">
            Six impossible things wait to be found.
          </p>
        )}
      </div>

      {/* Wolf's Hunger — aggregate bonus summary */}
      <div className="border-t border-[hsl(var(--egg-border))] pt-3 mt-1">
        <WolfHungerMeter />
      </div>
    </EasterEggModal>
  );
}
