"use client";

/**
 * IssuerLogo — displays an issuer's inline SVG logo or falls back to text name.
 *
 * For known issuers: renders an inline SVG component with simplified logo marks
 * inspired by official logos, using the issuer's brand colors.
 *
 * For unknown/custom issuers: renders the issuer name as plain text
 * (same as the previous behavior).
 *
 * All logos are designed to work on both dark and light theme backgrounds.
 */

import { getIssuerMeta, getIssuerName } from "@/lib/issuer-utils";

interface IssuerLogoProps {
  /** The issuer ID from the card data (e.g. "chase", "amex"). */
  issuerId: string;
  /** Optional className for the container element. */
  className?: string;
}

/**
 * Renders the inline SVG logo for a known issuer.
 * Each logo is a simplified mark inspired by the official logo.
 */
function IssuerSVG({ issuerId, brandColor }: { issuerId: string; brandColor: string }) {
  switch (issuerId) {
    case "chase":
      // Blue octagon - 4 interlocking rectangular segments forming the Chase logo
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ height: "1em", width: "auto" }}>
          <path d="M7 2L2 7V17L7 22H17L22 17V7L17 2H7Z" fill={brandColor} />
          <path d="M9 6H15V9H18V15H15V18H9V15H6V9H9V6Z" fill="white" />
        </svg>
      );

    case "bank_of_america":
      // Red and blue flag/banner shapes
      return (
        <svg viewBox="0 0 32 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ height: "1em", width: "auto" }}>
          <path d="M2 4L16 8L30 4V12L16 16L2 12V4Z" fill={brandColor} />
          <path d="M2 12L16 16L30 12V20L16 16L2 20V12Z" fill="#0060A9" />
        </svg>
      );

    case "capital_one":
      // Red swoosh arc
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ height: "1em", width: "auto" }}>
          <path d="M12 3C6.5 3 2 7.5 2 13C2 18.5 6.5 23 12 23C17.5 23 22 18.5 22 13C22 10 20.5 7.5 18 6" stroke={brandColor} strokeWidth="3" strokeLinecap="round" />
        </svg>
      );

    case "wells_fargo":
      // Simplified stagecoach/shield
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ height: "1em", width: "auto" }}>
          <path d="M12 2L4 6V14C4 18 8 21 12 22C16 21 20 18 20 14V6L12 2Z" fill={brandColor} />
          <path d="M12 5L7 7.5V13C7 15.5 9 17.5 12 18C15 17.5 17 15.5 17 13V7.5L12 5Z" fill="#FFC41F" />
        </svg>
      );

    case "amex":
      // Blue square with simplified wordmark
      return (
        <svg viewBox="0 0 32 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ height: "1em", width: "auto" }}>
          <rect x="2" y="4" width="28" height="16" rx="2" fill={brandColor} />
          <path d="M6 12L8 8H10L12 12L10 16H8L6 12Z M14 8H16L17 10L18 8H20L18 12L20 16H18L17 14L16 16H14L16 12L14 8Z" fill="white" />
        </svg>
      );

    case "citibank":
      // The iconic arc over the letter t
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ height: "1em", width: "auto" }}>
          <path d="M4 8C4 8 8 4 12 4C16 4 20 8 20 8" stroke={brandColor} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M10 10H14M12 10V20" stroke={brandColor} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

    case "discover":
      // Orange circle/sunburst
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ height: "1em", width: "auto" }}>
          <circle cx="12" cy="12" r="8" fill={brandColor} />
          <circle cx="15" cy="12" r="5" fill="#FFC41F" opacity="0.8" />
        </svg>
      );

    case "us_bank":
      // Red horizontal stripe motif
      return (
        <svg viewBox="0 0 32 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ height: "1em", width: "auto" }}>
          <rect x="2" y="4" width="28" height="4" fill={brandColor} />
          <rect x="2" y="10" width="28" height="4" fill={brandColor} />
          <rect x="2" y="16" width="28" height="4" fill={brandColor} />
        </svg>
      );

    case "barclays":
      // Blue spread eagle
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ height: "1em", width: "auto" }}>
          <path d="M12 6L8 10H10V14H14V10H16L12 6Z" fill={brandColor} />
          <path d="M6 14L4 18H8L10 16V14H6Z" fill={brandColor} />
          <path d="M18 14L20 18H16L14 16V14H18Z" fill={brandColor} />
        </svg>
      );

    case "hsbc":
      // Red hexagon made of triangles
      return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ height: "1em", width: "auto" }}>
          <path d="M12 2L4 12L12 22L20 12L12 2Z" fill={brandColor} />
          <path d="M12 6L8 12H16L12 6Z" fill="white" />
          <path d="M12 18L16 12H8L12 18Z" fill="white" />
        </svg>
      );

    default:
      return null;
  }
}

/**
 * IssuerLogo — renders an inline SVG logo for known issuers or text name fallback.
 *
 * @param issuerId  - Issuer identifier from KNOWN_ISSUERS.
 * @param className - Optional CSS class for the wrapper.
 */
export function IssuerLogo({ issuerId, className }: IssuerLogoProps) {
  const issuerMeta = getIssuerMeta(issuerId);
  const issuerName = getIssuerName(issuerId);

  if (!issuerMeta) {
    // Unknown issuer — fall back to text name
    return (
      <span className={className} title={issuerName}>
        {issuerName}
      </span>
    );
  }

  const logo = IssuerSVG({ issuerId, brandColor: issuerMeta.brandColor });

  if (!logo) {
    // Fallback for any issuer without a logo definition
    return (
      <span className={className} title={issuerName}>
        {issuerName}
      </span>
    );
  }

  return (
    <span className={className} title={issuerName} style={{ display: "inline-block", verticalAlign: "middle" }}>
      {logo}
    </span>
  );
}
