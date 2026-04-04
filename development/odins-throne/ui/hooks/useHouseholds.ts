import { useState, useEffect, useCallback } from "react";
import type { OdinHousehold, OdinCard } from "../lib/types";

interface HouseholdsState {
  households: OdinHousehold[];
  loading: boolean;
  error: string | null;
}

interface CardsState {
  cards: OdinCard[];
  loading: boolean;
  error: string | null;
}

export function useHouseholds(): HouseholdsState & { refresh: () => void } {
  const [state, setState] = useState<HouseholdsState>({
    households: [],
    loading: false,
    error: null,
  });

  const fetch_ = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch("/api/households");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as { households: OdinHousehold[] };
      setState({ households: data.households, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setState((s) => ({ ...s, loading: false, error: message }));
    }
  }, []);

  useEffect(() => {
    void fetch_();
  }, [fetch_]);

  return { ...state, refresh: fetch_ };
}

export function useCards(householdId: string | null): CardsState & { refresh: () => void } {
  const [state, setState] = useState<CardsState>({
    cards: [],
    loading: false,
    error: null,
  });

  const fetch_ = useCallback(async () => {
    if (!householdId) {
      setState({ cards: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(`/api/households/${encodeURIComponent(householdId)}/cards`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as { cards: OdinCard[] };
      setState({ cards: data.cards, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setState((s) => ({ ...s, loading: false, error: message }));
    }
  }, [householdId]);

  useEffect(() => {
    void fetch_();
  }, [fetch_]);

  return { ...state, refresh: fetch_ };
}
