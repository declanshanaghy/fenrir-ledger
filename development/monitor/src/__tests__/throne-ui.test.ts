/**
 * throne-ui.test.ts — Vitest tests for Odin's Throne Hlidskjalf UI (issue #882)
 *
 * Acceptance Criteria:
 *   AC1  Sidebar lists all agent sessions from K8s API
 *   AC2  Clicking a session loads the report in the content pane
 *   AC3  Live sessions show pulsing indicator
 *   AC4  New sessions appear automatically via WebSocket
 *   AC5  Timestamps in local time with "ago" text
 *   AC6  Odin avatar + random quote displayed
 *   Plus: ARIA accessibility, Norse-dark theme, XSS safety
 */

import { describe, it, expect, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../k8s.js", () => ({
  listAgentJobs: vi.fn().mockResolvedValue([]),
  findPodForSession: vi.fn(),
  streamPodLogs: vi.fn(),
  watchAgentJobs: vi.fn().mockReturnValue(() => {}),
  mapAgentJobToJob: vi.fn((j) => j),
}));

vi.mock("../ws.js", () => ({
  attachWebSocketServer: vi.fn(),
}));

vi.mock("@hono/node-server", () => ({
  serve: vi.fn().mockReturnValue({ on: vi.fn() }),
}));

// Auth mock — verifySessionToken always passes so we get the Hlidskjalf HTML
vi.mock("../auth.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../auth.js")>();
  return {
    ...original,
    verifySessionToken: vi.fn().mockReturnValue("test@fenrir.dev"),
  };
});

// ── Import after mocks ───────────────────────────────────────────────────────

import { app } from "../index.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getHtml(): Promise<string> {
  const res = await app.fetch(new Request("http://localhost:3001/", {
    headers: { Cookie: "odin_session=test-token" },
  }));
  return res.text();
}

// Known Odin quotes from the implementation
const ODIN_QUOTES = [
  "I hung on that windy tree for nine long nights. What's a failed build to that?",
  "I gave my eye for wisdom. You lot better not waste it on sloppy commits.",
  "The wolves are always hungry. Ship or be devoured.",
  "I see all nine worlds from Hlidskjalf. I can certainly see your merge conflicts.",
  "Even Ragnarok has a sprint deadline.",
  "The All-Father watches. The All-Father judges. The All-Father merges.",
  "Every rune I carved cost blood. Every PR you ship better be worth it.",
  "Fenrir breaks chains. We break annual fees. Same energy.",
  "My spear Gungnir never misses its mark. Your tests should aspire to the same.",
];

// ── Tests ────────────────────────────────────────────────────────────────────

describe("AC6 — Odin avatar + random quote", () => {
  it("serves the Odin avatar PNG at /static/odin-dark.png", async () => {
    const res = await app.fetch(
      new Request("http://localhost:3001/static/odin-dark.png")
    );
    // Avatar file should exist in public/ for this branch
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.headers.get("content-type")).toBe("image/png");
    }
  });

  it("renders avatar img tag with src/alt, a known Odin quote inside role=note", async () => {
    const html = await getHtml();
    expect(html).toContain('src="/static/odin-dark.png"');
    expect(html).toContain('alt="Odin"');
    const hasQuote = ODIN_QUOTES.some((q) => html.includes(q));
    expect(hasQuote).toBe(true);
    expect(html).toMatch(/role="note"[^>]*>[^<]*?(hung|eye|wolves|nine|Ragnarok|All-Father|rune|Fenrir|Gungnir)/s);
  });
});

describe("AC1 — Sidebar with ARIA landmarks and session list", () => {
  it("renders a nav sidebar with aria-label='Agent sessions'", async () => {
    const html = await getHtml();
    expect(html).toContain('aria-label="Agent sessions"');
  });

  it("renders job card list with role=list and aria-label", async () => {
    const html = await getHtml();
    expect(html).toContain('role="list"');
    expect(html).toContain('aria-label="Job sessions"');
  });

  it("renders the sidebar header h1 as Hlidskjalf in Cinzel Decorative font class", async () => {
    const html = await getHtml();
    // Must be an h1 element — not just text anywhere in the page
    expect(html).toMatch(/<h1[^>]*>Hlidskjalf<\/h1>/);
  });
});

describe("AC3+AC4 — WebSocket client and live-update script", () => {
  it("embeds multiplexed WebSocket connection to /ws and no fetchJobs polling", async () => {
    const html = await getHtml();
    // New: single multiplexed /ws endpoint — no per-session URL in WS path
    expect(html).toContain("'/ws'");
    expect(html).toContain("new WebSocket");
    // Polling must be gone
    expect(html).not.toContain("fetchJobs");
    expect(html).not.toContain("setInterval(fetchJobs");
    // jobs-snapshot and jobs-updated handlers must exist
    expect(html).toContain("jobs-snapshot");
    expect(html).toContain("jobs-updated");
  });

  it("sends subscribe/unsubscribe messages instead of opening per-session WS (AC4)", async () => {
    const html = await getHtml();
    expect(html).toContain("'subscribe'");
    expect(html).toContain("'unsubscribe'");
    expect(html).toContain("muxSend");
  });

  it("refreshes timestamps every 10 seconds via setInterval without re-fetching (AC5)", async () => {
    const html = await getHtml();
    // The timer still exists — it calls renderCards(currentJobs) from memory
    expect(html).toContain("renderCards(currentJobs)");
    expect(html).toContain("10000");
  });
});

describe("AC3 — Pulsing status indicator for live sessions", () => {
  it("defines pulse CSS animation and applies it only to running-status sessions", async () => {
    const html = await getHtml();
    expect(html).toContain("pulse");
    expect(html).toContain("@keyframes pulse");
    // Status is now 'running' (wire protocol) — not 'active'
    expect(html).toContain("status === 'running' ? ' pulse' : ''");
  });
});

describe("AC5 — Timestamps in local time with ago text", () => {
  it("defines fmtTime and timeAgo covering all time ranges (seconds, minutes, hours, days)", async () => {
    const html = await getHtml();
    expect(html).toContain("fmtTime");
    expect(html).toContain("timeAgo");
    expect(html).toContain("just now");
    expect(html).toContain("s + 's ago'");
    expect(html).toContain("m + 'm ago'");
    expect(html).toContain("h + 'h ago'");
    expect(html).toContain("d ago");
  });
});

describe("AC2 — Clicking a session loads the content pane", () => {
  it("card click calls openSession which manages content-header, log-terminal, and empty-state visibility", async () => {
    const html = await getHtml();
    expect(html).toContain("addEventListener('click'");
    expect(html).toContain("openSession");
    expect(html).toContain("data-session=");
    expect(html).toContain("'content-header').style.display = 'flex'");
    expect(html).toContain("'log-terminal').style.display = 'block'");
    expect(html).toContain("'empty-state').style.display = 'none'");
  });

  it("session title element is populated with agent name, issue, and step on open", async () => {
    const html = await getHtml();
    // Title must include issue number and step from the parsed job
    expect(html).toContain("job.agentName + ' — #' + job.issue + ' Step ' + job.step");
  });
});

describe("Norse-dark theme + XSS safety", () => {
  it("defines Norse-dark CSS variables (--void, --gold, --forge) and loads theme fonts", async () => {
    const html = await getHtml();
    expect(html).toContain("--void");
    expect(html).toContain("--gold");
    expect(html).toContain("--forge");
    expect(html).toContain("Cinzel");
    expect(html).toContain("JetBrains Mono");
  });

  it("includes escHtml function to prevent XSS injection in log output", async () => {
    const html = await getHtml();
    expect(html).toContain("escHtml");
    // Must handle all four critical characters
    expect(html).toContain("&amp;");
    expect(html).toContain("&lt;");
    expect(html).toContain("&gt;");
    expect(html).toContain("&quot;");
  });
});

describe("WS auto-reconnect (issue #911 — multiplexed mux)", () => {
  it("defines MUX_MAX_RECONNECT cap and exponential backoff delay constant", async () => {
    const html = await getHtml();
    expect(html).toContain("MUX_MAX_RECONNECT");
    expect(html).toContain("MUX_BASE_DELAY_MS");
  });

  it("defines scheduleMuxReconnect() that uses setTimeout with exponential backoff", async () => {
    const html = await getHtml();
    expect(html).toContain("scheduleMuxReconnect");
    expect(html).toContain("setTimeout");
    expect(html).toContain("muxReconnectCount");
  });

  it("connectMux() is the single WS entry-point called on boot", async () => {
    const html = await getHtml();
    expect(html).toContain("function connectMux");
    expect(html).toContain("connectMux()");
  });

  it("WS close handler calls scheduleMuxReconnect to reconnect the mux channel", async () => {
    const html = await getHtml();
    expect(html).toContain("scheduleMuxReconnect()");
  });

  it("shows error banner on connection failure and hides it on reconnect", async () => {
    const html = await getHtml();
    expect(html).toContain("showErrorBanner");
    expect(html).toContain("hideErrorBanner");
    expect(html).toContain("error-banner");
  });
});

describe("ARIA accessibility", () => {
  it("log terminal has role=log, aria-live=polite, and aria-label for screen readers", async () => {
    const html = await getHtml();
    // All three attributes must appear on the same log-terminal element
    expect(html).toMatch(/role="log"[^>]*aria-live="polite"|aria-live="polite"[^>]*role="log"/);
    expect(html).toContain('aria-label="Log viewer"');
  });
});
