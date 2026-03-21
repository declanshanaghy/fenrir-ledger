import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { log } from "@fenrir/logger";
import { firestoreClient } from "../lib/firestore.js";
import { useSelection } from "../context/SelectionContext.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnrichedUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  tier: string;
  householdId: string | null;
  householdName: string | null;
  createdAt: string | null;
  lastSyncAt: string | null;
  syncCount: number | null;
  syncHealth: string | null;
}

interface UserDetail {
  household: { id: string; name: string; tier: string } | null;
  cloudSync: { lastSync: string | null; totalSyncs: number; health: string } | null;
  cardCount: { active: number; total: number } | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

type ActionMode = "none" | "delete_confirm" | "sub_cancel_confirm";

// ─── Constants ────────────────────────────────────────────────────────────────

const GRAY = "#6b6b80";
const LIST_HEIGHT = 18;
const EMAIL_MAX = 22;

// ─── Tier helpers ─────────────────────────────────────────────────────────────

const TIER_STYLES: Record<string, { label: string; bg: string | undefined; color: string }> = {
  karl:   { label: "KARL",   bg: "yellow",       color: "black" },
  trial:  { label: "TRIAL",  bg: "yellowBright", color: "black" },
  thrall: { label: "THRALL", bg: undefined,       color: "gray"  },
};

function getTierStyle(tier: string): { label: string; bg: string | undefined; color: string } {
  return TIER_STYLES[tier] ?? TIER_STYLES["thrall"]!;
}

// ─── TierBadge ────────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }): React.JSX.Element {
  const s = getTierStyle(tier);
  if (s.bg) {
    return <Text backgroundColor={s.bg} color={s.color}> {s.label} </Text>;
  }
  return <Text color={s.color}>[{s.label}]</Text>;
}

// ─── UserListRow ──────────────────────────────────────────────────────────────

function UserListRow({
  user,
  selected,
}: {
  user: EnrichedUser;
  selected: boolean;
}): React.JSX.Element {
  const email =
    user.email.length > EMAIL_MAX
      ? user.email.slice(0, EMAIL_MAX - 1) + "\u2026"
      : user.email.padEnd(EMAIL_MAX);
  return (
    <Box>
      <Text color={selected ? "cyan" : GRAY}>{selected ? "\u25B6 " : "  "}</Text>
      <Text color={selected ? "cyan" : undefined} bold={selected}>
        {email}{" "}
      </Text>
      <TierBadge tier={user.tier} />
    </Box>
  );
}

// ─── UserDetailPanel ──────────────────────────────────────────────────────────

interface UserDetailPanelProps {
  user: EnrichedUser;
  detail: UserDetail | null;
  actionMode: ActionMode;
  statusMsg: string | null;
}

function UserDetailPanel({
  user,
  detail,
  actionMode,
  statusMsg,
}: UserDetailPanelProps): React.JSX.Element {
  const joinedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString()
    : "Unknown";

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
      {/* Status message */}
      {statusMsg ? (
        <Box marginBottom={1}>
          <Text color="#9b9baa">{statusMsg}</Text>
        </Box>
      ) : null}

      {/* User ID — never truncated */}
      <Box>
        <Text color={GRAY}>{"ID:     "}</Text>
        <Text color="cyan">{user.id}</Text>
      </Box>

      {/* Email */}
      <Box>
        <Text color={GRAY}>{"Email:  "}</Text>
        <Text>{user.email}</Text>
      </Box>

      {/* Tier */}
      <Box>
        <Text color={GRAY}>{"Tier:   "}</Text>
        <TierBadge tier={user.tier} />
      </Box>

      {/* Role */}
      {user.role ? (
        <Box>
          <Text color={GRAY}>{"Role:   "}</Text>
          <Text>{user.role}</Text>
        </Box>
      ) : null}

      {/* Joined */}
      <Box>
        <Text color={GRAY}>{"Joined: "}</Text>
        <Text>{joinedDate}</Text>
      </Box>

      {/* Household */}
      <Box marginTop={1}>
        {detail?.household ? (
          <Box>
            <Text color={GRAY}>{"Household: "}</Text>
            <Text>{detail.household.name}</Text>
            <Text color={GRAY}> [h]</Text>
          </Box>
        ) : (
          <Box>
            <Text color={GRAY}>{"Household: "}</Text>
            <Text color={GRAY} dimColor>
              No household (solo user)
            </Text>
          </Box>
        )}
      </Box>

      {/* Cloud Sync */}
      <Box marginTop={1} flexDirection="column">
        <Text color={GRAY} bold>
          Cloud Sync
        </Text>
        {detail?.cloudSync ? (
          <Box flexDirection="column">
            <Box>
              <Text color={GRAY}>{"  Last:   "}</Text>
              <Text>{detail.cloudSync.lastSync ?? "N/A"}</Text>
            </Box>
            <Box>
              <Text color={GRAY}>{"  Total:  "}</Text>
              <Text>{String(detail.cloudSync.totalSyncs)}</Text>
            </Box>
            <Box>
              <Text color={GRAY}>{"  Health: "}</Text>
              <Text>{detail.cloudSync.health}</Text>
            </Box>
          </Box>
        ) : (
          <Text color={GRAY} dimColor>
            {"  N/A"}
          </Text>
        )}
      </Box>

      {/* Card count */}
      {detail?.cardCount ? (
        <Box marginTop={1}>
          <Text color={GRAY}>{"Cards: "}</Text>
          <Text>
            {String(detail.cardCount.active)} active /{" "}
            {String(detail.cardCount.total)} total
          </Text>
        </Box>
      ) : null}

      {/* Stripe — read from household's /stripe/subscription subcollection */}
      {detail?.stripeCustomerId ? (
        <Box marginTop={1} flexDirection="column">
          <Text color={GRAY} bold>
            Stripe
          </Text>
          <Box>
            <Text color={GRAY}>{"  Customer: "}</Text>
            <Text>{detail.stripeCustomerId}</Text>
          </Box>
        </Box>
      ) : null}

      {/* Divider */}
      <Box marginTop={1}>
        <Text color="#3b3b4f">{"\u2500".repeat(40)}</Text>
      </Box>

      {/* Action bar */}
      {actionMode === "none" ? (
        <Box>
          <Text color={GRAY}>
            {"[x] Delete"}
            {detail?.stripeSubscriptionId ? "  [s] Cancel sub" : ""}
            {detail?.household ? "  [h] Household" : ""}
          </Text>
        </Box>
      ) : actionMode === "delete_confirm" ? (
        <Box>
          <Text color="red">
            {"Delete "}{user.email}{"? [y] confirm  [Esc] cancel"}
          </Text>
        </Box>
      ) : actionMode === "sub_cancel_confirm" ? (
        <Box>
          <Text color="red">
            {"Cancel sub for "}{user.email}{"? [y] confirm  [Esc] cancel"}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}

// ─── UsersTab ─────────────────────────────────────────────────────────────────

interface UsersTabProps {
  cmdStatus: string | null;
  onJumpToHousehold?: (householdId: string) => void;
}

export function UsersTab({
  cmdStatus,
  onJumpToHousehold,
}: UsersTabProps): React.JSX.Element {
  log.debug("UsersTab render");

  const selection = useSelection();

  const [users, setUsers] = useState<EnrichedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>("none");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Load users on mount
  useEffect(() => {
    // Capture selected user ID synchronously (before effects that clear context run)
    // so we can restore the selection after loading if we're returning from an overlay.
    const restoreUserId = selection.selectedUserId;

    void (async () => {
      log.debug("UsersTab: loading users");
      setLoading(true);
      setError(null);
      try {
        if (!firestoreClient) {
          setError("Firestore not connected");
          setLoading(false);
          return;
        }
        const [usersSnap, householdsSnap] = await Promise.all([
          firestoreClient.collection("users").get(),
          firestoreClient.collection("households").get(),
        ]);

        // Build household tier map
        const hhMap = new Map<string, { tier: string; name: string }>();
        householdsSnap.docs.forEach((d) => {
          const h = d.data() as { tier?: string; name?: string };
          hhMap.set(d.id, { tier: h["tier"] || "thrall", name: h["name"] || "" });
        });

        // Enrich users with tier from household map
        const enriched: EnrichedUser[] = usersSnap.docs.map((d) => {
          const u = d.data() as {
            email?: string;
            displayName?: string;
            role?: string;
            householdId?: string;
            createdAt?: string;
            tier?: string;
            lastSyncAt?: string;
            syncCount?: number;
            syncHealth?: string;
          };
          const hh = u["householdId"] ? (hhMap.get(u["householdId"]) ?? null) : null;
          return {
            id: d.id,
            email: u["email"] || "",
            displayName: u["displayName"] || "",
            role: u["role"] || "",
            tier: hh ? hh.tier : (u["tier"] || "thrall"),
            householdId: u["householdId"] || null,
            householdName: hh ? hh.name : null,
            createdAt: u["createdAt"] || null,
            lastSyncAt: u["lastSyncAt"] || null,
            syncCount: u["syncCount"] ?? null,
            syncHealth: u["syncHealth"] || null,
          };
        });

        log.debug("UsersTab: users loaded", { count: enriched.length });
        setUsers(enriched);

        // Restore selection when returning from an overlay (non-destructive actions).
        // If the previously selected user no longer exists (was deleted), findIndex
        // returns -1 and selection stays cleared — correct behaviour for delete.
        if (restoreUserId) {
          const idx = enriched.findIndex((u) => u.id === restoreUserId);
          if (idx >= 0) {
            log.debug("UsersTab: restoring selection", { userId: restoreUserId, idx });
            setSelectedIdx(idx);
            setScrollOffset(Math.max(0, Math.min(idx, enriched.length - LIST_HEIGHT)));
          }
        }
      } catch (err) {
        log.error("UsersTab: load error", err as Error);
        setError((err as Error).message);
      }
      setLoading(false);
    })();
  }, []); // intentionally mount-only; restoreUserId captured synchronously above

  // Load detail when selection changes
  useEffect(() => {
    if (selectedIdx < 0 || selectedIdx >= users.length) {
      setDetail(null);
      return;
    }
    const user = users[selectedIdx];
    if (!user) return;

    void (async () => {
      log.debug("UsersTab: loading detail", { userId: user.id });
      try {
        if (!firestoreClient) return;

        let household: { id: string; name: string; tier: string } | null = null;
        let cloudSync: { lastSync: string | null; totalSyncs: number; health: string } | null = null;
        let cardCount: { active: number; total: number } | null = null;
        let stripeCustomerId: string | null = null;
        let stripeSubscriptionId: string | null = null;

        if (user.householdId) {
          const [hhSnap, cardsSnap, stripeSnap] = await Promise.all([
            firestoreClient.collection("households").doc(user.householdId).get(),
            firestoreClient
              .collection("households")
              .doc(user.householdId)
              .collection("cards")
              .get(),
            firestoreClient
              .collection("households")
              .doc(user.householdId)
              .collection("stripe")
              .doc("subscription")
              .get(),
          ]);

          if (hhSnap.exists) {
            const hh = hhSnap.data() as {
              name?: string;
              tier?: string;
              lastSyncAt?: string;
              syncCount?: number;
              syncHealth?: string;
            };
            household = {
              id: user.householdId,
              name: hh["name"] || "",
              tier: hh["tier"] || "thrall",
            };

            // Cloud sync: user doc primary, household fallback
            if (user.lastSyncAt != null) {
              cloudSync = {
                lastSync: user.lastSyncAt,
                totalSyncs: user.syncCount || 0,
                health: user.syncHealth || "unknown",
              };
            } else if (hh["lastSyncAt"] || hh["syncCount"] != null) {
              cloudSync = {
                lastSync: hh["lastSyncAt"] || null,
                totalSyncs: hh["syncCount"] || 0,
                health: hh["syncHealth"] || "unknown",
              };
            }

            const cards = cardsSnap.docs.map((d) => d.data() as { deletedAt?: string });
            const active = cards.filter((c) => !c["deletedAt"]).length;
            cardCount = { active, total: cards.length };
          }

          // Read Stripe from /households/{id}/stripe/subscription
          if (stripeSnap.exists) {
            const sd = stripeSnap.data() as Record<string, unknown>;
            stripeCustomerId     = (sd["stripeCustomerId"] as string | null) || null;
            stripeSubscriptionId = (sd["stripeSubscriptionId"] as string | null) || null;
          }
        } else if (user.lastSyncAt != null) {
          cloudSync = {
            lastSync: user.lastSyncAt,
            totalSyncs: user.syncCount || 0,
            health: user.syncHealth || "unknown",
          };
        }

        setDetail({ household, cloudSync, cardCount, stripeCustomerId, stripeSubscriptionId });
        log.debug("UsersTab: detail loaded", { userId: user.id });
      } catch (err) {
        log.error("UsersTab: detail load error", err as Error);
      }
    })();
  }, [selectedIdx, users]);

  // Sync selected user into SelectionContext so commands receive context.
  // Trials are now keyed by userId — no fingerprint lookup needed (issue #1658).
  useEffect(() => {
    if (selectedIdx < 0 || selectedIdx >= users.length) {
      selection.setSelectedUserId(null);
      return;
    }
    const user = users[selectedIdx];
    if (!user) return;
    selection.setSelectedUserId(user.id);
  }, [selectedIdx, users]); // selection setters are stable (useState) — safe to omit

  // Delete user
  const doDeleteUser = useCallback(
    async (user: EnrichedUser): Promise<void> => {
      if (!firestoreClient) return;
      try {
        if (user.householdId) {
          const hhSnap = await firestoreClient
            .collection("households")
            .doc(user.householdId)
            .get();
          if (hhSnap.exists) {
            const hh = hhSnap.data() as { memberIds?: string[] };
            const newMembers = (hh["memberIds"] || []).filter((id) => id !== user.id);
            await firestoreClient
              .collection("households")
              .doc(user.householdId)
              .update({ memberIds: newMembers });
          }
        }
        await firestoreClient.collection("users").doc(user.id).delete();
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
        setSelectedIdx(-1);
        // Success: close confirm bar, show status toast
        setActionMode("none");
        setStatusMsg(`Deleted ${user.id}`);
      } catch (err) {
        // Failure: keep confirm bar open, show error inline
        setStatusMsg(`Error: ${(err as Error).message}`);
      }
    },
    [] // setters are stable
  );

  useInput((input, key) => {
    // Delete confirmation
    if (actionMode === "delete_confirm") {
      if (key.escape || input === "n") {
        setActionMode("none");
        return;
      }
      if (input === "y") {
        // Don't close the bar here — doDeleteUser controls actionMode.
        // On success it clears actionMode; on failure it sets statusMsg and keeps bar open.
        const user = users[selectedIdx];
        if (user) void doDeleteUser(user);
      }
      return;
    }

    // Sub cancel confirmation
    if (actionMode === "sub_cancel_confirm") {
      if (key.escape || input === "n") {
        setActionMode("none");
        return;
      }
      if (input === "y") {
        setStatusMsg("Subscription cancellation not yet implemented");
        setActionMode("none");
      }
      return;
    }

    // Navigation
    if (key.upArrow) {
      const newIdx = Math.max(0, selectedIdx <= 0 ? 0 : selectedIdx - 1);
      const newScroll = newIdx < scrollOffset ? newIdx : scrollOffset;
      setSelectedIdx(newIdx);
      setScrollOffset(newScroll);
      return;
    }

    if (key.downArrow) {
      const maxIdx = users.length - 1;
      const newIdx = selectedIdx < 0 ? 0 : Math.min(maxIdx, selectedIdx + 1);
      const newScroll =
        newIdx >= scrollOffset + LIST_HEIGHT
          ? newIdx - LIST_HEIGHT + 1
          : scrollOffset;
      setSelectedIdx(newIdx);
      setScrollOffset(newScroll);
      return;
    }

    if (key.return) {
      if (selectedIdx < 0 && users.length > 0) setSelectedIdx(0);
      return;
    }

    if (key.escape) {
      setSelectedIdx(-1);
      setActionMode("none");
      return;
    }

    // Action shortcuts (only when a user is selected)
    if (selectedIdx >= 0) {
      const user = users[selectedIdx];
      if (!user) return;

      if (input === "x") {
        setActionMode("delete_confirm");
        return;
      }
      if (input === "s" && detail?.stripeSubscriptionId) {
        setActionMode("sub_cancel_confirm");
        return;
      }
      if (input === "h") {
        if (detail?.household && user.householdId) {
          onJumpToHousehold?.(user.householdId);
        } else {
          setStatusMsg("No household \u2014 this user is solo");
        }
        return;
      }
    }
  });

  const selectedUser =
    selectedIdx >= 0 && selectedIdx < users.length
      ? (users[selectedIdx] ?? null)
      : null;

  const visibleUsers = users.slice(scrollOffset, scrollOffset + LIST_HEIGHT);

  return (
    <Box flexDirection="row" flexGrow={1}>
      {/* Left panel — user list */}
      <Box
        flexDirection="column"
        width={36}
        borderStyle="single"
        borderRight={true}
        borderLeft={false}
        borderTop={false}
        borderBottom={false}
        borderColor="#1e1e2e"
      >
        {/* Header */}
        <Box
          paddingX={1}
          borderStyle="single"
          borderBottom={true}
          borderTop={false}
          borderLeft={false}
          borderRight={false}
          borderColor="#1e1e2e"
        >
          <Text color={GRAY}>
            {"Users ("}
            {String(users.length)}
            {")"}
          </Text>
        </Box>

        {/* User list */}
        <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={0}>
          {loading ? (
            <Text color={GRAY}>{"Loading\u2026"}</Text>
          ) : error ? (
            <Text color="red">{error}</Text>
          ) : users.length === 0 ? (
            <Text color={GRAY} dimColor>
              No users found
            </Text>
          ) : (
            visibleUsers.map((user, i) => (
              <UserListRow
                key={user.id}
                user={user}
                selected={scrollOffset + i === selectedIdx}
              />
            ))
          )}
        </Box>
      </Box>

      {/* Right panel — detail or empty state */}
      <Box flexDirection="column" flexGrow={1}>
        {selectedUser ? (
          <UserDetailPanel
            user={selectedUser}
            detail={detail}
            actionMode={actionMode}
            statusMsg={statusMsg ?? cmdStatus}
          />
        ) : (
          <Box
            flexDirection="column"
            flexGrow={1}
            alignItems="center"
            justifyContent="center"
            paddingX={2}
          >
            <Text color="#8a6408" bold>
              {"\u16C5"}
            </Text>
            <Box height={1} />
            <Text color={GRAY}>Select a user from the list</Text>
            <Text color="#3b3b4f" dimColor>
              Use arrow keys to navigate
            </Text>
            {(statusMsg ?? cmdStatus) ? (
              <Box marginTop={1}>
                <Text color="#9b9baa">{statusMsg ?? cmdStatus}</Text>
              </Box>
            ) : null}
          </Box>
        )}
      </Box>
    </Box>
  );
}
