/**
 * /cards/new route segment layout — server component.
 *
 * Sets the page <title> for the Add Card route.
 * Per product/copywriting.md: "Add Card — Fenrir Ledger"
 *
 * A separate layout.tsx is required because the page itself is a client
 * component ("use client") and cannot export Next.js metadata directly.
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Add Card",
};

export default function NewCardLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
