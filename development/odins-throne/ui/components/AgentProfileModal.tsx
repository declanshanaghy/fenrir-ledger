import { useEffect, useRef } from "react";
import {
  AGENT_NAMES,
  AGENT_TITLES,
  AGENT_RUNE_NAMES,
  AGENT_QUOTES,
  AGENT_DESCRIPTIONS,
  AGENT_AVATARS,
  AGENT_LIGHT_AVATARS,
  AGENT_COLORS,
} from "../lib/constants";

const ELDER_FUTHARK = "ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ ᚺ ᚾ ᛁ ᛃ ᛇ ᛈ ᛉ ᛊ ᛏ ᛒ ᛖ ᛗ ᛚ ᛜ ᛞ ᛟ";

interface Props {
  agentKey: string;
  theme: "light" | "dark";
  onClose: () => void;
}

export function AgentProfileModal({ agentKey, theme, onClose }: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const name = AGENT_NAMES[agentKey] ?? agentKey;
  const title = AGENT_TITLES[agentKey] ?? "";
  const runes = AGENT_RUNE_NAMES[agentKey] ?? AGENT_RUNE_NAMES._fallback ?? "";
  const quote = AGENT_QUOTES[agentKey] ?? AGENT_QUOTES._fallback ?? "";
  const description = AGENT_DESCRIPTIONS[agentKey] ?? "";
  const accent = AGENT_COLORS[agentKey] ?? "var(--gold)";
  const portrait =
    theme === "light"
      ? (AGENT_LIGHT_AVATARS[agentKey] ?? AGENT_AVATARS[agentKey])
      : (AGENT_AVATARS[agentKey] ?? AGENT_LIGHT_AVATARS[agentKey]);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Focus close button on mount
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  // ESC key handler on window
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === backdropRef.current) onClose();
  }

  function handleModalKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // Focus trap — only one focusable element (close button)
    if (e.key === "Tab") {
      e.preventDefault();
      closeButtonRef.current?.focus();
    }
  }

  return (
    <div
      className="apm-backdrop"
      ref={backdropRef}
      onClick={handleBackdropClick}
      aria-label="Agent profile backdrop"
    >
      <div
        className="apm-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="apm-agent-name"
        onKeyDown={handleModalKeyDown}
        style={{ "--agent-accent": accent } as React.CSSProperties}
      >
        {/* [C] Close button — outside scroll body so it stays at top-right */}
        <button
          ref={closeButtonRef}
          className="apm-close"
          aria-label="Close agent profile"
          onClick={onClose}
        >
          ✕
        </button>

        {/* [B–H] Scrollable body */}
        <div className="apm-body">
          {/* [B] Top rune band */}
          <div className="apm-rune-band" aria-hidden="true">
            {ELDER_FUTHARK}
          </div>

          {/* [D] Portrait */}
          <div className="apm-portrait-zone">
            {portrait ? (
              <img
                className="apm-portrait"
                src={portrait}
                alt={name}
              />
            ) : (
              <div className="apm-portrait apm-portrait-placeholder" aria-label={name}>
                {name.charAt(0)}
              </div>
            )}
          </div>

          {/* [E] Identity block */}
          <div className="apm-identity">
            <div
              className="apm-agent-name"
              id="apm-agent-name"
              style={{ color: accent }}
            >
              {name}
            </div>
            <div className="apm-agent-title">{title}</div>
            {runes && (
              <div
                className="apm-rune-sig"
                aria-label={`Rune signature: ${name}`}
              >
                {runes}
              </div>
            )}
          </div>

          {/* [F] Norse quote */}
          {quote && (
            <div className="apm-quote">
              <p>&ldquo;{quote}&rdquo;</p>
            </div>
          )}

          {/* [G] Role description */}
          {description && (
            <div className="apm-description">
              <p>{description}</p>
            </div>
          )}

          {/* [H] Bottom rune band */}
          <div className="apm-rune-band apm-rune-band--bottom" aria-hidden="true">
            {ELDER_FUTHARK}
          </div>
        </div>
      </div>
    </div>
  );
}
