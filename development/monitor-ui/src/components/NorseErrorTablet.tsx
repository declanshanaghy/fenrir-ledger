/**
 * NorseErrorTablet — full-pane error display for TTL-expired sessions.
 *
 * Shown when a pod's TTL has expired and logs are no longer available.
 * Styled as an ancient stone tablet: Elder Futhark rune decorations,
 * Cinzel Decorative headings, void-black bg, gold accents.
 */

// Elder Futhark rows used as decorative borders
const RUNE_ROW_TOP = "ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ ᚺ ᚾ ᛁ ᛃ ᛇ ᛈ ᛉ ᛊ ᛏ ᛒ ᛖ ᛗ ᛚ ᛜ ᛞ ᛟ";
const RUNE_ROW_BTM = "ᛟ ᛞ ᛜ ᛚ ᛗ ᛖ ᛒ ᛏ ᛊ ᛉ ᛈ ᛇ ᛃ ᛁ ᚾ ᚺ ᚹ ᚷ ᚲ ᚱ ᚨ ᚦ ᚢ ᚠ";
const RUNE_GLYPH = "ᚦ"; // Thurisaz — warning / thorn

interface Props {
  sessionId: string;
  message: string;
}

export function NorseErrorTablet({ sessionId, message }: Props) {
  return (
    <div
      className="norse-error-tablet"
      role="alert"
      aria-label="Session error: pod TTL expired"
      aria-live="assertive"
    >
      <div className="net-rune-border" aria-hidden="true">
        {RUNE_ROW_TOP}
      </div>

      <div className="net-glyph" aria-hidden="true">
        {RUNE_GLYPH}
      </div>

      <h1 className="net-heading">The Eternal Halls Are Sealed</h1>
      <p className="net-subheading">This vessel has departed Yggdrasil</p>

      <div className="net-divider" aria-hidden="true">
        ᚠ ᚢ ᚦ ᛟ ᛞ ᛜ ᛚ ᛟ ᚦ ᚢ ᚠ
      </div>

      <p className="net-body">{message}</p>

      <div className="net-session" aria-label={`Session ID: ${sessionId}`}>
        <span className="net-session-label">Session</span>
        <span className="net-session-value">{sessionId}</span>
      </div>

      <div className="net-seal" aria-hidden="true">
        ᚠᚢᚦ &mdash; So it is written, so shall it remain &mdash; ᚦᚢᚠ
      </div>

      <div className="net-rune-border" aria-hidden="true">
        {RUNE_ROW_BTM}
      </div>
    </div>
  );
}
