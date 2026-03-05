"use client";

/**
 * LcarsOverlay — Easter Egg #10: LCARS Mode.
 *
 * Trigger: Ctrl+Shift+L (all platforms).
 * Displays a Star Trek LCARS-style diagnostic overlay for 5 seconds.
 * Shows stardate, card counts, and threat assessment.
 *
 * Can be triggered multiple times (no one-time gate like ForgeMasterEgg).
 */

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { getAllCardsGlobal, getClosedCards } from "@/lib/storage";

function computeStardate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  const stardate = (year - 1987) * 1000 + (dayOfYear / 365) * 1000;
  return stardate.toFixed(1);
}

type ThreatLevel = "NONE" | "ELEVATED" | "CRITICAL";

function getThreatLevel(urgentCount: number): ThreatLevel {
  if (urgentCount >= 5) return "CRITICAL";
  if (urgentCount >= 3) return "ELEVATED";
  return "NONE";
}

function getThreatColor(level: ThreatLevel): string {
  switch (level) {
    case "CRITICAL": return "#ff3333";
    case "ELEVATED": return "#ff9900";
    case "NONE": return "#33cc66";
  }
}

export function LcarsOverlay() {
  const [visible, setVisible] = useState(false);
  const { householdId, status } = useAuth();

  const dismiss = useCallback(() => setVisible(false), []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+Shift+L (all platforms)
      if (e.key === "L" && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        // Skip if a form field has focus
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

        e.preventDefault();
        setVisible(true);
      }

      // ESC to dismiss
      if (e.key === "Escape" && visible) {
        dismiss();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, dismiss]);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(dismiss, 5000);
    return () => clearTimeout(timer);
  }, [visible, dismiss]);

  // Gather card data
  const activeCards = status !== "loading" && householdId
    ? getAllCardsGlobal(householdId)
    : [];
  const closedCards = status !== "loading" && householdId
    ? getClosedCards(householdId)
    : [];
  const urgentCards = activeCards.filter(
    (c) => c.status === "fee_approaching" || c.status === "promo_expiring"
  );
  const threatLevel = getThreatLevel(urgentCards.length);
  const threatColor = getThreatColor(threatLevel);
  const stardate = computeStardate();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[500] cursor-pointer"
          onClick={dismiss}
          role="status"
          aria-live="polite"
          aria-label="LCARS diagnostic overlay"
          style={{
            background: "rgba(0, 0, 0, 0.92)",
            fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
          }}
        >
          {/* Scanline effect */}
          <motion.div
            initial={{ top: "-2px" }}
            animate={{ top: "100%" }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="absolute left-0 right-0 h-[2px] pointer-events-none"
            style={{ background: "rgba(255, 153, 0, 0.3)" }}
          />

          {/* LCARS frame */}
          <div className="h-full flex flex-col p-6 md:p-10">
            {/* Top bar */}
            <div className="flex items-center gap-3 mb-8">
              <div className="h-8 w-32 rounded-l-full" style={{ background: "#ff9900" }} />
              <div className="h-8 w-20" style={{ background: "#cc99cc" }} />
              <div className="h-8 w-16" style={{ background: "#9999ff" }} />
              <div className="h-8 flex-1 rounded-r-sm" style={{ background: "#ff9900" }} />
              <span className="text-xs tracking-[0.2em] uppercase" style={{ color: "#ff9900" }}>
                LCARS 47634
              </span>
            </div>

            {/* Main content grid */}
            <div className="flex-1 flex gap-6">
              {/* Left sidebar blocks */}
              <div className="hidden md:flex flex-col gap-2 w-24">
                {["#ff9900", "#cc99cc", "#9999ff", "#ff9900", "#cc6666", "#9999ff"].map((color, i) => (
                  <div
                    key={i}
                    className="rounded-sm"
                    style={{ background: color, height: `${30 + Math.random() * 40}px`, opacity: 0.85 }}
                  />
                ))}
              </div>

              {/* Data panels */}
              <div className="flex-1 flex flex-col gap-6">
                {/* Stardate */}
                <div>
                  <div className="text-[10px] tracking-[0.3em] uppercase mb-1" style={{ color: "#cc99cc" }}>
                    STARDATE
                  </div>
                  <div className="text-3xl md:text-4xl font-bold tracking-wider" style={{ color: "#ff9900" }}>
                    {stardate}
                  </div>
                </div>

                {/* Card diagnostics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-[10px] tracking-[0.3em] uppercase mb-1" style={{ color: "#9999ff" }}>
                      ACTIVE CARDS
                    </div>
                    <div className="text-2xl font-bold" style={{ color: "#ff9900" }}>
                      {activeCards.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] tracking-[0.3em] uppercase mb-1" style={{ color: "#9999ff" }}>
                      VALHALLA
                    </div>
                    <div className="text-2xl font-bold" style={{ color: "#ff9900" }}>
                      {closedCards.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] tracking-[0.3em] uppercase mb-1" style={{ color: "#9999ff" }}>
                      URGENT
                    </div>
                    <div className="text-2xl font-bold" style={{ color: threatColor }}>
                      {urgentCards.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] tracking-[0.3em] uppercase mb-1" style={{ color: "#9999ff" }}>
                      THREAT LEVEL
                    </div>
                    <div className="text-2xl font-bold" style={{ color: threatColor }}>
                      {threatLevel}
                    </div>
                  </div>
                </div>

                {/* System status */}
                <div className="mt-4 border-t pt-4" style={{ borderColor: "rgba(255, 153, 0, 0.2)" }}>
                  <div className="text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: "#cc99cc" }}>
                    SYSTEM STATUS
                  </div>
                  <div className="flex flex-col gap-1.5 text-xs" style={{ color: "#ff9900" }}>
                    <div>▸ FENRIR CONTAINMENT: {threatLevel === "CRITICAL" ? "FAILING" : threatLevel === "ELEVATED" ? "STRESSED" : "NOMINAL"}</div>
                    <div>▸ GLEIPNIR INTEGRITY: {activeCards.length > 0 ? "HOLDING" : "NO CHAINS FORGED"}</div>
                    <div>▸ BIFRÖST LINK: {householdId ? "AUTHENTICATED" : "ANONYMOUS"}</div>
                    <div>▸ RAGNARÖK INDEX: {urgentCards.length > 0 ? `${urgentCards.length} ANOMAL${urgentCards.length === 1 ? "Y" : "IES"} DETECTED` : "ALL CLEAR"}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="flex items-center gap-3 mt-8">
              <div className="h-6 w-24 rounded-l-full" style={{ background: "#9999ff" }} />
              <div className="h-6 flex-1" style={{ background: "#cc99cc", opacity: 0.6 }} />
              <div className="h-6 w-40 rounded-r-sm flex items-center justify-end px-3" style={{ background: "#ff9900" }}>
                <span className="text-[9px] tracking-[0.15em]" style={{ color: "#000" }}>
                  USS FENRIR NCC-9653
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
