"use client";

/**
 * CsvUpload -- drag-and-drop / file picker for CSV, TSV, XLS, and XLSX import.
 *
 * States: idle -> drag-over -> processing -> accepted | error
 * Validation: .csv/.tsv/.xls/.xlsx extension, size limits, non-empty.
 * - CSV/TSV: read as UTF-8 text, < 1 MB
 * - XLS/XLSX: read as base64 binary, < 5 MB
 */

import { useState, useRef, useCallback } from "react";
import { SafetyBanner } from "./SafetyBanner";

export type FileFormat = "csv" | "tsv" | "xls" | "xlsx";

interface CsvUploadProps {
  /** Called with the raw CSV/TSV text when a text file is accepted. */
  onSubmit: (csvText: string) => void;
  /** Called with base64-encoded data and filename for binary spreadsheet files. */
  onSubmitFile?: (base64: string, filename: string, format: FileFormat) => void;
  /** Navigate back to method selection. */
  onBack: () => void;
}

type DropState = "idle" | "drag-over" | "processing" | "accepted" | "error";

/** Maximum file size for text formats (CSV/TSV): 1 MB. */
const MAX_TEXT_FILE_SIZE = 1_048_576;

/** Maximum file size for binary formats (XLS/XLSX): 5 MB. */
const MAX_BINARY_FILE_SIZE = 5 * 1_048_576;

/** Accepted file extensions. */
const ACCEPTED_EXTENSIONS = [".csv", ".tsv", ".xls", ".xlsx"] as const;

/** Detect file format from extension. */
function detectFormat(filename: string): FileFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".tsv")) return "tsv";
  if (lower.endsWith(".xls") && !lower.endsWith(".xlsx")) return "xls";
  if (lower.endsWith(".xlsx")) return "xlsx";
  return null;
}

/** Format bytes to a human-readable string. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CsvUpload({ onSubmit, onSubmitFile, onBack }: CsvUploadProps) {
  const [dropState, setDropState] = useState<DropState>("idle");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [csvText, setCsvText] = useState("");
  const [fileBase64, setFileBase64] = useState("");
  const [fileFormat, setFileFormat] = useState<FileFormat | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCountRef = useRef(0);

  const resetFile = useCallback(() => {
    setDropState("idle");
    setFileName("");
    setFileSize(0);
    setErrorMsg("");
    setCsvText("");
    setFileBase64("");
    setFileFormat(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const processFile = useCallback((file: File) => {
    // Validate extension
    const format = detectFormat(file.name);
    if (!format) {
      setDropState("error");
      if (file.name.toLowerCase().endsWith(".numbers")) {
        setErrorMsg(
          "Numbers files are not supported. Please export as CSV from Numbers first (File > Export To > CSV)."
        );
      } else {
        setErrorMsg(`Unsupported file type. Accepted formats: ${ACCEPTED_EXTENSIONS.join(", ")}.`);
      }
      return;
    }

    const isBinary = format === "xls" || format === "xlsx";
    const maxSize = isBinary ? MAX_BINARY_FILE_SIZE : MAX_TEXT_FILE_SIZE;
    const maxSizeLabel = isBinary ? "5 MB" : "1 MB";

    // Validate size
    if (file.size > maxSize) {
      setDropState("error");
      setErrorMsg(`File too large (${formatBytes(file.size)}). Maximum is ${maxSizeLabel} for ${format.toUpperCase()} files.`);
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
    setFileFormat(format);

    if (isBinary) {
      // Read as base64 data URL for binary XLS/XLSX files
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result;
        if (typeof dataUrl !== "string" || !dataUrl.includes(",")) {
          setDropState("error");
          setErrorMsg("Could not read the file.");
          return;
        }
        // Strip the "data:...;base64," prefix to get raw base64
        const base64 = dataUrl.split(",")[1];
        if (!base64) {
          setDropState("error");
          setErrorMsg("Could not encode the file.");
          return;
        }
        setFileBase64(base64);
        setDropState("accepted");
      };
      reader.onerror = () => {
        setDropState("error");
        setErrorMsg(`Failed to read the ${format.toUpperCase()} file.`);
      };
      reader.readAsDataURL(file);
    } else {
      // Read as UTF-8 text for CSV/TSV files
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
        setErrorMsg(`Failed to read the file. Ensure it is a valid UTF-8 ${format.toUpperCase()} file.`);
      };
      reader.readAsText(file, "utf-8");
    }
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
    if (!fileFormat) return;
    const isBinary = fileFormat === "xls" || fileFormat === "xlsx";
    if (isBinary && fileBase64 && onSubmitFile) {
      onSubmitFile(fileBase64, fileName, fileFormat);
    } else if (!isBinary && csvText) {
      onSubmit(csvText);
    }
  }, [csvText, fileBase64, fileFormat, fileName, onSubmit, onSubmitFile]);

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
        aria-label="Upload spreadsheet file"
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && (dropState === "idle" || dropState === "error")) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={[
          "flex flex-col items-center justify-center gap-3 rounded-sm border-2 border-dashed p-8 text-center card-interactive cursor-pointer min-h-[160px]",
          "focus:outline-none focus:ring-2 focus:ring-gold/50",
          dropState === "drag-over"
            ? "border-gold bg-gold/10"
            : dropState === "error"
              ? "border-destructive/40 bg-destructive/5"
              : dropState === "accepted"
                ? "border-gold/40 bg-gold/5 cursor-default"
                : "border-border bg-card hover:border-gold/30",
        ].join(" ")}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.xls,.xlsx"
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
              Drop a spreadsheet here, or click to browse
            </p>
            <p className="font-body text-sm text-muted-foreground/60">
              .csv, .tsv, .xls, .xlsx — up to 5 MB
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
              className="ml-auto text-muted-foreground hover:text-destructive transition-colors p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
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
            <p className="font-body text-base text-destructive">{errorMsg}</p>
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
          className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-base transition-colors bg-primary text-primary-foreground hover:bg-primary hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed h-11 px-6 min-w-[44px]"
        >
          Begin Import
        </button>
      </div>
    </div>
  );
}
