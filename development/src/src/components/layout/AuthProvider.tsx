"use client";

/**
 * AuthProvider — wraps the app in the Auth.js v5 SessionProvider.
 *
 * This client component is required because SessionProvider uses React Context,
 * which is only available in client components. It is imported in the root layout
 * (a Server Component) and wraps all children.
 *
 * All client components that call useSession() must be descendants of this provider.
 *
 * See ADR-004 for the auth architecture decision.
 */

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  return <SessionProvider>{children}</SessionProvider>;
}
