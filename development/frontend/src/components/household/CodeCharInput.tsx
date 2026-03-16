"use client";

/**
 * CodeCharInput — Single character input for 6-char invite code entry.
 *
 * Handles:
 *   - Auto-advance on valid keypress (A–Z, 0–9)
 *   - Auto-uppercase normalization
 *   - Backspace: clear current, focus previous
 *   - Tab/Shift-Tab: sequential navigation
 *   - Paste handled by parent (see CodeCharInput usage in JoinHouseholdScreen)
 *
 * Issue #1123 — household invite code flow
 */

import { useRef, forwardRef, useImperativeHandle } from "react";

export interface CodeCharInputProps {
  /** 0-based index of this character (0–5) */
  index: number;
  /** Current character value (empty string or single uppercase char) */
  value: string;
  /** Visual state — affects border styling */
  state: "idle" | "filled" | "active" | "error";
  /** Whether this input is disabled (during validation) */
  disabled: boolean;
  /** Called when the value changes — always uppercase, max 1 char */
  onChange: (index: number, value: string) => void;
  /** Called to advance focus to next input */
  onAdvance: (index: number) => void;
  /** Called to move focus to previous input */
  onRetreat: (index: number) => void;
}

export interface CodeCharInputHandle {
  focus: () => void;
  clear: () => void;
}

const VALID_CHAR = /^[A-Z0-9]$/i;

const CodeCharInput = forwardRef<CodeCharInputHandle, CodeCharInputProps>(
  function CodeCharInput(
    { index, value, state, disabled, onChange, onAdvance, onRetreat },
    ref
  ) {
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      clear: () => onChange(index, ""),
    }));

    const borderClass = {
      idle: "border-border",
      filled: "border-gold/70",
      active: "border-gold ring-1 ring-gold/40",
      error: "border-dashed border-red-500/70",
    }[state];

    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        maxLength={1}
        value={value}
        disabled={disabled}
        aria-label={`Character ${index + 1} of 6`}
        aria-disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className={[
          "w-11 h-14 border-2 text-center font-mono text-2xl font-bold uppercase",
          "bg-background text-foreground",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "transition-colors duration-150",
          borderClass,
          "@media (max-width: 600px) min-w-[44px] min-h-[56px]",
        ].join(" ")}
        onChange={(e) => {
          const raw = e.target.value;
          const last = raw[raw.length - 1] ?? "";
          if (!last || !VALID_CHAR.test(last)) return;
          const upper = last.toUpperCase();
          onChange(index, upper);
          onAdvance(index);
        }}
        onKeyDown={(e) => {
          if (e.key === "Backspace") {
            if (value) {
              onChange(index, "");
            } else {
              onRetreat(index);
            }
            e.preventDefault();
          }
        }}
        onFocus={(e) => e.target.select()}
      />
    );
  }
);

export default CodeCharInput;
