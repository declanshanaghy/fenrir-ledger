import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { log } from "@fenrir/logger";
import { firestoreClient } from "../lib/firestore.js";
import { FieldValue } from "@google-cloud/firestore";

// ─── Colors ───────────────────────────────────────────────────────────────────

const GOLD    = "#c9920a";
const GREEN   = "#22c55e";
const RED     = "#ef4444";
const GRAY    = "#6b6b80";
const DIM     = "#3b3b4f";
const LAVENDER = "#9b9baa";

// ─── Constants ────────────────────────────────────────────────────────────────

const CARD_LIST_HEIGHT = 18;
const BAR_WIDTH = 28;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CardDoc {
  id: string;
  name?: string;
  status?: string;
  deletedAt?: string;
  userId?: string;
  ownerId?: string;
  issuer?: string;
  creditLimit?: number;
  annualFee?: number;
  annualFeeDate?: string;
  openedDate?: string;
  bonusStatus?: string;
  bonusAmount?: number;
  bonusDeadline?: string;
  spendGoal?: number;
  spendAmount?: number;
  notes?: string;
}

// ─── Status maps ──────────────────────────────────────────────────────────────

const CARD_STATUS_DOT: Record<string, { dot: string; color: string }> = {
  active:          { dot: "●", color: "green"  },
  fee_approaching: { dot: "◐", color: "yellow" },
  promo_expiring:  { dot: "◐", color: "yellow" },
  closed:          { dot: "○", color: "gray"   },
};

const CARD_STATUS_REALM: Record<string, string> = {
  active:          "Midgard",
  fee_approaching: "Muspelheim",
  promo_expiring:  "Niflheim",
  closed:          "Helheim",
};

function getStatusDot(status: string): { dot: string; color: string } {
  return CARD_STATUS_DOT[status] ?? { dot: "○", color: "gray" };
}

function getStatusRealm(status: string): string {
  return CARD_STATUS_REALM[status] ?? "Unknown";
}

// ─── sortCards ────────────────────────────────────────────────────────────────

const SORT_ORDER: Record<string, number> = {
  active:          0,
  fee_approaching: 1,
  promo_expiring:  2,
  closed:          3,
};

function sortCards(arr: CardDoc[]): CardDoc[] {
  return [...arr].sort((a, b) => {
    const ao = a.deletedAt ? 99 : (SORT_ORDER[a.status ?? ""] ?? 4);
    const bo = b.deletedAt ? 99 : (SORT_ORDER[b.status ?? ""] ?? 4);
    return ao !== bo ? ao - bo : (a.name ?? "").localeCompare(b.name ?? "");
  });
}

// ─── SpendProgressBar ─────────────────────────────────────────────────────────

function SpendProgressBar({ spend, goal }: { spend: number; goal: number }): React.JSX.Element {
  const raw = goal > 0 ? Math.min(1, (spend || 0) / goal) : 0;
  const filled = Math.round(raw * BAR_WIDTH);
  const color = raw >= 1 ? "green" : raw >= 0.5 ? "yellow" : "white";
  const bar = "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
  const pct = Math.round(raw * 100);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={GRAY}>{"Spend:  "}</Text>
        <Text color={color}>{bar}</Text>
        <Text color={GRAY}>{` ${pct}%`}</Text>
      </Box>
      <Box>
        <Text color={GRAY}>{"        "}</Text>
        <Text color={LAVENDER}>{`$${spend} / $${goal}`}</Text>
      </Box>
    </Box>
  );
}

// ─── CardListRow ──────────────────────────────────────────────────────────────

function CardListRow({ card, selected }: { card: CardDoc; selected: boolean }): React.JSX.Element {
  const { dot, color } = getStatusDot(card.status ?? "");
  const isDeleted = Boolean(card.deletedAt);
  const name = (card.name ?? "(unnamed)").slice(0, 24);

  return (
    <Box>
      <Text color={selected ? "cyan" : GRAY}>{selected ? "▶ " : "  "}</Text>
      <Text color={color}>{dot}</Text>
      <Text color="white"> </Text>
      <Text
        color={selected ? "cyan" : isDeleted ? GRAY : undefined}
        bold={selected}
        dimColor={isDeleted}
      >
        {name}
      </Text>
      {isDeleted ? <Text color={GRAY} dimColor> DEL</Text> : null}
    </Box>
  );
}

// ─── CardDetailPanel ─────────────────────────────────────────────────────────

type DetailMode = "browse" | "confirm-delete" | "confirm-restore" | "confirm-expunge" | "expunge-input";

interface CardDetailPanelProps {
  card: CardDoc;
  householdId: string;
  ownerEmail: string;
  breadcrumb: string;
  onBack: () => void;
  onCardUpdated: () => void;
  onInputCapture: (v: boolean) => void;
  statusMsg: string | null;
  setStatusMsg: (m: string | null) => void;
}

function CardDetailPanel({
  card,
  householdId,
  ownerEmail,
  breadcrumb,
  onBack,
  onCardUpdated,
  onInputCapture,
  statusMsg,
  setStatusMsg,
}: CardDetailPanelProps): React.JSX.Element {
  const [mode, setMode] = useState<DetailMode>("browse");
  const [expungeText, setExpungeText] = useState("");
  const isDeleted = Boolean(card.deletedAt);
  const { dot, color: dotColor } = getStatusDot(card.status ?? "");
  const realm = getStatusRealm(card.status ?? "");

  const doDelete = useCallback(async (): Promise<void> => {
    if (!firestoreClient) return;
    try {
      await firestoreClient
        .collection("households").doc(householdId)
        .collection("cards").doc(card.id)
        .update({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      setStatusMsg(`Deleted: ${card.name}`);
      onCardUpdated();
    } catch (err) {
      setStatusMsg(`Error: ${(err as Error).message}`);
    }
  }, [card, householdId, setStatusMsg, onCardUpdated]);

  const doRestore = useCallback(async (): Promise<void> => {
    if (!firestoreClient) return;
    try {
      await firestoreClient
        .collection("households").doc(householdId)
        .collection("cards").doc(card.id)
        .update({
          deletedAt: FieldValue.delete(),
          status: "active",
          updatedAt: new Date().toISOString(),
        });
      setStatusMsg(`Restored: ${card.name}`);
      onCardUpdated();
    } catch (err) {
      setStatusMsg(`Error: ${(err as Error).message}`);
    }
  }, [card, householdId, setStatusMsg, onCardUpdated]);

  const doExpunge = useCallback(async (): Promise<void> => {
    if (!firestoreClient) return;
    try {
      await firestoreClient
        .collection("households").doc(householdId)
        .collection("cards").doc(card.id)
        .delete();
      setStatusMsg(`Expunged: ${card.name}`);
      onCardUpdated();
    } catch (err) {
      setStatusMsg(`Error: ${(err as Error).message}`);
    }
  }, [card, householdId, setStatusMsg, onCardUpdated]);

  useInput((input, key) => {
    if (mode === "expunge-input") {
      if (key.return) {
        if (expungeText === "delete") { void doExpunge(); }
        else { setStatusMsg("Aborted: must type exactly 'delete'"); }
        onInputCapture(false);
        setMode("browse");
        setExpungeText("");
        return;
      }
      if (key.escape) {
        setStatusMsg("Expunge cancelled");
        onInputCapture(false);
        setMode("browse");
        setExpungeText("");
        return;
      }
      if (key.backspace || key.delete) {
        setExpungeText((prev) => prev.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setExpungeText((prev) => prev + input);
      }
      return;
    }

    if (mode === "confirm-delete") {
      if (input === "y" || input === "Y") { void doDelete(); }
      else { setStatusMsg("Delete cancelled"); }
      setMode("browse");
      return;
    }

    if (mode === "confirm-restore") {
      if (input === "y" || input === "Y") { void doRestore(); }
      else { setStatusMsg("Restore cancelled"); }
      setMode("browse");
      return;
    }

    if (mode === "confirm-expunge") {
      if (input === "y" || input === "Y") {
        onInputCapture(true);
        setMode("expunge-input");
        setExpungeText("");
      } else {
        setStatusMsg("Expunge cancelled");
        setMode("browse");
      }
      return;
    }

    // browse mode
    if (key.escape) { onBack(); return; }
    if (input === "d" && !isDeleted) { setMode("confirm-delete"); return; }
    if (input === "r" && isDeleted)  { setMode("confirm-restore"); return; }
    if (input === "x")               { setMode("confirm-expunge"); return; }
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
      {/* Breadcrumb */}
      <Box marginBottom={1}>
        <Text color={GRAY}>{"← "}</Text>
        <Text color={LAVENDER}>{breadcrumb}</Text>
        <Text color={GRAY}>{" / Cards / "}</Text>
        <Text color="cyan" bold>{card.name ?? "(unnamed)"}</Text>
      </Box>

      {/* Status message */}
      {statusMsg ? (
        <Box marginBottom={1}>
          <Text color={LAVENDER}>{statusMsg}</Text>
        </Box>
      ) : null}

      {/* Status + realm */}
      <Box>
        <Text color={GRAY}>{"Status: "}</Text>
        <Text color={dotColor}>{dot} </Text>
        <Text color={dotColor}>{card.status ?? "—"}</Text>
        <Text color={GRAY}>{" ("}</Text>
        <Text color={GOLD}>{realm}</Text>
        <Text color={GRAY}>{")"}</Text>
        {isDeleted ? <Text color={RED}> [DELETED]</Text> : null}
      </Box>

      {/* Issuer */}
      <Box>
        <Text color={GRAY}>{"Issuer: "}</Text>
        <Text>{card.issuer ?? "—"}</Text>
      </Box>

      {/* Credit Limit */}
      <Box>
        <Text color={GRAY}>{"Limit:  "}</Text>
        <Text>{card.creditLimit != null ? `$${card.creditLimit}` : "—"}</Text>
      </Box>

      {/* Annual Fee */}
      <Box>
        <Text color={GRAY}>{"Ann Fee:"}</Text>
        <Text>{card.annualFee != null ? `$${card.annualFee}` : "—"}</Text>
        {card.annualFeeDate ? (
          <>
            <Text color={GRAY}>{" due "}</Text>
            <Text>{card.annualFeeDate}</Text>
          </>
        ) : null}
      </Box>

      {/* Opened date */}
      <Box>
        <Text color={GRAY}>{"Opened: "}</Text>
        <Text>{card.openedDate ?? "—"}</Text>
      </Box>

      {/* Bonus */}
      {card.bonusAmount != null ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color={GOLD} bold>── Bonus</Text>
          <Box>
            <Text color={GRAY}>{"  Status: "}</Text>
            <Text color={card.bonusStatus === "met" ? "green" : "yellow"}>
              {card.bonusStatus === "met" ? "✓ Met" : "◎ In Progress"}
            </Text>
          </Box>
          <Box>
            <Text color={GRAY}>{"  Amount: "}</Text>
            <Text>{String(card.bonusAmount)} pts</Text>
          </Box>
          {card.bonusDeadline ? (
            <Box>
              <Text color={GRAY}>{"  Deadline: "}</Text>
              <Text>{card.bonusDeadline}</Text>
            </Box>
          ) : null}
        </Box>
      ) : null}

      {/* Spend progress */}
      {(card.spendGoal ?? 0) > 0 ? (
        <Box marginTop={1} flexDirection="column">
          <Text color={GOLD} bold>── Spend</Text>
          <Box paddingLeft={2}>
            <SpendProgressBar spend={card.spendAmount ?? 0} goal={card.spendGoal!} />
          </Box>
        </Box>
      ) : null}

      {/* Notes */}
      {card.notes ? (
        <Box marginTop={1}>
          <Text color={GRAY}>{"Notes:  "}</Text>
          <Text color={LAVENDER}>{card.notes}</Text>
        </Box>
      ) : null}

      {/* Owner */}
      <Box marginTop={1} flexDirection="column">
        <Text color={GOLD} bold>── Owner</Text>
        <Box>
          <Text color={GRAY}>{"  Email: "}</Text>
          <Text>{ownerEmail}</Text>
        </Box>
        <Box>
          <Text color={GRAY}>{"  Card ID: "}</Text>
          <Text color={DIM}>{card.id}</Text>
        </Box>
      </Box>

      {/* Divider */}
      <Box marginTop={1}>
        <Text color={DIM}>{"─".repeat(40)}</Text>
      </Box>

      {/* Action bar */}
      {mode === "browse" ? (
        <Box>
          <Text color={GRAY}>
            {!isDeleted ? "[d] Delete  " : ""}
            {isDeleted  ? "[r] Restore  " : ""}
            {"[x] Expunge  [Esc] back"}
          </Text>
        </Box>
      ) : mode === "confirm-delete" ? (
        <Box>
          <Text color={RED}>Delete {card.name}? [y] yes  [any] cancel</Text>
        </Box>
      ) : mode === "confirm-restore" ? (
        <Box>
          <Text color={GREEN}>Restore {card.name}? [y] yes  [any] cancel</Text>
        </Box>
      ) : mode === "confirm-expunge" ? (
        <Box>
          <Text color={RED}>Permanently expunge {card.name}? [y] yes  [any] cancel</Text>
        </Box>
      ) : mode === "expunge-input" ? (
        <Box flexDirection="column">
          <Box>
            <Text color={RED}>{"Type 'delete' to expunge: "}</Text>
            <Text color="cyan">{expungeText}</Text>
            <Text color="cyan">▌</Text>
          </Box>
          <Text color={GRAY}>[Enter] confirm  [Esc] cancel</Text>
        </Box>
      ) : null}
    </Box>
  );
}

// ─── CardDrilldownView ────────────────────────────────────────────────────────

interface CardDrilldownViewProps {
  /** Firestore household ID to load cards from */
  householdId: string;
  /** When set, only show cards belonging to this userId */
  filterUserId: string | null;
  /** Human-readable breadcrumb — e.g. "user@email.com" or "Household Name" */
  breadcrumbFrom: string;
  /** Email of the owner (used in card detail) */
  ownerEmail: string;
  /** Called when the user presses Esc from the card list */
  onBack: () => void;
  /** Called when app-level input should be blocked */
  onInputCapture?: (captured: boolean) => void;
  cmdStatus: string | null;
}

/**
 * CardDrilldownView — two-panel drill-down: card list (left) + card detail (right).
 * Accessible via [c] from UsersTab or HouseholdsTab.
 */
export function CardDrilldownView({
  householdId,
  filterUserId,
  breadcrumbFrom,
  ownerEmail,
  onBack,
  onInputCapture,
  cmdStatus,
}: CardDrilldownViewProps): React.JSX.Element {
  log.debug("CardDrilldownView render", { householdId, filterUserId });

  const [cards, setCards] = useState<CardDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadCards = useCallback(() => {
    log.debug("CardDrilldownView: loading cards", { householdId, filterUserId });
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        if (!firestoreClient) {
          setError("Firestore not connected");
          setLoading(false);
          return;
        }
        const snap = await firestoreClient
          .collection("households").doc(householdId)
          .collection("cards").get();

        let loaded: CardDoc[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            name:            (data["name"] as string | undefined),
            status:          (data["status"] as string | undefined),
            deletedAt:       (data["deletedAt"] as string | undefined),
            userId:          (data["userId"] as string | undefined),
            ownerId:         (data["ownerId"] as string | undefined),
            issuer:          (data["issuer"] as string | undefined),
            creditLimit:     (data["creditLimit"] as number | undefined),
            annualFee:       (data["annualFee"] as number | undefined),
            annualFeeDate:   (data["annualFeeDate"] as string | undefined),
            openedDate:      (data["openedDate"] as string | undefined),
            bonusStatus:     (data["bonusStatus"] as string | undefined),
            bonusAmount:     (data["bonusAmount"] as number | undefined),
            bonusDeadline:   (data["bonusDeadline"] as string | undefined),
            spendGoal:       (data["spendGoal"] as number | undefined),
            spendAmount:     (data["spendAmount"] as number | undefined),
            notes:           (data["notes"] as string | undefined),
          };
        });

        if (filterUserId) {
          loaded = loaded.filter((c) => c.userId === filterUserId || c.ownerId === filterUserId);
        }

        loaded = sortCards(loaded);
        log.debug("CardDrilldownView: loaded", { count: loaded.length });
        setCards(loaded);
        setSelectedIdx(loaded.length > 0 ? 0 : -1);
      } catch (err) {
        log.error("CardDrilldownView: load error", err as Error);
        setError((err as Error).message);
      }
      setLoading(false);
    })();
  }, [householdId, filterUserId]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  useInput((input, key) => {
    // Card detail owns input when open
    if (detailOpen) return;

    if (key.upArrow) {
      const ni = Math.max(0, selectedIdx - 1);
      const newScroll = ni < scrollOffset ? ni : scrollOffset;
      setSelectedIdx(ni);
      setScrollOffset(newScroll);
      return;
    }

    if (key.downArrow) {
      const maxIdx = cards.length - 1;
      const ni = selectedIdx < 0 ? 0 : Math.min(maxIdx, selectedIdx + 1);
      const newScroll =
        ni >= scrollOffset + CARD_LIST_HEIGHT
          ? ni - CARD_LIST_HEIGHT + 1
          : scrollOffset;
      setSelectedIdx(ni);
      setScrollOffset(newScroll);
      return;
    }

    if (key.return) {
      const card = cards[selectedIdx];
      if (card) setDetailOpen(true);
      return;
    }

    if (key.escape) {
      onBack();
      return;
    }

    if (key.ctrl && input === "r") {
      loadCards();
      return;
    }
  });

  const handleInputCapture = useCallback((captured: boolean) => {
    onInputCapture?.(captured);
  }, [onInputCapture]);

  const handleCardUpdated = useCallback(() => {
    setDetailOpen(false);
    loadCards();
  }, [loadCards]);

  const selectedCard = selectedIdx >= 0 && selectedIdx < cards.length
    ? (cards[selectedIdx] ?? null)
    : null;

  const visibleCards = cards.slice(scrollOffset, scrollOffset + CARD_LIST_HEIGHT);

  return (
    <Box flexDirection="row" flexGrow={1}>
      {/* Left panel — card list */}
      <Box
        flexDirection="column"
        width={36}
        borderStyle="single"
        borderRight={true}
        borderLeft={false}
        borderTop={false}
        borderBottom={false}
        borderColor={DIM}
      >
        {/* Header */}
        <Box
          paddingX={1}
          borderStyle="single"
          borderBottom={true}
          borderTop={false}
          borderLeft={false}
          borderRight={false}
          borderColor={DIM}
        >
          <Text color={GOLD} bold>Cards</Text>
          <Text color={GRAY}>{" ("}{cards.length}{")"}</Text>
          <Text color={GRAY}>{" ← "}</Text>
          <Text color={LAVENDER}>{breadcrumbFrom}</Text>
        </Box>

        {/* List body */}
        <Box flexDirection="column" flexGrow={1} paddingX={1}>
          {loading ? (
            <Text color={GRAY}>Loading…</Text>
          ) : error ? (
            <Text color={RED}>{error}</Text>
          ) : cards.length === 0 ? (
            <Text color={GRAY} dimColor>No cards found</Text>
          ) : (
            visibleCards.map((card, i) => (
              <CardListRow
                key={card.id}
                card={card}
                selected={scrollOffset + i === selectedIdx}
              />
            ))
          )}
        </Box>

        {/* Scroll indicator */}
        {cards.length > CARD_LIST_HEIGHT && (
          <Box paddingX={1}>
            <Text color={DIM}>
              {`${scrollOffset + 1}–${Math.min(scrollOffset + CARD_LIST_HEIGHT, cards.length)}/${cards.length}`}
            </Text>
          </Box>
        )}

        {/* Footer hints */}
        <Box paddingX={1} borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} borderColor={DIM}>
          <Text color={DIM}>↑↓ nav  Enter detail  Esc back</Text>
        </Box>
      </Box>

      {/* Right panel — detail or empty state */}
      <Box flexDirection="column" flexGrow={1}>
        {detailOpen && selectedCard ? (
          <CardDetailPanel
            card={selectedCard}
            householdId={householdId}
            ownerEmail={ownerEmail}
            breadcrumb={breadcrumbFrom}
            onBack={() => setDetailOpen(false)}
            onCardUpdated={handleCardUpdated}
            onInputCapture={handleInputCapture}
            statusMsg={statusMsg ?? cmdStatus}
            setStatusMsg={setStatusMsg}
          />
        ) : selectedCard ? (
          // Preview in right panel (no detail open)
          <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
            <Box marginBottom={1}>
              <Text color={GRAY}>← </Text>
              <Text color={LAVENDER}>{breadcrumbFrom}</Text>
              <Text color={GRAY}> / Cards</Text>
            </Box>
            {statusMsg ?? cmdStatus ? (
              <Box marginBottom={1}>
                <Text color={LAVENDER}>{statusMsg ?? cmdStatus}</Text>
              </Box>
            ) : null}
            <Box>
              <Text color="cyan" bold>{selectedCard.name ?? "(unnamed)"}</Text>
            </Box>
            <Box>
              <Text color={GRAY}>{"Status: "}</Text>
              {(() => {
                const { dot, color } = getStatusDot(selectedCard.status ?? "");
                return <Text color={color}>{dot} {selectedCard.status ?? "—"}</Text>;
              })()}
            </Box>
            {selectedCard.issuer ? (
              <Box><Text color={GRAY}>Issuer: </Text><Text>{selectedCard.issuer}</Text></Box>
            ) : null}
            {selectedCard.creditLimit != null ? (
              <Box><Text color={GRAY}>Limit:  </Text><Text>${selectedCard.creditLimit}</Text></Box>
            ) : null}
            <Box marginTop={1}>
              <Text color={DIM}>[Enter] open detail</Text>
            </Box>
          </Box>
        ) : (
          <Box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
            <Text color={GOLD} bold>ᛉ</Text>
            <Box height={1} />
            <Text color={GRAY}>Select a card from the list</Text>
            <Text color={DIM} dimColor>Use arrow keys to navigate</Text>
            {(statusMsg ?? cmdStatus) ? (
              <Box marginTop={1}>
                <Text color={LAVENDER}>{statusMsg ?? cmdStatus}</Text>
              </Box>
            ) : null}
          </Box>
        )}
      </Box>
    </Box>
  );
}
