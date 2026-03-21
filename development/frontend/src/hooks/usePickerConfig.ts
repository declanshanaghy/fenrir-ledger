"use client";

/**
 * usePickerConfig — fetches the Google Picker API key from the server.
 *
 * The key is served only to authenticated users via GET /api/config/picker,
 * keeping it out of the client JS bundle.
 */

import { useState, useEffect } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { ensureFreshToken } from "@/lib/auth/refresh-session";

export interface UsePickerConfigReturn {
  pickerApiKey: string | null;
  isLoading: boolean;
}

export function usePickerConfig(): UsePickerConfigReturn {
  const { status } = useAuthContext();
  const [pickerApiKey, setPickerApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") {
      setPickerApiKey(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    async function fetchKey() {
      try {
        const token = await ensureFreshToken();
        if (!token || cancelled) return;

        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
        };

        const res = await fetch("/api/config/picker", { headers });

        if (!res.ok || cancelled) return;

        const data = (await res.json()) as { pickerApiKey: string };
        if (!cancelled) {
          setPickerApiKey(data.pickerApiKey);
        }
      } catch {
        // Silently fail — picker will show as unavailable
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchKey();
    return () => { cancelled = true; };
  }, [status]);

  return { pickerApiKey, isLoading };
}
