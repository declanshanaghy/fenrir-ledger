import React, { createContext, useContext, useState } from "react";
import { log } from "@fenrir/logger";

export interface SelectionState {
  selectedUserId: string | null;
  selectedHouseholdId: string | null;
  selectedFp: string | null;
  selectedSubId: string | null;
  setSelectedUserId: (id: string | null) => void;
  setSelectedHouseholdId: (id: string | null) => void;
  setSelectedFp: (fp: string | null) => void;
  setSelectedSubId: (id: string | null) => void;
}

const SelectionContext = createContext<SelectionState | null>(null);

export function SelectionProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  log.debug("SelectionProvider render");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);
  const [selectedFp, setSelectedFp] = useState<string | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  return (
    <SelectionContext.Provider
      value={{
        selectedUserId,
        selectedHouseholdId,
        selectedFp,
        selectedSubId,
        setSelectedUserId,
        setSelectedHouseholdId,
        setSelectedFp,
        setSelectedSubId,
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection(): SelectionState {
  log.debug("useSelection called");
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used within SelectionProvider");
  return ctx;
}
