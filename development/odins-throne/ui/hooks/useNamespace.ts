import { useState, useCallback, useEffect } from "react";

export interface NamespaceOption {
  id: string;
  label: string;
}

const STORAGE_KEY = "hlidskjalf:namespace";
const DEFAULT_NAMESPACE = "fenrir-agents";

function loadNamespace(): string {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) return v;
  } catch {
    // private browsing — ignore
  }
  return DEFAULT_NAMESPACE;
}

function saveNamespace(ns: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, ns);
  } catch {
    // private browsing — ignore
  }
}

export function useNamespace() {
  const [namespace, setNamespaceState] = useState<string>(loadNamespace);
  const [namespaces, setNamespaces] = useState<NamespaceOption[]>([
    { id: "fenrir-agents", label: "Fenrir Ledger Agents" },
    { id: "say-so-agents", label: "SaySo Agents" },
  ]);

  // Fetch available namespaces from API at startup
  useEffect(() => {
    fetch("/api/namespaces")
      .then((res) => res.json())
      .then((data: { namespaces?: NamespaceOption[] }) => {
        if (Array.isArray(data.namespaces) && data.namespaces.length > 0) {
          setNamespaces(data.namespaces);
          // If saved namespace is no longer in the list, reset to first
          const ids = data.namespaces.map((n) => n.id);
          setNamespaceState((prev) => {
            if (!ids.includes(prev)) {
              const fallback = data.namespaces![0]!.id;
              saveNamespace(fallback);
              return fallback;
            }
            return prev;
          });
        }
      })
      .catch(() => {
        // Non-fatal — default namespace list remains
      });
  }, []);

  const setNamespace = useCallback((ns: string) => {
    saveNamespace(ns);
    setNamespaceState(ns);
  }, []);

  return { namespace, namespaces, setNamespace };
}
