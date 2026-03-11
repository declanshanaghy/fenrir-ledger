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
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "next-themes";
import { ConsoleSignature } from "@/components/layout/ConsoleSignature";
import { AuthProvider } from "@/contexts/AuthContext";
import { EntitlementProvider } from "@/contexts/EntitlementContext";
import { RagnarokProvider } from "@/contexts/RagnarokContext";
import { getNonce } from "@/lib/use-nonce";
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
    // Root (/) is marketing home; /ledger sub-pages set their own title.
    // Per product/copywriting.md page title table.
    default: "Fenrir Ledger — Break Free from Credit Card Traps",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = await getNonce();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={[
        cinzel.variable,
        cinzelDecorative.variable,
        sourceSerif.variable,
        jetbrainsMono.variable,
      ].join(" ")}
    >
      <body className="bg-background text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey="fenrir-theme"
          {...(nonce ? { nonce } : {})}
        >
          {/* AuthProvider — anonymous-first. No redirects. Resolves householdId for all users. */}
          <AuthProvider>
            {/* EntitlementProvider — platform-agnostic subscription tier. Nested inside AuthProvider. */}
            <EntitlementProvider>
              {/* RagnarokProvider — activates threshold mode when >=5 cards are urgent. */}
              <RagnarokProvider>
                {/* Easter egg #4 — console ASCII art (client-only, once per session) */}
                <ConsoleSignature />
                {children}
              </RagnarokProvider>
            </EntitlementProvider>
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
        {/* GA4 — only rendered when NEXT_PUBLIC_GA4_MEASUREMENT_ID is set */}
        {process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID}`}
              strategy="afterInteractive"
              nonce={nonce}
            />
            <Script
              id="ga4-init"
              strategy="afterInteractive"
              nonce={nonce}
            >
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
