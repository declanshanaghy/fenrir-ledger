"use client";

/**
 * useLokiMode — Easter Egg #3 state manager.
 *
 * Listens for "fenrir:loki-mode" CustomEvents dispatched by Footer.tsx.
 * When active: cards are shuffled into a random order and each card gets
 * a random Norse realm name as its status badge label.
 * After 5 s the Footer dispatches { active: false } and order is restored.
 *
 * Extracted from Dashboard.tsx (issue #1684) to reduce cyclomatic complexity.
 */

import { useState, useEffect } from "react";
import type { Card } from "@/lib/types";
import { LOKI_REALM_NAMES } from "@/components/layout/Footer";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Shuffles a copy of an array using Fisher-Yates and returns it. */
function shuffleArray<T>(arr: T[]): T[] {
  const a: T[] = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}

/** Returns a random realm name from the Loki Mode name list. */
function randomRealm(): string {
  const idx = Math.floor(Math.random() * LOKI_REALM_NAMES.length);
  return LOKI_REALM_NAMES[idx] ?? LOKI_REALM_NAMES[0];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseLokiModeResult {
  lokiActive: boolean;
  /** Cards in shuffled Loki order (only relevant when lokiActive is true). */
  lokiOrder: Card[];
  /** Per-card random realm label map (only relevant when lokiActive is true). */
  lokiLabels: Record<string, string>;
}

export function useLokiMode(cards: Card[]): UseLokiModeResult {
  const [lokiActive, setLokiActive] = useState(false);
  const [lokiOrder, setLokiOrder] = useState<Card[]>([]);
  const [lokiLabels, setLokiLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    function handleLokiMode(e: Event) {
      const active = (e as CustomEvent<{ active: boolean }>).detail?.active ?? false;

      if (active) {
        const shuffled = shuffleArray(cards);
        const labels: Record<string, string> = {};
        for (const card of cards) {
          labels[card.id] = randomRealm();
        }
        setLokiOrder(shuffled);
        setLokiLabels(labels);
        setLokiActive(true);
      } else {
        setLokiActive(false);
        setLokiOrder([]);
        setLokiLabels({});
      }
    }

    window.addEventListener("fenrir:loki-mode", handleLokiMode);
    return () => window.removeEventListener("fenrir:loki-mode", handleLokiMode);
  }, [cards]);

  return { lokiActive, lokiOrder, lokiLabels };
}
