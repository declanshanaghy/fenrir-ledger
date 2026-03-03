/**
 * Root Layout — Fenrir Ledger
 *
 * ╔══════════════════════════════════════════════════════╗
 * ║          F E N R I R   L E D G E R                  ║
 * ║    Break free. Harvest every reward. Let no          ║
 * ║    chain hold.                                       ║
 * ╠══════════════════════════════════════════════════════╣
 * ║  Forged by FiremanDecko in the fires of Muspelheim. ║
 * ║  Debugged by Loki (mostly for fun).                  ║
 * ║  Warded by Freya's seiðr.                            ║
 * ║  Designed by Luna under the light of Bifröst.        ║
 * ╠══════════════════════════════════════════════════════╣
 * ║  Gleipnir was made of six impossible things.         ║
 * ║  Can you find them all?                              ║
 * ╚══════════════════════════════════════════════════════╝
 */

import type { Metadata } from "next";
import {
  Cinzel,
  Cinzel_Decorative,
  Source_Serif_4,
  JetBrains_Mono,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ConsoleSignature } from "@/components/layout/ConsoleSignature";
import { AppShell } from "@/components/layout/AppShell";
import { AuthProvider } from "@/contexts/AuthContext";
import { EntitlementProvider } from "@/contexts/EntitlementContext";
import { RagnarokProvider } from "@/contexts/RagnarokContext";
import "./globals.css";

// ── Fonts ────────────────────────────────────────────────────────────────────

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  weight: ["400", "600", "700", "900"],
  display: "swap",
});

const cinzelDecorative = Cinzel_Decorative({
  subsets: ["latin"],
  variable: "--font-cinzel-decorative",
  weight: ["400", "700", "900"],
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  weight: ["300", "400", "600"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  display: "swap",
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: {
    // Dashboard (/) inherits this default: "Ledger of Fates — Fenrir Ledger"
    // Sub-pages set their own title via route segment layouts and use the template.
    // Per product/copywriting.md page title table.
    default: "Ledger of Fates — Fenrir Ledger",
    template: "%s — Fenrir Ledger",
  },
  description:
    "Track your credit card fees, sign-up bonuses, and deadlines. Never miss a fee or lose a reward.",
  // Easter egg #7 — runic cipher: ᚠᛖᚾᚱᛁᚱ = FENRIR in Elder Futhark
  other: {
    "fenrir:runes": "ᚠᛖᚾᚱᛁᚱ",
  },
};

// ── Layout ────────────────────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={[
        "dark",
        cinzel.variable,
        cinzelDecorative.variable,
        sourceSerif.variable,
        jetbrainsMono.variable,
      ].join(" ")}
    >
      <body className="bg-background text-foreground antialiased">
        {/* AuthProvider — anonymous-first. No redirects. Resolves householdId for all users. */}
        <AuthProvider>
          {/* EntitlementProvider — platform-agnostic subscription tier. Nested inside AuthProvider. */}
          <EntitlementProvider>
            {/* RagnarokProvider — activates threshold mode when ≥5 cards are urgent. */}
            <RagnarokProvider>
              {/* Easter egg #4 — console ASCII art (client-only, once per session) */}
              <ConsoleSignature />
              <AppShell>{children}</AppShell>
            </RagnarokProvider>
          </EntitlementProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
