"use client";

/**
 * IssuerLogo — displays an issuer's SVG logo image or falls back to text name.
 *
 * For known issuers: renders an <img> with the SVG logo from
 * public/static/logos/issuers/. The issuer text name is used as alt text
 * and appears as a tooltip on hover.
 *
 * For unknown/custom issuers: renders the issuer name as plain text
 * (same as the previous behavior).
 *
 * All logos are white text on transparent backgrounds, designed for the
 * dark Norse War Room theme.
 */

import { getIssuerLogoPath, getIssuerName } from "@/lib/issuer-utils";

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
  const logoPath = getIssuerLogoPath(issuerId);
  const issuerName = getIssuerName(issuerId);

  if (!logoPath) {
    // Unknown issuer — fall back to text name
    return (
      <span className={className} title={issuerName}>
        {issuerName}
      </span>
    );
  }

  return (
    <img
      src={logoPath}
      alt={issuerName}
      title={issuerName}
      className={className}
      // Fixed height, auto width to preserve aspect ratio
      style={{ height: "1em", width: "auto", display: "inline-block" }}
      loading="lazy"
    />
  );
}
