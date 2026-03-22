/**
 * /ledger route segment layout.
 *
 * Wraps all /ledger/* routes in the LedgerShell (slim top bar + sidebar +
 * mobile bottom tab bar). No marketing navbar or footer.
 *
 * Marketing pages (/, /features, /pricing, etc.) use the (marketing) layout
 * with MarketingNavbar/Footer instead.
 *
 * Issue: #372
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LedgerShell } from "@/components/layout/LedgerShell";

export const metadata: Metadata = {
  title: "Ledger of Fates",
};

export default function LedgerLayout({ children }: { children: ReactNode }) {
  return <LedgerShell>{children}</LedgerShell>;
}
