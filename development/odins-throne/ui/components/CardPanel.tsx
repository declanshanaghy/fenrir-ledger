import { useState } from "react";
import type { OdinCard } from "../lib/types";
import { useHouseholds, useCards } from "../hooks/useHouseholds";
import { CardDetailOverlay } from "./CardDetailOverlay";

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

function formatCents(cents: number): string {
  if (cents === 0) return "None";
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

interface CardRowProps {
  card: OdinCard;
  onClick: () => void;
}

function CardRow({ card, onClick }: CardRowProps) {
  const statusColor = STATUS_COLORS[card.status] ?? "#606070";
  const statusLabel = STATUS_LABELS[card.status] ?? card.status;

  return (
    <button
      className="card-row"
      onClick={onClick}
      aria-label={`View details for ${card.cardName} from ${card.issuerId}`}
      title={`${card.issuerId} — ${card.cardName}`}
    >
      <div className="card-row-main">
        <span className="card-row-issuer">{card.issuerId}</span>
        <span className="card-row-name">{card.cardName}</span>
      </div>
      <div className="card-row-meta">
        <span
          className="card-row-status"
          style={{ color: statusColor }}
        >
          {statusLabel}
        </span>
        <span className="card-row-fee">
          {card.annualFee > 0 ? `${formatCents(card.annualFee)}/yr` : "No fee"}
        </span>
        {card.annualFeeDate && card.annualFee > 0 && (
          <span className="card-row-fee-date">{formatDate(card.annualFeeDate)}</span>
        )}
      </div>
    </button>
  );
}

export function CardPanel() {
  const { households, loading: householdsLoading, error: householdsError } = useHouseholds();
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);
  const { cards, loading: cardsLoading, error: cardsError } = useCards(selectedHouseholdId);
  const [selectedCard, setSelectedCard] = useState<OdinCard | null>(null);

  const selectedHousehold = households.find((h) => h.id === selectedHouseholdId) ?? null;

  return (
    <section className="card-panel" aria-label="Household card summary">
      {/* Panel header */}
      <div className="card-panel-header">
        <h2 className="card-panel-title">Households</h2>
      </div>

      {/* Household selector */}
      <div className="card-panel-selector">
        {householdsLoading && (
          <div className="card-panel-empty" aria-live="polite">Loading households…</div>
        )}
        {householdsError && (
          <div className="card-panel-error" role="alert">
            Error: {householdsError}
          </div>
        )}
        {!householdsLoading && !householdsError && (
          <select
            className="card-panel-select"
            value={selectedHouseholdId ?? ""}
            onChange={(e) => setSelectedHouseholdId(e.target.value || null)}
            aria-label="Select household"
          >
            <option value="">— Select a household —</option>
            {households.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.memberIds.length} member{h.memberIds.length !== 1 ? "s" : ""})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Household info + card summary */}
      {selectedHousehold && (
        <div className="card-panel-body">
          <div className="household-info">
            <div className="household-info-name">{selectedHousehold.name}</div>
            <div className="household-info-meta">
              <span>{selectedHousehold.memberIds.length} member{selectedHousehold.memberIds.length !== 1 ? "s" : ""}</span>
              {selectedHousehold.syncVersion !== undefined && (
                <span>sync v{selectedHousehold.syncVersion}</span>
              )}
            </div>
          </div>

          <div className="card-summary">
            <h3 className="card-summary-title">Card Summary</h3>

            {cardsLoading && (
              <div className="card-panel-empty" aria-live="polite">Loading cards…</div>
            )}
            {cardsError && (
              <div className="card-panel-error" role="alert">
                Error: {cardsError}
              </div>
            )}
            {!cardsLoading && !cardsError && cards.length === 0 && (
              <div className="card-panel-empty">No cards for this household</div>
            )}
            {!cardsLoading && !cardsError && cards.length > 0 && (
              <div
                className="card-summary-list"
                role="list"
                aria-label={`Cards for ${selectedHousehold.name}`}
              >
                {cards.map((card) => (
                  <div key={card.id} role="listitem">
                    <CardRow card={card} onClick={() => setSelectedCard(card)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Card detail overlay */}
      {selectedCard && (
        <CardDetailOverlay
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </section>
  );
}
