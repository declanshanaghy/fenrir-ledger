/**
 * UmamiScript — conditionally renders the Umami analytics <Script> tag.
 *
 * Extracted from RootLayout so it can be unit-tested independently.
 * Umami respects Do Not Track by default. No PII is collected.
 *
 * @param websiteId  The Umami website UUID. Pass undefined/empty to suppress rendering.
 * @param nonce      Optional CSP nonce forwarded from the server.
 */

import Script from "next/script";

interface UmamiScriptProps {
  websiteId?: string;
  nonce?: string;
}

export function UmamiScript({ websiteId, nonce }: UmamiScriptProps) {
  if (!websiteId) return null;

  return (
    <Script
      id="umami-analytics"
      src="https://analytics.fenrirledger.com/script.js"
      data-website-id={websiteId}
      strategy="afterInteractive"
      {...(nonce ? { nonce } : {})}
    />
  );
}
