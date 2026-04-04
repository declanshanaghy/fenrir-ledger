import { useEffect, useCallback } from "react";
import type { OdinCard } from "../lib/types";

interface Props {
  card: OdinCard;
  onClose: () => void;
}

function formatCents(cents: number): string {
  if (cents === 0) return "$0";
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  fee_approaching: "Fee Approaching",
  promo_expiring: "Promo Expiring",
  closed: "Closed",
  bonus_open: "Bonus Open",
  overdue: "Overdue",
  graduated: "Graduated",
};

const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  fee_approaching: "#f0b429",
  promo_expiring: "#fb923c",
  closed: "#606070",
  bonus_open: "#4ecdc4",
  overdue: "#ef4444",
  graduated: "#a855f7",
};

export function CardDetailOverlay({ card, onClose }: Props) {
  // Dismiss on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const statusColor = STATUS_COLORS[card.status] ?? "#606070";
  const statusLabel = STATUS_LABELS[card.status] ?? card.status;

  return (
    <div
      className="card-overlay-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Card details: ${card.cardName}`}
    >
      <div
        className="card-overlay-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="card-overlay-header">
          <div className="card-overlay-title">
            <span className="card-overlay-issuer">{card.issuerId}</span>
            <span className="card-overlay-name">{card.cardName}</span>
          </div>
          <button
            className="card-overlay-close"
            onClick={onClose}
            aria-label="Close card details"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Status badge */}
        <div className="card-overlay-status">
          <span
            className="card-detail-status-badge"
            style={{ color: statusColor, borderColor: statusColor }}
          >
            {statusLabel}
          </span>
        </div>

        {/* Detail rows */}
        <dl className="card-overlay-details">
          <div className="card-detail-row">
            <dt>Issuer</dt>
            <dd>{card.issuerId}</dd>
          </div>
          <div className="card-detail-row">
            <dt>Card Name</dt>
            <dd>{card.cardName}</dd>
          </div>
          <div className="card-detail-row">
            <dt>Open Date</dt>
            <dd>{formatDate(card.openDate)}</dd>
          </div>
          <div className="card-detail-row">
            <dt>Credit Limit</dt>
            <dd>{formatCents(card.creditLimit)}</dd>
          </div>
          <div className="card-detail-row">
            <dt>Annual Fee</dt>
            <dd>{card.annualFee === 0 ? "None" : formatCents(card.annualFee)}</dd>
          </div>
          {card.annualFeeDate && (
            <div className="card-detail-row">
              <dt>Next Fee Date</dt>
              <dd>{formatDate(card.annualFeeDate)}</dd>
            </div>
          )}
          {card.promoPeriodMonths > 0 && (
            <div className="card-detail-row">
              <dt>Promo Period</dt>
              <dd>{card.promoPeriodMonths} months</dd>
            </div>
          )}
          {card.signUpBonus && (
            <>
              <div className="card-detail-row">
                <dt>Sign-Up Bonus</dt>
                <dd>{card.signUpBonus.description}</dd>
              </div>
              <div className="card-detail-row">
                <dt>Bonus Reward</dt>
                <dd>{formatCents(card.signUpBonus.rewardAmount)}</dd>
              </div>
              <div className="card-detail-row">
                <dt>Min Spend</dt>
                <dd>{formatCents(card.signUpBonus.minimumSpend)}</dd>
              </div>
              <div className="card-detail-row">
                <dt>Spend Deadline</dt>
                <dd>{formatDate(card.signUpBonus.minimumSpendDeadline)}</dd>
              </div>
              {card.amountSpent !== undefined && (
                <div className="card-detail-row">
                  <dt>Amount Spent</dt>
                  <dd>{formatCents(card.amountSpent)}</dd>
                </div>
              )}
            </>
          )}
          {card.closedAt && (
            <div className="card-detail-row">
              <dt>Closed Date</dt>
              <dd>{formatDate(card.closedAt)}</dd>
            </div>
          )}
          {card.notes && (
            <div className="card-detail-row card-detail-row--notes">
              <dt>Notes</dt>
              <dd>{card.notes}</dd>
            </div>
          )}
          <div className="card-detail-row">
            <dt>Card ID</dt>
            <dd className="card-detail-id">{card.id}</dd>
          </div>
          <div className="card-detail-row">
            <dt>Created</dt>
            <dd>{formatDate(card.createdAt)}</dd>
          </div>
          <div className="card-detail-row">
            <dt>Updated</dt>
            <dd>{formatDate(card.updatedAt)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
