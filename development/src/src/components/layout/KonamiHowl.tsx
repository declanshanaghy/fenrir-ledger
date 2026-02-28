"use client";

/**
 * KonamiHowl — Easter Egg #2.
 *
 * Listens for the classic Konami Code sequence:
 *   ↑ ↑ ↓ ↓ ← → ← → B A
 *
 * On completion:
 * 1. If the user has any fee_approaching or promo_expiring cards: fires a
 *    deep-red Ragnarök pulse flash first (z: 9652, 800 ms).
 * 2. After the pulse (or immediately if no overdue cards): the wolf silhouette
 *    rises from the bottom of the viewport (z: 9653, wolf-rise 600 ms).
 * 3. Simultaneously: FENRIR AWAKENS status band appears at the top (z: 9653).
 * 4. Simultaneously with rise: the body shakes (saga-shake, 400 ms).
 * 5. Both wolf and band hold for 3 s then fade out together (400 ms).
 *
 * The entire sequence is purely presentational — no dismiss button.
 * ESC does not cancel it. Total runtime: ~3.8 s (standard) / ~4.6 s (Ragnarök).
 *
 * prefers-reduced-motion: animations are skipped; the FENRIR AWAKENS band
 * still appears and holds for 3 s so reduced-motion users see the egg.
 *
 * Accessibility:
 * - Status band: role="status" aria-live="assertive"
 * - Wolf image: role="img" aria-label="Wolf head silhouette rising"
 * - Focus is never moved to the overlay elements.
 * - Keydown listener is removed on unmount.
 *
 * Mobile (< 640px):
 * - Wolf height capped at 50 vh so the status band remains readable.
 * - saga-shake reduced to ±3 px via saga-shake-mobile keyframe.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { getAllCardsGlobal } from "@/lib/storage";

// ── Constants ────────────────────────────────────────────────────────────────

const KONAMI_SEQUENCE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
] as const;

/** Duration of the Ragnarök pulse before the wolf begins to rise. */
const RAGNAROK_PULSE_MS = 800;

// ── Wolf SVG ─────────────────────────────────────────────────────────────────
//
// Simplified wolf-head silhouette drawn in path data.
// Fill is the gold accent (#c9920a) to match the theme.
// Centered horizontally, anchored at the bottom edge of its container.

function WolfSilhouette() {
  return (
    <svg
      viewBox="0 0 200 180"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="w-full max-w-[320px] sm:max-w-[440px]"
      style={{ fill: "#c9920a", opacity: 0.92 }}
    >
      {/*
       * Wolf head silhouette — geometric stylised shape.
       * Ears: two sharp triangular points flanking the crown.
       * Face: broad muzzle, angular jaw.
       * Eyes: two void cutouts (lighter, punched through).
       */}
      {/* Left ear */}
      <polygon points="30,100 55,10 80,90" />
      {/* Right ear */}
      <polygon points="120,90 145,10 170,100" />
      {/* Head body — broad pentagon */}
      <polygon points="20,110 40,90 160,90 180,110 175,160 100,175 25,160" />
      {/* Snout extension */}
      <polygon points="70,130 130,130 125,165 100,175 75,165" />
      {/* Left eye cutout */}
      <ellipse cx="75" cy="118" rx="12" ry="9" style={{ fill: "#07070d" }} />
      {/* Right eye cutout */}
      <ellipse cx="125" cy="118" rx="12" ry="9" style={{ fill: "#07070d" }} />
      {/* Nose bridge mark */}
      <rect x="94" y="140" width="12" height="6" rx="2" style={{ fill: "#07070d" }} />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

type HowlPhase = "idle" | "pulse" | "rising" | "holding" | "fading";

export function KonamiHowl() {
  const { data: session } = useSession();
  const sequenceRef = useRef<string[]>([]);
  const [phase, setPhase] = useState<HowlPhase>("idle");
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reducedMotion = useRef(false);

  // Detect prefers-reduced-motion once on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    reducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
  }, []);

  // Clear all pending timeouts (used on cleanup and early reset).
  const clearTimeouts = useCallback(() => {
    for (const id of timeoutsRef.current) clearTimeout(id);
    timeoutsRef.current = [];
  }, []);

  // Schedule a timeout and track it for cleanup.
  const schedule = useCallback(
    (fn: () => void, delay: number) => {
      const id = setTimeout(fn, delay);
      timeoutsRef.current.push(id);
    },
    []
  );

  // Run the full howl sequence.
  const triggerHowl = useCallback(() => {
    clearTimeouts();

    // Check for overdue / approaching cards.
    // householdId from session — empty string when no session (easter egg still works, just no overdue check)
    const householdId = session?.user?.householdId ?? "";
    const cards = householdId ? getAllCardsGlobal(householdId) : [];
    const overdue = cards.some(
      (c) => c.status === "fee_approaching" || c.status === "promo_expiring"
    );

    if (overdue && !reducedMotion.current) {
      // Phase 1: Ragnarök pulse (800 ms)
      setPhase("pulse");
      schedule(() => {
        // Phase 2: wolf rises
        setPhase("rising");
        // After rise animation completes, enter hold
        schedule(() => setPhase("holding"), 600);
        // After hold, begin fade
        schedule(() => setPhase("fading"), 600 + 3000);
        // After fade completes, return to idle
        schedule(() => setPhase("idle"), 600 + 3000 + 400);
      }, RAGNAROK_PULSE_MS);
    } else {
      // No overdue cards (or reduced motion): go straight to rising
      setPhase("rising");
      if (!reducedMotion.current) {
        schedule(() => setPhase("holding"), 600);
        schedule(() => setPhase("fading"), 600 + 3000);
        schedule(() => setPhase("idle"), 600 + 3000 + 400);
      } else {
        // Reduced motion: skip animations, just hold the band then dismiss.
        schedule(() => setPhase("fading"), 3000);
        schedule(() => setPhase("idle"), 3000 + 400);
      }
    }

    // Body shake (skip on reduced motion)
    if (!reducedMotion.current) {
      const isMobile = window.innerWidth < 640;
      document.body.classList.add(
        isMobile ? "konami-shake-mobile" : "konami-shake"
      );
      schedule(() => {
        document.body.classList.remove("konami-shake", "konami-shake-mobile");
      }, 400);
    }
  }, [clearTimeouts, schedule, session]);

  // Keydown listener — tracks the sequence and fires on completion.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore when a text input is focused — don't interfere with typing.
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const key = e.key;
      sequenceRef.current.push(key);

      // Keep only the last N keys (length of the sequence).
      if (sequenceRef.current.length > KONAMI_SEQUENCE.length) {
        sequenceRef.current.shift();
      }

      // Check for match.
      const current = sequenceRef.current;
      const match =
        current.length === KONAMI_SEQUENCE.length &&
        KONAMI_SEQUENCE.every((k, i) => k === current[i]);

      if (match) {
        sequenceRef.current = [];
        // Prevent any browser default for the last key ('a').
        e.preventDefault();
        triggerHowl();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeouts();
      sequenceRef.current = [];
    };
  }, [triggerHowl, clearTimeouts]);

  // Nothing to render when idle.
  if (phase === "idle") return null;

  const isVisible = phase === "pulse" || phase === "rising" || phase === "holding" || phase === "fading";
  const showWolf = phase === "rising" || phase === "holding" || phase === "fading";
  const showPulse = phase === "pulse";

  return (
    <>
      {/* ── Ragnarök pulse flash (z: 9652) ─────────────────────────────── */}
      {showPulse && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9652,
            backgroundColor: "#3d0000",
            animation: `ragnarok-pulse ${RAGNAROK_PULSE_MS}ms ease-out forwards`,
            pointerEvents: "none",
          }}
        />
      )}

      {isVisible && (
        <>
          {/* ── FENRIR AWAKENS band (z: 9653, top) ─────────────────────── */}
          <div
            role="status"
            aria-live="assertive"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              height: 44,
              zIndex: 9653,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(7, 7, 13, 0.96)",
              borderBottom: "2px solid #c94020",
              animation:
                phase === "fading"
                  ? "howl-band-fade 400ms ease-out forwards"
                  : undefined,
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-cinzel-decorative), serif",
                fontWeight: 700,
                fontSize: "clamp(14px, 4vw, 18px)",
                letterSpacing: "0.25em",
                color: "#c94020",
                textTransform: "uppercase",
              }}
            >
              FENRIR AWAKENS
            </span>
          </div>

          {/* ── Wolf silhouette (z: 9653, bottom) ──────────────────────── */}
          {showWolf && (
            <div
              role="img"
              aria-label="Wolf head silhouette rising from the bottom of the viewport"
              style={{
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                height: "min(320px, 50vh)",
                zIndex: 9653,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                backgroundColor: "rgba(7, 7, 13, 0.92)",
                borderTop: "2px solid #c9920a",
                animation:
                  phase === "fading"
                    ? "howl-element-fade 400ms ease-out forwards"
                    : !reducedMotion.current
                    ? "wolf-rise 600ms cubic-bezier(0.16, 1, 0.3, 1) both"
                    : undefined,
                pointerEvents: "none",
              }}
            >
              <div style={{ paddingBottom: 16 }}>
                <WolfSilhouette />
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
