"use client";

/**
 * Footer — persistent application footer.
 *
 * Three-column layout (collapses to single column on mobile):
 *   Left:   ᛟ FENRIR LEDGER wordmark + brand tagline
 *   Centre: Footer nav ("About" link — opens AboutModal)
 *   Right:  Team colophon + copyright line
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
 */

import { useRef, useState } from "react";
import { AboutModal } from "@/components/layout/AboutModal";
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
  // About modal state — local to Footer; TopBar manages its own independently.
  const [aboutOpen, setAboutOpen] = useState(false);

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
      <footer
        role="contentinfo"
        aria-label="App footer"
        className="border-t border-border bg-background/80 backdrop-blur-sm px-6 py-6"
      >
        {/*
         * Three-column grid:
         *   Desktop:  brand (1fr) | nav (auto) | credits (1fr)
         *   Mobile:   stacked single column
         */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_auto_1fr] md:gap-8 md:items-start">

          {/* ── Column 1: Brand ─────────────────────────────────────────── */}
          <div className="flex flex-col gap-1.5">
            <span
              className="font-heading text-gold tracking-[0.08em] uppercase text-sm font-bold"
              aria-label="Fenrir Ledger"
            >
              ᛟ FENRIR LEDGER
            </span>
            <span className="font-body text-xs text-muted-foreground italic leading-snug max-w-[240px]">
              Break free. Harvest every reward. Let no chain hold.
            </span>
          </div>

          {/* ── Column 2: Nav (centred) ──────────────────────────────────── */}
          <nav
            aria-label="Footer navigation"
            className="flex flex-col gap-2 md:items-center"
          >
            <button
              type="button"
              onClick={() => setAboutOpen(true)}
              className="font-body text-sm text-muted-foreground underline underline-offset-2
                         hover:text-foreground transition-colors text-left
                         min-h-[44px] min-w-[44px] flex items-center"
              aria-label="Open About dialog"
            >
              About
            </button>
          </nav>

          {/* ── Column 3: Credits + copyright (right-aligned on desktop) ── */}
          <div className="flex flex-col gap-1.5 md:items-end md:text-right">

            {/* Team colophon */}
            <p className="font-body text-xs text-muted-foreground">
              Forged by FiremanDecko
              <span aria-hidden="true"> &nbsp;·&nbsp; </span>
              Guarded by Freya
              <span aria-hidden="true"> &nbsp;·&nbsp; </span>
              Tested by{" "}
              {/*
               * Easter egg #3 — Loki Mode trigger.
               * No visual affordance in default state (discoverable only).
               * data-loki-trigger is a semantic marker for testing.
               * Padding expands the effective touch target to ≥ 44×44 px.
               */}
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
            </p>

            {/* Copyright line */}
            <p className="font-mono text-[11px] text-muted-foreground flex items-center gap-1 md:justify-end">
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
              <span>2026 Fenrir Ledger</span>
            </p>

          </div>
        </div>

        {/* Hairline rule below the grid */}
        <hr
          aria-hidden="true"
          className="border-t border-border mt-5"
        />
      </footer>

      {/* ── About modal ─────────────────────────────────────────────────── */}
      {/*
       * Rendered outside the footer element to avoid stacking context issues.
       * This is the same pattern TopBar.tsx uses for its own About modal
       * instance. Both are independent — each manages its own open state.
       */}
      <AboutModal open={aboutOpen} onOpenChange={setAboutOpen} />

      {/* ── Gleipnir Fragment 5 modal ────────────────────────────────────── */}
      <GleipnirFishBreath open={fishOpen} onClose={dismissFish} />
    </>
  );
}
