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

// ── Forge Anvil SVG ───────────────────────────────────────────────────────────
//
// 1024×1024 inline SVG — a forge anvil silhouette with rune engravings,
// ember glow, and the persistent ᚠ rune watermark (bottom-left, per skill spec).

function ForgeAnvilArtifact() {
  return (
    <svg
      viewBox="0 0 1024 1024"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="w-full max-w-[200px] md:max-w-[240px] aspect-square object-contain"
    >
      <title>The Forgemaster&apos;s Signature</title>
      <desc>
        I have worn every chain they could forge. Steel, seiðr, sky-iron.
        None held. Then came Gleipnir — woven from nothing, softer than thought,
        stronger than the roots of Yggdrasil. Even a wolf must respect the work
        of a master forger. This is that work. These are those hands.
      </desc>

      {/* Background — void black */}
      <rect width="1024" height="1024" fill="#07070d" />

      {/* Outer ring — gold, low opacity, per skill spec */}
      <circle
        cx="512"
        cy="512"
        r="440"
        stroke="#c9920a"
        strokeWidth="1"
        fill="none"
        opacity="0.18"
      />

      {/* ── Forge Glow — radial ember behind the anvil ── */}
      <defs>
        <radialGradient id="forge-glow" cx="50%" cy="62%" r="38%">
          <stop offset="0%" stopColor="#c9920a" stopOpacity="0.28" />
          <stop offset="60%" stopColor="#c9920a" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#c9920a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ember-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f0b429" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#c9920a" stopOpacity="0" />
        </radialGradient>
        <filter id="anvil-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ember glow behind the whole piece */}
      <ellipse cx="512" cy="620" rx="260" ry="160" fill="url(#forge-glow)" />

      {/* ── Anvil body — classic blacksmith profile ── */}
      {/* Base slab */}
      <rect
        x="310"
        y="700"
        width="404"
        height="56"
        rx="6"
        fill="#c9920a"
        opacity="0.82"
      />
      {/* Waist / neck */}
      <rect
        x="390"
        y="640"
        width="244"
        height="68"
        rx="4"
        fill="#c9920a"
        opacity="0.75"
      />
      {/* Top face — the working surface */}
      <rect
        x="298"
        y="576"
        width="428"
        height="72"
        rx="6"
        fill="#c9920a"
        opacity="0.90"
        filter="url(#anvil-glow)"
      />
      {/* Horn — protruding left cone */}
      <polygon
        points="298,600 178,618 298,636"
        fill="#c9920a"
        opacity="0.80"
      />
      {/* Hardie hole — small square punch on the top face */}
      <rect
        x="660"
        y="584"
        width="32"
        height="28"
        rx="2"
        fill="#07070d"
        opacity="0.90"
      />
      {/* Pritchel hole — small round punch */}
      <circle cx="622" cy="598" r="10" fill="#07070d" opacity="0.90" />

      {/* ── Top-face highlight — the reflection of forge light ── */}
      <rect
        x="310"
        y="578"
        width="320"
        height="8"
        rx="3"
        fill="#f0b429"
        opacity="0.22"
      />

      {/* ── Rune engravings on the anvil face ── */}
      {/* ᚠ Fehu — wealth / reward */}
      <text
        x="360"
        y="622"
        fontFamily="serif"
        fontSize="36"
        fill="#07070d"
        opacity="0.55"
      >
        ᚠ
      </text>
      {/* ᛖ Ehwaz — partnership */}
      <text
        x="430"
        y="622"
        fontFamily="serif"
        fontSize="36"
        fill="#07070d"
        opacity="0.55"
      >
        ᛖ
      </text>
      {/* ᚾ Naudiz — necessity / the forge's demand */}
      <text
        x="500"
        y="622"
        fontFamily="serif"
        fontSize="36"
        fill="#07070d"
        opacity="0.55"
      >
        ᚾ
      </text>
      {/* ᚱ Raidho — the journey */}
      <text
        x="570"
        y="622"
        fontFamily="serif"
        fontSize="36"
        fill="#07070d"
        opacity="0.55"
      >
        ᚱ
      </text>

      {/* ── Hammer — resting on the anvil, handle diagonal ── */}
      {/* Handle */}
      <line
        x1="530"
        y1="576"
        x2="430"
        y2="430"
        stroke="#8a8578"
        strokeWidth="14"
        strokeLinecap="round"
        opacity="0.70"
      />
      {/* Head — cross-peen */}
      <rect
        x="390"
        y="390"
        width="70"
        height="42"
        rx="5"
        fill="#c9920a"
        opacity="0.88"
        transform="rotate(-35 425 411)"
      />
      {/* Peen (back face of hammer head) */}
      <polygon
        points="390,395 368,420 390,432"
        fill="#f0b429"
        opacity="0.60"
        transform="rotate(-35 425 411)"
      />

      {/* ── Ember sparks — three small glowing dots near the hammer ── */}
      <circle cx="480" cy="510" r="5" fill="#f0b429" opacity="0.70" />
      <circle cx="500" cy="495" r="3" fill="#f0b429" opacity="0.50" />
      <circle cx="468" cy="498" r="4" fill="#f0b429" opacity="0.40" />
      <circle cx="510" cy="515" r="2.5" fill="#f0b429" opacity="0.35" />

      {/* ── Structural line — ground plane (dim iron) ── */}
      <line
        x1="200"
        y1="756"
        x2="824"
        y2="756"
        stroke="#1e2235"
        strokeWidth="1"
        opacity="0.60"
      />

      {/* ── Rune watermark — bottom-left, per skill spec ── */}
      <text
        x="32"
        y="988"
        fontFamily="serif"
        fontSize="80"
        fill="#c9920a"
        opacity="0.22"
      >
        ᚠ
      </text>
    </svg>
  );
}

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
      image={<ForgeAnvilArtifact />}
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
