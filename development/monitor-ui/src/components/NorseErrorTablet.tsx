/**
 * NorseErrorTablet — full-pane error display for TTL-expired sessions.
 *
 * Shown when a pod's TTL has expired or a node is unreachable.
 * Styled as an ancient stone tablet: Elder Futhark rune decorations,
 * Cinzel Decorative headings, void-black bg, gold accents.
 */

import type { ReactNode } from "react";
import { ERROR_TABLET_SEALS, WIKI_LINKS } from "../lib/constants";

// Elder Futhark rows used as decorative borders
const RUNE_ROW_TOP = "ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ ᚺ ᚾ ᛁ ᛃ ᛇ ᛈ ᛉ ᛊ ᛏ ᛒ ᛖ ᛗ ᛚ ᛜ ᛞ ᛟ";
const RUNE_ROW_BTM = "ᛟ ᛞ ᛜ ᛚ ᛗ ᛖ ᛒ ᛏ ᛊ ᛉ ᛈ ᛇ ᛃ ᛁ ᚾ ᚺ ᚹ ᚷ ᚲ ᚱ ᚨ ᚦ ᚢ ᚠ";
const RUNE_GLYPH = "ᚦ"; // Thurisaz — warning / thorn

type Variant = "ttl-expired" | "node-unreachable";

const VARIANT_CONTENT: Record<Variant, { ariaLabel: string; heading: string; subheading: ReactNode }> = {
  "ttl-expired": {
    ariaLabel: "Session error: pod TTL expired",
    heading: "The Eternal Halls Are Sealed",
    subheading: (
      <>
        This vessel has departed{" "}
        <a
          className="wiki-link"
          href={WIKI_LINKS["Yggdrasil"]}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Yggdrasil on Wikipedia, opens in new tab"
        >
          Yggdrasil
        </a>
      </>
    ),
  },
  "node-unreachable": {
    ariaLabel: "Session error: node unreachable",
    heading: "The Bifröst Has Fallen",
    subheading: (
      <>
        The node that bore this vessel is beyond reach — the{" "}
        <a
          className="wiki-link"
          href={WIKI_LINKS["Bifröst"]}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Bifröst on Wikipedia, opens in new tab"
        >
          Bifröst
        </a>{" "}
        bridge is severed
      </>
    ),
  },
};

interface Props {
  sessionId: string;
  message: string;
  variant?: Variant;
}

export function NorseErrorTablet({ sessionId, message, variant = "ttl-expired" }: Props) {
  const { ariaLabel, heading, subheading } = VARIANT_CONTENT[variant];
  const seal = ERROR_TABLET_SEALS[variant];
  return (
    <div
      className="norse-error-tablet"
      role="alert"
      aria-label={ariaLabel}
      aria-live="assertive"
    >
      <div className="net-rune-border" aria-hidden="true">
        {RUNE_ROW_TOP}
      </div>

      <div className="net-glyph" aria-hidden="true">
        {RUNE_GLYPH}
      </div>

      <h1 className="net-heading">{heading}</h1>
      <p className="net-subheading">{subheading}</p>

      <div className="net-divider" aria-hidden="true">
        ᚠ ᚢ ᚦ ᛟ ᛞ ᛜ ᛚ ᛟ ᚦ ᚢ ᚠ
      </div>

      <p className="net-body">{message}</p>

      <div className="net-session" aria-label={`Session ID: ${sessionId}`}>
        <span className="net-session-label">Session</span>
        <span className="net-session-value">{sessionId}</span>
      </div>

      <div className="net-seal-epic" aria-hidden="true">
        <div className="net-seal-rune-row">{seal.runes}</div>
        <div className="net-seal-inscription">{seal.inscription}</div>
        <div className="net-seal-sub">{seal.sub}</div>
      </div>

      <div className="net-rune-border" aria-hidden="true">
        {RUNE_ROW_BTM}
      </div>
    </div>
  );
}
