"use client";

/**
 * HeilungModal — Easter Egg #10: Heilung Krigsgaldr.
 *
 * Wolf-voice mystical restyle per Issue #955. Fixed per Issue #983:
 * hardcoded Norse colours replace CSS variable references (avoids
 * hsl(var(--egg-*)) resolution failure in all render environments),
 * and the border-breathe CSS animation is applied via .heilung-modal-shell
 * class instead of inline style (prevents Framer Motion v12 / WAAPI conflict).
 *
 * Trigger: Ctrl+Shift+L or Meta+Shift+L. Repeatable — no localStorage gate.
 * Dismiss: ESC, backdrop click, × close button, HEIÐR button.
 *
 * Desktop: 960px max, 3-col grid (info | 1px divider | video)
 * Mobile (≤600px): flex-col — video top, info below
 *
 * Z-index: 9653 = W-O-L-F on a phone keypad.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";

/** YouTube video ID for Heilung — Krigsgaldr LIFA */
const HEILUNG_VIDEO_ID = "QRg_8NNPTD8";

/** saga-enter easing — the wolf does not spring */
const SAGA_ENTER: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Band members in wolf-voice spec order */
const VOICES = [
  { name: "Kai Uwe Faust",     role: "Chant, throat — the low frequencies" },
  { name: "Maria Franz",       role: "Voice — the oldest tones remembered" },
  { name: "Christopher Juul",  role: "Percussion — the ritual architecture" },
] as const;

/** Framer Motion variants for staggered voice item entry */
const voicesContainerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      delayChildren: 0.4,
      staggerChildren: 0.1,
    },
  },
};

const voiceItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

/* ── Norse colour palette (hardcoded to avoid CSS-var resolution failures) ── */
const C = {
  bg:        "#0f1018",   /* void-indigo shell */
  bgBody:    "#13151f",   /* slightly lighter body panels */
  border:    "rgba(201, 146, 10, 0.25)",  /* subtle gold seam */
  title:     "#f0b429",   /* bright gold */
  text:      "#e8e4d4",   /* parchment */
  textMuted: "#8a8578",   /* stone */
  accent:    "#c9920a",   /* gold accent */
  btnText:   "#07070d",   /* near-void for button fill */
  btnHover:  "#f0b429",   /* bright gold hover */
} as const;

export function HeilungModal() {
  const [visible, setVisible] = useState(false);
  const dismissBtnRef = useRef<HTMLButtonElement>(null);

  const dismiss = useCallback(() => setVisible(false), []);

  /** Scroll lock while modal is open */
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => dismissBtnRef.current?.focus());
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [visible]);

  /** Keyboard trigger + ESC dismiss */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "L" && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        setVisible((v) => !v);
        return;
      }
      if (e.key === "Escape" && visible) {
        dismiss();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, dismiss]);

  return (
    <AnimatePresence>
      {visible && (
        /* ── Backdrop — darkness descends before the modal rises ── */
        <motion.div
          key="heilung-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{
            zIndex: 9653,
            background: "rgba(7, 7, 13, 0.95)",
            backdropFilter: "blur(6px)",
          }}
          onClick={dismiss}
        >
          {/* ── Modal shell — wolf-rise entry ─────────────────────── */}
          {/*
            border-breathe animation applied via .heilung-modal-shell CSS class
            (globals.css) — NOT inline style — to avoid Framer Motion WAAPI conflict.
          */}
          <motion.div
            key="heilung-modal"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: SAGA_ENTER }}
            className="relative w-full overflow-hidden heilung-modal-shell"
            style={{
              maxWidth: "960px",
              width: "min(960px, calc(100vw - 2rem))",
              background: C.bg,
              border: `1px solid ${C.border}`,
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="heilung-title"
          >
            {/* ── Close button — 44×44px touch target ─────────────── */}
            <button
              onClick={dismiss}
              aria-label="Dismiss the incantation"
              className="absolute top-2.5 right-2.5 z-10 flex items-center justify-center transition-colors"
              style={{
                width: "2.75rem",
                height: "2.75rem",
                border: `1px solid ${C.border}`,
                background: "none",
                color: C.accent,
                cursor: "pointer",
                fontSize: "1.125rem",
                lineHeight: 1,
              }}
            >
              ×
            </button>

            {/* ── HEADER ──────────────────────────────────────────── */}
            <header
              style={{
                padding: "2rem 2rem 1.25rem",
                textAlign: "center",
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              {/* Eyebrow: rune guards + label */}
              <p
                className="flex items-center justify-center gap-3"
                aria-label="Incantation found"
                style={{
                  fontFamily: "var(--font-jetbrains-mono), monospace",
                  fontSize: "0.68rem",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.25em",
                  marginBottom: "1rem",
                  color: C.textMuted,
                }}
              >
                <span aria-hidden="true" style={{ letterSpacing: "0.3em" }}>ᚠ ᛖ ᚾ ᚱ</span>
                <span>Incantation Found</span>
                <span aria-hidden="true" style={{ letterSpacing: "0.3em" }}>ᛁ ᚱ ᛊ</span>
              </p>

              {/* Title — Cinzel Decorative 700, gold glow */}
              <h1
                id="heilung-title"
                style={{
                  fontFamily: "var(--font-cinzel-decorative), serif",
                  fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                  lineHeight: 1,
                  color: C.title,
                }}
              >
                HEILUNG
              </h1>

              {/* Subtitle */}
              <p
                style={{
                  marginTop: "0.4rem",
                  fontFamily: "var(--font-source-serif), serif",
                  fontSize: "0.9rem",
                  fontStyle: "italic",
                  fontWeight: 300,
                  letterSpacing: "0.08em",
                  color: "rgba(201, 146, 10, 0.65)",
                }}
              >
                Amplified History
              </p>
            </header>

            {/* ── BODY: desktop 3-col grid / mobile flex-col ──────── */}
            {/*
              Desktop: grid-template-columns: 1fr 1px 1fr
              Mobile (≤600px): flex-col — video order-1, info order-2
              Responsive override lives in globals.css .heilung-modal-body
            */}
            <div
              className="heilung-modal-body"
              style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr" }}
            >
              {/* LEFT: Info panel — incantation + voices */}
              <div
                className="heilung-col-info"
                style={{
                  padding: "1.75rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.25rem",
                  background: C.bgBody,
                  order: 1,
                }}
              >
                {/* Incantation — wolf's testimony */}
                <div
                  aria-label="Wolf's testimony"
                  style={{
                    fontFamily: "var(--font-source-serif), serif",
                    fontSize: "0.9rem",
                    fontWeight: 400,
                    lineHeight: 1.75,
                    color: C.text,
                  }}
                >
                  <p>
                    They speak in iron and root. I have heard these words before —
                    in the age before names were given, when the world still breathed.
                  </p>
                  <p style={{ marginTop: "0.625rem" }}>
                    Three voices carry what others let fall. They call to that
                    which does not forget. I have never forgotten.
                  </p>
                </div>

                {/* Voices section */}
                <div>
                  <p
                    style={{
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: "0.65rem",
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.2em",
                      marginBottom: "0.625rem",
                      color: C.textMuted,
                    }}
                  >
                    THE VOICES
                  </p>
                  <motion.ul
                    aria-label="Band members"
                    variants={voicesContainerVariants}
                    initial="hidden"
                    animate="show"
                    style={{
                      listStyle: "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.625rem",
                      padding: 0,
                      margin: 0,
                    }}
                  >
                    {VOICES.map(({ name, role }) => (
                      <motion.li
                        key={name}
                        variants={voiceItemVariants}
                        style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-cinzel), serif",
                            fontSize: "0.825rem",
                            fontWeight: 600,
                            color: C.text,
                          }}
                        >
                          {name}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-source-serif), serif",
                            fontSize: "0.75rem",
                            fontStyle: "italic",
                            fontWeight: 300,
                            color: C.textMuted,
                          }}
                        >
                          {role}
                        </span>
                      </motion.li>
                    ))}
                  </motion.ul>
                </div>

                {/* amplifiedhistory.com — pushed to bottom */}
                <a
                  href="https://www.amplifiedhistory.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="amplifiedhistory.com, opens in new tab"
                  style={{
                    marginTop: "auto",
                    paddingTop: "0.5rem",
                    borderTop: `1px solid ${C.border}`,
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    color: C.accent,
                    textDecoration: "none",
                    transition: "opacity 0.15s ease",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.7"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
                >
                  amplifiedhistory.com ↗
                </a>
              </div>

              {/* Vertical 1px divider — gradient top→mid→bottom */}
              <div
                aria-hidden="true"
                style={{
                  background: `linear-gradient(to bottom, transparent, ${C.border}, transparent)`,
                }}
              />

              {/* RIGHT: Embedded video — Krigsgaldr LIFA */}
              <div
                className="heilung-col-video"
                style={{
                  padding: "1.25rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: C.bgBody,
                  order: 2,
                }}
              >
                <div style={{ width: "100%", aspectRatio: "16 / 9" }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${HEILUNG_VIDEO_ID}?autoplay=1&rel=0`}
                    title="Heilung — Krigsgaldr LIFA"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                    className="w-full h-full"
                    style={{ border: "none", width: "100%", height: "100%" }}
                  />
                </div>
              </div>
            </div>

            {/* ── FOOTER ──────────────────────────────────────────── */}
            <footer
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "1.25rem 2rem 1.75rem",
                borderTop: `1px solid ${C.border}`,
              }}
            >
              {/* HEIÐR dismiss — Old Norse: honour, glory */}
              <button
                ref={dismissBtnRef}
                onClick={dismiss}
                style={{
                  padding: "0.75rem 3rem",
                  fontFamily: "var(--font-cinzel), serif",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.25em",
                  border: `1px solid ${C.accent}`,
                  background: "transparent",
                  color: C.accent,
                  cursor: "pointer",
                  minHeight: "44px",
                  transition: "background 0.2s ease, color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  const btn = e.currentTarget as HTMLButtonElement;
                  btn.style.background = C.accent;
                  btn.style.color = C.btnText;
                }}
                onMouseLeave={(e) => {
                  const btn = e.currentTarget as HTMLButtonElement;
                  btn.style.background = "transparent";
                  btn.style.color = C.accent;
                }}
              >
                HEIÐR
              </button>
            </footer>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
