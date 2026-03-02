"use client";

/**
 * MethodSelection -- choose an import method (URL, picker, or CSV upload).
 *
 * Three cards laid out as a grid:
 *  - Path A: "Share a Scroll" (URL entry)
 *  - Path B: "Browse the Archives" (Google Picker, disabled / coming soon)
 *  - Path C: "Deliver a Rune-Stone" (CSV upload)
 *
 * Keyboard accessible: arrow keys navigate, Enter selects.
 * role="listbox" with role="option" on each card.
 */

import { useCallback, useRef, useEffect } from "react";
import { SafetyBanner } from "./SafetyBanner";

export type ImportMethod = "url" | "picker" | "csv";

interface MethodSelectionProps {
  /** Callback when the user selects an import method. */
  onSelectMethod: (method: ImportMethod) => void;
}

interface MethodCardDef {
  id: ImportMethod;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  disabled: boolean;
  disabledLabel?: string;
}

/** Link / chain icon for URL path. */
function LinkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

/** Folder / archive icon for picker path. */
function FolderIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    </svg>
  );
}

/** Upload icon for CSV path. */
function UploadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

const METHODS: MethodCardDef[] = [
  {
    id: "url",
    title: "Share a Scroll",
    subtitle: "Google Sheets URL",
    description: "Paste a link to a publicly shared spreadsheet.",
    icon: <LinkIcon />,
    disabled: false,
  },
  {
    id: "picker",
    title: "Browse the Archives",
    subtitle: "Google Drive Picker",
    description: "Select a spreadsheet from your Drive.",
    icon: <FolderIcon />,
    disabled: true,
    disabledLabel: "Coming soon",
  },
  {
    id: "csv",
    title: "Deliver a Rune-Stone",
    subtitle: "CSV File Upload",
    description: "Upload a CSV file exported from any spreadsheet.",
    icon: <UploadIcon />,
    disabled: false,
  },
];

export function MethodSelection({ onSelectMethod }: MethodSelectionProps) {
  const listboxRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Focus the first enabled item on mount
  useEffect(() => {
    const firstEnabled = METHODS.findIndex((m) => !m.disabled);
    if (firstEnabled >= 0) {
      itemRefs.current[firstEnabled]?.focus();
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const enabledIndices = METHODS.reduce<number[]>((acc, m, i) => {
        if (!m.disabled) acc.push(i);
        return acc;
      }, []);

      const focusedMethodIdx = METHODS.findIndex(
        (_, i) => itemRefs.current[i] === document.activeElement
      );
      const currentPosInEnabled = enabledIndices.indexOf(focusedMethodIdx);

      let nextIndex: number | null = null;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = currentPosInEnabled < enabledIndices.length - 1
          ? enabledIndices[currentPosInEnabled + 1]
          : enabledIndices[0];
        nextIndex = next ?? null;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = currentPosInEnabled > 0
          ? enabledIndices[currentPosInEnabled - 1]
          : enabledIndices[enabledIndices.length - 1];
        nextIndex = prev ?? null;
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (focusedMethodIdx >= 0) {
          const method = METHODS[focusedMethodIdx];
          if (method && !method.disabled) {
            onSelectMethod(method.id);
          }
        }
        return;
      }

      if (nextIndex !== null) {
        itemRefs.current[nextIndex]?.focus();
      }
    },
    [onSelectMethod]
  );

  return (
    <div className="flex flex-col gap-4">
      <SafetyBanner variant="full" />

      <div
        ref={listboxRef}
        role="listbox"
        aria-label="Choose import method"
        onKeyDown={handleKeyDown}
        className="grid grid-cols-1 md:grid-cols-3 gap-3"
      >
        {METHODS.map((method, index) => (
          <div
            key={method.id}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            role="option"
            aria-selected={false}
            aria-disabled={method.disabled}
            tabIndex={method.disabled ? -1 : 0}
            onClick={() => {
              if (!method.disabled) onSelectMethod(method.id);
            }}
            className={[
              "relative flex flex-col items-center gap-2 rounded-sm border p-4 text-center transition-colors cursor-pointer",
              "focus:outline-none focus:ring-2 focus:ring-gold/50",
              method.disabled
                ? "border-border bg-card/50 opacity-50 cursor-not-allowed"
                : "border-border bg-card hover:border-gold/40 hover:bg-gold/5",
            ].join(" ")}
          >
            {method.disabledLabel && (
              <span className="absolute top-2 right-2 text-[10px] font-heading tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm">
                {method.disabledLabel}
              </span>
            )}
            <div className="text-gold">{method.icon}</div>
            <h3 className="font-heading text-sm text-foreground tracking-wide">
              {method.title}
            </h3>
            <p className="text-[11px] font-body text-muted-foreground leading-relaxed">
              {method.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
