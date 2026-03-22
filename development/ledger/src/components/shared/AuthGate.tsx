"use client";

import { useAuth } from "@/hooks/useAuth";
import type { ReactNode } from "react";

interface AuthGateProps {
  /** Which auth status is required to show children. Default: "authenticated" */
  require?: "authenticated" | "anonymous";
  /** Content to show when the auth condition is met */
  children: ReactNode;
  /** Optional fallback to render when condition is NOT met (default: null) */
  fallback?: ReactNode;
}

/**
 * AuthGate — conditionally renders children based on auth status.
 *
 * Usage:
 *   <AuthGate>Only signed-in users see this</AuthGate>
 *   <AuthGate require="anonymous">Only anonymous users see this</AuthGate>
 *   <AuthGate fallback={<SignInPrompt />}>Signed-in content</AuthGate>
 */
export function AuthGate({ require = "authenticated", children, fallback = null }: AuthGateProps) {
  const { status } = useAuth();

  // Don't render anything while auth is resolving
  if (status === "loading") return null;

  if (status === require) return <>{children}</>;

  return <>{fallback}</>;
}
