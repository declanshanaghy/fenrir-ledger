/**
 * /ledger route segment layout.
 *
 * Wraps all /ledger/* routes in the AppShell (sidebar + topbar + footer).
 * Marketing pages (/, /features, /pricing, etc.) use the (marketing) layout
 * with MarketingNavbar/Footer instead.
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Ledger of Fates",
};

export default function LedgerLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
