"use client";

/**
 * IssuerLogo — displays an issuer's SVG logo from disk or falls back to text name.
 *
 * For known issuers: renders an <img> pointing at /issuers/<name>.svg.
 * For unknown/custom issuers: renders the issuer name as plain text.
 */

import { getIssuerMeta, getIssuerName } from "@/lib/issuer-utils";

interface IssuerLogoProps {
  /** The issuer ID from the card data (e.g. "chase", "amex"). */
  issuerId: string;
  /** Optional className for the container element. */
  className?: string;
}

/**
 * IssuerLogo — renders an SVG logo for known issuers or text name fallback.
 *
 * @param issuerId  - Issuer identifier from KNOWN_ISSUERS.
 * @param className - Optional CSS class for the wrapper.
 */
export function IssuerLogo({ issuerId, className }: IssuerLogoProps) {
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
    <span className={className} title={issuerName} style={{ display: "inline-block", verticalAlign: "middle" }} data-testid="issuer-logo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={issuerMeta.logoPath}
        alt={issuerName}
        style={{ height: "1em", width: "auto" }}
      />
    </span>
  );
}
