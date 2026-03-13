/**
 * Pack Status Dashboard — Admin Console
 *
 * Five Norse-themed sections displaying pack status data:
 * 1. "The Wolves Hunt" — in-flight chains
 * 2. "The Norns Speak" — verdict summary
 * 3. "Chains Yet Forged" — up-next queue
 * 4. "Scrolls for Odin" — research awaiting review
 * 5. "The Howl Commands" — copy-paste commands
 *
 * Auto-refreshes every 30 seconds. Responsive at 375px min.
 *
 * @see #654
 */

"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import type {
  PackStatusResult,
  ChainAnalysis,
  UpNextItem,
  ActionItem,
} from "@/lib/admin/pack-status";

// ── Constants ─────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 30_000;
const OWNER = "declanshanaghy";
const REPO = "fenrir-ledger";

// ── Colors ────────────────────────────────────────────────────────────────────

const GOLD = "#c9920a";
const VOID = "#07070d";
const PARCHMENT = "#e8e4d4";
const STONE = "#3a3530";
const MUSPEL_RED = "#c94a0a";
const PASS_GREEN = "#2d9d4f";
const PENDING_AMBER = "#d4a520";

// ── Main Component ────────────────────────────────────────────────────────────

export function PackStatusDashboard() {
  const { data: session } = useAuth();
  const [data, setData] = useState<PackStatusResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    if (!session?.id_token) return;

    setIsRefreshing(true);
    try {
      const res = await fetch("/api/admin/pack-status", {
        headers: { Authorization: `Bearer ${session.id_token}` },
      });

      if (!res.ok) {
        const body = (await res.json()) as { error_description?: string };
        throw new Error(body.error_description ?? `HTTP ${res.status}`);
      }

      const result = (await res.json()) as PackStatusResult;
      setData(result);
      setError(null);
      setLastFetched(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch pack status");
    } finally {
      setIsRefreshing(false);
    }
  }, [session?.id_token]);

  // Initial fetch + auto-refresh
  useEffect(() => {
    fetchData();

    timerRef.current = setInterval(fetchData, REFRESH_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchData]);

  if (error && !data) {
    return (
      <div className="text-center py-12" aria-label="Pack status error">
        <p className="text-lg font-heading" style={{ color: MUSPEL_RED }}>
          The ravens return empty-handed.
        </p>
        <p className="text-sm opacity-60 mt-2">{error}</p>
        <button
          type="button"
          onClick={fetchData}
          className="mt-4 px-4 py-2 border rounded-sm text-sm font-heading transition-opacity hover:opacity-80"
          style={{ borderColor: STONE, color: GOLD, minHeight: 44 }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 animate-pulse" aria-label="Loading pack status">
        <p className="text-lg font-heading italic" style={{ color: GOLD }}>
          The wolves report...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl tracking-wide" style={{ color: GOLD }}>
            Pack Status
          </h1>
          {lastFetched && (
            <p className="text-xs opacity-40 mt-1">
              Last updated: {lastFetched.toLocaleTimeString()}
              {isRefreshing && (
                <span className="ml-2 animate-pulse" style={{ color: PENDING_AMBER }}>
                  refreshing...
                </span>
              )}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={fetchData}
          disabled={isRefreshing}
          className="self-start px-4 py-2 border rounded-sm text-sm font-heading tracking-wide transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ borderColor: STONE, color: GOLD, minHeight: 44 }}
          aria-label="Refresh pack status"
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {/* Rune divider */}
      <RuneDivider />

      {/* Section 1: The Wolves Hunt */}
      <WolvesHunt chains={data.in_flight} />

      <RuneDivider />

      {/* Section 2: The Norns Speak */}
      <NornsSpeak verdicts={data.verdicts} chains={data.in_flight} />

      <RuneDivider />

      {/* Section 3: Chains Yet Forged */}
      <ChainsYetForged items={data.up_next} />

      <RuneDivider />

      {/* Section 4: Scrolls for Odin */}
      <ScrollsForOdin chains={data.in_flight} />

      <RuneDivider />

      {/* Section 5: The Howl Commands */}
      <HowlCommands actions={data.actions} />
    </div>
  );
}

// ── Section 1: The Wolves Hunt ────────────────────────────────────────────────

function WolvesHunt({ chains }: { chains: ChainAnalysis[] }) {
  if (chains.length === 0) {
    return (
      <Section title="The Wolves Hunt" subtitle="In-flight chains">
        <EmptyState message="No wolves in the field." />
      </Section>
    );
  }

  return (
    <Section title="The Wolves Hunt" subtitle="In-flight chains">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm" aria-label="In-flight chains table">
          <thead>
            <tr style={{ borderBottom: `1px solid ${STONE}` }}>
              <Th>Issue</Th>
              <Th>Title</Th>
              <Th>Type</Th>
              <Th>Chain Position</Th>
              <Th>PR</Th>
              <Th>CI</Th>
              <Th>Verdict</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {chains.map((chain) => (
              <tr
                key={chain.issue}
                style={{
                  borderBottom: `1px solid ${STONE}`,
                  borderLeft: `3px solid ${
                    chain.verdict === "FAIL"
                      ? MUSPEL_RED
                      : chain.verdict === "PASS"
                        ? PASS_GREEN
                        : GOLD
                  }`,
                }}
              >
                <Td>
                  <IssueLink num={chain.issue} />
                </Td>
                <Td>{chain.title}</Td>
                <Td><TypeBadge type={chain.type} /></Td>
                <Td>
                  <ChainPipeline chain={chain.chain} position={chain.position} />
                </Td>
                <Td>
                  {chain.pr ? <PrLink num={chain.pr} /> : <span className="opacity-40">—</span>}
                </Td>
                <Td><CIBadge status={chain.ci} /></Td>
                <Td><VerdictBadge verdict={chain.verdict} /></Td>
                <Td>
                  {chain.command ? (
                    <CopyButton text={chain.command} label={`Copy command for #${chain.issue}`} />
                  ) : (
                    <span className="opacity-40">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {chains.map((chain) => (
          <div
            key={chain.issue}
            className="p-4 rounded-sm space-y-2"
            style={{
              backgroundColor: "#0d0d1a",
              border: `1px solid ${STONE}`,
              borderLeft: `3px solid ${
                chain.verdict === "FAIL"
                  ? MUSPEL_RED
                  : chain.verdict === "PASS"
                    ? PASS_GREEN
                    : GOLD
              }`,
            }}
            aria-label={`Chain: #${chain.issue} ${chain.title}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <IssueLink num={chain.issue} />
                <span className="ml-2 text-sm">{chain.title}</span>
              </div>
              <VerdictBadge verdict={chain.verdict} />
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <TypeBadge type={chain.type} />
              <CIBadge status={chain.ci} />
              {chain.pr && <PrLink num={chain.pr} />}
            </div>
            <p className="text-xs opacity-60">{chain.position}</p>
            {chain.command && (
              <CopyButton text={chain.command} label={`Copy command for #${chain.issue}`} />
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Section 2: The Norns Speak ────────────────────────────────────────────────

function NornsSpeak({
  verdicts,
  chains,
}: {
  verdicts: PackStatusResult["verdicts"];
  chains: ChainAnalysis[];
}) {
  const groups = [
    { label: "PASS — Ready to Merge", issues: verdicts.pass, color: PASS_GREEN, icon: "ᚱ" },
    { label: "FAIL — Needs Attention", issues: verdicts.fail, color: MUSPEL_RED, icon: "ᛏ" },
    { label: "Awaiting Loki", issues: verdicts.awaiting_loki, color: PENDING_AMBER, icon: "ᚺ" },
    { label: "Awaiting Decko", issues: verdicts.awaiting_decko, color: PENDING_AMBER, icon: "ᚠ" },
    { label: "No Response", issues: verdicts.no_response, color: "#6b7280", icon: "ᚦ" },
    { label: "Research Review", issues: verdicts.research_review, color: GOLD, icon: "ᛟ" },
  ];

  const hasAny = groups.some((g) => g.issues.length > 0);

  return (
    <Section title="The Norns Speak" subtitle="Verdict summary">
      {!hasAny ? (
        <EmptyState message="The Norns are silent — no verdicts to report." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups
            .filter((g) => g.issues.length > 0)
            .map((group) => (
              <div
                key={group.label}
                className="p-4 rounded-sm"
                style={{
                  backgroundColor: "#0d0d1a",
                  border: `1px solid ${STONE}`,
                  borderTop: `3px solid ${group.color}`,
                }}
                aria-label={`${group.label}: ${group.issues.length} issues`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ color: group.color }} aria-hidden="true">
                    {group.icon}
                  </span>
                  <span className="text-sm font-heading" style={{ color: group.color }}>
                    {group.label}
                  </span>
                  <span
                    className="ml-auto text-xs px-2 py-0.5 rounded-sm"
                    style={{ backgroundColor: group.color + "20", color: group.color }}
                  >
                    {group.issues.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {group.issues.map((num) => {
                    const chain = chains.find((c) => c.issue === num);
                    return (
                      <IssueLink
                        key={num}
                        num={num}
                        title={chain?.title}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}
    </Section>
  );
}

// ── Section 3: Chains Yet Forged ──────────────────────────────────────────────

function ChainsYetForged({ items }: { items: UpNextItem[] }) {
  if (items.length === 0) {
    return (
      <Section title="Chains Yet Forged" subtitle="Up-next queue">
        <EmptyState message="The queue rests — no chains await." />
      </Section>
    );
  }

  return (
    <Section title="Chains Yet Forged" subtitle="Up-next queue">
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.num}
            className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 p-3 rounded-sm"
            style={{
              backgroundColor: "#0d0d1a",
              border: `1px solid ${STONE}`,
            }}
            aria-label={`Up next: #${item.num} ${item.title}`}
          >
            <IssueLink num={item.num} />
            <span className="flex-1 text-sm">{item.title}</span>
            <div className="flex flex-wrap gap-2">
              <PriorityBadge priority={item.priority} />
              <TypeBadge type={item.type} />
            </div>
            <span className="text-xs opacity-40">{item.chain}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Section 4: Scrolls for Odin ───────────────────────────────────────────────

function ScrollsForOdin({ chains }: { chains: ChainAnalysis[] }) {
  const research = chains.filter((c) => c.next_action === "review");

  if (research.length === 0) {
    return (
      <Section title="Scrolls for Odin" subtitle="Research awaiting review">
        <EmptyState message="No scrolls await the Allfather's eye." />
      </Section>
    );
  }

  return (
    <Section title="Scrolls for Odin" subtitle="Research awaiting review">
      <div className="space-y-2">
        {research.map((chain) => (
          <div
            key={chain.issue}
            className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 p-3 rounded-sm"
            style={{
              backgroundColor: "#0d0d1a",
              border: `1px solid ${STONE}`,
              borderLeft: `3px solid ${GOLD}`,
            }}
            aria-label={`Research: #${chain.issue} ${chain.title}`}
          >
            <IssueLink num={chain.issue} />
            <span className="flex-1 text-sm">{chain.title}</span>
            <span className="text-xs opacity-60">{chain.position}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Section 5: The Howl Commands ──────────────────────────────────────────────

function HowlCommands({ actions }: { actions: ActionItem[] }) {
  const actionable = actions.filter((a) => a.command.length > 0);

  if (actionable.length === 0) {
    return (
      <Section title="The Howl Commands" subtitle="Copy-paste commands">
        <EmptyState message="No commands to howl — the pack awaits." />
      </Section>
    );
  }

  // Group: merges first, then dispatches, then waits
  const merges = actionable.filter((a) => a.reason.includes("ready to merge"));
  const dispatches = actionable.filter(
    (a) => !a.reason.includes("ready to merge") && !a.reason.includes("awaiting") && !a.reason.includes("wait"),
  );
  const waits = actionable.filter(
    (a) => a.reason.includes("awaiting") || a.reason.includes("wait") || a.reason.includes("running"),
  );

  const groups = [
    { label: "Ready to Merge", items: merges },
    { label: "Dispatch / Resume", items: dispatches },
    { label: "Awaiting / In Progress", items: waits },
  ].filter((g) => g.items.length > 0);

  return (
    <Section title="The Howl Commands" subtitle="Copy-paste commands">
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.label}>
            <h4
              className="text-xs uppercase tracking-widest mb-2 font-heading"
              style={{ color: GOLD + "80" }}
            >
              {group.label}
            </h4>
            <div className="space-y-2">
              {group.items.map((action) => (
                <div
                  key={action.issue}
                  className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 p-3 rounded-sm"
                  style={{
                    backgroundColor: "#0d0d1a",
                    border: `1px solid ${STONE}`,
                  }}
                  aria-label={`Command for #${action.issue}`}
                >
                  <IssueLink num={action.issue} />
                  <code
                    className="flex-1 text-xs px-2 py-1 rounded-sm font-mono break-all"
                    style={{ backgroundColor: VOID, color: PARCHMENT }}
                  >
                    {action.command}
                  </code>
                  <span className="text-xs opacity-40 shrink-0">{action.reason}</span>
                  <CopyButton text={action.command} label={`Copy command for #${action.issue}`} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title}>
      <div className="mb-4">
        <h2 className="font-display text-xl tracking-wide" style={{ color: GOLD }}>
          {title}
        </h2>
        <p className="text-xs opacity-40">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function RuneDivider() {
  return (
    <div className="flex items-center gap-3 opacity-20" aria-hidden="true">
      <div className="flex-1 h-px" style={{ backgroundColor: STONE }} />
      <span style={{ color: GOLD }}>ᛟ</span>
      <div className="flex-1 h-px" style={{ backgroundColor: STONE }} />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-sm italic opacity-40 py-4 text-center">{message}</p>
  );
}

function IssueLink({ num, title }: { num: number; title?: string | undefined }) {
  return (
    <a
      href={`https://github.com/${OWNER}/${REPO}/issues/${num}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm font-mono hover:underline shrink-0"
      style={{ color: GOLD }}
      title={title ?? `Issue #${num}`}
    >
      #{num}
    </a>
  );
}

function PrLink({ num }: { num: number }) {
  return (
    <a
      href={`https://github.com/${OWNER}/${REPO}/pull/${num}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs font-mono hover:underline"
      style={{ color: PENDING_AMBER }}
    >
      PR #{num}
    </a>
  );
}

function TypeBadge({ type }: { type: string }) {
  const icons: Record<string, string> = {
    bug: "🐛",
    security: "🛡",
    ux: "🎨",
    enhancement: "✨",
    research: "📜",
    unknown: "❓",
  };

  return (
    <span
      className="text-xs px-2 py-0.5 rounded-sm"
      style={{ backgroundColor: STONE, color: PARCHMENT }}
    >
      {icons[type] ?? "❓"} {type}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    critical: MUSPEL_RED,
    high: "#e67e22",
    normal: PENDING_AMBER,
    low: "#6b7280",
  };
  const color = colors[priority] ?? PENDING_AMBER;

  return (
    <span
      className="text-xs px-2 py-0.5 rounded-sm font-heading"
      style={{ backgroundColor: color + "20", color, border: `1px solid ${color}40` }}
    >
      {priority}
    </span>
  );
}

function CIBadge({ status }: { status: string | null }) {
  if (!status) return <span className="opacity-40 text-xs">—</span>;

  const config: Record<string, { color: string; label: string }> = {
    pass: { color: PASS_GREEN, label: "CI Pass" },
    fail: { color: MUSPEL_RED, label: "CI Fail" },
    pending: { color: PENDING_AMBER, label: "CI Pending" },
    unknown: { color: "#6b7280", label: "CI Unknown" },
  };

  const { color, label } = config[status] ?? config.unknown!;

  return (
    <span
      className="text-xs px-2 py-0.5 rounded-sm"
      style={{ backgroundColor: color + "20", color }}
      aria-label={label}
    >
      ●{" "}{status}
    </span>
  );
}

function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) {
    return (
      <span
        className="text-xs px-2 py-0.5 rounded-sm animate-pulse"
        style={{ backgroundColor: PENDING_AMBER + "20", color: PENDING_AMBER }}
      >
        ◌ awaiting
      </span>
    );
  }

  const isPass = verdict === "PASS";
  const color = isPass ? PASS_GREEN : MUSPEL_RED;

  return (
    <span
      className="text-xs px-2 py-0.5 rounded-sm font-heading"
      style={{ backgroundColor: color + "20", color }}
      aria-label={`Verdict: ${verdict}`}
    >
      {isPass ? "ᚱ" : "ᛏ"} {verdict}
    </span>
  );
}

function ChainPipeline({ chain, position }: { chain: string; position: string }) {
  // Parse chain string like "Luna → FiremanDecko → Loki"
  const steps = chain.split(" → ").map((s) => s.trim());

  // Determine active step from position
  const activeStep = steps.findIndex((step) =>
    position.toLowerCase().includes(step.toLowerCase()),
  );

  return (
    <div className="flex items-center gap-1 text-xs flex-wrap">
      {steps.map((step, i) => (
        <span key={step} className="flex items-center gap-1">
          <span
            className="px-1.5 py-0.5 rounded-sm"
            style={{
              backgroundColor: i === activeStep ? GOLD + "30" : "transparent",
              color: i === activeStep ? GOLD : PARCHMENT + "60",
              border: i === activeStep ? `1px solid ${GOLD}40` : "1px solid transparent",
            }}
          >
            {step}
          </span>
          {i < steps.length - 1 && (
            <span className="opacity-30" aria-hidden="true">→</span>
          )}
        </span>
      ))}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => { setCopied(false); }, 2000);
    } catch {
      // Fallback: select the text
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 px-3 py-1.5 border rounded-sm text-xs font-heading transition-colors hover:opacity-80"
      style={{
        borderColor: copied ? PASS_GREEN : STONE,
        color: copied ? PASS_GREEN : GOLD,
        backgroundColor: "transparent",
        minHeight: 44,
        minWidth: 44,
      }}
      aria-label={label}
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

// ── Table helpers ─────────────────────────────────────────────────────────────

function Th({ children }: { children: ReactNode }) {
  return (
    <th
      className="text-left text-xs font-heading uppercase tracking-wider px-3 py-2 opacity-60"
      style={{ color: GOLD }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: ReactNode }) {
  return (
    <td className="px-3 py-3 text-sm align-top">
      {children}
    </td>
  );
}
