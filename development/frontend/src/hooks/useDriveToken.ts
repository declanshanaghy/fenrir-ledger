"use client";

/**
 * useDriveToken — manages the Drive-scoped access token for Path B.
 *
 * Stores the token separately from the main Fenrir session (two-token architecture).
 * localStorage key: "fenrir:drive-token" → { access_token, expires_at }
 *
 * Clears the Drive token when the user signs out (auth status changes to anonymous).
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { requestDriveAccessToken, GisError } from "@/lib/google/gis";

const STORAGE_KEY = "fenrir:drive-token";

/** Buffer before expiry to trigger re-request (2 minutes). */
const EXPIRY_BUFFER_MS = 2 * 60 * 1000;

interface StoredDriveToken {
  access_token: string;
  expires_at: number;
}

/**
 * Reads the Drive token from localStorage.
 * Returns null if absent, expired, or unparseable.
 */
function getStoredToken(): StoredDriveToken | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDriveToken;

    if (parsed.expires_at <= Date.now() + EXPIRY_BUFFER_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function storeToken(accessToken: string, expiresIn: number): void {
  if (typeof window === "undefined") return;
  const data: StoredDriveToken = {
    access_token: accessToken,
    expires_at: Date.now() + expiresIn * 1000,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export interface UseDriveTokenReturn {
  /** True if a valid (non-expired) Drive access token exists */
  hasDriveAccess: boolean;
  /** The current valid Drive access token, or null */
  driveToken: string | null;
  /** True while the GIS consent popup is open */
  isRequesting: boolean;
  /** Triggers the GIS popup. Returns the token on success, null on decline. */
  requestDriveAccess: () => Promise<string | null>;
  /** Last error from a failed consent request */
  driveError: GisError | null;
  /** Clears the error state */
  clearDriveError: () => void;
}

export function useDriveToken(): UseDriveTokenReturn {
  const { status } = useAuthContext();
  const [token, setToken] = useState<StoredDriveToken | null>(() => getStoredToken());
  const [isRequesting, setIsRequesting] = useState(false);
  const [driveError, setDriveError] = useState<GisError | null>(null);
  const prevStatusRef = useRef(status);

  // Clear Drive token when user signs out
  useEffect(() => {
    if (prevStatusRef.current === "authenticated" && status === "anonymous") {
      clearStoredToken();
      setToken(null);
      setDriveError(null);
    }
    prevStatusRef.current = status;
  }, [status]);

  // Re-check stored token on mount (handles page refreshes)
  useEffect(() => {
    setToken(getStoredToken());
  }, []);

  const hasDriveAccess = token !== null;
  const driveToken = token?.access_token ?? null;

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const requestDriveAccess = useCallback(async (): Promise<string | null> => {
    if (!clientId) {
      console.error("[Fenrir] NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured");
      return null;
    }

    setIsRequesting(true);
    setDriveError(null);

    try {
      const result = await requestDriveAccessToken(clientId);
      storeToken(result.access_token, result.expires_in);
      setToken({
        access_token: result.access_token,
        expires_at: Date.now() + result.expires_in * 1000,
      });
      return result.access_token;
    } catch (err) {
      if (err instanceof GisError) {
        setDriveError(err);
      }
      return null;
    } finally {
      setIsRequesting(false);
    }
  }, [clientId]);

  const clearDriveError = useCallback(() => {
    setDriveError(null);
  }, []);

  return {
    hasDriveAccess,
    driveToken,
    isRequesting,
    requestDriveAccess,
    driveError,
    clearDriveError,
  };
}
