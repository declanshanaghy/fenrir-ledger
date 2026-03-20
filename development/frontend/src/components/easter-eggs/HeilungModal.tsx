"use client";

/**
 * HeilungModal — Easter Egg #10: Heilung Krigsgaldr.
 *
 * Issue #1068 — Norse restyle: single-column 7-section layout, Elder Futhark rune bands,
 * Old Norse title (Cinzel Decorative), click-to-play video portal with rune frame,
 * gold Wikipedia links, ᛉ Algiz close button, wolf seal inscription, Framer Motion entry.
 *
 * Trigger: Ctrl+Shift+L (all platforms). Skip if form field focused.
 * Repeatable — no one-time gate, no localStorage tracking.
 * No auto-dismiss timer. User dismisses via ESC, backdrop click, ᛉ button, or HEIÐR button.
 *
 * Layout: single-column flex-col stack (7 sections). max-width: 680px.
 * Mobile: padding scales down, dismiss button full-width. min-viewport: 375px.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/** YouTube video ID for Heilung — Norupo LIFA */
const HEILUNG_VIDEO_ID = "2wy-W-pYlds";

/** Elder Futhark 22-rune sequence (forward) */
const FUTHARK_FORWARD = "ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ ᚺ ᚾ ᛁ ᛃ ᛇ ᛈ ᛏ ᛒ ᛖ ᛗ ᛚ ᛜ ᛞ ᛟ";
/** Elder Futhark 22-rune sequence (reversed) — mirrors top band */
const FUTHARK_REVERSED = "ᛟ ᛞ ᛜ ᛚ ᛗ ᛖ ᛒ ᛏ ᛈ ᛇ ᛃ ᛁ ᚾ ᚺ ᚹ ᚷ ᚲ ᚱ ᚨ ᚦ ᚢ ᚠ";

/** Corner runes for the video portal frame */
const CORNER_RUNES = ["ᚠ", "ᛖ", "ᚾ", "ᚱ"] as const;

export function HeilungModal() {
  const [visible, setVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const dismiss = useCallback(() => {
    setPlaying(false);
    setVisible(false);
  }, []);

  // Focus the Algiz close button when modal opens (WCAG focus trap entry point)
  useEffect(() => {
    if (!visible) return;
    // Small delay to allow Framer Motion entry animation to start
    const t = setTimeout(() => closeButtonRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+Shift+L / Meta+Shift+L — toggle modal
      if (e.key === "L" && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        setVisible((v) => {
          if (v) setPlaying(false); // reset video on close
          return !v;
        });
        return;
      }

      // ESC to dismiss
      if (e.key === "Escape" && visible) {
        dismiss();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, dismiss]);

  // Handle click/keydown on the video portal thumbnail
  function handlePortalActivate(e: React.MouseEvent | React.KeyboardEvent) {
    if (
      e.type === "keydown" &&
      (e as React.KeyboardEvent).key !== "Enter" &&
      (e as React.KeyboardEvent).key !== " "
    ) {
      return;
    }
    e.preventDefault();
    setPlaying(true);
  }

  return (
    <AnimatePresence>
      {visible && (
        /* ── Backdrop ───────────────────────────────────────────── */
        <motion.div
          key="heilung-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeIn" }}
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{
            zIndex: 9653,
            background: "rgba(7, 7, 13, 0.95)",
            backdropFilter: "blur(6px)",
          }}
          onClick={dismiss}
          aria-label="Heilung modal backdrop — click to close"
        >
          {/* ── Modal shell ─────────────────────────────────────── */}
          <motion.div
            key="heilung-modal"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.6,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="relative w-full flex flex-col heilung-modal-shell"
            style={{
              maxWidth: "680px",
              maxHeight: "calc(100vh - 4rem)",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
              background: "hsl(var(--egg-bg))",
              border: "1px solid hsl(var(--egg-border))",
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="heilung-title"
          >

            {/* ── Algiz close button (ᛉ) ───────────────────────── */}
            <button
              ref={closeButtonRef}
              onClick={dismiss}
              aria-label="Close — return from the wolf's hall"
              className="absolute top-2 right-2 z-10 flex items-center justify-center transition-colors heilung-algiz-btn"
              style={{
                width: "2.75rem",
                height: "2.75rem",
                fontSize: "1.4rem",
                color: "hsl(var(--egg-accent))",
                background: "none",
                border: "1px solid hsl(var(--egg-border))",
                cursor: "pointer",
              }}
            >
              <span aria-hidden="true">ᛉ</span>
            </button>

            {/* ── Section 1: Rune band (top) ────────────────────── */}
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeIn", delay: 0.4 }}
              className="heilung-rune-band heilung-rune-band--top"
            >
              {FUTHARK_FORWARD}
            </motion.div>

            {/* ── Section 2: Title block ────────────────────────── */}
            <div className="heilung-title-block">
              <h1
                id="heilung-title"
                aria-label="Heyra Norðupo — Hear the Invocation"
                className="heilung-norse-title"
              >
                Heyra Norðupo
              </h1>
              <div aria-hidden="true" className="heilung-title-rune-row">
                ᚠ ᛖ ᚾ ᚱ ᛁ ᚱ
              </div>
              <div aria-hidden="true" className="heilung-subtitle">
                HEILUNG · Amplified History
              </div>
            </div>

            {/* ── Rune divider (1) ──────────────────────────────── */}
            <div aria-hidden="true" className="heilung-rune-divider">
              · ᛉ · ᚠ · ᛉ ·
            </div>

            {/* ── Section 3: Wolf's invitation ─────────────────── */}
            <section aria-label="Wolf's invitation" className="heilung-wolf-invitation">
              <p>
                Before there were names, there were sounds — guttural, sacred, older than memory.
                Hear now the invocation that summoned the spirits beneath the branches
                of{" "}
                <a
                  href="https://en.wikipedia.org/wiki/Yggdrasil"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Yggdrasil on Wikipedia"
                  className="heilung-wiki-link"
                >
                  Yggdrasil
                </a>{" "}
                —{" "}
                <a
                  href="https://en.wikipedia.org/wiki/Heilung"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Heilung on Wikipedia"
                  className="heilung-wiki-link"
                >
                  <span className="heilung-gold-term">Norupo</span>
                </a>
                , the invocation of{" "}
                <a
                  href="https://en.wikipedia.org/wiki/Heilung"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Heilung on Wikipedia"
                  className="heilung-wiki-link"
                >
                  <span className="heilung-gold-term">Heilung</span>
                </a>
                . Let the old voices fill thy skull.
              </p>
              <p>
                Three throats carry what the age of iron sought to silence. They speak in root and
                bone, in the tongue of those who burned beneath the stars before{" "}
                <a
                  href="https://en.wikipedia.org/wiki/Ragnar%C3%B6k"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Ragnarök on Wikipedia"
                  className="heilung-wiki-link"
                >
                  <span className="heilung-gold-term">Ragnarök</span>
                </a>{" "}
                was a name for anything. Fenrir remembers.
              </p>
            </section>

            {/* ── Rune divider (2) ──────────────────────────────── */}
            <div aria-hidden="true" className="heilung-rune-divider">
              · ᛉ · ᚠ · ᛉ ·
            </div>

            {/* ── Section 4: Video portal ───────────────────────── */}
            <div className="heilung-video-portal-section">
              <div aria-hidden="true" className="heilung-portal-label">
                ᛊᛖᛖ ᚦᛖ ᛊᛟᚾᚷ
              </div>

              {/* Rune-framed portal */}
              <div className="heilung-video-portal-frame">
                {/* Corner runes */}
                <div className="heilung-portal-corners" aria-hidden="true">
                  {CORNER_RUNES.map((rune, i) => (
                    <motion.span
                      key={rune}
                      className={`heilung-corner-rune heilung-corner-rune--${i}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.6 }}
                      transition={{
                        duration: 0.4,
                        ease: "easeIn",
                        delay: 0.8 + i * 0.05,
                      }}
                      aria-hidden="true"
                    >
                      {rune}
                    </motion.span>
                  ))}
                </div>

                {/* Video portal inner — thumbnail or iframe */}
                <div className="heilung-video-portal-inner">
                  {playing ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${HEILUNG_VIDEO_ID}?autoplay=1&rel=0`}
                      title="Heilung — Norupo LIFA"
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                      className="w-full h-full"
                      style={{ border: "none", display: "block" }}
                    />
                  ) : (
                    /* Fallback: <a> wraps the portal for no-JS navigation */
                    <a
                      href={`https://www.youtube.com/watch?v=${HEILUNG_VIDEO_ID}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      tabIndex={-1}
                      aria-hidden="true"
                      style={{ display: "contents" }}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label="Watch Heilung — Norupo LIFA on YouTube"
                        className="heilung-thumbnail-btn"
                        onClick={handlePortalActivate}
                        onKeyDown={handlePortalActivate}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://img.youtube.com/vi/${HEILUNG_VIDEO_ID}/hqdefault.jpg`}
                          alt=""
                          className="heilung-thumbnail-img"
                        />
                        <span aria-hidden="true" className="heilung-play-overlay">
                          ▶
                        </span>
                      </div>
                    </a>
                  )}
                </div>
              </div>

              <p className="heilung-video-caption" aria-hidden="true">
                Heilung — Norupo LIFA
              </p>
            </div>

            {/* ── Rune divider (3) ──────────────────────────────── */}
            <div aria-hidden="true" className="heilung-rune-divider">
              · ᛉ · ᚠ · ᛉ ·
            </div>

            {/* ── Section 5: Band lore ──────────────────────────── */}
            <div className="heilung-band-lore">
              <div aria-hidden="true" className="heilung-band-lore-label">
                OF THE BAND
              </div>
              <p>
                <a
                  href="https://en.wikipedia.org/wiki/Heilung"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Heilung on Wikipedia"
                  className="heilung-wiki-link"
                >
                  <span className="heilung-gold-term">Heilung</span>
                </a>{" "}
                — the word means healing in the old tongue. Three voices from Copenhagen, born in
                2014, conjured from runic inscription, Iron Age text, and Viking Age artifact. They
                call their work amplified history. I call it memory that refused to die.
              </p>

              {/* External link row */}
              <div className="heilung-external-link-row">
                <a
                  href="https://www.amplifiedhistory.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="amplifiedhistory.com, opens in new tab"
                  className="heilung-external-link"
                >
                  amplifiedhistory.com ↗
                </a>
              </div>
            </div>

            {/* ── Section 6: Wolf seal + dismiss ───────────────── */}
            <div className="heilung-seal-block">
              <p
                aria-label="Fenrir seal — The wolf remembers what the world forgot"
                className="heilung-wolf-seal"
              >
                ᚠᛖᚾᚱᛁᚱ — The wolf remembers what the world forgot — ᚠᛖᚾᚱᛁᚱ
              </p>
              <button
                onClick={dismiss}
                aria-label="Dismiss — honour given"
                className="heilung-dismiss-btn"
              >
                HEIÐR
              </button>
            </div>

            {/* ── Section 7: Rune band (bottom) ────────────────── */}
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeIn", delay: 0.4 }}
              className="heilung-rune-band heilung-rune-band--bottom"
            >
              {FUTHARK_REVERSED}
            </motion.div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
