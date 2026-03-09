/**
 * Ledger Layout — /ledger
 *
 * Wraps all app routes under /ledger in the AppShell (sidebar + topbar + footer).
 * The AppShell provides the persistent application frame — TopBar, SideNav, Footer.
 *
 * This layout was extracted from the root layout during the route restructure
 * (Issue #371) so that marketing pages at / render without the AppShell.
 */

import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: {
    default: "Ledger of Fates",
    template: "%s — Fenrir Ledger",
  },
};

export default function LedgerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppShell>{children}</AppShell>;
}
