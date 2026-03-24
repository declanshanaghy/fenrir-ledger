import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Text, useInput } from "ink";
import { log } from "@fenrir/logger";
import { firestoreClient } from "../lib/firestore.js";
import { useSelection } from "../context/SelectionContext.js";

// ─── Colors ──────────────────────────────────────────────────────────────────

const GOLD = "#c9920a";
const GREEN = "#22c55e";
const RED = "#ef4444";
const GRAY = "#6b6b80";
const DIM = "#3b3b4f";
const LAVENDER = "#9b9baa";
const BLUE = "#60a5fa";

// ─── Constants ────────────────────────────────────────────────────────────────

const LIST_HEIGHT = 18;
const NAME_TRUNCATE = 19;

// ─── Types ────────────────────────────────────────────────────────────────────

type HouseholdTier = "free" | "karl" | "trial";

export interface HouseholdListItem {
  id: string;
  name: string;
  memberCount: number;
  tier: HouseholdTier;
  createdAt: string | null;
  ownerId: string;
  inviteCode: string;
  inviteCodeExpiresAt: string | null;
  updatedAt: string | null;
}

export interface MemberRow {
  userId: string;
  email: string;
  role: string;
  cardCount: number;
  joinedAt: string | null;
}

export interface HouseholdDetail {
  household: HouseholdListItem;
  members: MemberRow[];
  cardTotal: number;
  activeCards: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeStatus: string | null;
  currentPeriodEnd: string | null;
  // Extended Stripe fields
  cancelAtPeriodEnd: boolean | null;
  stripePlanName: string | null;
  stripePeriodStart: string | null;
  stripePaymentLast4: string | null;
  stripePaymentBrand: string | null;
}

// ─── Pure helpers (unit-testable) ─────────────────────────────────────────────

/** Format ISO date string to "YYYY-MM-DD" */
export function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "—";
  }
}

/** Format ISO date string to "YYYY-MM-DD HH:MM" */
export function fmtDatetimeShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const date = d.toISOString().slice(0, 10);
    const time = d.toISOString().slice(11, 16);
    return `${date} ${time}`;
  } catch {
    return "—";
  }
}

/** Truncate a string to maxLen, appending "…" if truncated */
export function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + "\u2026";
}

/** Tier badge single character: K/T/F */
export function tierBadge(tier: HouseholdTier): string {
  if (tier === "karl")  return "K";
  if (tier === "trial") return "T";
  return "F";
}

/** Tier badge color */
export function tierColor(tier: HouseholdTier): string {
  if (tier === "karl")  return "yellow";
  if (tier === "trial") return "yellowBright";
  return GRAY;
}

/** Returns true if the invite code has expired */
export function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

/** Color for Stripe subscription status */
export function stripeStatusColor(status: string | null): string {
  if (!status) return GRAY;
  switch (status) {
    case "active":    return GREEN;
    case "trialing":  return "yellowBright";
    case "past_due":  return "yellow";
    case "canceled":  return RED;
    case "unpaid":    return RED;
    case "paused":    return BLUE;
    default:          return LAVENDER;
  }
}

/** Human-readable label for Stripe subscription status */
export function stripeStatusLabel(status: string | null): string {
  if (!status) return "none";
  switch (status) {
    case "active":    return "active";
    case "trialing":  return "trialing";
    case "past_due":  return "past_due";
    case "canceled":  return "canceled";
    case "unpaid":    return "unpaid";
    case "paused":    return "paused";
    default:          return status;
  }
}

// ─── Confirmation action type ─────────────────────────────────────────────────

type ConfirmAction =
  | { kind: "kick"; memberId: string; email: string }
  | { kind: "xfer"; memberId: string; email: string }
  | { kind: "regen-invite" }
  | { kind: "cancel-sub" }
  | { kind: "delete" };

// ─── HDetailRow — key/value row ───────────────────────────────────────────────

interface HDetailRowProps {
  label: string;
  value: string;
  valueColor?: string;
  dimValue?: boolean;
}

export function HDetailRow({ label, value, valueColor, dimValue }: HDetailRowProps): React.JSX.Element {
  return (
    <Box flexDirection="row" gap={1}>
      <Text color={GRAY}>{label.padEnd(18)}</Text>
      <Text color={valueColor ?? LAVENDER} dimColor={dimValue}>{value}</Text>
    </Box>
  );
}

// ─── HSectionTitle — section header ──────────────────────────────────────────

interface HSectionTitleProps {
  title: string;
}

export function HSectionTitle({ title }: HSectionTitleProps): React.JSX.Element {
  return (
    <Box marginTop={1}>
      <Text color={GOLD} bold>{`\u2500\u2500 ${title} `}</Text>
    </Box>
  );
}

// ─── HouseholdDetailView ──────────────────────────────────────────────────────

interface HouseholdDetailViewProps {
  detail: HouseholdDetail;
}

export function HouseholdDetailView({ detail }: HouseholdDetailViewProps): React.JSX.Element {
  const {
    household, members, cardTotal, activeCards,
    stripeCustomerId, stripeSubscriptionId, stripeStatus, currentPeriodEnd,
    cancelAtPeriodEnd, stripePlanName, stripePeriodStart, stripePaymentLast4, stripePaymentBrand,
  } = detail;

  const expired = isExpired(household.inviteCodeExpiresAt);
  const inviteDisplay = household.inviteCode
    ? `${household.inviteCode}${expired ? " (expired)" : ""}`
    : "—";

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1} overflowY="hidden">

      {/* Household Info */}
      <HSectionTitle title="Household Info" />
      <HDetailRow label="ID"           value={household.id} />
      <HDetailRow label="Name"         value={household.name} />
      <HDetailRow label="Tier"         value={household.tier.toUpperCase()} valueColor={tierColor(household.tier)} />
      <HDetailRow label="Owner ID"     value={household.ownerId} />
      <HDetailRow label="Created"      value={fmtDateShort(household.createdAt)} />
      <HDetailRow label="Updated"      value={fmtDateShort(household.updatedAt)} />
      <HDetailRow
        label="Invite Code"
        value={inviteDisplay}
        valueColor={expired ? RED : LAVENDER}
      />
      <HDetailRow label="Invite Expiry" value={fmtDatetimeShort(household.inviteCodeExpiresAt)} />

      {/* Members */}
      <HSectionTitle title="Members" />
      {members.length === 0 ? (
        <Text color={GRAY} dimColor>(no members)</Text>
      ) : (
        <Box flexDirection="column">
          {/* Header row */}
          <Box flexDirection="row" gap={1}>
            <Text color={DIM}>{"Email".padEnd(28)}</Text>
            <Text color={DIM}>{"Role".padEnd(7)}</Text>
            <Text color={DIM}>{"Cards".padEnd(7)}</Text>
            <Text color={DIM}>{"Joined"}</Text>
          </Box>
          {members.map((m) => (
            <Box key={m.userId} flexDirection="row" gap={1}>
              <Text color={LAVENDER}>{truncate(m.email, 28).padEnd(28)}</Text>
              <Text color={m.role === "owner" ? GOLD : LAVENDER}>{m.role.padEnd(7)}</Text>
              <Text color={LAVENDER}>{String(m.cardCount).padEnd(7)}</Text>
              <Text color={LAVENDER}>{fmtDateShort(m.joinedAt)}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Stripe subscription — always fetched; shows mismatch warning if tier != karl */}
      <HSectionTitle title="Stripe" />
      {!stripeSubscriptionId ? (
        <Text color={GRAY} dimColor>No Stripe subscription (Thrall / free tier)</Text>
      ) : (
        <>
          {household.tier !== "karl" && (
            <Text color="yellow">⚠ tier mismatch: household.tier="{household.tier}" but stripe subscription exists</Text>
          )}
          <HDetailRow
            label="Status"
            value={stripeStatusLabel(stripeStatus)}
            valueColor={stripeStatusColor(stripeStatus)}
          />
          {cancelAtPeriodEnd === true && (
            <HDetailRow label="  Cancel at end" value="yes" valueColor={RED} />
          )}
          <HDetailRow label="Plan"          value={stripePlanName ?? "—"} />
          <HDetailRow label="Customer ID"   value={stripeCustomerId ?? "—"} />
          <HDetailRow label="Sub ID"        value={stripeSubscriptionId ?? "—"} />
          <HDetailRow label="Period Start"  value={fmtDateShort(stripePeriodStart)} />
          <HDetailRow label="Period End"    value={fmtDateShort(currentPeriodEnd)} />
          <HDetailRow label="Renewal Date"  value={fmtDateShort(currentPeriodEnd)} />
          <HDetailRow
            label="Payment"
            value={
              stripePaymentLast4
                ? `${stripePaymentBrand ? stripePaymentBrand + " " : ""}••••${stripePaymentLast4}`
                : "—"
            }
          />
        </>
      )}

      {/* Card Summary */}
      <HSectionTitle title="Card Summary" />
      <Box flexDirection="row" gap={3}>
        <HDetailRow label="Active"  value={String(activeCards)} valueColor={GREEN} />
        <HDetailRow label="Total"   value={String(cardTotal)} />
      </Box>

      {/* Action hints */}
      <Box marginTop={1}>
        <Text color={DIM}>
          {`[a] adjust trial  [c] cards  [k] kick  [o] xfer owner  [i] regen invite  ${stripeSubscriptionId ? "[s] cancel sub  " : ""}[x] delete`}
        </Text>
      </Box>
    </Box>
  );
}

// ─── Confirmation bar ─────────────────────────────────────────────────────────

interface ConfirmBarProps {
  action: ConfirmAction;
  onConfirm: () => void;
  onCancel: () => void;
  /** Inline error shown when action failed — bar stays open for retry or cancel */
  error?: string | null;
}

function ConfirmBar({ action, onConfirm, onCancel, error = null }: ConfirmBarProps): React.JSX.Element {
  let label: string;
  switch (action.kind) {
    case "kick":        label = `Kick ${action.email}?`; break;
    case "xfer":        label = `Transfer ownership to ${action.email}?`; break;
    case "regen-invite": label = "Regenerate invite code?"; break;
    case "cancel-sub":  label = "Cancel Stripe subscription?"; break;
    case "delete":      label = "Delete this household (irreversible)?"; break;
  }

  useInput((input, key) => {
    if (input === "y") { onConfirm(); return; }
    if (input === "n" || key.escape) { onCancel(); return; }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderTop={true}
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      borderColor={RED}
      paddingX={2}
    >
      <Box flexDirection="row" gap={2}>
        <Text color={RED} bold>{label}</Text>
        <Text color={GREEN} bold>[y] yes</Text>
        <Text color={GOLD}>[n/Esc] cancel</Text>
      </Box>
      {error ? (
        <Text color={RED}>Error: {error}</Text>
      ) : null}
    </Box>
  );
}

// ─── Firestore loading helpers ────────────────────────────────────────────────

async function loadHouseholds(): Promise<HouseholdListItem[]> {
  log.debug("loadHouseholds called");
  if (!firestoreClient) {
    log.debug("loadHouseholds: no client");
    return [];
  }
  const snap = await firestoreClient.collection("households").get();
  const items: HouseholdListItem[] = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id:                   d.id,
      name:                 (data["name"] as string) || d.id,
      memberCount:          Array.isArray(data["memberIds"]) ? (data["memberIds"] as string[]).length : 0,
      tier:                 ((data["tier"] as string) || "free") as HouseholdTier,
      createdAt:            (data["createdAt"] as string | null) || null,
      ownerId:              (data["ownerId"] as string) || "",
      inviteCode:           (data["inviteCode"] as string) || "",
      inviteCodeExpiresAt:  (data["inviteCodeExpiresAt"] as string | null) || null,
      updatedAt:            (data["updatedAt"] as string | null) || null,
    };
  });
  items.sort((a, b) => a.name.localeCompare(b.name));
  log.debug("loadHouseholds returning", { count: items.length });
  return items;
}

async function loadHouseholdDetail(hh: HouseholdListItem): Promise<HouseholdDetail> {
  log.debug("loadHouseholdDetail called", { id: hh.id });
  if (!firestoreClient) {
    return { household: hh, members: [], cardTotal: 0, activeCards: 0, stripeCustomerId: null, stripeSubscriptionId: null, stripeStatus: null, currentPeriodEnd: null, cancelAtPeriodEnd: null, stripePlanName: null, stripePeriodStart: null, stripePaymentLast4: null, stripePaymentBrand: null };
  }

  // Members: query users by householdId
  const [membersSnap, cardsSnap] = await Promise.all([
    firestoreClient.collection("users").where("householdId", "==", hh.id).get(),
    firestoreClient.collection("households").doc(hh.id).collection("cards").get(),
  ]);

  // Build card counts per member
  const cardsByUser = new Map<string, number>();
  for (const c of cardsSnap.docs) {
    const cd = c.data() as Record<string, unknown>;
    const uid = (cd["userId"] as string) || (cd["ownerId"] as string) || "";
    if (uid) cardsByUser.set(uid, (cardsByUser.get(uid) ?? 0) + 1);
  }
  const activeCards = cardsSnap.docs.filter((c) => {
    const cd = c.data() as Record<string, unknown>;
    return !cd["deletedAt"];
  }).length;

  const members: MemberRow[] = membersSnap.docs.map((d) => {
    const ud = d.data() as Record<string, unknown>;
    return {
      userId:   d.id,
      email:    (ud["email"] as string) || d.id,
      role:     (ud["role"] as string) || "member",
      cardCount: cardsByUser.get(d.id) ?? 0,
      joinedAt: (ud["createdAt"] as string | null) || null,
    };
  });
  // Owner first
  members.sort((a, b) => {
    if (a.role === "owner") return -1;
    if (b.role === "owner") return 1;
    return a.email.localeCompare(b.email);
  });

  // Stripe info: read from /households/{id}/stripe/subscription subcollection
  let stripeCustomerId: string | null = null;
  let stripeSubscriptionId: string | null = null;
  let stripeStatus: string | null = null;
  let currentPeriodEnd: string | null = null;
  let cancelAtPeriodEnd: boolean | null = null;
  let stripePlanName: string | null = null;
  let stripePeriodStart: string | null = null;
  let stripePaymentLast4: string | null = null;
  let stripePaymentBrand: string | null = null;

  // Always fetch the stripe subcollection regardless of the household's tier field.
  // The top-level tier field may lag behind the stripe subcollection (e.g. if the
  // webhook wrote stripe data but failed to update the household doc). Fetching
  // unconditionally lets us detect and surface tier mismatches in the UI.
  try {
    const stripeSnap = await firestoreClient
      .collection("households")
      .doc(hh.id)
      .collection("stripe")
      .doc("subscription")
      .get();
    if (stripeSnap.exists) {
      const sd = stripeSnap.data() as Record<string, unknown>;
      stripeCustomerId     = (sd["stripeCustomerId"] as string | null) || null;
      stripeSubscriptionId = (sd["stripeSubscriptionId"] as string | null) || null;
      stripeStatus         = (sd["stripeStatus"] as string | null) || null;
      currentPeriodEnd     = (sd["currentPeriodEnd"] as string | null) || null;
      cancelAtPeriodEnd    = typeof sd["cancelAtPeriodEnd"] === "boolean" ? sd["cancelAtPeriodEnd"] : null;
    }
  } catch (err) {
    log.debug("loadHouseholdDetail: stripe subcollection fetch failed", err as Error);
  }

  // Live Stripe API fetch for plan name, period start, and payment method
  if (stripeSubscriptionId) {
    try {
      const { getStripeKey } = await import("../lib/stripe.js");
      const key = await getStripeKey();
      if (key) {
        const { createRequire } = await import("module");
        const require = createRequire(import.meta.url);
        const Stripe = (require("stripe") as { default: typeof import("stripe").default }).default;
        const stripe = new Stripe(key);
        const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
          expand: ["default_payment_method", "items.data.price.product"],
        });
        // Billing cycle anchor = effective period start
        if (sub.billing_cycle_anchor) {
          stripePeriodStart = new Date(sub.billing_cycle_anchor * 1000).toISOString();
        }
        // Plan name from first subscription item
        const item = sub.items?.data?.[0];
        if (item) {
          const price = item.price;
          const product = price?.product;
          const interval = price?.recurring?.interval;
          const intervalLabel = interval === "year" ? "annual" : interval === "month" ? "monthly" : (interval ?? "");
          if (product && typeof product === "object" && "name" in product) {
            stripePlanName = `${(product as { name: string }).name}${intervalLabel ? ` (${intervalLabel})` : ""}`;
          } else if (price?.nickname) {
            stripePlanName = `${price.nickname}${intervalLabel ? ` (${intervalLabel})` : ""}`;
          } else {
            stripePlanName = intervalLabel ? `Karl (${intervalLabel})` : "Karl";
          }
        }
        // Payment method
        const pm = sub.default_payment_method;
        if (pm && typeof pm === "object" && "card" in pm) {
          const card = (pm as { card?: { last4?: string; brand?: string } }).card;
          stripePaymentLast4 = card?.last4 ?? null;
          stripePaymentBrand = card?.brand ?? null;
        }
        log.debug("loadHouseholdDetail: stripe live fetch ok", { stripeSubscriptionId, stripePlanName });
      }
    } catch (err) {
      log.debug("loadHouseholdDetail: stripe live API fetch failed (non-fatal)", err as Error);
    }
  }

  log.debug("loadHouseholdDetail returning", { memberCount: members.length, cardTotal: cardsSnap.docs.length });
  return {
    household: hh,
    members,
    cardTotal: cardsSnap.docs.length,
    activeCards,
    stripeCustomerId,
    stripeSubscriptionId,
    stripeStatus,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    stripePlanName,
    stripePeriodStart,
    stripePaymentLast4,
    stripePaymentBrand,
  };
}

// ─── Action executors ─────────────────────────────────────────────────────────

async function executeAction(
  action: ConfirmAction,
  hh: HouseholdListItem,
  detail: HouseholdDetail | null,
  setStatus: (s: string) => void,
  reload: () => void,
  setConfirm: (c: ConfirmAction | null) => void,
  setConfirmError: (e: string | null) => void,
  returnTo?: () => void
): Promise<void> {
  log.debug("executeAction called", { kind: action.kind, hhId: hh.id });
  if (!firestoreClient) {
    setConfirmError("Firestore not connected");
    return;
  }

  try {
    switch (action.kind) {
      case "kick": {
        const hhRef = firestoreClient.collection("households").doc(hh.id);
        const hhSnap = await hhRef.get();
        if (hhSnap.exists) {
          const d = hhSnap.data() as Record<string, unknown>;
          const members = (d["memberIds"] as string[] | undefined) ?? [];
          await hhRef.update({ memberIds: members.filter((id) => id !== action.memberId) });
          // Success: close confirm bar, set status toast
          setConfirm(null);
          setConfirmError(null);
          setStatus(`Kicked ${action.email} from household`);
          reload();
        }
        break;
      }
      case "xfer": {
        await firestoreClient.collection("households").doc(hh.id).update({ ownerId: action.memberId });
        await firestoreClient.collection("users").doc(action.memberId).update({ role: "owner" });
        await firestoreClient.collection("users").doc(hh.ownerId).update({ role: "member" });
        // Success: close confirm bar, set status toast
        setConfirm(null);
        setConfirmError(null);
        setStatus(`Transferred ownership to ${action.email}`);
        reload();
        break;
      }
      case "regen-invite": {
        const newCode = generateRandomCode();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await firestoreClient.collection("households").doc(hh.id).update({
          inviteCode: newCode,
          inviteCodeExpiresAt: expiresAt,
        });
        // Success: close confirm bar, set status toast
        setConfirm(null);
        setConfirmError(null);
        setStatus(`New invite code: ${newCode}`);
        reload();
        break;
      }
      case "cancel-sub": {
        const subId = detail?.stripeSubscriptionId ?? null;
        if (!subId) {
          // No-op with explanation — treat as immediate close (no retry possible)
          setConfirm(null);
          setConfirmError(null);
          setStatus("No Stripe subscription ID — cannot cancel");
          return;
        }
        // Success: close confirm bar, set status toast
        setConfirm(null);
        setConfirmError(null);
        setStatus(`Sub ${subId} — cancel via Stripe dashboard or API`);
        break;
      }
      case "delete": {
        await firestoreClient.collection("households").doc(hh.id).delete();
        // Success: close confirm bar, navigate away, set status toast
        setConfirm(null);
        setConfirmError(null);
        setStatus(`Deleted household ${hh.name}`);
        // Navigate away first — entity no longer exists — then refresh the list
        returnTo?.();
        reload();
        break;
      }
    }
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    log.error("executeAction failed", err as Error);
    // Failure: keep confirm bar open, show error inline
    setConfirmError(msg);
  }
}

function generateRandomCode(): string {
  const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

// ─── HouseholdsTab ────────────────────────────────────────────────────────────

interface HouseholdsTabProps {
  cmdStatus: string | null;
  initialHouseholdId?: string | null;
  onCardsView?: (householdId: string, householdName: string) => void;
  onTrialAdjust?: () => void;
}

type LoadState = "idle" | "loading" | "loaded" | "error";

/**
 * HouseholdsTab — master-detail panel for Firestore households.
 * Left panel: scrollable list with tier badge + member count.
 * Right panel: full household detail with members, Stripe info.
 */
export function HouseholdsTab({ cmdStatus, initialHouseholdId, onCardsView, onTrialAdjust }: HouseholdsTabProps): React.JSX.Element {
  log.debug("HouseholdsTab render");

  const selection = useSelection();

  const [households, setHouseholds] = useState<HouseholdListItem[]>([]);
  const [loadState, setLoadState]   = useState<LoadState>("idle");
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [detail, setDetail]         = useState<HouseholdDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [status, setStatus]         = useState<string | null>(cmdStatus);
  const [confirm, setConfirm]       = useState<ConfirmAction | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Track whether the initialHouseholdId has been applied — reset on each mount
  const initialApplied = useRef(false);

  // Capture selected household ID at render time (before effects that clear context run)
  // so we can restore selection when returning from an overlay.
  const restoreHouseholdRef = useRef<string | null>(selection.selectedHouseholdId);

  // Reload function — exported for Ctrl+R
  const doLoad = useCallback(() => {
    log.debug("HouseholdsTab doLoad");
    setLoadState("loading");
    setStatus("Loading households\u2026");
    loadHouseholds()
      .then((items) => {
        setHouseholds(items);
        setLoadState("loaded");
        setStatus(null);
        log.debug("HouseholdsTab doLoad done", { count: items.length });
      })
      .catch((err: Error) => {
        setLoadState("error");
        setStatus(`Error loading households: ${err.message}`);
        log.error("HouseholdsTab doLoad error", err);
      });
  }, []);

  // Initial load
  useEffect(() => {
    doLoad();
  }, [doLoad]);

  // Auto-select a household when navigating from the Users tab via H key
  useEffect(() => {
    if (!initialHouseholdId || initialApplied.current) return;
    if (loadState !== "loaded" || households.length === 0) return;

    const idx = households.findIndex((h) => h.id === initialHouseholdId);
    if (idx >= 0) {
      log.debug("HouseholdsTab: auto-selecting household from H key", { id: initialHouseholdId, idx });
      setSelectedIdx(idx);
      setScrollOffset(Math.max(0, Math.min(idx, households.length - LIST_HEIGHT)));
    } else {
      log.debug("HouseholdsTab: initialHouseholdId not found in list", { id: initialHouseholdId });
      setStatus(`Household not found`);
    }
    initialApplied.current = true;
  }, [initialHouseholdId, loadState, households]);

  // Restore selection when returning from an overlay (non-destructive actions).
  // initialHouseholdId takes priority; this only fires once per mount.
  // If the previously selected household no longer exists (was deleted), findIndex
  // returns -1 and selection stays cleared — correct behaviour for delete.
  useEffect(() => {
    if (loadState !== "loaded" || households.length === 0) return;
    if (!restoreHouseholdRef.current) return;
    if (initialHouseholdId) return; // explicit jump takes priority
    const restoreId = restoreHouseholdRef.current;
    restoreHouseholdRef.current = null; // consume — only restore once
    const idx = households.findIndex((h) => h.id === restoreId);
    if (idx >= 0) {
      log.debug("HouseholdsTab: restoring selection", { householdId: restoreId, idx });
      setSelectedIdx(idx);
      setScrollOffset(Math.max(0, Math.min(idx, households.length - LIST_HEIGHT)));
    }
  }, [loadState, households, initialHouseholdId]);

  // Load detail when selection changes
  useEffect(() => {
    if (selectedIdx < 0 || selectedIdx >= households.length) {
      setDetail(null);
      selection.setSelectedHouseholdId(null);
      return;
    }
    const hh = households[selectedIdx];
    if (!hh) return;
    selection.setSelectedHouseholdId(hh.id);
    setDetailLoading(true);
    loadHouseholdDetail(hh)
      .then((d) => {
        setDetail(d);
        setDetailLoading(false);
        log.debug("HouseholdsTab detail loaded", { hhId: hh.id });
      })
      .catch((err: Error) => {
        setDetailLoading(false);
        setStatus(`Error loading detail: ${err.message}`);
        log.error("HouseholdsTab detail load error", err);
      });
  }, [selectedIdx, households]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard handler
  useInput((input, key) => {
    log.debug("HouseholdsTab useInput", { input, overlayActive: Boolean(confirm) });

    // Confirmation bar owns input
    if (confirm) return;

    if (key.upArrow) {
      setSelectedIdx((prev) => {
        const next = Math.max(0, prev <= 0 ? 0 : prev - 1);
        setScrollOffset((off) => next < off ? next : off);
        return next;
      });
      return;
    }

    if (key.downArrow) {
      setSelectedIdx((prev) => {
        const max = households.length - 1;
        const next = prev < 0 ? 0 : Math.min(max, prev + 1);
        setScrollOffset((off) => next >= off + LIST_HEIGHT ? next - LIST_HEIGHT + 1 : off);
        return next;
      });
      return;
    }

    if (key.return) {
      if (selectedIdx < 0 && households.length > 0) {
        setSelectedIdx(0);
      }
      return;
    }

    if (key.escape) {
      setSelectedIdx(-1);
      return;
    }

    if (key.ctrl && input === "r") {
      doLoad();
      return;
    }

    // Action shortcuts — require a selected household
    const hh = selectedIdx >= 0 ? households[selectedIdx] : null;
    if (!hh) return;

    if (input === "x") {
      setConfirm({ kind: "delete" });
      return;
    }

    if (input === "i") {
      setConfirm({ kind: "regen-invite" });
      return;
    }

    if (input === "s") {
      // Require a loaded Stripe subscription ID (tier field may lag — use sub ID as source of truth)
      if (!detail?.stripeSubscriptionId) {
        setStatus("[s] requires a household with an active Stripe subscription");
        return;
      }
      setConfirm({ kind: "cancel-sub" });
      return;
    }

    if (input === "k") {
      // Pick first non-owner member to kick
      if (!detail || detail.members.length <= 1) {
        setStatus("No non-owner members to kick");
        return;
      }
      const target = detail.members.find((m) => m.role !== "owner");
      if (!target) {
        setStatus("No non-owner members to kick");
        return;
      }
      setConfirm({ kind: "kick", memberId: target.userId, email: target.email });
      return;
    }

    if (input === "o") {
      if (!detail || detail.members.length <= 1) {
        setStatus("No members to transfer ownership to");
        return;
      }
      const target = detail.members.find((m) => m.role !== "owner");
      if (!target) {
        setStatus("No non-owner members available");
        return;
      }
      setConfirm({ kind: "xfer", memberId: target.userId, email: target.email });
      return;
    }

    if (input === "a") {
      onTrialAdjust?.();
      return;
    }

    if (input === "c") {
      onCardsView?.(hh.id, hh.name);
      return;
    }
  });

  // Execute confirmed action
  const handleConfirm = useCallback(() => {
    if (!confirm) return;
    const hh = selectedIdx >= 0 ? households[selectedIdx] : null;
    if (!hh) { setConfirm(null); return; }
    const pendingAction = confirm;
    // Don't pre-clear confirm here — executeAction controls it.
    // On success it calls setConfirm(null); on failure it calls setConfirmError(msg).
    setConfirmError(null); // clear any prior error when retrying
    // For delete, supply a returnTo that clears the selection — the entity won't exist after success.
    // Non-destructive actions (kick, xfer, etc.) preserve the current selection.
    const returnTo = pendingAction.kind === "delete" ? () => { setSelectedIdx(-1); } : undefined;
    void executeAction(pendingAction, hh, detail, setStatus, doLoad, setConfirm, setConfirmError, returnTo);
  }, [confirm, selectedIdx, households, detail, doLoad]);

  const handleCancel = useCallback(() => {
    setConfirm(null);
    setConfirmError(null);
  }, []);

  // Visible list slice
  const visibleItems = households.slice(scrollOffset, scrollOffset + LIST_HEIGHT);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Main row */}
      <Box flexDirection="row" flexGrow={1}>
        {/* Left panel — list */}
        <Box
          flexDirection="column"
          width={34}
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
            <Text color={GOLD} bold>Households</Text>
            {households.length > 0 && (
              <Text color={GRAY}>{" "}{households.length}</Text>
            )}
          </Box>

          {/* Loading / error states */}
          {loadState === "loading" && (
            <Box paddingX={1} paddingY={1}>
              <Text color={GRAY} dimColor>Loading\u2026</Text>
            </Box>
          )}
          {loadState === "error" && (
            <Box paddingX={1} paddingY={1}>
              <Text color={RED}>Load error</Text>
            </Box>
          )}

          {/* List rows */}
          {loadState === "loaded" && households.length === 0 && (
            <Box paddingX={1} paddingY={1}>
              <Text color={GRAY} dimColor>(no households)</Text>
            </Box>
          )}
          {loadState === "loaded" && visibleItems.map((hh, i) => {
            const absIdx = scrollOffset + i;
            const selected = absIdx === selectedIdx;
            return (
              <Box
                key={hh.id}
                paddingX={1}
                flexDirection="row"
              >
                <Text
                  backgroundColor={selected ? "#2a2a3e" : undefined}
                  color={selected ? "#e0e0ff" : LAVENDER}
                  bold={selected}
                >
                  {selected ? "\u276F " : "  "}
                  {truncate(hh.name, NAME_TRUNCATE).padEnd(NAME_TRUNCATE)}
                  {" "}
                </Text>
                <Text color={tierColor(hh.tier)} bold>{tierBadge(hh.tier)}</Text>
                <Text color={GRAY}>{` ${hh.memberCount}m`}</Text>
              </Box>
            );
          })}

          {/* Scroll indicator */}
          {loadState === "loaded" && households.length > LIST_HEIGHT && (
            <Box paddingX={1}>
              <Text color={DIM}>
                {`${scrollOffset + 1}\u2013${Math.min(scrollOffset + LIST_HEIGHT, households.length)}/${households.length}`}
              </Text>
            </Box>
          )}
        </Box>

        {/* Right panel — detail */}
        <Box flexDirection="column" flexGrow={1} overflowY="hidden">
          {selectedIdx < 0 || !detail ? (
            <Box
              flexDirection="column"
              flexGrow={1}
              alignItems="center"
              justifyContent="center"
            >
              <Text color={GOLD} bold>{"\u16C5"}</Text>
              <Box height={1} />
              {detailLoading ? (
                <Text color={GRAY}>Loading\u2026</Text>
              ) : (
                <>
                  <Text color={GRAY}>Select a household from the list</Text>
                  <Text color={DIM} dimColor>Use arrow keys to navigate</Text>
                </>
              )}
              {status ? (
                <Box marginTop={1}>
                  <Text color={LAVENDER}>{status}</Text>
                </Box>
              ) : null}
            </Box>
          ) : detailLoading ? (
            <Box flexGrow={1} alignItems="center" justifyContent="center">
              <Text color={GRAY}>Loading detail\u2026</Text>
            </Box>
          ) : (
            <HouseholdDetailView detail={detail} />
          )}
        </Box>
      </Box>

      {/* Status / confirmation row */}
      {confirm ? (
        <ConfirmBar
          action={confirm}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          error={confirmError}
        />
      ) : status && selectedIdx >= 0 ? (
        <Box paddingX={2} borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} borderColor={DIM}>
          <Text color={BLUE}>{status}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
