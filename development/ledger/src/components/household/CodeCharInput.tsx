"use client";

/**
 * CodeCharInput — single character input cell for invite code entry.
 *
 * Handles auto-advance, backspace-navigation, and paste distribution.
 * Paste is handled on the first cell and distributed to all siblings via
 * the onPaste callback passed from the parent.
 *
 * @see ux/wireframes/household/join-household.html § Code Input
 * Issue #1123
 */

import { forwardRef, useCallback, type KeyboardEvent, type ClipboardEvent } from "react";

interface CodeCharInputProps {
  index: number;
  value: string;
  disabled?: boolean;
  hasError?: boolean;
  onChange: (index: number, value: string) => void;
  onBackspace: (index: number) => void;
  onPaste: (text: string) => void;
}

export const CodeCharInput = forwardRef<HTMLInputElement, CodeCharInputProps>(
  function CodeCharInput(
    { index, value, disabled, hasError, onChange, onBackspace, onPaste },
    ref
  ) {
    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace") {
          e.preventDefault();
          onBackspace(index);
        }
      },
      [index, onBackspace]
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.toUpperCase();
        // Accept only A-Z and 0-9
        const char = raw.replace(/[^A-Z0-9]/g, "").slice(-1);
        onChange(index, char);
      },
      [index, onChange]
    );

    const handlePaste = useCallback(
      (e: ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text").trim().toUpperCase();
        onPaste(text);
      },
      [onPaste]
    );

    const borderClass = hasError
      ? "border-destructive border-dashed"
      : value
        ? "border-foreground"
        : "border-border";

    return (
      <input
        ref={ref}
        type="text"
        inputMode="text"
        maxLength={1}
        value={value}
        disabled={disabled}
        aria-label={`Character ${index + 1} of 6`}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className={[
          "w-11 h-14 sm:w-12 sm:h-14",
          "border-2 text-center",
          "text-2xl font-bold font-mono uppercase",
          "text-foreground bg-transparent",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "transition-colors",
          borderClass,
        ].join(" ")}
      />
    );
  }
);
