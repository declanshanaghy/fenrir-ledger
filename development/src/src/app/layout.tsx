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
import { ConsoleSignature } from "@/components/layout/ConsoleSignature";
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
    default: "Ledger of Fates — Fenrir Ledger",
    template: "%s — Fenrir Ledger",
  },
  description:
    "Break free from fee traps. Harvest every reward. Let no chain hold. Gleipnir breaks.",
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
      <body className="min-h-screen bg-background text-foreground antialiased">
        {/* Easter egg #4 — console ASCII art (client-only, once per session) */}
        <ConsoleSignature />
        {children}
      </body>
    </html>
  );
}
