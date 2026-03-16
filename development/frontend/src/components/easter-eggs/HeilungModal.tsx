"use client";

/**
 * HeilungModal — Easter Egg #10: Heilung Krigsgaldr.
 *
 * Trigger: Ctrl+Shift+L (all platforms). Skip if form field focused.
 * Displays a 2-column modal with band profile (left) and YouTube embed (right).
 *
 * Repeatable — no one-time gate, no localStorage tracking.
 * No auto-dismiss timer. User dismisses via ESC, backdrop click, or X button.
 *
 * Desktop: CSS grid grid-cols-2 (~900px max-width)
 * Mobile: flex flex-col — video on top, info below
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/** YouTube video ID for Heilung — Krigsgaldr LIFA */
const HEILUNG_VIDEO_ID = "QRg_8NNPTD8";

export function HeilungModal() {
  const [visible, setVisible] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const dismiss = useCallback(() => setVisible(false), []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+Shift+L (all platforms)
      if (e.key === "L" && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        // Skip if a form field has focus
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

        e.preventDefault();
        setVisible((v) => !v);
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

  return (
    <AnimatePresence>
      {visible && (
        /* Backdrop */
        <motion.div
          key="heilung-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[500] flex items-center justify-center p-4"
          style={{ background: "rgba(7, 7, 13, 0.95)", backdropFilter: "blur(6px)" }}
          onClick={dismiss}
          aria-label="Heilung modal backdrop"
        >
          {/* Modal container — stop click propagation so backdrop-click only fires on backdrop */}
          <motion.div
            key="heilung-modal"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="relative w-full rounded-lg overflow-hidden"
            style={{
              maxWidth: "900px",
              background: "#07070d",
              border: "1px solid rgba(201, 146, 10, 0.35)",
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Heilung — Amplified History"
          >
            {/* Close button */}
            <button
              onClick={dismiss}
              aria-label="Close Heilung modal"
              className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-white/10"
              style={{ color: "#c9920a" }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* 2-column layout: mobile stacks (video top, info bottom); desktop side-by-side */}
            <div className="flex flex-col md:grid md:grid-cols-2">

              {/* LEFT COLUMN — Band Profile (shown below video on mobile) */}
              <div
                className="p-6 md:p-8 order-2 md:order-1 flex flex-col gap-4"
                style={{ borderRight: "1px solid rgba(201, 146, 10, 0.15)" }}
              >
                {/* Heading */}
                <div>
                  <h2
                    className="text-3xl font-bold tracking-wider uppercase"
                    style={{
                      fontFamily: "'Cinzel Decorative', var(--font-display), serif",
                      color: "#c9920a",
                      letterSpacing: "0.12em",
                    }}
                  >
                    HEILUNG
                  </h2>
                  <p
                    className="mt-1 text-sm italic"
                    style={{ color: "rgba(201, 146, 10, 0.65)" }}
                  >
                    Amplified History
                  </p>
                </div>

                {/* Bio */}
                <p className="text-sm leading-relaxed" style={{ color: "#d4cfc4" }}>
                  Heilung (&ldquo;healing&rdquo;) is a Norse experimental folk group formed in
                  Copenhagen, 2014. Their music draws from runic inscriptions, Iron Age texts,
                  and Viking Age artifacts &mdash; what they call &ldquo;amplified history from
                  early medieval northern Europe.&rdquo;
                </p>

                {/* Members */}
                <div>
                  <h3
                    className="text-xs font-semibold uppercase tracking-widest mb-3"
                    style={{ color: "rgba(201, 146, 10, 0.55)" }}
                  >
                    Members
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {[
                      {
                        name: "Kai Uwe Faust",
                        role: "Vocals — throat singing, Germanic chanting",
                      },
                      {
                        name: "Christopher Juul",
                        role: "Producer, percussion",
                      },
                      {
                        name: "Maria Franz",
                        role: "Vocals — traditional Norwegian techniques",
                      },
                    ].map(({ name, role }) => (
                      <li key={name} className="flex flex-col">
                        <span
                          className="text-sm font-medium"
                          style={{ color: "#e8e4d4" }}
                        >
                          {name}
                        </span>
                        <span
                          className="text-xs"
                          style={{ color: "rgba(232, 228, 212, 0.5)" }}
                        >
                          {role}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Link */}
                <a
                  href="https://www.amplifiedhistory.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline underline-offset-2 transition-opacity hover:opacity-80 mt-auto"
                  style={{ color: "#c9920a" }}
                >
                  amplifiedhistory.com
                </a>
              </div>

              {/* RIGHT COLUMN — Embedded YouTube Video (shown on top on mobile) */}
              <div className="p-4 md:p-6 order-1 md:order-2 flex flex-col justify-center">
                <div className="w-full aspect-video rounded-lg overflow-hidden">
                  <iframe
                    ref={iframeRef}
                    src={`https://www.youtube.com/embed/${HEILUNG_VIDEO_ID}?autoplay=1&rel=0`}
                    title="Heilung — Krigsgaldr LIFA"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                    className="w-full h-full"
                    style={{ border: "none" }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
