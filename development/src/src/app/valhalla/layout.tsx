/**
 * /valhalla route segment layout — server component.
 *
 * Sets the page <title> for the Valhalla (Closed Cards) route.
 * Per product/copywriting.md: "Valhalla — Fenrir Ledger"
 *
 * A separate layout.tsx is required because the page itself is a client
 * component ("use client") and cannot export Next.js metadata directly.
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Valhalla",
};

export default function ValhallaLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
