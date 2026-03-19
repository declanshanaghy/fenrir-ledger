import { useEffect, useRef, useState } from "react";

interface Props {
  sessionId: string;
  jobTitle: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

/**
 * RagnarokDialog — Ragnarök-themed confirmation dialog for cancelling a
 * running agent job. Invoked by clicking the running status icon on a JobCard.
 *
 * Design: void-black (#07070d) backdrop, gold borders, blood-red confirm button.
 * Copy follows the issue spec verbatim.
 */
export function RagnarokDialog({ sessionId, jobTitle, onConfirm, onCancel }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus the safe "cancel" button on open so Enter key doesn't accidentally confirm
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isLoading, onCancel]);

  const handleConfirm = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
      setIsLoading(false);
    }
  };

  return (
    <div
      className="rdk-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rdk-title"
      aria-describedby="rdk-body"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onCancel();
      }}
    >
      <div className="rdk-shell">
        {/* Elder Futhark rune band — top */}
        <div className="rdk-rune-band" aria-hidden="true">
          ᚱᚨᚷᚾᚨᚱᛟᚲ ᛊᚢᛗᛗᚢᚾᛊ ᛁᛊ ᚾᛁᚷᚺ
        </div>

        {/* Header */}
        <div className="rdk-header">
          <span className="rdk-sword-icon" aria-hidden="true">⚔️</span>
          <h2 id="rdk-title" className="rdk-title">Invoke Ragnarök?</h2>
        </div>

        {/* Body */}
        <div className="rdk-body" id="rdk-body">
          <p className="rdk-body-text">
            You are about to sever this thread from the Nornir&apos;s loom.
            This agent&apos;s saga will end — no Valhalla awaits a cancelled job.
            This cannot be undone.
          </p>
          <div className="rdk-job-label" aria-label="Job to be cancelled">
            <span className="rdk-job-label-icon" aria-hidden="true">☽</span>
            <span className="rdk-job-label-text">{jobTitle}</span>
          </div>
          <div className="rdk-session-id" aria-label="Session ID">
            {sessionId}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="rdk-error" role="alert">
            <span aria-hidden="true">✕</span> {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="rdk-actions">
          <button
            ref={cancelRef}
            className="rdk-btn rdk-btn--cancel"
            onClick={onCancel}
            disabled={isLoading}
            aria-label="Stay the Hand of Fate — keep job running"
          >
            Stay the Hand of Fate
          </button>
          <button
            ref={confirmRef}
            className="rdk-btn rdk-btn--confirm"
            onClick={handleConfirm}
            disabled={isLoading}
            aria-label="Unleash Ragnarök — permanently cancel this job"
          >
            {isLoading ? (
              <span className="rdk-loading-text">
                <span className="rdk-spinner" aria-hidden="true" />
                Severing the thread…
              </span>
            ) : (
              "Unleash Ragnarök"
            )}
          </button>
        </div>

        {/* Elder Futhark rune band — bottom */}
        <div className="rdk-rune-band rdk-rune-band--bottom" aria-hidden="true">
          ᚠᛖᚾᚱᛁᚱ ᚹᚨᛏᚲᚺᛖᛊ ᚦᛖ ᚹᛟᛚᚠ ᚹᚨᛏᚲᚺᛖᛊ
        </div>
      </div>
    </div>
  );
}
