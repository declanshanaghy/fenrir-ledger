"use client";

/**
 * IssuerLogo — displays an issuer's SVG logo from disk or falls back to text name.
 *
 * For known issuers: renders an <img> pointing at /issuers/<name>.svg.
 * For unknown/custom issuers: renders the issuer name as plain text.
 *
 * When showLabel is true: renders logo + rune char + rune name inline.
 * Format: [logo] ᚱ Raidho
 */

import { getIssuerMeta, getIssuerName } from "@/lib/issuer-utils";

interface IssuerLogoProps {
  /** The issuer ID from the card data (e.g. "chase", "amex"). */
  issuerId: string;
  /** Optional className for the container element. */
  className?: string;
  /**
   * When true, displays the rune character and rune name after the logo.
   * Format: [logo] <RuneChar> <RuneName>
   * Unknown issuers show their name as text (no rune).
   */
  showLabel?: boolean;
}

/**
 * IssuerLogo — renders an SVG logo for known issuers or text name fallback.
 *
 * @param issuerId  - Issuer identifier from KNOWN_ISSUERS.
 * @param className - Optional CSS class for the wrapper.
 * @param showLabel - When true, renders rune char + rune name after the logo.
 */
export function IssuerLogo({ issuerId, className, showLabel = false }: IssuerLogoProps) {
  const issuerMeta = getIssuerMeta(issuerId);
  const issuerName = getIssuerName(issuerId);

  if (!issuerMeta) {
    return (
      <span className={className} title={issuerName} data-testid="issuer-logo">
        {issuerName}
      </span>
    );
  }

  return (
    <span
      className={className}
      title={issuerName}
      style={{ display: "inline-flex", alignItems: "center", gap: "0.35em", verticalAlign: "middle" }}
      data-testid="issuer-logo"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={issuerMeta.logoPath}
        alt={issuerName}
        style={{ height: "1em", width: "auto", flexShrink: 0 }}
      />
      {showLabel && (
        <>
          <span aria-hidden="true" data-testid="issuer-rune">{issuerMeta.rune}</span>
          <span data-testid="issuer-rune-name">{issuerMeta.runeName}</span>
        </>
      )}
    </span>
  );
}
