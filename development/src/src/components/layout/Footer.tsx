"use client";

/**
 * Footer — persistent application footer.
 *
 * Single flex row, maximum 2 lines tall:
 *   Left:   ᛟ FENRIR LEDGER · brand tagline
 *   Right:  team colophon + copyright line (easter egg triggers intact)
 *
 * No border. No nav links. No About dialog.
 *
 * Easter eggs wired here:
 *   #5 — Gleipnir Fragment 5 "The Breath of a Fish": hover the © symbol.
 *   #3 — Loki Mode: click "Loki" 7 times in the team colophon.
 *
 * Loki Mode effect:
 *   Dispatches a "fenrir:loki-mode" CustomEvent on window so the Dashboard
 *   can react without prop drilling. The event carries { active: boolean }.
 *   After 5 s the event is fired again with { active: false } to restore.
 *
 * Touch accessibility:
 *   © and "Loki" both have min-touch-target padding (44×44 px effective area).
 *
 * Mobile (< 640 px):
 *   flex-col — both cells stack on two lines, both left-aligned.
 */

import { useRef, useState } from "react";
import {
  GleipnirFishBreath,
  useGleipnirFragment5,
} from "@/components/cards/GleipnirFishBreath";

// ── Constants ────────────────────────────────────────────────────────────────

/** Number of clicks required to activate Loki Mode (= Loki's 7 known children). */
const LOKI_CLICK_THRESHOLD = 7;

/** How long Loki Mode stays active before order is restored (ms). */
const LOKI_MODE_DURATION_MS = 5_000;

/** Realm names to cycle through when Loki Mode scrambles status badges. */
export const LOKI_REALM_NAMES = [
  "Ásgarðr",
  "Miðgarðr",
  "Jötunheimr",
  "Niðavellir",
  "Vanaheimr",
  "Álfheimr",
  "Svartálfaheimr",
  "Niflheimr",
  "Muspelheim",
] as const;

// ── LokiToast ────────────────────────────────────────────────────────────────
//
// Minimal self-contained toast — no external dependency required.
// Renders a fixed banner at the top of the viewport (z: 9000, below egg overlays).

interface LokiToastProps {
  visible: boolean;
}

function LokiToast({ visible }: LokiToastProps) {
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: "fixed",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9000,
        backgroundColor: "rgba(18, 16, 14, 0.97)",
        border: "1px solid #d4a520",
        borderRadius: 4,
        padding: "10px 20px",
        whiteSpace: "nowrap",
        boxShadow: "0 0 20px rgba(212, 165, 32, 0.25)",
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: 13,
          color: "#f0c040",
          letterSpacing: "0.04em",
        }}
      >
        Loki was here. Your data is fine. Probably.
      </span>
    </div>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────

export function Footer() {
  // Easter egg #5 — Gleipnir Fragment: "The Breath of a Fish"
  const { open: fishOpen, trigger: triggerFish, dismiss: dismissFish } =
    useGleipnirFragment5();

  // Easter egg #3 — Loki Mode: click counter
  const lokiClicksRef = useRef(0);
  const lokiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lokiToastVisible, setLokiToastVisible] = useState(false);

  function handleLokiClick() {
    lokiClicksRef.current += 1;

    if (lokiClicksRef.current >= LOKI_CLICK_THRESHOLD) {
      lokiClicksRef.current = 0;

      // Clear any existing restore timeout
      if (lokiTimeoutRef.current !== null) {
        clearTimeout(lokiTimeoutRef.current);
        lokiTimeoutRef.current = null;
      }

      // Activate Loki Mode — signal the card grid
      window.dispatchEvent(
        new CustomEvent("fenrir:loki-mode", { detail: { active: true } })
      );

      // Show the toast
      setLokiToastVisible(true);

      // Restore after 5 s
      lokiTimeoutRef.current = setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("fenrir:loki-mode", { detail: { active: false } })
        );
        setLokiToastVisible(false);
        lokiTimeoutRef.current = null;
      }, LOKI_MODE_DURATION_MS);
    }
  }

  return (
    <>
      {/* ── Loki Mode toast ─────────────────────────────────────────────── */}
      <LokiToast visible={lokiToastVisible} />

      {/* ── Footer shell ────────────────────────────────────────────────── */}
      {/*
       * No border-top. No border-bottom. Padding small enough to keep
       * the footer under ~2 lines tall at 11 px rendered size.
       */}
      <footer
        role="contentinfo"
        aria-label="App footer"
        className="bg-background/80 backdrop-blur-sm px-6 py-1.5"
      >
        {/*
         * Single flex row:
         *   Desktop:  left cell (brand) | right cell (colophon + ©)
         *   Mobile:   flex-col — both lines left-aligned
         */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-0.5 sm:gap-0">

          {/* ── Left: wordmark · tagline ─────────────────────────────────── */}
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            <a
              href="/static"
              target="_blank"
              rel="noopener noreferrer"
              className="font-heading tracking-[0.06em] uppercase font-bold text-[11px] hover:text-foreground transition-colors"
              aria-label="Fenrir Ledger — visit the marketing site (opens in new tab)"
            >
              ᛟ FENRIR LEDGER
            </a>
            <span aria-hidden="true">&nbsp;·&nbsp;</span>
            <span>Break free. Harvest every reward. Let no chain hold.</span>
          </span>

          {/* ── Right: colophon · © ──────────────────────────────────────── */}
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            {/*
             * Team colophon. "Loki" is Easter Egg #3 — Loki Mode trigger.
             * No visual affordance in default state (discoverable only).
             * data-loki-trigger is a semantic marker for testing.
             * Padding expands the effective touch target to ≥ 44×44 px.
             */}
            Forged by FiremanDecko
            <span aria-hidden="true">&nbsp;·&nbsp;</span>
            Guarded by Freya
            <span aria-hidden="true">&nbsp;·&nbsp;</span>
            Tested by{" "}
            <span
              data-loki-trigger
              role="button"
              tabIndex={0}
              aria-label="Loki"
              onClick={handleLokiClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleLokiClick();
              }}
              className="cursor-default underline decoration-dotted
                         hover:text-foreground transition-colors
                         inline-flex items-center justify-center
                         px-2 py-3 -my-3 -mx-2"
              title="Tested by Loki"
            >
              Loki
            </span>
            <span aria-hidden="true">&nbsp;&mdash;&nbsp;</span>
            {/*
             * Easter egg #5 — Gleipnir Fragment "The Breath of a Fish".
             * data-gleipnir="breath-of-a-fish" is the semantic marker.
             * onMouseEnter fires the fragment trigger (first hover only).
             * The CSS ::after tooltip is injected via globals.css.
             * Touch: onTouchStart fires for touch devices.
             * Padding expands the touch target to ≥ 44×44 px.
             */}
            <span
              data-gleipnir="breath-of-a-fish"
              className="gleipnir-copyright-symbol
                         inline-flex items-center justify-center
                         px-2 py-3 -my-3 -mx-2
                         cursor-default relative"
              aria-label="Copyright"
              onMouseEnter={triggerFish}
              onTouchStart={triggerFish}
            >
              ©
            </span>
            <span>&nbsp;2026 Fenrir Ledger</span>
          </span>

        </div>
      </footer>

      {/* ── Gleipnir Fragment 5 modal ────────────────────────────────────── */}
      <GleipnirFishBreath open={fishOpen} onClose={dismissFish} />
    </>
  );
}
