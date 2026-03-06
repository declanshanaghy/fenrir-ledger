"use client";

/**
 * CsvUpload -- drag-and-drop / file picker for CSV import.
 *
 * States: idle -> drag-over -> processing -> accepted | error
 * Validation: .csv extension, < 1 MB, non-empty, UTF-8 readable.
 */

import { useState, useRef, useCallback } from "react";
import { SafetyBanner } from "./SafetyBanner";

interface CsvUploadProps {
  /** Called with the raw CSV text when a valid file is accepted. */
  onSubmit: (csvText: string) => void;
  /** Navigate back to method selection. */
  onBack: () => void;
}

type DropState = "idle" | "drag-over" | "processing" | "accepted" | "error";

/** Maximum file size: 1 MB. */
const MAX_FILE_SIZE = 1_048_576;

/** Format bytes to a human-readable string. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CsvUpload({ onSubmit, onBack }: CsvUploadProps) {
  const [dropState, setDropState] = useState<DropState>("idle");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [csvText, setCsvText] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCountRef = useRef(0);

  const resetFile = useCallback(() => {
    setDropState("idle");
    setFileName("");
    setFileSize(0);
    setErrorMsg("");
    setCsvText("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const processFile = useCallback((file: File) => {
    // Validate extension with format-specific guidance
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setDropState("error");
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        setErrorMsg(
          "Excel files are not supported directly. Please export as CSV from Excel first (File > Save As > CSV UTF-8)."
        );
      } else if (lower.endsWith(".numbers")) {
        setErrorMsg(
          "Numbers files are not supported directly. Please export as CSV from Numbers first (File > Export To > CSV)."
        );
      } else {
        setErrorMsg("Only .csv files are accepted.");
      }
      return;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      setDropState("error");
      setErrorMsg(`File too large (${formatBytes(file.size)}). Maximum is 1 MB.`);
      return;
    }

    // Validate non-empty
    if (file.size === 0) {
      setDropState("error");
      setErrorMsg("The file is empty.");
      return;
    }

    setDropState("processing");
    setFileName(file.name);
    setFileSize(file.size);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text !== "string" || text.trim().length === 0) {
        setDropState("error");
        setErrorMsg("Could not read the file or the file is empty.");
        return;
      }
      setCsvText(text);
      setDropState("accepted");
    };
    reader.onerror = () => {
      setDropState("error");
      setErrorMsg("Failed to read the file. Ensure it is a valid UTF-8 CSV.");
    };
    reader.readAsText(file, "utf-8");
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current += 1;
    setDropState("drag-over");
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current -= 1;
    if (dragCountRef.current <= 0) {
      dragCountRef.current = 0;
      setDropState("idle");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCountRef.current = 0;

      const files = e.dataTransfer.files;
      if (!files || files.length === 0) {
        setDropState("idle");
        return;
      }
      const file = files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const file = files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleSubmit = useCallback(() => {
    if (csvText) {
      onSubmit(csvText);
    }
  }, [csvText, onSubmit]);

  return (
    <div className="flex flex-col gap-4">
      <SafetyBanner variant="compact" />

      {/* Drop zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (dropState === "idle" || dropState === "error") {
            fileInputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Upload CSV file"
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && (dropState === "idle" || dropState === "error")) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={[
          "flex flex-col items-center justify-center gap-3 rounded-sm border-2 border-dashed p-8 text-center transition-colors cursor-pointer min-h-[160px]",
          "focus:outline-none focus:ring-2 focus:ring-gold/50",
          dropState === "drag-over"
            ? "border-gold bg-gold/10"
            : dropState === "error"
              ? "border-red-500/40 bg-red-500/5"
              : dropState === "accepted"
                ? "border-gold/40 bg-gold/5 cursor-default"
                : "border-border bg-card hover:border-gold/30",
        ].join(" ")}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileInput}
          className="hidden"
          aria-hidden="true"
        />

        {dropState === "idle" && (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 text-muted-foreground"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="font-body text-base text-muted-foreground">
              Drop a CSV file here, or click to browse
            </p>
            <p className="font-body text-sm text-muted-foreground/60">
              .csv files only, 1 MB maximum
            </p>
          </>
        )}

        {dropState === "drag-over" && (
          <p className="font-heading text-base text-gold tracking-wide">
            Release to upload
          </p>
        )}

        {dropState === "processing" && (
          <div className="flex items-center gap-2">
            <div
              className="h-5 w-5 rounded-full border-2 border-border border-t-gold animate-spin"
              role="status"
              aria-label="Processing file"
            />
            <p className="font-body text-base text-muted-foreground">
              Reading file...
            </p>
          </div>
        )}

        {dropState === "accepted" && (
          <div className="flex items-center gap-3 w-full">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-gold shrink-0"
              aria-hidden="true"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <div className="flex flex-col items-start min-w-0">
              <span className="font-mono text-base text-foreground truncate max-w-full">
                {fileName}
              </span>
              <span className="font-body text-sm text-muted-foreground">
                {formatBytes(fileSize)}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                resetFile();
              }}
              className="ml-auto text-muted-foreground hover:text-red-400 transition-colors p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Remove file"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {dropState === "error" && (
          <div className="flex flex-col items-center gap-2">
            <p className="font-body text-base text-red-400">{errorMsg}</p>
            <p className="font-body text-sm text-muted-foreground">
              Click to try again
            </p>
          </div>
        )}
      </div>

      {/* Format help */}
      <div className="text-sm font-body text-muted-foreground">
        <p className="font-heading text-foreground text-sm mb-1.5 tracking-wide">
          How to export CSV
        </p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Google Sheets: File &gt; Download &gt; Comma-separated values (.csv)</li>
          <li>Excel: File &gt; Save As &gt; CSV UTF-8</li>
          <li>Numbers: File &gt; Export To &gt; CSV</li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-base transition-colors border border-border text-muted-foreground hover:border-gold/50 hover:text-gold h-11 px-6 min-w-[44px]"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={dropState !== "accepted"}
          className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-base transition-colors bg-primary text-primary-foreground hover:bg-gold-bright disabled:opacity-40 disabled:cursor-not-allowed h-11 px-6 min-w-[44px]"
        >
          Begin Import
        </button>
      </div>
    </div>
  );
}
